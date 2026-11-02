defmodule Grange.FarmStore do
  @moduledoc """
  Owns every player's field, barn inventory, fences, and movable props, plus
  the lobby listings.

  State is persisted in the database, so farms survive restarts. Each
  successful change broadcasts the affected farm and the lobby summaries over
  PubSub. Tile timing uses wall-clock milliseconds (`System.system_time/1`) so
  crops keep ripening across restarts.

  Produce lives in the barn (`barn_items`); the legacy `farms.tomatoes` column
  is no longer written and is only kept for backwards compatibility.
  """

  import Ecto.Query

  alias Grange.{
    Barn,
    BarnItem,
    Crops,
    Farm,
    FarmAction,
    FarmBootstrap,
    FarmFence,
    FarmFences,
    FarmGate,
    FarmGates,
    FarmProp,
    FarmProps,
    FarmRecord,
    FarmView,
    Inventory,
    InventoryItem,
    InventorySlot,
    Land,
    PlayerItem,
    Repo,
    Tile
  }

  @lobby_topic "lobby"
  @orthogonal [{0, -1}, {0, 1}, {1, 0}, {-1, 0}]
  @growing [:planted, :watered, :ready]

  @spec ensure(String.t()) :: map()
  def ensure(owner) do
    case FarmBootstrap.ensure(owner) do
      :created -> broadcast_change(owner)
      :existing -> :ok
    end

    Inventory.ensure(owner)
    view(owner)
  end

  def has_farm?(owner), do: Repo.exists?(from(f in FarmRecord, where: f.owner == ^owner))

  @spec view(String.t()) :: map() | nil
  def view(owner) do
    case Repo.get(FarmRecord, owner) do
      nil ->
        nil

      farm ->
        barn = Barn.map(owner)

        %{
          owner: owner,
          tiles: FarmView.tiles(owner),
          barn: barn,
          tomatoes: Map.get(barn, "tomato", 0),
          fences: FarmFences.list(owner),
          fence_count: farm.fence_count,
          gates: FarmGates.list(owner),
          gate_count: farm.gate_count,
          animals: farm.animals,
          land_level: farm.land_level,
          prop_overrides: FarmProps.overrides(owner),
          prop_inventory: FarmProps.inventory(owner)
        }
    end
  end

  @spec summaries() :: [map()]
  def summaries do
    Repo.all(from(f in FarmRecord, preload: [:tiles, :barn_items], order_by: f.owner))
    |> Enum.map(&FarmView.summary/1)
  end

  @spec action(String.t(), map()) :: {:ok, map()} | {:error, String.t()}
  def action(owner, action) do
    case normalize(action) do
      {:ok, kind, x, y, opts} -> run(owner, kind, x, y, opts)
      :error -> {:error, "invalid action"}
    end
  end

  @spec prop_action(String.t(), map()) :: {:ok, map()} | {:error, String.t()}
  def prop_action(owner, action) do
    with {:ok, :ok} <- FarmProps.action(owner, action), do: refresh(owner)
  end

  @doc "Broadcasts the farm and returns its refreshed view."
  @spec refresh(String.t()) :: {:ok, map()}
  def refresh(owner) do
    broadcast_change(owner)
    {:ok, view(owner)}
  end

  @spec sell(String.t(), String.t(), integer()) :: {:ok, map()} | {:error, String.t()}
  def sell(owner, item, count) when is_binary(item) and is_integer(count) and count > 0 do
    with :ok <- Barn.sell(owner, item, count), do: refresh(owner)
  end

  def sell(_owner, _item, _count), do: {:error, "invalid sale"}

  @spec tick(integer()) :: [String.t()]
  def tick(now \\ System.system_time(:millisecond)) do
    ready =
      Repo.all(
        from(t in Tile,
          where: t.state == :watered and not is_nil(t.ready_at) and t.ready_at <= ^now
        )
      )

    owners = ready |> Enum.map(& &1.owner) |> Enum.uniq() |> Enum.sort()
    Enum.each(ready, &Repo.update!(Ecto.Changeset.change(&1, state: :ready)))
    Enum.each(owners, &broadcast_farm/1)
    if owners != [], do: broadcast_lobby()
    owners
  end

  @spec reset() :: :ok
  def reset do
    # Child tables first so foreign keys are satisfied, then the farms.
    [
      Tile,
      BarnItem,
      PlayerItem,
      InventoryItem,
      InventorySlot,
      FarmFence,
      FarmGate,
      FarmProp,
      FarmRecord
    ]
    |> Enum.each(&Repo.delete_all/1)

    :ok
  end

  defp run(owner, kind, x, y, opts) do
    with :ok <- Land.check(owner, kind, x, y, true),
         do: apply_action(owner, kind, x, y, opts)
  end

  defp apply_action(owner, kind, x, y, opts) do
    case Repo.transaction(fn -> mutate_or_rollback(owner, kind, x, y, opts) end) do
      {:ok, {:drops, drops}} ->
        broadcast_change(owner)
        {:ok, Map.put(view(owner), :drops, drops)}

      {:ok, :ok} ->
        refresh(owner)

      {:error, reason} when is_binary(reason) ->
        {:error, reason}

      {:error, _reason} ->
        {:error, "could not update farm"}
    end
  end

  defp mutate_or_rollback(owner, kind, x, y, opts) do
    case mutate(owner, kind, x, y, opts) do
      {:error, reason} -> Repo.rollback(reason)
      result -> result
    end
  end

  defp mutate(owner, :till, x, y, _opts) do
    case tile_at(owner, x, y) do
      nil ->
        %Tile{}
        |> Tile.changeset(%{owner: owner, x: x, y: y, state: :tilled, crop: "tomato"})
        |> Repo.insert!()

        :ok

      _tile ->
        {:error, "tile is already tilled"}
    end
  end

  defp mutate(owner, :place_fence, x, y, _opts),
    do: reorient_gates(owner, FarmFences.place(owner, x, y))

  defp mutate(owner, :remove_fence, x, y, _opts),
    do: reorient_gates(owner, FarmFences.remove(owner, x, y))

  defp mutate(owner, :place_gate, x, y, _opts),
    do: reorient_gates(owner, FarmGates.place(owner, x, y))

  defp mutate(owner, :remove_gate, x, y, _opts),
    do: reorient_gates(owner, FarmGates.remove(owner, x, y))

  defp mutate(owner, kind, x, y, opts) do
    case tile_at(owner, x, y) do
      nil -> {:error, "no tilled tile here"}
      tile -> transform(owner, tile, kind, opts)
    end
  end

  defp reorient_gates(owner, :ok), do: FarmGates.reorient(owner)
  defp reorient_gates(_owner, error), do: error

  defp transform(owner, tile, :plant, opts) do
    crop = opts[:crop] || "tomato"
    total = Crops.get(crop)[:harvests] || 1
    seed = Inventory.seed_item(crop)

    with :ok <- Inventory.take(owner, seed, 1),
         {:ok, planted} <- Farm.plant(tile, now_ms()) do
      update_tile(tile, %{planted | crop: Crops.encode_crop(crop, total)})
    end
  end

  defp transform(owner, tile, :water, _opts) do
    {crop_id, _remaining} = Crops.parse_crop(tile.crop)
    speed = Crops.growth_speed_multiplier(crop_id, neighbor_families(owner, tile.x, tile.y))

    with {:ok, watered} <- Farm.water(tile, now_ms(), Farm.grow_ms() / speed) do
      update_tile(tile, watered)
    end
  end

  defp transform(owner, tile, :harvest, opts) do
    {crop_id, remaining} = Crops.parse_crop(tile.crop)

    cond do
      tile.state != :ready ->
        {:error, "tile is not ready"}

      Crops.can_harvest?(crop_id, opts[:tool]) ->
        Barn.add(owner, crop_id, 1)
        families = neighbor_families(owner, tile.x, tile.y)
        drops = FarmAction.mutation_drops(crop_id, tile.state, families, opts, :rand.uniform())
        Enum.each(drops, &Inventory.add(owner, &1, 1))
        regrow_or_clear(owner, tile, crop_id, remaining)
        {:drops, drops}

      true ->
        {:error, "#{Crops.get(crop_id).name} needs a scythe"}
    end
  end

  defp regrow_or_clear(owner, tile, crop_id, remaining) do
    crop_def = Crops.get(crop_id)

    if remaining > 1 and crop_def[:regrow_stage] >= 0 do
      speed = Crops.growth_speed_multiplier(crop_id, neighbor_families(owner, tile.x, tile.y))
      now = now_ms()

      tile
      |> Ecto.Changeset.change(%{
        state: :watered,
        crop: Crops.encode_crop(crop_id, remaining - 1),
        watered_at: now,
        ready_at: now + round(Farm.grow_ms() / speed)
      })
      |> Repo.update!()

      :ok
    else
      case Farm.harvest(tile) do
        {:ok, harvested} -> update_tile(tile, harvested)
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp update_tile(tile, changed) do
    tile
    |> Ecto.Changeset.change(%{
      state: changed.state,
      crop: changed.crop,
      planted_at: changed.planted_at,
      watered_at: changed.watered_at,
      ready_at: changed.ready_at
    })
    |> Repo.update!()

    :ok
  end

  defp neighbor_families(owner, x, y) do
    for {dx, dy} <- @orthogonal,
        tile = tile_at(owner, x + dx, y + dy),
        tile != nil,
        tile.state in @growing do
      {crop_id, _remaining} = Crops.parse_crop(tile.crop)
      Crops.family(crop_id)
    end
  end

  @kinds %{
    "till" => :till,
    "plant" => :plant,
    "water" => :water,
    "harvest" => :harvest,
    "place_fence" => :place_fence,
    "remove_fence" => :remove_fence,
    "place_gate" => :place_gate,
    "remove_gate" => :remove_gate
  }

  defp normalize(action) when is_map(action) do
    kind = Map.get(@kinds, to_string(fetch(action, "kind")))
    x = to_integer(fetch(action, "x"))
    y = to_integer(fetch(action, "y"))

    if kind && is_integer(x) && is_integer(y) do
      {:ok, kind, x, y, FarmAction.opts(action)}
    else
      :error
    end
  end

  defp normalize(_action), do: :error

  defp fetch(map, key), do: Map.get(map, key) || Map.get(map, String.to_atom(key))
  defp to_integer(value) when is_integer(value), do: value

  defp to_integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} -> int
      _ -> nil
    end
  end

  defp to_integer(_value), do: nil

  defp tile_at(owner, x, y) do
    Repo.one(from(t in Tile, where: t.owner == ^owner and t.x == ^x and t.y == ^y))
  end

  defp broadcast_change(owner) do
    broadcast_farm(owner)
    broadcast_lobby()
  end

  defp broadcast_farm(owner) do
    GrangeWeb.Endpoint.broadcast("farm:" <> owner, "farmUpdate", %{farm: view(owner)})
  end

  defp broadcast_lobby do
    GrangeWeb.Endpoint.broadcast(@lobby_topic, "farms", %{farms: summaries()})
  end

  defp now_ms, do: System.system_time(:millisecond)
end
