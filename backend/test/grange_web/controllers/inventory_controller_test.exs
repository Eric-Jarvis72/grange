defmodule GrangeWeb.InventoryControllerTest do
  @moduledoc false
  use GrangeWeb.ConnCase, async: false

  alias Grange.{Accounts, FarmStore}

  @alice %{
    "username" => "Alice",
    "email" => "alice@example.test",
    "password" => "harvest-please"
  }

  setup do
    Accounts.reset()
    FarmStore.reset()
    :ok
  end

  defp json_post(conn, path, params) do
    conn
    |> put_req_header("content-type", "application/json")
    |> post(path, Jason.encode!(params))
  end

  defp json_put(conn, path, params) do
    conn
    |> put_req_header("content-type", "application/json")
    |> put(path, Jason.encode!(params))
  end

  defp register(conn \\ build_conn()), do: json_post(conn, "/api/auth/register", @alice)

  test "inventory requires a session" do
    conn = get(build_conn(), "/api/inventory")
    assert %{"ok" => false} = json_response(conn, 401)

    conn =
      json_post(build_conn(), "/api/inventory/buy", %{"item" => "tomato-seed", "quantity" => 1})

    assert %{"ok" => false} = json_response(conn, 401)

    conn = json_put(build_conn(), "/api/inventory", %{"slots" => []})
    assert %{"ok" => false} = json_response(conn, 401)
  end

  test "inventory returns the starter seeds, layout, and opening balance" do
    conn = register() |> recycle() |> get("/api/inventory")

    assert %{"ok" => true, "balance" => 100, "seeds" => seeds, "slots" => slots} =
             json_response(conn, 200)

    assert seeds["seed-bag"] == 10
    assert Enum.any?(slots, &(&1["item"] == "seed-bag" and &1["slot"] == 1))
  end

  test "saving a layout moves slots and keeps splitting stacks" do
    conn = register() |> recycle()

    slots = [
      %{"area" => "hotbar", "slot" => 0, "item" => "hoe", "count" => 1},
      %{"area" => "hotbar", "slot" => 1, "item" => "watering-can", "count" => 1},
      %{"area" => "grid", "slot" => 0, "item" => "seed-bag", "count" => 5},
      %{"area" => "grid", "slot" => 1, "item" => "seed-bag", "count" => 5}
    ]

    conn = json_put(conn, "/api/inventory", %{"slots" => slots})
    assert %{"ok" => true, "slots" => saved} = json_response(conn, 200)
    assert Enum.any?(saved, &(&1["item"] == "watering-can" and &1["slot"] == 1))

    conn = conn |> recycle() |> get("/api/inventory")
    assert %{"slots" => saved} = json_response(conn, 200)
    assert Enum.any?(saved, &(&1["item"] == "seed-bag" and &1["slot"] == 0 and &1["count"] == 5))
  end

  test "saving a layout rejects seed totals that do not match the ledger" do
    conn = register() |> recycle()

    slots = [%{"area" => "hotbar", "slot" => 1, "item" => "seed-bag", "count" => 11}]
    conn = json_put(conn, "/api/inventory", %{"slots" => slots})

    assert %{"ok" => false, "error" => "seed count mismatch"} = json_response(conn, 422)
  end

  test "buying seeds persists and debits the account" do
    conn = register() |> recycle()

    conn =
      json_post(conn, "/api/inventory/buy", %{"item" => "tomato-seed", "quantity" => 1})

    assert %{"ok" => true, "balance" => 92, "seeds" => %{"seed-bag" => 11}} =
             json_response(conn, 200)

    conn = conn |> recycle() |> get("/api/inventory")
    assert %{"balance" => 92, "seeds" => %{"seed-bag" => 11}} = json_response(conn, 200)
  end

  test "buying rejects an unaffordable or unknown seed" do
    conn = register() |> recycle()

    conn =
      json_post(conn, "/api/inventory/buy", %{"item" => "tomato-seed", "quantity" => 20})

    assert %{"ok" => false, "error" => "insufficient funds"} = json_response(conn, 400)

    conn =
      conn
      |> recycle()
      |> json_post("/api/inventory/buy", %{"item" => "midas-wheat-seed", "quantity" => 1})

    assert %{"ok" => false, "error" => "unknown seed"} = json_response(conn, 400)
  end
end
