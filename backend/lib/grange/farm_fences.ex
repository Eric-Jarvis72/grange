defmodule Grange.FarmFences do
  @moduledoc "Persists the fence posts a player has placed on their field."

  import Ecto.Query

  alias Grange.{FarmFence, FarmRecord, Repo, Tile}

  @doc "Every fence on the farm as a list of `%{x:, y:}`."
  @spec list(String.t()) :: [map()]
  def list(owner) do
    Repo.all(
      from(f in FarmFence,
        where: f.owner == ^owner,
        order_by: [f.x, f.y],
        select: %{x: f.x, y: f.y}
      )
    )
  end

  @spec at(String.t(), integer(), integer()) :: FarmFence.t() | nil
  def at(owner, x, y) do
    Repo.one(from(f in FarmFence, where: f.owner == ^owner and f.x == ^x and f.y == ^y))
  end

  @doc "Places a fence post, spending one from the farm's supply."
  @spec place(String.t(), integer(), integer()) :: :ok | {:error, String.t()}
  def place(owner, x, y) do
    farm = Repo.get!(FarmRecord, owner)

    cond do
      farm.fence_count <= 0 ->
        {:error, "no fences left"}

      at(owner, x, y) ->
        {:error, "fence already here"}

      tile_at(owner, x, y) ->
        {:error, "crop tile is in the way"}

      true ->
        Repo.insert!(%FarmFence{owner: owner, x: x, y: y})
        Repo.update!(Ecto.Changeset.change(farm, fence_count: farm.fence_count - 1))
        :ok
    end
  end

  @doc "Removes a fence post and returns it to the farm's supply."
  @spec remove(String.t(), integer(), integer()) :: :ok | {:error, String.t()}
  def remove(owner, x, y) do
    case at(owner, x, y) do
      nil ->
        {:error, "no fence here"}

      fence ->
        Repo.delete!(fence)
        farm = Repo.get!(FarmRecord, owner)
        Repo.update!(Ecto.Changeset.change(farm, fence_count: farm.fence_count + 1))
        :ok
    end
  end

  defp tile_at(owner, x, y) do
    Repo.one(from(t in Tile, where: t.owner == ^owner and t.x == ^x and t.y == ^y))
  end
end
