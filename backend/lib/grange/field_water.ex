defmodule Grange.FieldWater do
  @moduledoc """
  Starting-water rules shared by the manual watering action and sprinkle ticks.

  Growth speed is computed from the crop's grid synergy at the moment the tile
  is watered; the readiness deadline is never recomputed later. Keeping this in
  one place means a sprinkler waters exactly like a player's watering can.
  """

  import Ecto.Query

  alias Grange.{Crops, Farm, Repo, Tile}

  @orthogonal [{0, -1}, {0, 1}, {1, 0}, {-1, 0}]
  @growing [:planted, :watered, :ready]

  @doc "The families of growing crops orthogonally touching `(x, y)`."
  @spec neighbor_families(String.t(), integer(), integer()) :: [atom()]
  def neighbor_families(owner, x, y) do
    for {dx, dy} <- @orthogonal,
        tile = tile_at(owner, x + dx, y + dy),
        tile != nil,
        tile.state in @growing do
      {crop_id, _remaining} = Crops.parse_crop(tile.crop)
      Crops.family(crop_id)
    end
  end

  @doc "Waters a planted tile, scheduling readiness with synergy-adjusted speed."
  @spec water(String.t(), Tile.t(), integer()) :: :ok | {:error, String.t()}
  def water(owner, %Tile{state: :planted} = tile, now) do
    {crop_id, _remaining} = Crops.parse_crop(tile.crop)
    speed = Crops.growth_speed_multiplier(crop_id, neighbor_families(owner, tile.x, tile.y))

    with {:ok, watered} <- Farm.water(tile, now, Farm.grow_ms() / speed),
         do: persist(tile, watered)
  end

  def water(_owner, _tile, _now), do: {:error, "tile is not planted"}

  defp persist(tile, changed) do
    tile
    |> Ecto.Changeset.change(%{
      state: changed.state,
      crop: changed.crop,
      planted_at: changed.planted_at,
      watered_at: changed.watered_at,
      ready_at: changed.ready_at,
      tilled_at: nil
    })
    |> Repo.update!()

    :ok
  end

  defp tile_at(owner, x, y) do
    Repo.one(from(t in Tile, where: t.owner == ^owner and t.x == ^x and t.y == ^y))
  end
end
