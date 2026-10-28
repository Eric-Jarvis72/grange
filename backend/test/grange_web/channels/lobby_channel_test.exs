defmodule GrangeWeb.LobbyChannelTest do
  @moduledoc false
  use GrangeWeb.ChannelCase

  alias Grange.{Accounts, FarmStore, PlayerItems}
  alias GrangeWeb.ChannelCase, as: Helper

  setup do
    Accounts.reset()
    FarmStore.reset()
    :ok
  end

  defp join_lobby(username) do
    user = Helper.register_user(username)

    {:ok, reply, socket} =
      socket(GrangeWeb.UserSocket, user.id, %{user: user})
      |> subscribe_and_join(GrangeWeb.LobbyChannel, "lobby")

    {reply, socket}
  end

  test "join lists players and prepares the user's farm" do
    {reply, _socket} = join_lobby("Alice")

    assert Enum.map(reply.players, & &1.name) == ["Alice"]
    assert Enum.map(reply.farms, & &1.owner) == ["Alice"]
    assert FarmStore.has_farm?("Alice")
  end

  test "registering broadcasts the player list" do
    {_reply, _socket} = join_lobby("Alice")

    {:ok, _user} =
      Accounts.register(%{
        "username" => "Bob",
        "email" => "bob@example.test",
        "password" => "harvest-please"
      })

    assert_broadcast("players", %{players: players})
    assert Enum.any?(players, &(&1.name == "Bob"))
  end

  test "farms returns the current summaries" do
    FarmStore.ensure("Bob")
    {_reply, socket} = join_lobby("Alice")

    ref = push(socket, "farms", %{})
    assert_reply(ref, :ok, reply)
    assert Enum.map(reply.farms, & &1.owner) == ["Alice", "Bob"]
  end

  test "join includes the signed-in player's durable items" do
    FarmStore.ensure("Alice")
    PlayerItems.add("Alice", "minnow", 2)
    PlayerItems.add("Alice", "fiberglass", 1)

    {reply, _socket} = join_lobby("Alice")

    assert reply.items == %{"minnow" => 2, "fiberglass" => 1}
  end

  test "a signed-out lobby join carries no items" do
    {:ok, reply, _socket} =
      socket(GrangeWeb.UserSocket) |> subscribe_and_join(GrangeWeb.LobbyChannel, "lobby")

    assert reply.items == %{}
  end

  test "addItem and removeItem persist for the signed-in player" do
    {_reply, socket} = join_lobby("Alice")

    ref = push(socket, "addItem", %{"item" => "minnow", "count" => 3})
    assert_reply(ref, :ok)
    assert PlayerItems.map("Alice") == %{"minnow" => 3}

    ref = push(socket, "removeItem", %{"item" => "minnow", "count" => 1})
    assert_reply(ref, :ok)
    assert PlayerItems.map("Alice") == %{"minnow" => 2}
  end

  test "removeItem refuses to overdraw" do
    {_reply, socket} = join_lobby("Alice")

    ref = push(socket, "removeItem", %{"item" => "minnow", "count" => 1})
    assert_reply(ref, :error, reply)
    assert reply.error == "not enough minnow"
  end

  test "a signed-out socket cannot add items" do
    {:ok, _reply, socket} =
      socket(GrangeWeb.UserSocket) |> subscribe_and_join(GrangeWeb.LobbyChannel, "lobby")

    ref = push(socket, "addItem", %{"item" => "minnow", "count" => 1})
    assert_reply(ref, :error, reply)
    assert reply.error == "not logged in"
  end
end
