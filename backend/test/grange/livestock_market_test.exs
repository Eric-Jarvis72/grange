defmodule Grange.LivestockMarketTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Accounts, FarmStore, LivestockMarket}

  setup do
    Accounts.reset()
    FarmStore.reset()

    {:ok, user} =
      Accounts.register(%{
        "username" => "LivestockBuyer",
        "email" => "livestock@example.test",
        "password" => "harvest-please"
      })

    FarmStore.ensure(user.username)
    %{user: user}
  end

  test "purchase spends real funds and survives farm reload", %{user: user} do
    assert {:ok, %{balance: 75, owned: 1}} =
             LivestockMarket.buy(user.id, user.username, "hen")

    assert {:ok, %{balance: 50, owned: 2}} =
             LivestockMarket.buy(user.id, user.username, "hen")

    assert FarmStore.view(user.username).animals == %{"hen" => 2}
    assert {:ok, stored} = Accounts.authenticate(user.username, "harvest-please")
    assert stored.balance == 50
  end

  test "rejects unaffordable, unknown, and cross-farm purchases", %{user: user} do
    assert {:error, "insufficient funds"} =
             LivestockMarket.buy(user.id, user.username, "cow")

    assert {:error, "unknown animal"} =
             LivestockMarket.buy(user.id, user.username, "dragon")

    FarmStore.ensure("SomeoneElse")

    assert {:error, "not your farm"} =
             LivestockMarket.buy(user.id, "SomeoneElse", "hen")

    assert FarmStore.view(user.username).animals == %{}
    assert {:ok, stored} = Accounts.authenticate(user.username, "harvest-please")
    assert stored.balance == 100
  end
end
