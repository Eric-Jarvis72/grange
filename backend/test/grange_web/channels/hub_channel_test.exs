defmodule GrangeWeb.HubChannelTest do
  @moduledoc false
  use GrangeWeb.ChannelCase

  alias Grange.Accounts
  alias GrangeWeb.ChannelCase, as: Helper
  alias GrangeWeb.Presence

  setup do
    Accounts.reset()
    :ok
  end

  defp join_hub(username, area) do
    user = Helper.register_user(username)

    {:ok, reply, socket} =
      socket(GrangeWeb.UserSocket, user.id, %{user: user})
      |> subscribe_and_join(GrangeWeb.HubChannel, "hub:#{area}")

    {reply, socket}
  end

  # Each test uses a distinct account so lingering presence from another test
  # can never be mistaken for this one.
  defp meta(area, username) do
    case Presence.get_by_key("hub:#{area}", username) do
      %{metas: metas} when metas != [] -> Enum.max_by(metas, & &1.at)
      _ -> nil
    end
  end

  test "join announces the area and tracks the player" do
    {reply, _socket} = join_hub("Join-Alice", "marketplace")

    assert reply.area == "marketplace"
    assert %{name: "Join-Alice", x: nil, y: nil} = meta("marketplace", "Join-Alice")
  end

  test "join pushes the presence snapshot the client needs" do
    {_reply, _socket} = join_hub("Snapshot-Ivy", "marketplace")

    assert_push("presence_state", %{"Snapshot-Ivy" => %{metas: [%{x: nil, y: nil}]}})
  end

  test "join requires a signed-in socket" do
    assert {:error, %{reason: "not logged in"}} =
             socket(GrangeWeb.UserSocket, nil, %{})
             |> subscribe_and_join(GrangeWeb.HubChannel, "hub:casino")
  end

  test "join rejects unknown areas" do
    user = Helper.register_user("Area-Bob")

    assert {:error, %{reason: "unknown area"}} =
             socket(GrangeWeb.UserSocket, user.id, %{user: user})
             |> subscribe_and_join(GrangeWeb.HubChannel, "hub:lobby")
  end

  test "move tracks the reported position" do
    {_reply, socket} = join_hub("Move-Carol", "marketplace")

    ref = push(socket, "move", %{"x" => 400.5, "y" => 300})
    assert_reply(ref, :ok)

    assert %{name: "Move-Carol", x: 400.5, y: 300} = meta("marketplace", "Move-Carol")
  end

  test "move clamps coordinates into the map" do
    {_reply, socket} = join_hub("Clamp-Dave", "casino")

    ref = push(socket, "move", %{"x" => 99_999, "y" => -20})
    assert_reply(ref, :ok)

    assert %{x: 1136, y: 32} = meta("casino", "Clamp-Dave")
  end

  test "move ignores malformed payloads" do
    {_reply, socket} = join_hub("Bad-Erin", "casino")

    ref = push(socket, "move", %{"x" => "east", "y" => 1})
    assert_reply(ref, :error, %{error: "move ignored"})

    assert %{x: nil, y: nil} = meta("casino", "Bad-Erin")
  end

  test "players only appear in the area they joined" do
    {_reply, _socket} = join_hub("Area-Frank", "casino")

    assert meta("casino", "Area-Frank")
    assert meta("marketplace", "Area-Frank") == nil
  end
end
