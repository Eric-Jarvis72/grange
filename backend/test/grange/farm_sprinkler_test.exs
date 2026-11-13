defmodule Grange.FarmSprinklerTest do
  @moduledoc false
  use ExUnit.Case, async: false

  import Grange.FarmFixtures

  alias Grange.{Farm, FarmStore}

  setup do
    reset_farm_state()
    :ok
  end

  defp stock(owner, count) do
    set_farm!(owner, sprinkler_count: count, land_level: 4)
  end

  defp plant(owner, x, y) do
    FarmStore.action(owner, %{"kind" => "till", "x" => x, "y" => y})
    FarmStore.action(owner, %{"kind" => "plant", "x" => x, "y" => y, "crop" => "tomato"})
  end

  test "placing a sprinkler spends supply and cannot stack on the same corner" do
    stock("Alice", 2)

    assert {:ok, view} =
             FarmStore.action("Alice", %{"kind" => "place_sprinkler", "x" => 7, "y" => 6})

    assert view.sprinklers == [%{x: 7, y: 6}]
    assert view.sprinkler_count == 1

    assert {:error, "sprinkler already here"} =
             FarmStore.action("Alice", %{"kind" => "place_sprinkler", "x" => 7, "y" => 6})

    assert {:ok, view} =
             FarmStore.action("Alice", %{"kind" => "remove_sprinkler", "x" => 7, "y" => 6})

    assert view.sprinklers == []
    assert view.sprinkler_count == 2

    assert {:error, "no sprinkler here"} =
             FarmStore.action("Alice", %{"kind" => "remove_sprinkler", "x" => 7, "y" => 6})
  end

  test "placing needs supply and owned land for the whole 2x2" do
    FarmStore.ensure("Alice")

    assert {:error, "no sprinklers left"} =
             FarmStore.action("Alice", %{"kind" => "place_sprinkler", "x" => 7, "y" => 6})

    stock("Bob", 2)

    assert {:error, "buy this land from the mayor first"} =
             FarmStore.action("Bob", %{"kind" => "place_sprinkler", "x" => 19, "y" => 6})
  end

  test "a tick waters every planted tile under a sprinkler but nothing outside it" do
    stock("Alice", 1)
    FarmStore.action("Alice", %{"kind" => "place_sprinkler", "x" => 7, "y" => 6})

    covered = [{7, 6}, {8, 6}, {7, 7}, {8, 7}]
    Enum.each(covered ++ [{10, 6}], fn {x, y} -> plant("Alice", x, y) end)

    Enum.each(covered ++ [{10, 6}], fn {x, y} ->
      assert tile_at("Alice", x, y).state == :planted
    end)

    now = System.system_time(:millisecond)
    assert FarmStore.tick(now) == ["Alice"]

    Enum.each(covered, fn {x, y} -> assert tile_at("Alice", x, y).state == :watered end)
    assert tile_at("Alice", 10, 6).state == :planted

    # The sprinkler uses the normal growth clock, so the crops still ripen.
    assert FarmStore.tick(now + Farm.grow_ms() + 60_000) == ["Alice"]

    Enum.each(covered, fn {x, y} -> assert tile_at("Alice", x, y).state == :ready end)
  end

  test "lifting a sprinkler stops it watering later plantings" do
    stock("Alice", 1)
    FarmStore.action("Alice", %{"kind" => "place_sprinkler", "x" => 3, "y" => 3})
    FarmStore.action("Alice", %{"kind" => "remove_sprinkler", "x" => 3, "y" => 3})

    plant("Alice", 3, 3)
    now = System.system_time(:millisecond)

    assert FarmStore.tick(now) == []
    assert tile_at("Alice", 3, 3).state == :planted
  end
end
