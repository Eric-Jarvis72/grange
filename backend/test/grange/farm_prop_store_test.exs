defmodule Grange.FarmPropStoreTest do
  @moduledoc false
  use ExUnit.Case, async: false

  import Grange.FarmFixtures

  alias Grange.FarmStore

  setup do
    reset_farm_state()
    full_farm("Alice")
    :ok
  end

  test "a dug-up farmhouse can return to its original position beside the path" do
    assert {:ok, _} = FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 0})

    assert {:ok, view} =
             FarmStore.prop_action("Alice", %{
               "kind" => "place",
               "asset" => "farmhouse",
               "x" => 210,
               "y" => 260
             })

    assert Enum.find(view.prop_overrides, &(&1.index == 0)) ==
             %{index: 0, asset: "farmhouse", x: 210, y: 260, carried: false}
  end

  test "well and sign can be dug up, carried, placed, and reloaded per farm" do
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
    assert {:ok, _} = FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 0})
    assert {:ok, view} = FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 1})
    assert view.prop_inventory == %{"farmhouse" => 1, "barn" => 1}
    assert Enum.count(view.prop_overrides, & &1.carried) == 2

    assert {:error, "that object cannot be dug up"} =
             FarmStore.prop_action("Alice", %{"kind" => "dig", "index" => 12})
  end
end
