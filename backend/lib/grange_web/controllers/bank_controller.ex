defmodule GrangeWeb.BankController do
  @moduledoc "Authenticated banking and land-purchase endpoints."
  use Phoenix.Controller, formats: [:json]

  alias Grange.{Accounts, Bank, Land}

  def balance(conn, _params) do
    case signed_in(conn) do
      {:ok, user} ->
        json(conn, %{ok: true, balance: user.balance, bank_balance: user.bank_balance})

      :error ->
        unauthorized(conn)
    end
  end

  def transfer(conn, params) do
    case signed_in(conn) do
      {:ok, user} -> reply(conn, Bank.transfer(user.id, params["direction"], params["amount"]))
      :error -> unauthorized(conn)
    end
  end

  def buy_land(conn, _params) do
    case signed_in(conn) do
      {:ok, user} -> reply(conn, Land.buy(user.id, user.username))
      :error -> unauthorized(conn)
    end
  end

  defp signed_in(conn), do: Accounts.resolve_token(get_session(conn, :user_token))

  defp reply(conn, {:ok, result}), do: json(conn, Map.put(result, :ok, true))

  defp reply(conn, {:error, reason}) do
    conn |> put_status(:bad_request) |> json(%{ok: false, error: reason})
  end

  defp unauthorized(conn) do
    conn |> put_status(:unauthorized) |> json(%{ok: false, error: "not signed in"})
  end
end
