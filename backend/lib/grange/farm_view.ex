defmodule Grange.FarmView do
  @moduledoc """
  Read-only projections of a persisted farm for channel replies and summaries.
  """

  import Ecto.Query

  alias Grange.{FarmRecord, Repo, Tile}

  @doc "The farm's tiles as plain maps ordered by position."
  @spec tiles(String.t()) :: [map()]
  def tiles(owner) do
    from(t in Tile, where: t.owner == ^owner, order_by: [t.x, t.y])
    |> Repo.all()
    |> Enum.map(&tile_view/1)
  end

  @doc "A compact row for the lobby's farm list."
  @spec summary(FarmRecord.t()) :: map()
  def summary(farm) do
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

  defp tile_view(tile) do
    Map.take(tile, [:x, :y, :state, :crop, :planted_at, :watered_at, :ready_at])
  end
end
