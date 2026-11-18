defmodule Grange.FarmFenceTest do
  @moduledoc false
  use ExUnit.Case, async: false

  import Grange.FarmFixtures

  alias Grange.FarmStore

  setup do
    reset_farm_state()
    :ok
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

  test "fences use tile corners, including around a crop and along the shoreline" do
    full_farm("Alice")

    assert {:ok, _view} =
             FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 7, "y" => 10})

    assert {:error, "out of bounds"} =
             FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 7, "y" => 11})

    FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 2})

    assert {:ok, _view} =
             FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 2, "y" => 2})
  end
end
