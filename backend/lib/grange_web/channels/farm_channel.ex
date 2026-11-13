defmodule GrangeWeb.FarmChannel do
  @moduledoc """
  A single farm's room: presence for visitors plus farm actions.

  Owners always join. Strangers may join a public farm read-only, and may act
  only while the owner has enabled visitor editing. Identity comes from the
  session, never the client, and the persisted settings are re-checked on every
  action so revoking edit permission takes effect immediately.

  Admins may also rearrange props on any farm, and the owner manages the barn
  through the `barnAction` event.
  """

  use Phoenix.Channel

  alias Grange.{BarnStorage, FarmGateActions, FarmSettings, FarmStore, Inventory, WorldPosition}
  alias GrangeWeb.Presence

  # A client sends at ~10 Hz; this only guards against abusive or buggy loops.
  @min_move_interval_ms 50

  @impl true
  def join("farm:" <> owner, _payload, socket) do
    case socket.assigns[:user] do
      %{username: username} ->
        join_farm(owner, username, socket)

      _ ->
        {:error, %{error: "not logged in"}}
    end
  end

  defp join_farm(owner, username, socket) do
    # Every account that can act needs its own farm row first: inventory and
    # barn rows reference `farms.owner`, and a visitor may plant with seeds.
    FarmStore.ensure(username)

    cond do
      not FarmStore.has_farm?(owner) ->
        {:error, %{error: "Farm not found"}}

      username != owner and not FarmSettings.public?(owner) ->
        {:error, %{error: "farm is private"}}

      true ->
        GrangeWeb.Endpoint.subscribe("farm:" <> owner)
        track(username, owner, nil, nil)
        send(self(), :after_join)
        {:ok, %{farm: FarmStore.view(owner)}, assign(socket, :owner, owner)}
    end
  end

  @impl true
  def handle_info(:after_join, socket) do
    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end

  @impl true
  def handle_in("farmAction", %{"action" => action}, socket) do
    authorize_edit(socket, fn owner, actor -> act(socket, owner, actor, action) end)
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
    authorize_owner(socket, fn owner -> sell(socket, owner, item, count) end)
  end

  @impl true
  def handle_in("farmPropAction", %{"action" => action}, socket) do
    authorize_prop(socket, fn owner -> prop_act(socket, owner, action) end)
  end

  @impl true
  def handle_in("barnAction", %{"action" => action}, socket) do
    authorize_owner(socket, fn owner -> barn_act(socket, owner, action) end)
  end

  @impl true
  def handle_in("updateSettings", payload, socket) when is_map(payload) do
    authorize_owner(socket, fn owner -> update_settings(socket, owner, payload) end)
  end

  def handle_in("updateSettings", _payload, socket) do
    {:reply, {:error, %{error: "invalid settings"}}, socket}
  end

  @impl true
  def handle_in("move", %{"x" => x, "y" => y}, socket) do
    user = socket.assigns[:user]
    owner = socket.assigns[:owner]
    now = System.monotonic_time(:millisecond)

    with %{username: username} <- user,
         true <- is_binary(owner),
         true <- throttle_open?(socket.assigns[:last_move_at], now),
         {:ok, {px, py}} <- WorldPosition.clamp(x, y) do
      track(username, owner, px, py)
      {:reply, :ok, assign(socket, :last_move_at, now)}
    else
      _ -> {:reply, {:error, %{error: "move ignored"}}, socket}
    end
  end

  def handle_in("move", _payload, socket) do
    {:reply, {:error, %{error: "move ignored"}}, socket}
  end

  # Farm presence is paused while the player travels into a hub; the channel
  # stays joined so owner-only actions such as selling produce still work.
  @impl true
  def handle_in("pausePresence", _payload, socket) do
    with %{username: username} <- socket.assigns[:user],
         owner when is_binary(owner) <- socket.assigns[:owner] do
      Presence.untrack(self(), "farm:" <> owner, username)
      {:reply, :ok, socket}
    else
      _ -> {:reply, {:error, %{error: "not logged in"}}, socket}
    end
  end

  @impl true
  def handle_in("resumePresence", _payload, socket) do
    with %{username: username} <- socket.assigns[:user],
         owner when is_binary(owner) <- socket.assigns[:owner] do
      track(username, owner, nil, nil)
      {:reply, :ok, socket}
    else
      _ -> {:reply, {:error, %{error: "not logged in"}}, socket}
    end
  end

  @impl true
  def handle_out(event, payload, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end

  # Farm actions require owner or an enabled visitor-edit flag.
  defp authorize_edit(socket, handler) do
    owner = socket.assigns[:owner]
    user = socket.assigns[:user]

    cond do
      is_nil(user) -> {:reply, {:error, %{error: "not logged in"}}, socket}
      user.username == owner -> handler.(owner, user.username)
      FarmStore.edit_allowed?(owner) -> handler.(owner, user.username)
      true -> {:reply, {:error, %{error: "not your farm"}}, socket}
    end
  end

  # Settings, barn actions, and sales always stay with the owner.
  defp authorize_owner(socket, handler) do
    owner = socket.assigns[:owner]
    user = socket.assigns[:user]

    cond do
      is_nil(user) -> {:reply, {:error, %{error: "not logged in"}}, socket}
      user.username != owner -> {:reply, {:error, %{error: "not your farm"}}, socket}
      true -> handler.(owner)
    end
  end

  # Props are normally the owner's (or an enabled visitor's), but admins may
  # rearrange buildings on any farm.
  defp authorize_prop(socket, handler) do
    owner = socket.assigns[:owner]
    user = socket.assigns[:user]

    cond do
      is_nil(user) -> {:reply, {:error, %{error: "not logged in"}}, socket}
      user.username == owner -> handler.(owner)
      user.is_admin -> handler.(owner)
      FarmStore.edit_allowed?(owner) -> handler.(owner)
      true -> {:reply, {:error, %{error: "not your farm"}}, socket}
    end
  end

  defp act(socket, owner, actor, action) do
    case FarmStore.action(owner, action, actor) do
      {:ok, farm} ->
        reply = %{seeds: Inventory.seeds(actor), drops: Map.get(farm, :drops, [])}
        {:reply, {:ok, reply}, socket}

      {:error, reason} ->
        reply = %{error: reason, seeds: Inventory.seeds(actor)}
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

  defp barn_act(socket, owner, action) do
    with {:ok, :ok} <- BarnStorage.action(owner, action),
         {:ok, _farm} <- FarmStore.refresh(owner) do
      {:reply, :ok, socket}
    else
      {:error, reason} -> {:reply, {:error, %{error: reason}}, socket}
    end
  end

  defp update_settings(socket, owner, payload) do
    case FarmStore.update_settings(owner, payload) do
      {:ok, farm} -> {:reply, {:ok, %{farm: farm}}, socket}
      {:error, reason} -> {:reply, {:error, %{error: reason}}, socket}
    end
  end

  defp track(username, owner, x, y) do
    topic = "farm:" <> owner
    meta = %{name: username, x: x, y: y, at: System.system_time(:millisecond)}

    case Presence.update(self(), topic, username, meta) do
      {:ok, _ref} -> :ok
      {:error, _reason} -> Presence.track(self(), topic, username, meta)
    end
  end

  defp throttle_open?(nil, _now), do: true
  defp throttle_open?(last, now), do: now - last >= @min_move_interval_ms
end
