defmodule GrangeWeb.DevController do
  @moduledoc """
  Test-only shortcuts for the browser suite.

  Every action is mounted only while `enable_test_routes` is on (development
  and test), exactly like `/api/reset`, so a production build cannot reach it.
  """

  use Phoenix.Controller, formats: [:json]

  alias Grange.{Accounts, Barn, Crops, FarmStore, NpcQuest, PlayerItems}

  @session_key :user_token

  @doc """
  Seeds the signed-in player's farmhand quest and/or barn.

  Body: `{"stage": ..., "counters": {"tomatoes": 10}, "barn": {"tomato": 10}}`.
  Every field is optional; an omitted stage is derived from the counters.
  """
  def npc(conn, params) do
    case Accounts.resolve_token(get_session(conn, @session_key)) do
      {:ok, user} ->
        FarmStore.ensure(user.username)
        seed_npc(conn, user.username, params)

      :error ->
        unauthorized(conn)
    end
  end

  defp seed_npc(conn, owner, params) do
    with {:ok, _npc} <- NpcQuest.force(owner, params),
         :ok <- fill_barn(owner, Map.get(params, "barn")),
         {:ok, farm} <- FarmStore.refresh(owner) do
      npc = NpcQuest.status(owner)
      # The farm snapshot has no quest fields, so tell the room directly.
      GrangeWeb.Endpoint.broadcast("farm:" <> owner, "npcUpdate", %{npc: npc})
      json(conn, %{ok: true, npc: npc, barn: farm.barn})
    else
      {:error, reason} when is_binary(reason) ->
        conn |> put_status(:bad_request) |> json(%{ok: false, error: reason})
    end
  end

  @doc "Promotes the signed-in player to admin for e2e coverage."
  def promote(conn, _params) do
    case Accounts.resolve_token(get_session(conn, @session_key)) do
      {:ok, user} ->
        case Accounts.grant_admin(user.username) do
          {:ok, admin} ->
            json(conn, %{ok: true, user: admin})

          {:error, reason} ->
            conn |> put_status(:bad_request) |> json(%{ok: false, error: reason})
        end

      :error ->
        unauthorized(conn)
    end
  end

  @doc "Grants catalyst items to the signed-in player for e2e coverage."
  def item(conn, params) do
    case Accounts.resolve_token(get_session(conn, @session_key)) do
      {:ok, user} ->
        FarmStore.ensure(user.username)
        grant_item(conn, user.username, params)

      :error ->
        unauthorized(conn)
    end
  end

  defp grant_item(conn, owner, params) do
    item = Map.get(params, "item")
    count = Map.get(params, "count", 1)

    if is_binary(item) and Crops.catalyst?(item) and is_integer(count) and count > 0 do
      PlayerItems.add(owner, item, count)
      json(conn, %{ok: true, items: PlayerItems.map(owner)})
    else
      conn |> put_status(:bad_request) |> json(%{ok: false, error: "invalid item"})
    end
  end

  @doc "Forces every pending catalyst to resolve, for deterministic e2e tests."
  def dawn(conn, _params) do
    case Accounts.resolve_token(get_session(conn, @session_key)) do
      {:ok, user} ->
        FarmStore.ensure(user.username)
        json(conn, %{ok: true, applied: FarmStore.apply_dawn_catalysts()})

      :error ->
        unauthorized(conn)
    end
  end

  defp fill_barn(_owner, nil), do: :ok

  defp fill_barn(owner, barn) when is_map(barn) do
    Enum.reduce_while(barn, :ok, fn {item, count}, :ok ->
      if is_binary(item) and is_integer(count) and count > 0 and Crops.get(item) do
        Barn.add(owner, item, count)
        {:cont, :ok}
      else
        {:halt, {:error, "invalid barn"}}
      end
    end)
  end

  defp fill_barn(_owner, _barn), do: {:error, "invalid barn"}

  defp unauthorized(conn) do
    conn |> put_status(:unauthorized) |> json(%{ok: false, error: "not signed in"})
  end
end
