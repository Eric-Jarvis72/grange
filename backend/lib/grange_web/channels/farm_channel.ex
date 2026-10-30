defmodule GrangeWeb.FarmChannel do
  @moduledoc """
  A single farm's room: read-only for visitors, actions for the owner.

  Replaces the socket.io `visitFarm` / `leaveFarm` / `farmAction` events and
  the `farmUpdate` broadcast. Identity comes from the session, never the client.
  """

  use Phoenix.Channel

  alias Grange.{FarmGateActions, FarmStore, Inventory}

  @impl true
  def join("farm:" <> owner, _payload, socket) do
    ensure_owner_farm(owner, socket)

    if FarmStore.has_farm?(owner) do
      GrangeWeb.Endpoint.subscribe("farm:" <> owner)
      {:ok, %{farm: FarmStore.view(owner)}, assign(socket, :owner, owner)}
    else
      {:error, %{error: "Farm not found"}}
    end
  end

  defp ensure_owner_farm(owner, socket) do
    case socket.assigns[:user] do
      %{username: ^owner} -> FarmStore.ensure(owner)
      _ -> nil
    end
  end

  @impl true
  def handle_in("farmAction", %{"action" => action}, socket) do
    authorize(socket, fn owner -> act(socket, owner, action) end)
  end

  @impl true
  def handle_in("gateAction", %{"action" => action}, socket) do
    case socket.assigns[:user] do
      nil -> {:reply, {:error, %{error: "not logged in"}}, socket}
      _user -> gate_act(socket, socket.assigns[:owner], action)
    end
  end

  @impl true
  def handle_in("sellProduce", %{"item" => item, "count" => count}, socket) do
    authorize(socket, fn owner -> sell(socket, owner, item, count) end)
  end

  @impl true
  def handle_in("farmPropAction", %{"action" => action}, socket) do
    authorize(socket, fn owner -> prop_act(socket, owner, action) end)
  end

  @impl true
  def handle_out(event, payload, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end

  defp authorize(socket, handler) do
    owner = socket.assigns[:owner]
    user = socket.assigns[:user]

    cond do
      is_nil(user) -> {:reply, {:error, %{error: "not logged in"}}, socket}
      user.username != owner -> {:reply, {:error, %{error: "not your farm"}}, socket}
      true -> handler.(owner)
    end
  end

  defp act(socket, owner, action) do
    case FarmStore.action(owner, action) do
      {:ok, farm} ->
        reply = %{seeds: Inventory.seeds(owner), drops: Map.get(farm, :drops, [])}
        {:reply, {:ok, reply}, socket}

      {:error, reason} ->
        reply = %{error: reason, seeds: Inventory.seeds(owner)}
        {:reply, {:error, reply}, socket}
    end
  end

  defp gate_act(socket, owner, action) do
    case FarmGateActions.toggle(owner, action) do
      {:ok, _farm} -> {:reply, :ok, socket}
      {:error, reason} -> {:reply, {:error, %{error: reason}}, socket}
    end
  end

  defp prop_act(socket, owner, action) do
    case FarmStore.prop_action(owner, action) do
      {:ok, _farm} -> {:reply, :ok, socket}
      {:error, reason} -> {:reply, {:error, %{error: reason}}, socket}
    end
  end

  defp sell(socket, owner, item, count) do
    case FarmStore.sell(owner, item, count) do
      {:ok, _farm} -> {:reply, :ok, socket}
      {:error, reason} -> {:reply, {:error, %{error: reason}}, socket}
    end
  end
end
