defmodule GrangeWeb.LivestockController do
  @moduledoc "Account-backed livestock purchases from the marketplace pens."

  use Phoenix.Controller, formats: [:json]

  alias Grange.{Accounts, LivestockMarket}

  def buy(conn, %{"animal" => animal}) do
    case Accounts.resolve_token(get_session(conn, :user_token)) do
      :error ->
        conn |> put_status(:unauthorized) |> json(%{ok: false, error: "not signed in"})

      {:ok, user} ->
        case LivestockMarket.buy(user.id, user.username, animal) do
          {:ok, result} ->
            json(conn, Map.put(result, :ok, true))

          {:error, reason} ->
            conn |> put_status(:bad_request) |> json(%{ok: false, error: reason})
        end
    end
  end

  def buy(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{ok: false, error: "unknown animal"})
  end
end
