defmodule Grange.FarmAnimalsTest do
  @moduledoc false
  use ExUnit.Case, async: false
  import Grange.FarmFixtures

  alias Grange.FarmStore

  setup do
    reset_farm_state()
    full_farm("Alice")
    set_farm!("Alice", animals: %{"cow" => 1, "hen" => 1, "sheep" => 1, "pig" => 1})
    :ok
  end

  test "a hen can live on open ground, persists on the farm, and returns to inventory" do
    assert {:ok, farm} = place_hen(4, 4)
    assert farm.animals["hen"] == 0
    assert [%{species: "hen", x: 4, y: 4}] = farm.placed_animals
    assert FarmStore.view("Alice").placed_animals == farm.placed_animals
    assert {:error, "no hen in inventory"} = place_hen(4, 5)

    assert {:ok, farm} =
             FarmStore.action("Alice", %{"kind" => "remove_animal", "x" => 4, "y" => 4})

    assert farm.animals["hen"] == 1
    assert farm.placed_animals == []
  end

  test "animals may share one pen on separate tiles" do
    build_square()
    assert {:ok, _farm} = place_hen(4, 4)

    assert {:ok, farm} =
             FarmStore.action("Alice", %{
               "kind" => "place_animal",
               "animal" => "pig",
               "x" => 4,
               "y" => 5
             })

    assert Enum.count(farm.placed_animals) == 2

    assert {:error, "that spot is occupied"} =
             FarmStore.action("Alice", %{
               "kind" => "place_animal",
               "animal" => "cow",
               "x" => 4,
               "y" => 4
             })
  end

  test "water cannot hold an animal" do
    assert {:error, "out of bounds"} = place_hen(4, 10)
  end

  test "a fence on a tile corner does not occupy the animal's ground tile" do
    assert {:ok, _farm} =
             FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 4, "y" => 4})

    assert {:ok, farm} = place_hen(4, 4)
    assert [%{species: "hen", x: 4, y: 4}] = farm.placed_animals
  end

  test "each livestock species can be placed and picked back up" do
    build_square()

    for {species, x, y} <- [{"cow", 3, 3}, {"hen", 4, 3}, {"sheep", 5, 3}, {"pig", 3, 4}] do
      assert {:ok, farm} =
               FarmStore.action("Alice", %{
                 "kind" => "place_animal",
                 "animal" => species,
                 "x" => x,
                 "y" => y
               })

      assert farm.animals[species] == 0
      assert Enum.any?(farm.placed_animals, &(&1.species == species and &1.x == x and &1.y == y))
    end

    for {species, x, y} <- [{"cow", 3, 3}, {"hen", 4, 3}, {"sheep", 5, 3}, {"pig", 3, 4}] do
      assert {:ok, farm} =
               FarmStore.action("Alice", %{"kind" => "remove_animal", "x" => x, "y" => y})

      assert farm.animals[species] == 1
    end

    assert FarmStore.view("Alice").placed_animals == []
  end

  defp place_hen(x, y),
    do:
      FarmStore.action("Alice", %{"kind" => "place_animal", "animal" => "hen", "x" => x, "y" => y})

  defp build_square do
    perimeter =
      Enum.flat_map(2..6, fn x -> [{x, 2}, {x, 6}] end) ++
        Enum.flat_map(3..5, fn y -> [{2, y}, {6, y}] end)

    Enum.each(perimeter, fn {x, y} ->
      assert {:ok, _farm} =
               FarmStore.action("Alice", %{"kind" => "place_fence", "x" => x, "y" => y})
    end)
  end
end
