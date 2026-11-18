defmodule Grange.NpcQuestTest do
  @moduledoc false

  use ExUnit.Case, async: false

  alias Grange.{Accounts, Barn, Crops, FarmStore, NpcQuest, NpcQuestRecord, Repo, User}

  setup do
    Accounts.reset()
    FarmStore.reset()
    :ok
  end

  defp register(name) do
    {:ok, user} =
      Accounts.register(%{
        "username" => name,
        "email" => "#{name}@example.test",
        "password" => "harvest-please"
      })

    FarmStore.ensure(user.username)
    user
  end

  defp balance(name), do: Repo.get_by!(User, username: name).balance

  defp stock(name, item), do: Map.get(Barn.map(name), item, 0)

  test "a fresh quest starts at the intro stage" do
    register("Alice")

    assert %{stage: "intro", tomatoes: 0, lettuce: 0, wheat: 0} = NpcQuest.status("Alice")
  end

  test "seeing the intro moves on to the tomatoes stage" do
    register("Alice")

    assert %{stage: "tomatoes"} = NpcQuest.intro_seen("Alice")
    # Seeing it again must not rewind or repeat anything.
    assert %{stage: "tomatoes"} = NpcQuest.intro_seen("Alice")
  end

  test "handing in ten tomatoes pays market price and unlocks supplies" do
    register("Alice")
    NpcQuest.intro_seen("Alice")
    Barn.add("Alice", "tomato", 10)

    price = Crops.get("tomato").sell_value * 10
    assert {:ok, %{npc: npc, balance: balance}} = NpcQuest.sell("Alice", "tomato")

    assert npc.stage == "supplies"
    assert npc.tomatoes == 10
    assert balance == 100 + price
    assert balance("Alice") == 100 + price
    assert stock("Alice", "tomato") == 0
  end

  test "handing in nine crops is rejected and changes nothing" do
    register("Alice")
    NpcQuest.intro_seen("Alice")
    Barn.add("Alice", "tomato", 9)

    assert {:error, "you need ten tomato"} = NpcQuest.sell("Alice", "tomato")
    assert balance("Alice") == 100
    assert stock("Alice", "tomato") == 9
    assert NpcQuest.status("Alice").stage == "tomatoes"
  end

  test "only the crop the current stage asks for is accepted" do
    register("Alice")
    NpcQuest.intro_seen("Alice")
    Barn.add("Alice", "lettuce", 10)

    assert {:error, "not looking for that"} = NpcQuest.sell("Alice", "lettuce")
    assert stock("Alice", "lettuce") == 10
  end

  test "the second stage needs both lettuce and wheat" do
    register("Alice")
    NpcQuest.force("Alice", %{"counters" => %{"tomatoes" => 10}})
    Barn.add("Alice", "lettuce", 10)
    Barn.add("Alice", "wheat", 10)

    assert {:ok, %{npc: after_lettuce}} = NpcQuest.sell("Alice", "lettuce")
    assert after_lettuce.stage == "supplies"
    assert after_lettuce.lettuce == 10

    assert {:ok, %{npc: done}} = NpcQuest.sell("Alice", "wheat")
    assert done.stage == "complete"
    assert done.wheat == 10
    assert stock("Alice", "lettuce") == 0
    assert stock("Alice", "wheat") == 0
    assert balance("Alice") == 100 + 70 + 40
  end

  test "a completed quest refuses further trades and stays complete" do
    register("Alice")
    NpcQuest.force("Alice", %{"stage" => "complete"})
    Barn.add("Alice", "tomato", 10)

    assert {:error, "not looking for that"} = NpcQuest.sell("Alice", "tomato")
    assert %{stage: "complete"} = NpcQuest.intro_seen("Alice")
  end

  test "force derives the stage from counters and clamps them" do
    register("Alice")

    assert {:ok, %{stage: "supplies", tomatoes: 10}} =
             NpcQuest.force("Alice", %{"counters" => %{"tomatoes" => 99}})

    assert {:ok, %{stage: "complete", tomatoes: 10, lettuce: 10, wheat: 10}} =
             NpcQuest.force("Alice", %{
               "counters" => %{"tomatoes" => 10, "lettuce" => 10, "wheat" => 10}
             })

    assert {:ok, %{stage: "tomatoes", tomatoes: 0}} =
             NpcQuest.force("Alice", %{"counters" => %{"tomatoes" => 0}})

    assert {:error, "unknown stage"} = NpcQuest.force("Alice", %{"stage" => "nonsense"})
  end

  test "resetting farms clears the quest rows" do
    register("Alice")
    NpcQuest.force("Alice", %{"stage" => "supplies"})

    FarmStore.reset()

    assert Repo.all(NpcQuestRecord) == []
  end
end
