defmodule Grange.FarmCatalystsTest do
  @moduledoc false
  use ExUnit.Case, async: false

  import Grange.FarmFixtures

  alias Grange.{FarmCatalysts, FarmStore, Inventory, PlayerItems}

  setup do
    reset_farm_state()
    :ok
  end

  test "next_dawn_ms points at the next cycle start" do
    assert FarmCatalysts.next_dawn_ms(1_000, 10, 100) == 1_090
    assert FarmCatalysts.next_dawn_ms(1_000, 60, 100) == 1_040
    assert FarmCatalysts.next_dawn_ms(1_000, 0, 100) == 1_100
  end

  test "a catalyst is consumed and transforms only its standard crop at dawn" do
    full_farm("Alice")
    PlayerItems.add("Alice", "gilded-dust", 1)
    Inventory.add("Alice", "wheat-seed", 1)

    FarmStore.action("Alice", %{"kind" => "till", "x" => 1, "y" => 1})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 1, "y" => 1, "crop" => "wheat"})
    FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 2})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 2, "y" => 2, "crop" => "tomato"})

    before = tile_at("Alice", 1, 1)
    assert {:ok, pending} = FarmStore.use_catalyst("Alice", "gilded-dust")
    assert pending.standard == "wheat"
    assert pending.crop == "midas_wheat"
    assert PlayerItems.map("Alice") == %{"gilded-dust" => 0}

    assert FarmStore.tick(pending.applies_at) == ["Alice"]

    assert %{crop: "midas_wheat", state: :planted, planted_at: planted_at} =
             tile_at("Alice", 1, 1)

    assert planted_at == before.planted_at
    assert tile_at("Alice", 2, 2).crop == "tomato:2"
  end

  test "using a catalyst with no matching crops leaves it in the inventory" do
    full_farm("Alice")
    PlayerItems.add("Alice", "sun-shard", 1)

    assert {:error, "no Tomato to transform"} =
             FarmStore.use_catalyst("Alice", "sun-shard")

    assert PlayerItems.map("Alice") == %{"sun-shard" => 1}
  end

  test "the same catalyst cannot be queued twice" do
    full_farm("Alice")
    PlayerItems.add("Alice", "blizzard-vial", 2)
    Inventory.add("Alice", "lettuce-seed", 1)

    FarmStore.action("Alice", %{"kind" => "till", "x" => 1, "y" => 1})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 1, "y" => 1, "crop" => "lettuce"})

    assert {:ok, _pending} = FarmStore.use_catalyst("Alice", "blizzard-vial")
    assert {:error, "catalyst already brewing"} = FarmStore.use_catalyst("Alice", "blizzard-vial")
    assert PlayerItems.map("Alice") == %{"blizzard-vial" => 1}
  end

  test "a dawn skip applies pending catalysts before their natural deadline" do
    full_farm("Alice")
    PlayerItems.add("Alice", "sun-shard", 1)

    FarmStore.action("Alice", %{"kind" => "till", "x" => 1, "y" => 1})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 1, "y" => 1, "crop" => "tomato"})

    assert {:ok, pending} = FarmStore.use_catalyst("Alice", "sun-shard")
    assert pending.applies_at > System.system_time(:millisecond)

    assert [%{count: 1, crop: "sunburst_tomato"}] = FarmStore.apply_dawn_catalysts()
    assert tile_at("Alice", 1, 1).crop == "sunburst_tomato:3"
  end
end
