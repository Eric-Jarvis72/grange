defmodule Grange.AccountsTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Accounts, AuthToken}

  setup do
    Accounts.reset()
    :ok
  end

  defp register(attrs \\ %{}) do
    Accounts.register(
      Map.merge(
        %{
          "username" => "Alice",
          "email" => "alice@example.test",
          "password" => "harvest-please"
        },
        attrs
      )
    )
  end

  test "registers a user and hides the password hash in JSON" do
    assert {:ok, user} = register()
    assert user.username == "Alice"
    assert user.email == "alice@example.test"
    refute Map.has_key?(Jason.encode!(user) |> Jason.decode!(), "password_hash")
  end

  test "rejects invalid usernames, emails, and short passwords" do
    assert {:error, message} = register(%{"username" => "ab"})
    assert message =~ "3-32"

    assert {:error, message} = register(%{"email" => "nope"})
    assert message =~ "valid email"

    assert {:error, message} = register(%{"password" => "short"})
    assert message =~ "at least 8"
  end

  test "rejects duplicate usernames and emails" do
    assert {:ok, _user} = register()

    assert {:error, "that username is taken"} =
             register(%{"email" => "other@example.test"})

    assert {:error, "that email is already registered"} =
             register(%{"username" => "Bob"})
  end

  test "an unverified account cannot authenticate" do
    {:ok, _user} = register()

    assert {:error, :unverified} = Accounts.authenticate("Alice", "harvest-please")
  end

  test "authenticates with the right password only once verified" do
    {:ok, user} = register()
    {:ok, _} = Accounts.verify_email(AuthToken.issue(user.id, :verify_email))

    assert {:ok, verified} = Accounts.authenticate("Alice", "harvest-please")
    assert verified.id == user.id
    assert {:error, "invalid username or password"} = Accounts.authenticate("Alice", "wrong")
    assert {:error, "invalid username or password"} = Accounts.authenticate("Nobody", "whatever")
  end

  test "verify_email is single-use and stamps the account" do
    {:ok, user} = register()
    token = AuthToken.issue(user.id, :verify_email)

    assert {:ok, verified} = Accounts.verify_email(token)
    assert verified.email_verified_at

    assert {:error, "this verification link is invalid or expired"} =
             Accounts.verify_email(token)

    assert {:error, _} = Accounts.verify_email("bogus")
  end

  test "reset_password validates before spending the link and clears sessions" do
    {:ok, user} = register()
    {:ok, _} = Accounts.verify_email(AuthToken.issue(user.id, :verify_email))
    session = Accounts.create_session(user.id)

    token = AuthToken.issue(user.id, :reset_password)
    assert {:error, message} = Accounts.reset_password(token, "short")
    assert message =~ "at least 8"

    # The too-short attempt did not burn the link.
    assert {:ok, _} = Accounts.reset_password(token, "brand-new-pass")

    assert :error = Accounts.resolve_token(session)
    assert {:ok, _} = Accounts.authenticate("Alice", "brand-new-pass")
  end

  test "resend and reset requests are uniform" do
    {:ok, _user} = register()

    assert :ok = Accounts.resend_verification("alice@example.test")
    assert :ok = Accounts.resend_verification("nobody@example.test")
    assert :ok = Accounts.request_password_reset("alice@example.test")
    assert :ok = Accounts.request_password_reset("nobody@example.test")
  end

  test "session tokens resolve to the user and can be destroyed" do
    {:ok, user} = register()
    token = Accounts.create_session(user.id)

    assert {:ok, ^user} = Accounts.resolve_token(token)
    assert :error = Accounts.resolve_token(nil)
    assert :error = Accounts.resolve_token("bogus")

    assert :ok = Accounts.destroy_session(token)
    assert :error = Accounts.resolve_token(token)
  end

  test "list_users is sorted and reset clears everything" do
    {:ok, _} = register(%{"username" => "Charlie", "email" => "c@example.test"})
    {:ok, _} = register(%{"username" => "Alice", "email" => "a@example.test"})

    assert Enum.map(Accounts.list_users(), & &1.username) == ["Alice", "Charlie"]

    assert :ok = Accounts.reset()
    assert Accounts.list_users() == []
  end

  test "new users start at the opening balance, included in JSON" do
    assert {:ok, user} = register()
    assert user.balance == 100

    decoded = user |> Jason.encode!() |> Jason.decode!()
    assert decoded["balance"] == 100
  end

  test "new users are not admins, and is_admin is included in JSON" do
    assert {:ok, user} = register()
    refute user.is_admin

    decoded = user |> Jason.encode!() |> Jason.decode!()
    assert decoded["is_admin"] == false
  end

  test "apply_balance_delta spends, earns, and clamps at zero" do
    {:ok, user} = register()

    assert {:ok, 70} = Accounts.apply_balance_delta(user.id, -30)
    assert {:ok, 75} = Accounts.apply_balance_delta(user.id, 5)
    assert {:ok, 0} = Accounts.apply_balance_delta(user.id, -1_000)

    stored = Enum.find(Accounts.list_users(), &(&1.id == user.id))
    assert stored.balance == 0
  end

  test "apply_balance_delta rejects bad deltas and unknown users" do
    {:ok, user} = register()

    assert {:error, _} = Accounts.apply_balance_delta(user.id, "loot")
    assert {:error, _} = Accounts.apply_balance_delta(user.id, 1.5)
    assert {:error, _} = Accounts.apply_balance_delta("missing", 10)
  end

  test "register_admin creates an admin with an effectively unlimited balance" do
    assert {:ok, user} =
             Accounts.register_admin(%{
               "username" => "Root",
               "email" => "root@example.test",
               "password" => "harvest-please"
             })

    assert user.is_admin
    assert user.balance == 1_000_000_000

    decoded = user |> Jason.encode!() |> Jason.decode!()
    assert decoded["is_admin"] == true
    assert decoded["balance"] == 1_000_000_000
  end

  test "admins never spend down their balance, but can still earn" do
    {:ok, user} =
      Accounts.register_admin(%{
        "username" => "Root",
        "email" => "root@example.test",
        "password" => "harvest-please"
      })

    assert {:ok, 1_000_000_000} = Accounts.apply_balance_delta(user.id, -500)
    assert {:ok, 1_000_000_050} = Accounts.apply_balance_delta(user.id, 50)
  end

  test "grant_admin promotes an existing account and tops up its balance" do
    {:ok, user} = register()
    refute user.is_admin

    assert {:ok, promoted} = Accounts.grant_admin("Alice")
    assert promoted.id == user.id
    assert promoted.is_admin
    assert promoted.balance == 1_000_000_000

    assert {:error, "unknown user"} = Accounts.grant_admin("Nobody")
  end

  test "grant_admin can reset the password so the login is known" do
    {:ok, user} = register()
    {:ok, _} = Accounts.verify_email(AuthToken.issue(user.id, :verify_email))

    assert {:ok, promoted} = Accounts.grant_admin("Alice", "brand-new-pass")
    assert promoted.is_admin

    assert {:ok, _} = Accounts.authenticate("Alice", "brand-new-pass")
    assert {:error, _} = Accounts.authenticate("Alice", "harvest-please")
  end
end
