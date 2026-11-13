defmodule GrangeWeb.InventoryController do
  @moduledoc """
  Reads and updates the signed-in account's persisted inventory layout.

  Seed totals remain server-authoritative; layout saves are validated against
  them so moving or splitting stacks cannot create seeds.
  """

  use Phoenix.Controller, formats: [:json]

  alias Grange.{Accounts, FarmStore, Inventory}

  @session_key :user_token

  def index(conn, _params) do
    case current_user(conn) do
      nil ->
        unauthorized(conn)

      user ->
        FarmStore.ensure(user.username)

        seeds =
          if user.is_admin,
            do: Inventory.grant_all_seeds(user.username),
            else: Inventory.seeds(user.username)

        json(conn, %{
          ok: true,
          seeds: seeds,
          slots: Inventory.layout(user.username),
          balance: user.balance
        })
    end
  end

  def replace(conn, params) do
    case current_user(conn) do
      nil ->
        unauthorized(conn)

      user ->
        FarmStore.ensure(user.username)
        save_layout(conn, user, Map.get(params, "slots"))
    end
  end

  def buy(conn, params) do
    case current_user(conn) do
      nil ->
        unauthorized(conn)

      user ->
        FarmStore.ensure(user.username)
        buy_seeds(conn, user, params)
    end
  end

  defp save_layout(conn, user, slots) when is_list(slots) do
    case Inventory.save_layout(user.username, slots) do
      {:ok, saved} ->
        json(conn, %{ok: true, slots: saved})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{ok: false, error: reason})
    end
  end

  defp save_layout(conn, _user, _slots) do
    conn |> put_status(:unprocessable_entity) |> json(%{ok: false, error: "invalid inventory"})
  end

  defp buy_seeds(conn, user, params) do
    item = Map.get(params, "item")
    quantity = quantity(Map.get(params, "quantity"))

    case Inventory.buy(user, item, quantity) do
      {:ok, result} ->
        json(conn, Map.put(result, :ok, true))

      {:error, reason} ->
        conn |> put_status(:bad_request) |> json(%{ok: false, error: reason})
    end
  end

  defp quantity(value) when is_integer(value), do: value

  defp quantity(value) when is_binary(value) do
    case Integer.parse(value) do
      {number, ""} -> number
      _ -> nil
    end
  end

  defp quantity(_value), do: nil

  defp unauthorized(conn) do
    conn |> put_status(:unauthorized) |> json(%{ok: false, error: "not signed in"})
  end

  defp current_user(conn) do
    case Accounts.resolve_token(get_session(conn, @session_key)) do
      {:ok, user} -> user
      :error -> nil
    end
  end
end
