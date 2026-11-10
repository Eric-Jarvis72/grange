defmodule Grange.FarmSprinklers do
  @moduledoc """
  Persists sprinklers and keeps their 2x2 coverage watered.

  A sprinkler is stored by the top-left tile `(x, y)` of the four tiles it
  covers; the object itself is drawn on the corner those tiles share. While a
  sprinkler stands, a planted tile in its square is watered on the next tick,
  so a seed planted under a sprinkler never needs a watering can.

  A sprinkler also keeps bare tilled soil moist: `Grange.FarmTick` never lets a
  covered `tilled` tile dry out, and arriving/leaving restamps its drying clock
  so removing a sprinkler starts a fresh window rather than reverting at once.
  """

  import Ecto.Query

  alias Grange.{FarmRecord, FarmSprinkler, FieldWater, Land, Repo, Tile}

  @coverage [{0, 0}, {1, 0}, {0, 1}, {1, 1}]

  @doc "Every sprinkler on the farm as a list of `%{x:, y:}` anchors."
  @spec list(String.t()) :: [map()]
  def list(owner) do
    Repo.all(
      from(s in FarmSprinkler,
        where: s.owner == ^owner,
        order_by: [s.x, s.y],
        select: %{x: s.x, y: s.y}
      )
    )
  end

  @spec at(String.t(), integer(), integer()) :: FarmSprinkler.t() | nil
  def at(owner, x, y) do
    Repo.one(from(s in FarmSprinkler, where: s.owner == ^owner and s.x == ^x and s.y == ^y))
  end

  @doc """
  Every tile coordinate covered by a sprinkler, as `{owner, x, y}`.

  Used by `Grange.FarmTick` to spare covered tilled soil from the drying sweep.
  """
  @spec covered_coords() :: MapSet.t({String.t(), integer(), integer()})
  def covered_coords do
    from(s in FarmSprinkler, select: {s.owner, s.x, s.y})
    |> Repo.all()
    |> Enum.reduce(MapSet.new(), fn {owner, x, y}, acc ->
      Enum.reduce(@coverage, acc, fn {dx, dy}, inner ->
        MapSet.put(inner, {owner, x + dx, y + dy})
      end)
    end)
  end

  @doc """
  Restamps the drying clock of bare tilled soil in a sprinkler's square.

  Called when a sprinkler arrives or leaves so its soil always gets a full
  `Grange.Farm.till_decay_ms/0` window from the moment it is last moistened.
  """
  @spec moisten_soil(String.t(), integer(), integer(), integer()) :: :ok
  def moisten_soil(owner, x, y, now) do
    Enum.each(@coverage, fn {dx, dy} ->
      case tile_at(owner, x + dx, y + dy) do
        %Tile{state: :tilled} = tile -> Repo.update!(Ecto.Changeset.change(tile, tilled_at: now))
        _other -> :ok
      end
    end)
  end

  @doc "Places or lifts a sprinkler; the action kind picks the direction."
  @spec action(String.t(), atom(), integer(), integer()) :: :ok | {:error, String.t()}
  def action(owner, :place_sprinkler, x, y), do: place(owner, x, y)
  def action(owner, :remove_sprinkler, x, y), do: remove(owner, x, y)

  @doc "Places a sprinkler, spending one from the farm's supply."
  @spec place(String.t(), integer(), integer()) :: :ok | {:error, String.t()}
  def place(owner, x, y) do
    farm = Repo.get!(FarmRecord, owner)

    cond do
      farm.sprinkler_count <= 0 ->
        {:error, "no sprinklers left"}

      not covers_owned_land?(x, y, farm.land_level) ->
        {:error, "buy this land from the mayor first"}

      at(owner, x, y) ->
        {:error, "sprinkler already here"}

      true ->
        Repo.insert!(%FarmSprinkler{owner: owner, x: x, y: y})
        Repo.update!(Ecto.Changeset.change(farm, sprinkler_count: farm.sprinkler_count - 1))
        moisten_soil(owner, x, y, now_ms())
        :ok
    end
  end

  @doc "Lifts a sprinkler and returns it to the farm's supply."
  @spec remove(String.t(), integer(), integer()) :: :ok | {:error, String.t()}
  def remove(owner, x, y) do
    case at(owner, x, y) do
      nil ->
        {:error, "no sprinkler here"}

      sprinkler ->
        Repo.delete!(sprinkler)
        farm = Repo.get!(FarmRecord, owner)
        Repo.update!(Ecto.Changeset.change(farm, sprinkler_count: farm.sprinkler_count + 1))
        moisten_soil(owner, x, y, now_ms())
        :ok
    end
  end

  @doc """
  Waters every planted tile under a sprinkler and returns the owners that
  changed. Idempotent: an already-watered or ready tile is left alone.
  """
  @spec water_tick(integer()) :: [String.t()]
  def water_tick(now) do
    from(s in FarmSprinkler, order_by: [s.owner, s.x, s.y])
    |> Repo.all()
    |> Enum.group_by(& &1.owner)
    |> Enum.flat_map(fn {owner, sprinklers} ->
      changed = Enum.reduce(sprinklers, false, &(water_square(owner, &1.x, &1.y, now) or &2))
      if changed, do: [owner], else: []
    end)
  end

  defp water_square(owner, x, y, now) do
    Enum.reduce(@coverage, false, fn {dx, dy}, acc ->
      water_covered(owner, x + dx, y + dy, now) or acc
    end)
  end

  defp water_covered(owner, x, y, now) do
    case tile_at(owner, x, y) do
      %Tile{state: :planted} = tile -> FieldWater.water(owner, tile, now) == :ok
      _other -> false
    end
  end

  defp covers_owned_land?(x, y, level) do
    Land.owned?(x, y, level) and Land.owned?(x + 1, y + 1, level)
  end

  defp tile_at(owner, x, y) do
    Repo.one(from(t in Tile, where: t.owner == ^owner and t.x == ^x and t.y == ^y))
  end

  defp now_ms, do: System.system_time(:millisecond)
end
