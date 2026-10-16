defmodule Grange.FarmStoreTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Farm, FarmStore}

  setup do
    FarmStore.reset()
    :ok
  end

  defp tile_at(owner, x, y) do
    FarmStore.view(owner).tiles |> Enum.find(&(&1.x == x and &1.y == y))
  end

  defp grow(owner, x, y) do
    FarmStore.action(owner, %{"kind" => "water", "x" => x, "y" => y})

    future = System.system_time(:millisecond) + Farm.grow_ms() + 60_000
    FarmStore.tick(future)
  end

  test "ensure/1 creates a farm once" do
    refute FarmStore.has_farm?("Alice")

    view = FarmStore.ensure("Alice")
    assert view.owner == "Alice"
    assert view.tiles == []
    assert view.barn == %{}
    assert view.tomatoes == 0
    assert FarmStore.has_farm?("Alice")
    assert FarmStore.ensure("Alice") == view
  end

  test "tilling creates a tile and rejects a double till" do
    FarmStore.ensure("Alice")

    assert {:ok, _view} = FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 3})
    assert %{state: :tilled} = tile_at("Alice", 2, 3)

    assert {:error, "tile is already tilled"} =
             FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 3})
  end

  test "plant and water follow the tile lifecycle" do
    FarmStore.ensure("Alice")

    assert {:error, "no tilled tile here"} =
             FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})

    FarmStore.action("Alice", %{"kind" => "till", "x" => 0, "y" => 0})
    assert {:ok, _} = FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})
    assert %{state: :planted} = tile_at("Alice", 0, 0)

    assert {:ok, _} = FarmStore.action("Alice", %{"kind" => "water", "x" => 0, "y" => 0})
    assert %{state: :watered} = tile_at("Alice", 0, 0)
  end

  test "watering rejects untilled and already-watered tiles; unknown kinds are invalid" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 1, "y" => 1})

    assert {:error, "tile is not planted"} =
             FarmStore.action("Alice", %{"kind" => "water", "x" => 1, "y" => 1})

    FarmStore.action("Alice", %{"kind" => "plant", "x" => 1, "y" => 1})
    assert {:ok, _} = FarmStore.action("Alice", %{"kind" => "water", "x" => 1, "y" => 1})

    assert {:error, "tile is not planted"} =
             FarmStore.action("Alice", %{"kind" => "water", "x" => 1, "y" => 1})

    assert {:error, "invalid action"} =
             FarmStore.action("Alice", %{"kind" => "dance", "x" => 1, "y" => 1})
  end

  test "harvesting banks produce in the barn and tomatoes regrow once" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 5, "y" => 5})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 5, "y" => 5})
    grow("Alice", 5, 5)

    assert %{state: :ready} = tile_at("Alice", 5, 5)
    assert {:ok, view} = FarmStore.action("Alice", %{"kind" => "harvest", "x" => 5, "y" => 5})
    assert view.barn["tomato"] == 1
    assert view.tomatoes == 1
    # Regrows instead of clearing.
    assert %{state: :watered} = tile_at("Alice", 5, 5)
  end

  test "wheat cannot be harvested by hand and banks its own barn item" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 2})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 2, "y" => 2, "crop" => "wheat"})
    grow("Alice", 2, 2)

    assert {:error, reason} =
             FarmStore.action("Alice", %{"kind" => "harvest", "x" => 2, "y" => 2})

    assert reason =~ "needs a scythe"

    assert {:ok, view} =
             FarmStore.action("Alice", %{
               "kind" => "harvest",
               "x" => 2,
               "y" => 2,
               "tool" => "scythe"
             })

    assert view.barn["wheat"] == 1
    assert Map.get(view.barn, "tomato", 0) == 0
    assert %{state: :tilled} = tile_at("Alice", 2, 2)
  end

  test "selling produce removes it from the barn" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 0, "y" => 0})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})
    grow("Alice", 0, 0)
    FarmStore.action("Alice", %{"kind" => "harvest", "x" => 0, "y" => 0})

    assert {:ok, view} = FarmStore.sell("Alice", "tomato", 1)
    assert view.tomatoes == 0
  end

  test "selling more than the barn holds is rejected" do
    FarmStore.ensure("Alice")

    assert {:error, "not enough tomato"} = FarmStore.sell("Alice", "tomato", 1)
  end

  test "selling a non-positive amount is rejected" do
    FarmStore.ensure("Alice")

    assert {:error, "invalid sale"} = FarmStore.sell("Alice", "tomato", 0)
    assert {:error, "invalid sale"} = FarmStore.sell("Alice", "tomato", -2)
  end

  test "actions outside the grid are rejected" do
    FarmStore.ensure("Alice")

    assert {:error, "out of bounds"} =
             FarmStore.action("Alice", %{"kind" => "till", "x" => 99, "y" => 0})
  end

  test "summaries report tile counts and produce" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 0, "y" => 0})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})

    assert [%{owner: "Alice", tiles: 1, planted: 1, tomatoes: 0}] = FarmStore.summaries()
  end

  test "tick broadcasts a single lobby summary no matter how many farms change" do
    for owner <- ["Alice", "Bob", "Carol"] do
      FarmStore.ensure(owner)
      FarmStore.action(owner, %{"kind" => "till", "x" => 0, "y" => 0})
      FarmStore.action(owner, %{"kind" => "plant", "x" => 0, "y" => 0})
      FarmStore.action(owner, %{"kind" => "water", "x" => 0, "y" => 0})
    end

    GrangeWeb.Endpoint.subscribe("lobby")

    future = System.system_time(:millisecond) + Farm.grow_ms() + 60_000
    assert Enum.sort(FarmStore.tick(future)) == ["Alice", "Bob", "Carol"]

    assert_receive %Phoenix.Socket.Broadcast{event: "farms"}
    refute_receive %Phoenix.Socket.Broadcast{event: "farms"}, 50
  end
end
