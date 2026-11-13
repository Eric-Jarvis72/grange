defmodule Grange.InventoryTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Accounts, FarmStore, Inventory, LivestockMarket}

  setup do
    FarmStore.reset()
    Accounts.reset()
    :ok
  end

  defp register(attrs \\ %{}) do
    Accounts.register(
      Map.merge(
        %{
          "username" => "Alice",
          "email" => "alice@example.test",
          "password" => "harvest-please"
        },
        attrs
      )
    )
  end

  defp find_slot(slots, area, slot) do
    Enum.find(slots, &(&1.area == area and &1.slot == slot))
  end

  test "the starter kit is created once and zero counts are kept" do
    FarmStore.ensure("Alice")
    assert Inventory.seeds("Alice") == %{"seed-bag" => 10}

    assert :ok = Inventory.take("Alice", "seed-bag", 10)
    assert Inventory.seeds("Alice") == %{"seed-bag" => 0}

    FarmStore.ensure("Alice")
    assert Inventory.seeds("Alice") == %{"seed-bag" => 0}
  end

  test "seeds are added and only spent when enough are held" do
    FarmStore.ensure("Alice")
    assert :ok = Inventory.add("Alice", "wheat-seed", 3)
    assert Inventory.seeds("Alice")["wheat-seed"] == 3

    assert {:error, "no seeds"} = Inventory.take("Alice", "wheat-seed", 4)
    assert Inventory.seeds("Alice")["wheat-seed"] == 3

    assert :ok = Inventory.take("Alice", "wheat-seed", 3)
    assert Inventory.seeds("Alice")["wheat-seed"] == 0
  end

  test "buying seeds debits the account and returns authoritative counts" do
    assert {:ok, user} = register()
    FarmStore.ensure(user.username)

    assert {:ok, result} = Inventory.buy(user, "tomato-seed", 1)
    assert result.balance == 92
    assert result.seeds["seed-bag"] == 11
    assert Inventory.seeds(user.username)["seed-bag"] == 11
  end

  test "buying is rejected when the account cannot afford it" do
    assert {:ok, user} = register()
    FarmStore.ensure(user.username)

    assert {:error, "insufficient funds"} = Inventory.buy(user, "tomato-seed", 20)
    assert Inventory.seeds(user.username)["seed-bag"] == 10

    stored = Enum.find(Accounts.list_users(), &(&1.id == user.id))
    assert stored.balance == 100
  end

  test "buying rejects unknown seeds and bad quantities" do
    assert {:ok, user} = register()
    FarmStore.ensure(user.username)

    assert {:error, "unknown seed"} = Inventory.buy(user, "midas-wheat-seed", 1)
    assert {:error, "invalid purchase"} = Inventory.buy(user, "tomato-seed", 0)
    assert {:error, "invalid purchase"} = Inventory.buy(user, "tomato-seed", nil)
  end

  test "admin grants fill every seed stack" do
    FarmStore.ensure("Alice")
    seeds = Inventory.grant_all_seeds("Alice")

    assert seeds["seed-bag"] == 99
    assert seeds["midas-wheat-seed"] == 99
    assert Inventory.seeds("Alice")["sunburst-tomato-seed"] == 99
  end

  test "seed_item maps tomato to the inventory's seed bag" do
    assert Inventory.seed_item("tomato") == "seed-bag"
    assert Inventory.seed_item("wheat") == "wheat-seed"
    assert Inventory.seed_item("bogus") == nil
  end

  test "the starter layout is created once and includes tools, fence, and seeds" do
    FarmStore.ensure("Alice")
    slots = Inventory.layout("Alice")

    assert find_slot(slots, "hotbar", 0) == %{area: "hotbar", slot: 0, item: "hoe", count: 1}
    assert find_slot(slots, "hotbar", 1).item == "seed-bag"
    assert find_slot(slots, "hotbar", 2).item == "watering-can"
    assert find_slot(slots, "hotbar", 5).item == "fence"
    assert find_slot(slots, "hotbar", 6).item == "shovel"

    FarmStore.ensure("Alice")
    assert length(Inventory.layout("Alice")) == length(slots)
  end

  test "saving a layout preserves moved and split slots" do
    FarmStore.ensure("Alice")

    slots = [
      %{"area" => "hotbar", "slot" => 0, "item" => "hoe", "count" => 1},
      %{"area" => "hotbar", "slot" => 1, "item" => "watering-can", "count" => 1},
      %{"area" => "grid", "slot" => 0, "item" => "seed-bag", "count" => 5},
      %{"area" => "grid", "slot" => 1, "item" => "seed-bag", "count" => 5}
    ]

    assert {:ok, saved} = Inventory.save_layout("Alice", slots)
    assert find_slot(saved, "hotbar", 1).item == "watering-can"
    assert find_slot(saved, "grid", 0).count == 5
    assert find_slot(saved, "grid", 1).count == 5
  end

  test "layout saves cannot create seeds but may leave seeds unplaced" do
    FarmStore.ensure("Alice")

    too_many = [
      %{"area" => "hotbar", "slot" => 1, "item" => "seed-bag", "count" => 11}
    ]

    assert {:error, "seed count mismatch"} = Inventory.save_layout("Alice", too_many)

    too_few = [
      %{"area" => "hotbar", "slot" => 1, "item" => "seed-bag", "count" => 9}
    ]

    assert {:ok, _saved} = Inventory.save_layout("Alice", too_few)
    assert Inventory.seeds("Alice") == %{"seed-bag" => 10}
  end

  test "layout saves reject duplicate and malformed slots" do
    FarmStore.ensure("Alice")

    duplicate = [
      %{"area" => "hotbar", "slot" => 0, "item" => "hoe", "count" => 1},
      %{"area" => "hotbar", "slot" => 0, "item" => "scythe", "count" => 1}
    ]

    assert {:error, "duplicate inventory slot"} = Inventory.save_layout("Alice", duplicate)

    unknown = [
      %{"area" => "hotbar", "slot" => 0, "item" => "not-real", "count" => 1}
    ]

    assert {:error, "invalid inventory slot"} = Inventory.save_layout("Alice", unknown)

    overfull = [
      %{"area" => "hotbar", "slot" => 0, "item" => "hoe", "count" => 2}
    ]

    assert {:error, "invalid inventory slot"} = Inventory.save_layout("Alice", overfull)
  end

  test "owned livestock can be saved in slots, but cannot be invented" do
    assert {:ok, user} = register()
    FarmStore.ensure(user.username)
    pig = [%{"area" => "grid", "slot" => 0, "item" => "pig", "count" => 1}]

    assert {:error, "animal count mismatch"} = Inventory.save_layout("Alice", pig)
    assert {:ok, _} = LivestockMarket.buy(user.id, user.username, "pig")
    assert {:ok, saved} = Inventory.save_layout("Alice", pig)
    assert find_slot(saved, "grid", 0).item == "pig"
  end
end
