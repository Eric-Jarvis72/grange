defmodule Grange.FarmAnimals do
  @moduledoc "Server-owned placement and pickup of livestock."
  import Ecto.Query

  alias Grange.{FarmAnimal, FarmRecord, Land, Repo, Tile}

  @species ~w(cow hen sheep pig)

  def list(owner) do
    Repo.all(
      from(a in FarmAnimal,
        where: a.owner == ^owner,
        order_by: a.id,
        select: %{id: a.id, species: a.species, x: a.x, y: a.y}
      )
    )
  end

  def count(owner, species) do
    Repo.aggregate(
      from(a in FarmAnimal, where: a.owner == ^owner and a.species == ^species),
      :count
    )
  end

  def place(owner, species, x, y) when species in @species do
    farm = Repo.get!(FarmRecord, owner)

    cond do
      not Land.owned?(x, y, farm.land_level) -> {:error, "buy this land from the mayor first"}
      Map.get(farm.animals, species, 0) <= 0 -> {:error, "no #{species} in inventory"}
      occupied?(owner, x, y) -> {:error, "that spot is occupied"}
      true -> save_place(farm, species, x, y)
    end
  end

  def place(_owner, _species, _x, _y), do: {:error, "unknown animal"}

  def pickup(owner, x, y) do
    case Repo.one(from(a in FarmAnimal, where: a.owner == ^owner and a.x == ^x and a.y == ^y)) do
      nil -> {:error, "no animal here"}
      animal -> save_pickup(owner, animal)
    end
  end

  defp occupied?(owner, x, y) do
    Repo.exists?(from(t in Tile, where: t.owner == ^owner and t.x == ^x and t.y == ^y)) or
      Repo.exists?(from(a in FarmAnimal, where: a.owner == ^owner and a.x == ^x and a.y == ^y))
  end

  defp save_place(farm, species, x, y) do
    Repo.insert!(%FarmAnimal{owner: farm.owner, species: species, x: x, y: y})
    remaining = Map.get(farm.animals, species, 0) - 1

    farm
    |> Ecto.Changeset.change(animals: Map.put(farm.animals, species, remaining))
    |> Repo.update!()

    :ok
  end

  defp save_pickup(owner, animal) do
    Repo.delete!(animal)
    farm = Repo.get!(FarmRecord, owner)
    held = Map.get(farm.animals, animal.species, 0)

    farm
    |> Ecto.Changeset.change(animals: Map.put(farm.animals, animal.species, held + 1))
    |> Repo.update!()

    :ok
  end
end
