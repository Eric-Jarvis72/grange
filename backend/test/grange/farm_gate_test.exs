defmodule Grange.FarmGateTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{FarmGateActions, FarmStore}

  setup do
    FarmStore.reset()
    :ok
  end

  test "gates persist, consume a separate supply, toggle, and reorient" do
    FarmStore.ensure("Alice")
    FarmStore.ensure("Bob")

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
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "place_fence", "x" => 4, "y" => 4})

    assert {:error, "fence already here"} =
             FarmStore.action("Alice", %{"kind" => "place_gate", "x" => 4, "y" => 4})
  end
end
