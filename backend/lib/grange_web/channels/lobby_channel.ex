defmodule GrangeWeb.LobbyChannel do
  @moduledoc """
  Lists registered players and every farm summary, broadcasting updates.

  It also carries each signed-in player's own durable items (fishing rods and
  caught fish): they ride along with the join reply and are written back through
  `addItem` / `removeItem` pushes. Identity always comes from the session.
  """

  use Phoenix.Channel

  alias Grange.Accounts
  alias Grange.FarmStore
  alias Grange.PlayerItems

  @impl true
  def join("lobby", _payload, socket) do
    GrangeWeb.Endpoint.subscribe("lobby")
    ensure_farm(socket)
    {:ok, %{players: players(), farms: FarmStore.summaries(), items: items(socket)}, socket}
  end

  @impl true
  def handle_in("farms", _payload, socket) do
    {:reply, {:ok, %{farms: FarmStore.summaries()}}, socket}
  end

  def handle_in("addItem", %{"item" => item, "count" => count}, socket)
      when is_binary(item) and is_integer(count) do
    with_owner(socket, fn owner ->
      PlayerItems.add(owner, item, count)
      {:reply, :ok, socket}
    end)
  end

  def handle_in("addItem", _payload, socket) do
    {:reply, {:error, %{error: "invalid item"}}, socket}
  end

  def handle_in("removeItem", %{"item" => item, "count" => count}, socket)
      when is_binary(item) and is_integer(count) do
    with_owner(socket, fn owner ->
      case PlayerItems.remove(owner, item, count) do
        :ok -> {:reply, :ok, socket}
        {:error, reason} -> {:reply, {:error, %{error: reason}}, socket}
      end
    end)
  end

  def handle_in("removeItem", _payload, socket) do
    {:reply, {:error, %{error: "invalid item"}}, socket}
  end

  @impl true
  def handle_out(event, payload, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end

  defp with_owner(socket, handler) do
    case socket.assigns[:user] do
      %{username: username} -> handler.(username)
      _ -> {:reply, {:error, %{error: "not logged in"}}, socket}
    end
  end

  defp ensure_farm(socket) do
    case socket.assigns[:user] do
      %{username: username} -> FarmStore.ensure(username)
      _ -> nil
    end
  end

  defp items(socket) do
    case socket.assigns[:user] do
      %{username: username} -> PlayerItems.map(username)
      _ -> %{}
    end
  end

  defp players do
    Accounts.list_users() |> Enum.map(&%{name: &1.username})
  end
end
