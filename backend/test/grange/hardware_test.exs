defmodule Grange.HardwareTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Accounts, FarmStore, Hardware}

  setup do
    FarmStore.reset()
    Accounts.reset()
    :ok
  end

  defp user(username) do
    {:ok, user} =
      Accounts.register(%{
        "username" => username,
        "email" => "#{username}@example.test",
        "password" => "harvest-please"
      })

    FarmStore.ensure(username)
    user
  end

  test "buying a sprinkler debits the wallet and stocks the farm supply" do
    user = user("Buyer")

    assert Hardware.price("sprinkler") == 75

    assert {:ok, result} = Hardware.buy(user, "sprinkler", 1)
    assert result.balance == 25
    assert result.item == "sprinkler"
    assert result.count == 1
    assert FarmStore.view("Buyer").sprinkler_count == 1

    assert {:error, "insufficient funds"} = Hardware.buy(user, "sprinkler", 1)
    assert FarmStore.view("Buyer").sprinkler_count == 1
  end

  test "fences and gates restock their supplies" do
    user = user("Builder")

    assert {:ok, result} = Hardware.buy(user, "fence", 3)
    assert result.count == 23
    assert FarmStore.view("Builder").fence_count == 23

    assert {:ok, result} = Hardware.buy(user, "gate", 2)
    assert result.count == 4
    assert FarmStore.view("Builder").gate_count == 4
  end

  test "unknown and invalid purchases are rejected" do
    user = user("Shopper")

    assert {:error, "unknown item"} = Hardware.buy(user, "tractor", 1)
    assert {:error, "invalid purchase"} = Hardware.buy(user, "sprinkler", 0)
  end
end
