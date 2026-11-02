defmodule Grange.FarmStoreTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Farm, FarmGateActions, FarmRecord, FarmStore, Inventory, Repo}

  setup do
    FarmStore.reset()
    :ok
  end

  defp full_farm(owner) do
    FarmStore.ensure(owner)

    Repo.get!(FarmRecord, owner)
    |> Ecto.Changeset.change(land_level: 4)
    |> Repo.update!()

    FarmStore.view(owner)
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

    view = full_farm("Alice")
    assert view.owner == "Alice"
    assert view.tiles == []
    assert view.barn == %{}
    assert view.tomatoes == 0
    assert view.fences == []
    assert view.fence_count == 20
    assert view.gates == []
    assert view.gate_count == 2
    assert FarmStore.has_farm?("Alice")
    assert full_farm("Alice") == view
  end

  test "fences persist per farm, connect as coordinates, and shovel returns stock" do
    full_farm("Alice")
    full_farm("Bob")

    assert {:ok, view} = FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 7, "y" => 5})
    assert view.fences == [%{x: 7, y: 5}]
    assert view.fence_count == 19
    assert FarmStore.view("Bob").fences == []

    assert {:error, "fence already here"} =
             FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 7, "y" => 5})

    assert {:ok, view} =
             FarmStore.action("Alice", %{"kind" => "remove_fence", "x" => 7, "y" => 5})

    assert view.fences == []
    assert view.fence_count == 20

    assert {:error, "no fence here"} =
             FarmStore.action("Alice", %{"kind" => "remove_fence", "x" => 7, "y" => 5})
  end

  test "gates persist, consume a separate supply, toggle, and reorient" do
    full_farm("Alice")
    full_farm("Bob")

    assert {:ok, view} = FarmStore.action("Alice", %{"kind" => "place_gate", "x" => 7, "y" => 5})
    assert view.gates == [%{x: 7, y: 5, direction: "horizontal", open: false}]
    assert view.gate_count == 1
    assert FarmStore.view("Bob").gates == []

    assert {:error, "gate already here"} =
             FarmStore.action("Alice", %{"kind" => "place_gate", "x" => 7, "y" => 5})

    assert {:error, "gate already here"} =
             FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 7, "y" => 5})

    assert {:ok, view} =
             FarmGateActions.toggle("Alice", %{"kind" => "toggle_gate", "x" => 7, "y" => 5})

    assert [%{open: true}] = view.gates

    assert {:ok, view} = FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 7, "y" => 6})
    assert [%{direction: "vertical"}] = view.gates

    assert {:ok, view} = FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 8, "y" => 5})
    assert [%{direction: "horizontal"}] = view.gates

    assert {:ok, view} =
             FarmStore.action("Alice", %{"kind" => "remove_gate", "x" => 7, "y" => 5})

    assert view.gates == []
    assert view.gate_count == 2

    assert {:error, "no gate here"} =
             FarmGateActions.toggle("Alice", %{"kind" => "toggle_gate", "x" => 7, "y" => 5})

    assert {:error, "invalid gate action"} =
             FarmGateActions.toggle("Alice", %{"kind" => "toggle_gate", "x" => 99, "y" => 5})
  end

  test "a gate cannot share a tile with a fence" do
    full_farm("Alice")
    FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 4, "y" => 4})

    assert {:error, "fence already here"} =
             FarmStore.action("Alice", %{"kind" => "place_gate", "x" => 4, "y" => 4})
  end

  test "fences reject water and occupied crop tiles" do
    full_farm("Alice")

    assert {:error, "out of bounds"} =
             FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 7, "y" => 10})

    FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 2})

    assert {:error, "crop tile is in the way"} =
             FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 2, "y" => 2})
  end

  test "well and sign can be dug up, carried, placed, and reloaded per farm" do
    full_farm("Alice")
    full_farm("Bob")
    assert {:ok, view} = FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 2})
    assert view.prop_inventory == %{"well" => 1}
    assert [%{index: 2, carried: true}] = view.prop_overrides
    assert FarmStore.view("Bob").prop_overrides == []

    assert {:error, "object is already in inventory"} =
             FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 2})

    assert {:ok, view} = FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 4})
    assert view.prop_inventory == %{"well" => 1, "sign" => 1}

    assert {:ok, view} =
             FarmStore.prop_action("Alice", %{
               "kind" => "place",
               "asset" => "well",
               "x" => 480,
               "y" => 416
             })

    assert view.prop_inventory == %{"sign" => 1}

    assert Enum.find(view.prop_overrides, &(&1.index == 2)) ==
             %{index: 2, asset: "well", x: 480, y: 416, carried: false}

    assert FarmStore.view("Alice").prop_overrides == view.prop_overrides
  end

  test "train stays fixed and placement requires a carried item and valid grid" do
    full_farm("Alice")

    assert {:error, "that object cannot be dug up"} =
             FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 12})

    assert {:error, "object is not in inventory"} =
             FarmStore.prop_action("Alice", %{
               "kind" => "place",
               "asset" => "well",
               "x" => 480,
               "y" => 416
             })

    FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 2})

    assert {:ok, _} =
             FarmStore.prop_action("Alice", %{
               "kind" => "place",
               "asset" => "well",
               "x" => 480,
               "y" => 704
             })

    assert {:ok, _} = FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 2})

    assert {:error, "invalid placement"} =
             FarmStore.prop_action("Alice", %{
               "kind" => "place",
               "asset" => "well",
               "x" => 480,
               "y" => 706
             })

    assert {:error, "invalid placement"} =
             FarmStore.prop_action("Alice", %{
               "kind" => "place",
               "asset" => "well",
               "x" => 480,
               "y" => -300
             })
  end

  test "farmhouse and barn may be picked up while train remains placed" do
    full_farm("Alice")
    assert {:ok, _} = FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 0})
    assert {:ok, view} = FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 1})
    assert view.prop_inventory == %{"farmhouse" => 1, "barn" => 1}
    assert Enum.count(view.prop_overrides, & &1.carried) == 2

    assert {:error, "that object cannot be dug up"} =
             FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 12})
  end

  test "tilling creates a tile and rejects a double till" do
    full_farm("Alice")

    assert {:ok, _view} = FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 3})
    assert %{state: :tilled} = tile_at("Alice", 2, 3)

    assert {:error, "tile is already tilled"} =
             FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 3})
  end

  test "plant and water follow the tile lifecycle" do
    full_farm("Alice")

    assert {:error, "no tilled tile here"} =
             FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})

    FarmStore.action("Alice", %{"kind" => "till", "x" => 0, "y" => 0})
    assert {:ok, _} = FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})
    assert %{state: :planted} = tile_at("Alice", 0, 0)

    assert {:ok, _} = FarmStore.action("Alice", %{"kind" => "water", "x" => 0, "y" => 0})
    assert %{state: :watered} = tile_at("Alice", 0, 0)
  end

  test "planting spends one seed and a rejected plant refunds it" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 0, "y" => 0})
    FarmStore.action("Alice", %{"kind" => "till", "x" => 1, "y" => 0})

    assert {:ok, _} = FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})
    assert Inventory.seeds("Alice")["seed-bag"] == 9

    assert {:error, "tile is not tilled"} =
             FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})

    assert Inventory.seeds("Alice")["seed-bag"] == 9
  end

  test "planting without a seed leaves the tile tilled" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 0, "y" => 0})
    assert :ok = Inventory.take("Alice", "seed-bag", 10)

    assert {:error, "no seeds"} =
             FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})

    assert %{state: :tilled} = tile_at("Alice", 0, 0)
    assert Inventory.seeds("Alice")["seed-bag"] == 0
  end

  test "watering rejects untilled and already-watered tiles; unknown kinds are invalid" do
    full_farm("Alice")
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
    full_farm("Alice")
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

  test "harvesting an immature crop is rejected and does not water it" do
    full_farm("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 4, "y" => 4})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 4, "y" => 4})
    assert %{state: :planted} = tile_at("Alice", 4, 4)

    assert {:error, "tile is not ready"} =
             FarmStore.action("Alice", %{
               "kind" => "harvest",
               "x" => 4,
               "y" => 4,
               "tool" => "scythe"
             })

    assert FarmStore.view("Alice").barn == %{}
    assert %{state: :planted} = tile_at("Alice", 4, 4)
  end

  test "wheat cannot be harvested by hand and banks its own barn item" do
    full_farm("Alice")
    Inventory.add("Alice", "wheat-seed", 1)
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
    full_farm("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 0, "y" => 0})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})
    grow("Alice", 0, 0)
    FarmStore.action("Alice", %{"kind" => "harvest", "x" => 0, "y" => 0})

    assert {:ok, view} = FarmStore.sell("Alice", "tomato", 1)
    assert view.tomatoes == 0
  end

  test "selling more than the barn holds is rejected" do
    full_farm("Alice")

    assert {:error, "not enough tomato"} = FarmStore.sell("Alice", "tomato", 1)
  end

  test "selling a non-positive amount is rejected" do
    full_farm("Alice")

    assert {:error, "invalid sale"} = FarmStore.sell("Alice", "tomato", 0)
    assert {:error, "invalid sale"} = FarmStore.sell("Alice", "tomato", -2)
  end

  test "actions outside the grid are rejected" do
    full_farm("Alice")

    assert {:error, "out of bounds"} =
             FarmStore.action("Alice", %{"kind" => "till", "x" => 99, "y" => 0})
  end

  test "summaries report tile counts and produce" do
    full_farm("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 0, "y" => 0})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})

    assert [%{owner: "Alice", tiles: 1, planted: 1, tomatoes: 0}] = FarmStore.summaries()
  end

  test "tick broadcasts a single lobby summary no matter how many farms change" do
    for owner <- ["Alice", "Bob", "Carol"] do
      full_farm(owner)
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
