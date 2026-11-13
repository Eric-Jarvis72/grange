defmodule GrangeWeb.HubChannel do
  @moduledoc """
  Live player presence for one shared hub area (`hub:marketplace`/`hub:casino`).

  Every signed-in player in the same area appears to the others. Identity comes
  from the socket session, never the payload. Positions are cosmetic: they are
  clamped to the map and lightly throttled, but the server does not simulate
  movement. Farms are deliberately not hubs; this channel is never used there.

  Presence is keyed by username, so a second browser tab groups under the same
  key and the client renders a single avatar per account.
  """

  use Phoenix.Channel

  alias Grange.Hub
  alias GrangeWeb.Presence

  # A client sends at ~10 Hz; this only guards against abusive or buggy loops.
  @min_move_interval_ms 50

  @impl true
  def join("hub:" <> area, _payload, socket) do
    case socket.assigns[:user] do
      %{username: username} ->
        if Hub.area?(area) do
          track(username, area, nil, nil)
          send(self(), :after_join)

          {:ok, %{area: area}, assign(socket, :hub, %{area: area, last_move_at: nil})}
        else
          {:error, %{reason: "unknown area"}}
        end

      _ ->
        {:error, %{reason: "not logged in"}}
    end
  end

  def join(_topic, _payload, _socket), do: {:error, %{reason: "unknown area"}}

  @impl true
  def handle_info(:after_join, socket) do
    # The Phoenix Presence client needs this snapshot; without it it treats
    # every following diff as pending and never syncs.
    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end

  @impl true
  def handle_in("move", %{"x" => x, "y" => y}, socket) do
    hub = socket.assigns[:hub]
    user = socket.assigns[:user]
    now = monotonic_ms()

    with %{area: area} <- hub,
         %{username: username} <- user,
         true <- throttle_open?(hub.last_move_at, now),
         {:ok, {px, py}} <- Hub.clamp_position(x, y) do
      track(username, area, px, py)
      {:reply, :ok, assign(socket, :hub, %{hub | last_move_at: now})}
    else
      _ -> {:reply, {:error, %{error: "move ignored"}}, socket}
    end
  end

  def handle_in("move", _payload, socket) do
    {:reply, {:error, %{error: "move ignored"}}, socket}
  end

  # Presence is keyed by username; update this channel's metadata in place, or
  # track it the first time. A second tab gets its own entry and the client
  # renders only the newest one per account.
  defp track(username, area, x, y) do
    topic = "hub:#{area}"
    meta = %{name: username, x: x, y: y, at: System.system_time(:millisecond)}

    case Presence.update(self(), topic, username, meta) do
      {:ok, _ref} -> :ok
      {:error, _reason} -> Presence.track(self(), topic, username, meta)
    end
  end

  defp monotonic_ms, do: System.monotonic_time(:millisecond)

  # Monotonic time may be negative, so "never moved" is represented by nil.
  defp throttle_open?(nil, _now), do: true
  defp throttle_open?(last, now), do: now - last >= @min_move_interval_ms
end
