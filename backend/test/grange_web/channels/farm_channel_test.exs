defmodule GrangeWeb.FarmChannelTest do
  @moduledoc false
  use GrangeWeb.ChannelCase

  alias Grange.{Accounts, Farm, FarmRecord, FarmStore, Repo}
  alias GrangeWeb.ChannelCase, as: Helper

  setup do
    Accounts.reset()
    FarmStore.reset()
    :ok
  end

  defp full_farm(owner) do
    FarmStore.ensure(owner)

    Repo.get!(FarmRecord, owner)
    |> Ecto.Changeset.change(land_level: 4)
    |> Repo.update!()

    FarmStore.view(owner)
  end

  defp signed_socket(username) do
    user = Helper.register_user(username)
    socket(GrangeWeb.UserSocket, user.id, %{user: user})
  end

  test "joining a farm replies with the farm" do
    full_farm("Alice")

    assert {:ok, reply, _socket} =
             signed_socket("Alice")
             |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    assert reply.farm.owner == "Alice"
    assert reply.farm.tiles == []
  end

  test "the owner can till and the change is broadcast" do
    full_farm("Alice")

    {:ok, _reply, socket} =
      signed_socket("Alice") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "farmAction", %{"action" => %{"kind" => "till", "x" => 1, "y" => 1}})
    assert_reply(ref, :ok)
    assert_broadcast("farmUpdate", %{farm: %{tiles: [%{state: :tilled}]}})
  end

  test "an illegal action is rejected" do
    full_farm("Alice")

    {:ok, _reply, socket} =
      signed_socket("Alice") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "farmAction", %{"action" => %{"kind" => "harvest", "x" => 0, "y" => 0}})
    assert_reply(ref, :error, reply)
    assert reply.error == "no tilled tile here"
    assert reply.seeds["seed-bag"] == 10
  end

  test "action replies carry the remaining seed count" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      signed_socket("Alice") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "farmAction", %{"action" => %{"kind" => "till", "x" => 1, "y" => 1}})
    assert_reply(ref, :ok)

    ref = push(socket, "farmAction", %{"action" => %{"kind" => "plant", "x" => 1, "y" => 1}})
    assert_reply(ref, :ok, reply)
    assert reply.seeds["seed-bag"] == 9
  end

  test "a visitor joins read-only and cannot act" do
    full_farm("Alice")

    {:ok, _reply, socket} =
      signed_socket("Bob") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "farmAction", %{"action" => %{"kind" => "till", "x" => 0, "y" => 0}})
    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end

  test "a visitor can toggle a gate but cannot place one" do
    full_farm("Alice")
    FarmStore.action("Alice", %{"kind" => "place_gate", "x" => 7, "y" => 5})

    {:ok, _reply, socket} =
      signed_socket("Bob") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref =
      push(socket, "gateAction", %{
        "action" => %{"kind" => "toggle_gate", "x" => 7, "y" => 5}
      })

    assert_reply(ref, :ok)
    assert_broadcast("farmUpdate", %{farm: %{gates: [%{open: true}]}})

    ref =
      push(socket, "farmAction", %{"action" => %{"kind" => "place_gate", "x" => 8, "y" => 5}})

    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end

  test "the owner can sell produce and the change is broadcast" do
    full_farm("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 1, "y" => 1})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 1, "y" => 1})
    FarmStore.action("Alice", %{"kind" => "water", "x" => 1, "y" => 1})

    future = System.system_time(:millisecond) + Farm.grow_ms() + 60_000
    FarmStore.tick(future)
    FarmStore.action("Alice", %{"kind" => "harvest", "x" => 1, "y" => 1})

    {:ok, _reply, socket} =
      signed_socket("Alice") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "sellProduce", %{"item" => "tomato", "count" => 1})
    assert_reply(ref, :ok)
    assert_broadcast("farmUpdate", %{farm: %{tomatoes: 0}})
  end

  test "a visitor cannot sell produce" do
    full_farm("Alice")

    {:ok, _reply, socket} =
      signed_socket("Bob") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "sellProduce", %{"item" => "tomato", "count" => 1})
    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end

  test "a signed-out socket cannot act" do
    full_farm("Alice")

    {:ok, _reply, socket} =
      socket(GrangeWeb.UserSocket)
      |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "farmAction", %{"action" => %{"kind" => "till", "x" => 0, "y" => 0}})
    assert_reply(ref, :error, reply)
    assert reply.error == "not logged in"
  end

  test "joining a missing farm fails" do
    assert {:error, %{error: "Farm not found"}} =
             signed_socket("Bob")
             |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Nobody")
  end

  test "UserSocket.connect resolves the token param" do
    user = Helper.register_user("Alice")
    token = Accounts.create_session(user.id)

    assert {:ok, connected} =
             GrangeWeb.UserSocket.connect(%{"token" => token}, socket(GrangeWeb.UserSocket), %{})

    assert connected.assigns.user.id == user.id
  end
end
