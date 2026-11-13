defmodule GrangeWeb.FarmChannelTest do
  @moduledoc false
  use GrangeWeb.ChannelCase

  import Grange.FarmFixtures

  alias Grange.{Accounts, Farm, FarmStore, Inventory, Repo}
  alias GrangeWeb.ChannelCase, as: Helper
  alias GrangeWeb.Presence

  setup do
    Accounts.reset()
    reset_farm_state()
    :ok
  end

  defp signed_socket(username) do
    user = Helper.register_user(username)
    socket(GrangeWeb.UserSocket, user.id, %{user: user})
  end

  defp join_farm(username, owner) do
    signed_socket(username)
    |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:#{owner}")
  end

  defp act(socket, kind, x \\ 1, y \\ 1, extra \\ %{}) do
    push(socket, "farmAction", %{
      "action" => Map.merge(%{"kind" => kind, "x" => x, "y" => y}, extra)
    })
  end

  test "joining a farm replies with the farm" do
    full_farm("Alice")

    assert {:ok, reply, _socket} = join_farm("Alice", "Alice")
    assert reply.farm.owner == "Alice"
    assert reply.farm.tiles == []
    refute reply.farm.is_public
    refute reply.farm.visitor_edit
  end

  test "the owner can till and the change is broadcast" do
    full_farm("Alice")
    {:ok, _reply, socket} = join_farm("Alice", "Alice")

    ref = act(socket, "till")
    assert_reply(ref, :ok)
    assert_broadcast("farmUpdate", %{farm: %{tiles: [%{state: :tilled}]}})
  end

  test "an illegal action is rejected" do
    full_farm("Alice")
    {:ok, _reply, socket} = join_farm("Alice", "Alice")

    ref = act(socket, "harvest", 0, 0)
    assert_reply(ref, :error, reply)
    assert reply.error == "no tilled tile here"
    assert reply.seeds["seed-bag"] == 10
  end

  test "action replies carry the actor's remaining seed count" do
    FarmStore.ensure("Alice")
    {:ok, _reply, socket} = join_farm("Alice", "Alice")

    assert_reply(act(socket, "till"), :ok)
    assert_reply(act(socket, "plant"), :ok, reply)
    assert reply.seeds["seed-bag"] == 9
  end

  test "a private farm rejects visitors" do
    full_farm("Alice")

    assert {:error, %{error: "farm is private"}} = join_farm("Bob", "Alice")
  end

  test "a visitor joins a public farm read-only and cannot act" do
    public_farm("Alice")
    assert {:ok, _reply, socket} = join_farm("Bob", "Alice")

    ref = act(socket, "till", 0, 0)
    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end

  test "visitor editing lets a visitor farm with their own seeds" do
    editable_farm("Alice")
    assert {:ok, _reply, socket} = join_farm("Bob", "Alice")

    assert_reply(act(socket, "till"), :ok)
    assert_reply(act(socket, "plant"), :ok, reply)

    assert reply.seeds["seed-bag"] == 9
    assert Inventory.seeds("Bob")["seed-bag"] == 9
    assert Inventory.seeds("Alice")["seed-bag"] == 10

    assert FarmStore.view("Alice").visitor_edit
    assert [%{state: :planted}] = FarmStore.view("Alice").tiles
  end

  test "a visitor harvest sends produce to the owner's barn" do
    editable_farm("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 1, "y" => 1})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 1, "y" => 1})
    FarmStore.action("Alice", %{"kind" => "water", "x" => 1, "y" => 1})
    FarmStore.tick(System.system_time(:millisecond) + Farm.grow_ms() + 60_000)

    assert {:ok, _reply, socket} = join_farm("Bob", "Alice")
    assert_reply(act(socket, "harvest", 1, 1, %{"tool" => "scythe"}), :ok)

    assert FarmStore.view("Alice").barn["tomato"] == 1
    assert FarmStore.view("Bob").barn == %{}
  end

  test "revoking visitor editing blocks the next visitor action" do
    editable_farm("Alice")
    assert {:ok, _reply, socket} = join_farm("Bob", "Alice")
    assert_reply(act(socket, "till", 0, 0), :ok)

    {:ok, _farm} = FarmStore.update_settings("Alice", %{"visitor_edit" => false})

    ref = act(socket, "till", 2, 2)
    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end

  test "a visitor can toggle a gate but cannot place one" do
    public_farm("Alice")
    FarmStore.action("Alice", %{"kind" => "place_gate", "x" => 7, "y" => 5})

    assert {:ok, _reply, socket} = join_farm("Bob", "Alice")

    ref =
      push(socket, "gateAction", %{"action" => %{"kind" => "toggle_gate", "x" => 7, "y" => 5}})

    assert_reply(ref, :ok)
    assert_broadcast("farmUpdate", %{farm: %{gates: [%{open: true}]}})

    ref = act(socket, "place_gate", 8, 5)
    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end

  test "an admin can rearrange another player's props" do
    public_farm("Alice")

    admin =
      Helper.register_user("Root")
      |> Ecto.Changeset.change(is_admin: true)
      |> Repo.update!()

    {:ok, _reply, socket} =
      socket(GrangeWeb.UserSocket, admin.id, %{user: admin})
      |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "farmPropAction", %{"action" => %{"kind" => "dig", "index" => 2}})
    assert_reply(ref, :ok)
    assert_broadcast("farmUpdate", %{farm: %{prop_overrides: overrides}})
    assert Enum.any?(overrides, &(&1.index == 2 and &1.carried))
  end

  test "a non-admin visitor cannot move props" do
    public_farm("Alice")

    {:ok, _reply, socket} =
      signed_socket("Bob") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "farmPropAction", %{"action" => %{"kind" => "dig", "index" => 2}})
    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end

  test "the owner can sell produce" do
    full_farm("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 1, "y" => 1})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 1, "y" => 1})
    FarmStore.action("Alice", %{"kind" => "water", "x" => 1, "y" => 1})
    FarmStore.tick(System.system_time(:millisecond) + Farm.grow_ms() + 60_000)
    FarmStore.action("Alice", %{"kind" => "harvest", "x" => 1, "y" => 1})

    {:ok, _reply, socket} = join_farm("Alice", "Alice")

    ref = push(socket, "sellProduce", %{"item" => "tomato", "count" => 1})
    assert_reply(ref, :ok)
    assert_broadcast("farmUpdate", %{farm: %{tomatoes: 0}})
  end

  test "a visitor cannot sell produce" do
    editable_farm("Alice")
    {:ok, _reply, socket} = join_farm("Bob", "Alice")

    ref = push(socket, "sellProduce", %{"item" => "tomato", "count" => 1})
    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end

  test "the owner can store and retrieve items from the barn" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      signed_socket("Alice") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref =
      push(socket, "barnAction", %{
        "action" => %{"kind" => "deposit", "item" => "tomato", "count" => 2}
      })

    assert_reply(ref, :ok)
    assert_broadcast("farmUpdate", %{farm: %{storage: %{"tomato" => 2}}})

    ref =
      push(socket, "barnAction", %{
        "action" => %{"kind" => "withdraw", "item" => "tomato", "count" => 1}
      })

    assert_reply(ref, :ok)
    assert_broadcast("farmUpdate", %{farm: %{storage: %{"tomato" => 1}}})
  end

  test "a visitor cannot touch the barn" do
    public_farm("Alice")

    {:ok, _reply, socket} =
      signed_socket("Bob") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref =
      push(socket, "barnAction", %{
        "action" => %{"kind" => "deposit", "item" => "tomato", "count" => 1}
      })

    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end

  test "only the owner can change settings and the change is broadcast" do
    public_farm("Alice")
    {:ok, _reply, visitor} = join_farm("Bob", "Alice")

    {:ok, _reply, owner_socket} = join_farm("Alice", "Alice")
    ref = push(owner_socket, "updateSettings", %{"is_public" => false, "visitor_edit" => false})
    assert_reply(ref, :ok, reply)
    refute reply.farm.is_public
    refute reply.farm.visitor_edit
    assert_broadcast("farmUpdate", %{farm: %{is_public: false}})

    ref = push(visitor, "updateSettings", %{"is_public" => true})
    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end

  test "presence lists visitors and clamps their reported position" do
    public_farm("Alice")

    assert {:ok, _reply, socket} = join_farm("Alice", "Alice")
    assert {:ok, _reply, _bob} = join_farm("Bob", "Alice")
    assert Map.has_key?(Presence.list("farm:Alice"), "Bob")

    assert_reply(push(socket, "move", %{"x" => -50, "y" => 5000}), :ok)

    meta =
      Presence.get_by_key("farm:Alice", "Alice") |> then(&Enum.max_by(&1.metas, fn m -> m.at end))

    assert meta.x == 16
    assert meta.y == 752

    ref = push(socket, "move", %{"x" => 20, "y" => 20})
    assert_reply(ref, :error, reply)
    assert reply.error == "move ignored"
  end

  test "pausing presence hides the player but keeps the channel joined" do
    public_farm("Alice")
    {:ok, _reply, _alice} = join_farm("Alice", "Alice")
    {:ok, _reply, bob} = join_farm("Bob", "Alice")
    assert Map.has_key?(Presence.list("farm:Alice"), "Bob")

    assert_reply(push(bob, "pausePresence", %{}), :ok)
    refute Map.has_key?(Presence.list("farm:Alice"), "Bob")

    assert_reply(push(bob, "resumePresence", %{}), :ok)
    assert Map.has_key?(Presence.list("farm:Alice"), "Bob")
  end

  test "a signed-out socket cannot join" do
    full_farm("Alice")

    assert {:error, %{error: "not logged in"}} =
             socket(GrangeWeb.UserSocket)
             |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")
  end

  test "joining a missing farm fails" do
    assert {:error, %{error: "Farm not found"}} = join_farm("Bob", "Nobody")
  end

  test "UserSocket.connect resolves the token param" do
    user = Helper.register_user("Alice")
    token = Accounts.create_session(user.id)

    assert {:ok, connected} =
             GrangeWeb.UserSocket.connect(%{"token" => token}, socket(GrangeWeb.UserSocket), %{})

    assert connected.assigns.user.id == user.id
  end
end
