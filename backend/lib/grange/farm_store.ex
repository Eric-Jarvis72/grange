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
    FarmFence,
    FarmFences,
    FarmProp,
    FarmProps,
    FarmRecord,
    Repo,
    Tile
  }

  @lobby_topic "lobby"
  @orthogonal [{0, -1}, {0, 1}, {1, 0}, {-1, 0}]
  @growing [:planted, :watered, :ready]

  @spec ensure(String.t()) :: map()
  def ensure(owner) do
    case Repo.get(FarmRecord, owner) do
      nil ->
        %FarmRecord{owner: owner, tomatoes: 0} |> Repo.insert!()
        broadcast_change(owner)

      _farm ->
        :ok
    end

    view(owner)
  end

  @spec has_farm?(String.t()) :: boolean()
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
          tiles: tiles(owner),
          barn: barn,
          tomatoes: Map.get(barn, "tomato", 0),
          fences: FarmFences.list(owner),
          fence_count: farm.fence_count,
          prop_overrides: FarmProps.overrides(owner),
          prop_inventory: FarmProps.inventory(owner)
        }
    end
  end

  @spec summaries() :: [map()]
  def summaries do
    Repo.all(from(f in FarmRecord, preload: [:tiles, :barn_items], order_by: f.owner))
    |> Enum.map(&summary/1)
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
    case FarmProps.action(owner, action) do
      {:ok, :ok} ->
        broadcast_change(owner)
        {:ok, view(owner)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @spec sell(String.t(), String.t(), integer()) :: {:ok, map()} | {:error, String.t()}
  def sell(owner, item, count) when is_binary(item) and is_integer(count) and count > 0 do
    case Barn.sell(owner, item, count) do
      :ok ->
        broadcast_change(owner)
        {:ok, view(owner)}

      {:error, reason} ->
        {:error, reason}
    end
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
    Repo.delete_all(Tile)
    Repo.delete_all(BarnItem)
    Repo.delete_all(FarmFence)
    Repo.delete_all(FarmProp)
    Repo.delete_all(FarmRecord)
    :ok
  end

  defp run(owner, kind, x, y, opts) do
    bounds? =
      if kind in [:place_fence, :remove_fence],
        do: x in 0..17 and y in 0..9,
        else: Farm.in_bounds?(x, y)

    if bounds? do
      apply_action(owner, kind, x, y, opts)
    else
      {:error, "out of bounds"}
    end
  end

  defp apply_action(owner, kind, x, y, opts) do
    case Repo.transaction(fn -> mutate(owner, kind, x, y, opts) end) do
      {:ok, {:drops, drops}} ->
        broadcast_change(owner)
        {:ok, Map.put(view(owner), :drops, drops)}

      {:ok, {:error, reason}} ->
        {:error, reason}

      {:ok, :ok} ->
        broadcast_change(owner)
        {:ok, view(owner)}

      {:error, _reason} ->
        {:error, "could not update farm"}
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

  defp mutate(owner, :place_fence, x, y, _opts), do: FarmFences.place(owner, x, y)

  defp mutate(owner, :remove_fence, x, y, _opts), do: FarmFences.remove(owner, x, y)

  defp mutate(owner, kind, x, y, opts) do
    case tile_at(owner, x, y) do
      nil -> {:error, "no tilled tile here"}
      tile -> transform(owner, tile, kind, opts)
    end
  end

  defp transform(_owner, tile, :plant, opts) do
    crop = opts[:crop] || "tomato"
    total = Crops.get(crop)[:harvests] || 1

    with {:ok, planted} <- Farm.plant(tile, now_ms()) do
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

    if Crops.can_harvest?(crop_id, opts[:tool]) do
      Barn.add(owner, crop_id, 1)
      families = neighbor_families(owner, tile.x, tile.y)
      drops = FarmAction.mutation_drops(crop_id, tile.state, families, opts, :rand.uniform())
      regrow_or_clear(owner, tile, crop_id, remaining)
      {:drops, drops}
    else
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
    "remove_fence" => :remove_fence
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
  defp to_integer(value) when is_binary(value), do: safe_to_integer(value)
  defp to_integer(_value), do: nil

  defp safe_to_integer(value) do
    case Integer.parse(value) do
      {int, ""} -> int
      _ -> nil
    end
  end

  defp tile_at(owner, x, y) do
    Repo.one(from(t in Tile, where: t.owner == ^owner and t.x == ^x and t.y == ^y))
  end

  defp tiles(owner) do
    from(t in Tile, where: t.owner == ^owner, order_by: [t.x, t.y])
    |> Repo.all()
    |> Enum.map(&tile_view/1)
  end

  defp tile_view(tile) do
    %{
      x: tile.x,
      y: tile.y,
      state: tile.state,
      crop: tile.crop,
      planted_at: tile.planted_at,
      watered_at: tile.watered_at,
      ready_at: tile.ready_at
    }
  end

  defp summary(farm) do
    counts = Enum.frequencies_by(farm.tiles, & &1.state)
    tomatoes = Enum.find_value(farm.barn_items, 0, &if(&1.item == "tomato", do: &1.count))

    %{
      owner: farm.owner,
      tiles: length(farm.tiles),
      planted: Map.get(counts, :planted, 0),
      watered: Map.get(counts, :watered, 0),
      ready: Map.get(counts, :ready, 0),
      tomatoes: tomatoes
    }
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
