defmodule Grange.FarmPropStoreTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{FarmRecord, FarmStore, Repo}

  setup do
    FarmStore.reset()
    FarmStore.ensure("Alice")

    Repo.get!(FarmRecord, "Alice")
    |> Ecto.Changeset.change(land_level: 4)
    |> Repo.update!()

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
end
