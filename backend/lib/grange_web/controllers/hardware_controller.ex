defmodule GrangeWeb.HardwareController do
  @moduledoc "Handles hardware-store purchases for the signed-in account."

  use Phoenix.Controller, formats: [:json]

  alias Grange.{Accounts, FarmStore, Hardware}

  @session_key :user_token

  def buy(conn, params) do
    case current_user(conn) do
      nil ->
        unauthorized(conn)

      user ->
        FarmStore.ensure(user.username)
        buy(conn, user, Map.get(params, "item"), quantity(Map.get(params, "quantity")))
    end
  end

  defp buy(conn, user, item, quantity) do
    case Hardware.buy(user, item, quantity) do
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
