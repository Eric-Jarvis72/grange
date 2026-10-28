defmodule Grange.PlayerItemsTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{FarmStore, PlayerItems}

  setup do
    FarmStore.reset()
    FarmStore.ensure("Alice")
    :ok
  end

  test "adds and stacks items per owner" do
    PlayerItems.add("Alice", "minnow", 2)
    PlayerItems.add("Alice", "minnow", 3)
    PlayerItems.add("Alice", "fiberglass", 1)

    assert PlayerItems.map("Alice") == %{"minnow" => 5, "fiberglass" => 1}
    assert PlayerItems.map("Bob") == %{}
  end

  test "ignores non-positive counts" do
    PlayerItems.add("Alice", "minnow", 0)
    PlayerItems.add("Alice", "minnow", -3)
    assert PlayerItems.map("Alice") == %{}
  end

  test "removes items and refuses to overdraw" do
    PlayerItems.add("Alice", "salmon", 4)
    assert :ok = PlayerItems.remove("Alice", "salmon", 3)
    assert PlayerItems.map("Alice") == %{"salmon" => 1}

    assert {:error, "not enough salmon"} = PlayerItems.remove("Alice", "salmon", 2)
    assert PlayerItems.map("Alice") == %{"salmon" => 1}
  end

  test "reset clears every player's items" do
    PlayerItems.add("Alice", "carp", 1)
    PlayerItems.reset()
    assert PlayerItems.map("Alice") == %{}
  end
end
