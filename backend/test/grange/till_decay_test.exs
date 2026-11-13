defmodule Grange.TillDecayTest do
  @moduledoc false
  use ExUnit.Case, async: false

  import Ecto.Query
  import Grange.FarmFixtures

  alias Grange.{Farm, FarmStore, Inventory, Repo, Tile}

  setup do
    reset_farm_state()
    :ok
  end

  defp row(owner, x, y) do
    Repo.one(from(t in Tile, where: t.owner == ^owner and t.x == ^x and t.y == ^y))
  end

  test "untended tilled soil reverts to grass after the decay window" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 3, "y" => 3})

    tilled_at = row("Alice", 3, 3).tilled_at
    assert is_integer(tilled_at)

    assert FarmStore.tick(tilled_at + Farm.till_decay_ms() - 1) == []
    assert tile_at("Alice", 3, 3).state == :tilled

    assert FarmStore.tick(tilled_at + Farm.till_decay_ms()) == ["Alice"]
    assert tile_at("Alice", 3, 3) == nil
  end

  test "a sprinkler keeps its tilled soil from decaying" do
    set_farm!("Alice", sprinkler_count: 1)

    assert {:ok, _} =
             FarmStore.action("Alice", %{"kind" => "place_sprinkler", "x" => 3, "y" => 3})

    FarmStore.action("Alice", %{"kind" => "till", "x" => 3, "y" => 3})
    FarmStore.action("Alice", %{"kind" => "till", "x" => 6, "y" => 6})

    tilled_at = row("Alice", 3, 3).tilled_at
    now = tilled_at + Farm.till_decay_ms() * 3

    # Only the uncovered tile dries out; the sprinkled one stays tilled.
    assert FarmStore.tick(now) == ["Alice"]
    assert tile_at("Alice", 3, 3).state == :tilled
    assert tile_at("Alice", 6, 6) == nil
  end

  test "lifting a sprinkler restarts the drying clock for its soil" do
    set_farm!("Alice", sprinkler_count: 1)

    FarmStore.action("Alice", %{"kind" => "place_sprinkler", "x" => 3, "y" => 3})
    FarmStore.action("Alice", %{"kind" => "till", "x" => 3, "y" => 3})

    old = row("Alice", 3, 3).tilled_at
    assert FarmStore.tick(old + Farm.till_decay_ms() * 2) == []
    assert tile_at("Alice", 3, 3).state == :tilled

    FarmStore.action("Alice", %{"kind" => "remove_sprinkler", "x" => 3, "y" => 3})
    fresh = row("Alice", 3, 3).tilled_at
    assert fresh > old

    # The freshly moistened soil gets a full new window instead of reverting.
    assert FarmStore.tick(fresh + Farm.till_decay_ms() - 1) == []
    assert tile_at("Alice", 3, 3).state == :tilled
    assert FarmStore.tick(fresh + Farm.till_decay_ms()) == ["Alice"]
    assert tile_at("Alice", 3, 3) == nil
  end

  test "planting and watering exempt a tile from the till decay" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 2})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 2, "y" => 2})

    assert is_nil(row("Alice", 2, 2).tilled_at)

    now = System.system_time(:millisecond) + Farm.till_decay_ms() * 2
    assert FarmStore.tick(now) == []
    assert tile_at("Alice", 2, 2).state == :planted

    FarmStore.action("Alice", %{"kind" => "water", "x" => 2, "y" => 2})
    assert FarmStore.tick(now + Farm.grow_ms() + 60_000) == ["Alice"]
    assert tile_at("Alice", 2, 2).state == :ready
  end

  test "harvesting back to bare soil restarts the decay clock" do
    FarmStore.ensure("Alice")
    Inventory.add("Alice", "wheat-seed", 1)
    FarmStore.action("Alice", %{"kind" => "till", "x" => 5, "y" => 5})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 5, "y" => 5, "crop" => "wheat"})
    FarmStore.action("Alice", %{"kind" => "water", "x" => 5, "y" => 5})

    FarmStore.tick(System.system_time(:millisecond) + Farm.grow_ms() + 60_000)
    assert tile_at("Alice", 5, 5).state == :ready

    FarmStore.action("Alice", %{"kind" => "harvest", "x" => 5, "y" => 5, "tool" => "scythe"})
    assert tile_at("Alice", 5, 5).state == :tilled

    tilled_at = row("Alice", 5, 5).tilled_at
    assert is_integer(tilled_at)

    assert FarmStore.tick(tilled_at + Farm.till_decay_ms() - 1) == []
    assert tile_at("Alice", 5, 5).state == :tilled

    assert FarmStore.tick(tilled_at + Farm.till_decay_ms()) == ["Alice"]
    assert tile_at("Alice", 5, 5) == nil
  end

  test "reverting soil broadcasts the farm and a single lobby summary" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 3, "y" => 3})
    tilled_at = row("Alice", 3, 3).tilled_at

    GrangeWeb.Endpoint.subscribe("farm:Alice")
    GrangeWeb.Endpoint.subscribe("lobby")

    assert FarmStore.tick(tilled_at + Farm.till_decay_ms()) == ["Alice"]

    assert_receive %Phoenix.Socket.Broadcast{event: "farmUpdate", topic: "farm:Alice"}
    assert_receive %Phoenix.Socket.Broadcast{event: "farms", topic: "lobby"}
    refute_receive %Phoenix.Socket.Broadcast{event: "farms"}, 50
  end
end
