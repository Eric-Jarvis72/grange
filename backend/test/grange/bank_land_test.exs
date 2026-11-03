defmodule Grange.BankLandTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Accounts, Bank, FarmStore, Land}

  setup do
    Accounts.reset()
    FarmStore.reset()

    {:ok, user} =
      Accounts.register(%{
        "username" => "LandBuyer",
        "email" => "land@example.test",
        "password" => "harvest-please"
      })

    FarmStore.ensure(user.username)
    %{user: user}
  end

  test "savings transfers are persisted and never overdrawn", %{user: user} do
    assert {:ok, %{balance: 60, bank_balance: 40}} = Bank.transfer(user.id, "deposit", 40)
    assert {:error, "insufficient wallet funds"} = Bank.transfer(user.id, "deposit", 61)
    assert {:error, "insufficient savings"} = Bank.transfer(user.id, "withdraw", 41)
    assert {:ok, %{balance: 75, bank_balance: 25}} = Bank.transfer(user.id, "withdraw", 15)
    assert {:error, "enter a positive whole amount"} = Bank.transfer(user.id, "deposit", -1)
    assert {:ok, stored} = Accounts.authenticate(user.username, "harvest-please")
    assert stored.balance == 75
    assert stored.bank_balance == 25
  end

  test "starter farm stays usable and purchases expand beyond its edge", %{user: user} do
    assert FarmStore.view(user.username).land_level == 0

    assert {:ok, _farm} =
             FarmStore.action(user.username, %{"kind" => "till", "x" => 7, "y" => 2})

    assert {:error, "buy this land from the mayor first"} =
             FarmStore.action(user.username, %{"kind" => "till", "x" => 7, "y" => -1})

    assert {:ok, _} = Accounts.apply_balance_delta(user.id, 200)
    assert {:ok, %{balance: 50, land_level: 1}} = Land.buy(user.id, user.username)

    assert {:ok, _farm} =
             FarmStore.action(user.username, %{"kind" => "till", "x" => 7, "y" => -1})

    assert {:error, "insufficient wallet funds"} = Land.buy(user.id, user.username)
    assert FarmStore.view(user.username).land_level == 1
  end

  test "one farm cannot buy land for another", %{user: user} do
    FarmStore.ensure("Other")
    assert {:error, "not your farm"} = Land.buy(user.id, "Other")
  end
end
