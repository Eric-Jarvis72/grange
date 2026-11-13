defmodule Grange.Accounts do
  @moduledoc """
  Accounts and sessions, persisted in the database.

  Validation messages match the previous in-memory implementation so the SPA
  and tests see the same contract. Session tokens are handed to the client as
  opaque strings; only a SHA-256 hash is stored, so a database leak cannot be
  replayed.
  """

  import Ecto.Query

  alias Grange.{AuthToken, Mailer, Repo, Session, User}

  @username_re ~r/^[a-zA-Z0-9_-]{3,32}$/
  @email_re ~r/^[^\s@]+@[^\s@]+\.[^\s@]+$/
  @min_password 8
  @token_bytes 32
  @ttl_seconds 30 * 24 * 60 * 60
  @lobby_topic "lobby"
  # Admins are seeded with a balance large enough to read as "unlimited" for
  # any in-game price; debits against it are ignored (see apply_balance_delta/2).
  @admin_balance 1_000_000_000

  @spec register(map()) :: {:ok, User.t()} | {:error, String.t()}
  def register(attrs) do
    username = attrs |> fetch(:username) |> String.trim()
    email = attrs |> fetch(:email) |> String.trim() |> String.downcase()
    password = fetch(attrs, :password)

    with :ok <- validate_username(username),
         :ok <- validate_email(email),
         :ok <- validate_password(password),
         :ok <- ensure_unique(username, email) do
      insert_user(username, email, password)
    end
  end

  @spec authenticate(String.t(), String.t()) ::
          {:ok, User.t()} | {:error, String.t() | :unverified}
  def authenticate(username, password) do
    case Repo.get_by(User, username: username) do
      nil ->
        # Hash anyway so a missing account takes the same time as a wrong password.
        _ = hash(password)
        {:error, "invalid username or password"}

      %User{} = user ->
        cond do
          not Argon2.verify_pass(password, user.password_hash) ->
            {:error, "invalid username or password"}

          is_nil(user.email_verified_at) ->
            {:error, :unverified}

          true ->
            {:ok, user}
        end
    end
  end

  @spec create_session(String.t()) :: String.t()
  def create_session(user_id) do
    token = :crypto.strong_rand_bytes(@token_bytes) |> Base.url_encode64(padding: false)

    %Session{
      token_hash: hash_token(token),
      user_id: user_id,
      expires_at: DateTime.add(DateTime.utc_now(), @ttl_seconds, :second)
    }
    |> Repo.insert!()

    token
  end

  @spec resolve_token(String.t() | nil) :: {:ok, User.t()} | :error
  def resolve_token(token) when token in [nil, ""], do: :error

  def resolve_token(token) do
    case Repo.get(Session, hash_token(token)) do
      nil -> :error
      session -> resolve_session(session)
    end
  end

  @spec destroy_session(String.t() | nil) :: :ok
  def destroy_session(token) when token in [nil, ""], do: :ok

  def destroy_session(token) do
    Repo.delete_all(from(s in Session, where: s.token_hash == ^hash_token(token)))
    :ok
  end

  @spec list_users() :: [User.t()]
  def list_users, do: Repo.all(from(u in User, order_by: u.username))

  @spec apply_balance_delta(String.t(), integer()) ::
          {:ok, non_neg_integer()} | {:error, String.t()}
  def apply_balance_delta(user_id, delta) when is_integer(delta) do
    case Repo.get(User, user_id) do
      nil ->
        {:error, "unknown user"}

      %User{is_admin: true} = user when delta < 0 ->
        # Admins draw on effective infinity: a debit never lowers the balance.
        {:ok, user.balance}

      %User{} = user ->
        # Spend/earn delta, clamped at zero so a balance can never go negative.
        balance = max(0, user.balance + delta)
        user |> Ecto.Changeset.change(balance: balance) |> Repo.update!()
        {:ok, balance}
    end
  end

  def apply_balance_delta(_user_id, _delta), do: {:error, "delta must be an integer"}

  @doc """
  Registers an account and promotes it to admin.

  Admins are handed the whole item catalog by the SPA and are given a balance
  large enough to be effectively unlimited. Used by `mix grange.create_admin`.
  """
  @spec register_admin(map()) :: {:ok, User.t()} | {:error, String.t()}
  def register_admin(attrs) do
    case register(attrs) do
      {:ok, user} -> promote(user, nil)
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Promotes an existing account to admin by username."
  @spec grant_admin(String.t()) :: {:ok, User.t()} | {:error, String.t()}
  def grant_admin(username), do: grant_admin(username, nil)

  @doc """
  Promotes an existing account to admin, optionally resetting its password so
  the operator always ends up with a login they know.
  """
  @spec grant_admin(String.t(), String.t() | nil) :: {:ok, User.t()} | {:error, String.t()}
  def grant_admin(username, password) do
    case Repo.get_by(User, username: username) do
      nil -> {:error, "unknown user"}
      %User{} = user -> promote(user, password)
    end
  end

  @spec reset() :: :ok
  def reset do
    Repo.delete_all(AuthToken)
    Repo.delete_all(Session)
    Repo.delete_all(User)
    :ok
  end

  @spec find_by_email(String.t()) :: User.t() | nil
  def find_by_email(email), do: Repo.get_by(User, email: normalize_email(email))

  @spec find_by_id(String.t()) :: User.t() | nil
  def find_by_id(user_id), do: Repo.get(User, user_id)

  @doc "Issues and mails a verification link. Best-effort: returns the send result."
  @spec send_verification_email(User.t()) :: :ok | {:error, term()}
  def send_verification_email(%User{} = user) do
    user.id
    |> AuthToken.issue(:verify_email)
    |> then(&Mailer.deliver(Mailer.verification_email(user.email, &1)))
  end

  @doc "Issues and mails a password reset link."
  @spec send_password_reset_email(User.t()) :: :ok | {:error, term()}
  def send_password_reset_email(%User{} = user) do
    user.id
    |> AuthToken.issue(:reset_password)
    |> then(&Mailer.deliver(Mailer.password_reset_email(user.email, &1)))
  end

  @doc "Consumes a verification token, stamping the account verified."
  @spec verify_email(term()) :: {:ok, User.t()} | {:error, String.t()}
  def verify_email(token) do
    case AuthToken.consume(token, :verify_email) do
      {:ok, user_id} ->
        case find_by_id(user_id) do
          nil -> {:error, "account not found"}
          user -> {:ok, mark_verified(user)}
        end

      :error ->
        {:error, "this verification link is invalid or expired"}
    end
  end

  @doc """
  Re-sends a verification link for an unverified address.

  Always resolves `:ok`, whether or not the address exists or is already
  verified, so the endpoint cannot be used to enumerate accounts.
  """
  @spec resend_verification(term()) :: :ok
  def resend_verification(email) do
    case find_by_email(email) do
      %User{email_verified_at: nil} = user -> _ = send_verification_email(user)
      _ -> :ok
    end

    :ok
  end

  @doc """
  Starts a password reset, uniformly and without revealing whether the address
  is registered.
  """
  @spec request_password_reset(term()) :: :ok
  def request_password_reset(email) do
    case find_by_email(email) do
      nil -> :ok
      user -> _ = send_password_reset_email(user)
    end

    :ok
  end

  @doc """
  Completes a reset. Validates the new password before burning the token so a
  too-short entry does not cost the user their link, then clears every session
  so anyone holding the old password is signed out everywhere.
  """
  @spec reset_password(term(), term()) :: {:ok, User.t()} | {:error, String.t()}
  def reset_password(token, password) do
    with :ok <- validate_password(password),
         {:ok, user_id} <- consume_reset_token(token),
         {:ok, user} <- require_user(user_id) do
      update_password(user, password)
    end
  end

  defp consume_reset_token(token) do
    case AuthToken.consume(token, :reset_password) do
      {:ok, user_id} -> {:ok, user_id}
      :error -> {:error, "this reset link is invalid or expired"}
    end
  end

  defp require_user(user_id) do
    case find_by_id(user_id) do
      nil -> {:error, "account not found"}
      user -> {:ok, user}
    end
  end

  defp mark_verified(%User{email_verified_at: nil} = user) do
    user
    |> Ecto.Changeset.change(email_verified_at: DateTime.utc_now())
    |> Repo.update!()
  end

  defp mark_verified(%User{} = user), do: user

  defp update_password(%User{} = user, password) do
    # Only the hash is stored; a database leak cannot reveal the password.
    user
    |> Ecto.Changeset.change(password_hash: hash(password))
    |> Repo.update!()

    Repo.delete_all(from(s in Session, where: s.user_id == ^user.id))
    {:ok, user}
  end

  defp normalize_email(email), do: email |> to_string() |> String.trim() |> String.downcase()

  defp resolve_session(session) do
    if DateTime.compare(DateTime.utc_now(), session.expires_at) == :lt do
      case Repo.get(User, session.user_id) do
        nil -> :error
        user -> {:ok, user}
      end
    else
      Repo.delete(session)
      :error
    end
  end

  defp insert_user(username, email, password) do
    attrs = %{username: username, email: email, password_hash: hash(password)}

    case %User{id: User.id()} |> User.changeset(attrs) |> Repo.insert() do
      {:ok, user} ->
        broadcast_players()
        {:ok, user}

      {:error, changeset} ->
        {:error, error_message(changeset)}
    end
  end

  # Grants admin rights and tops the balance up to the admin floor. Promotion
  # only ever raises the balance, so promoting an account never takes money away.
  # A password, when given, is rehashed and stored so the login is known. The
  # account is marked verified because promotion is an operator action and the
  # resulting admin must be able to sign in immediately.
  defp promote(user, password) do
    balance = max(user.balance, @admin_balance)
    verified_at = user.email_verified_at || DateTime.utc_now()

    changes =
      if password do
        %{
          is_admin: true,
          balance: balance,
          password_hash: hash(password),
          email_verified_at: verified_at
        }
      else
        %{is_admin: true, balance: balance, email_verified_at: verified_at}
      end

    case user |> Ecto.Changeset.change(changes) |> Repo.update() do
      {:ok, user} -> {:ok, user}
      {:error, changeset} -> {:error, error_message(changeset)}
    end
  end

  defp error_message(changeset) do
    changeset.errors
    |> Enum.map_join(", ", fn {_field, {message, _opts}} -> message end)
  end

  defp ensure_unique(username, email) do
    cond do
      Repo.exists?(from(u in User, where: u.username == ^username)) ->
        {:error, "that username is taken"}

      Repo.exists?(from(u in User, where: u.email == ^email)) ->
        {:error, "that email is already registered"}

      true ->
        :ok
    end
  end

  defp validate_username(username) do
    if Regex.match?(@username_re, username) do
      :ok
    else
      {:error, "username must be 3-32 characters (letters, numbers, _ or -)"}
    end
  end

  defp validate_email(email) do
    if Regex.match?(@email_re, email) and byte_size(email) <= 254 do
      :ok
    else
      {:error, "a valid email address is required"}
    end
  end

  defp validate_password(password) do
    if String.length(password) >= @min_password do
      :ok
    else
      {:error, "password must be at least #{@min_password} characters"}
    end
  end

  defp fetch(attrs, key) when is_map(attrs) do
    Map.get(attrs, to_string(key)) || Map.get(attrs, key) || ""
  end

  defp hash(password), do: Argon2.hash_pwd_salt(to_string(password), hash_opts())

  # Read from app config instead of Mix.env() so releases (where Mix is not
  # available at runtime) don't crash on register/login.
  defp hash_opts do
    Application.get_env(:grange, :argon2_opts, [])
  end

  defp hash_token(token), do: :crypto.hash(:sha256, token) |> Base.encode16(case: :lower)

  defp broadcast_players do
    players = list_users() |> Enum.map(&%{name: &1.username})
    GrangeWeb.Endpoint.broadcast(@lobby_topic, "players", %{players: players})
  end
end
