defmodule GrangeWeb.AuthController do
  @moduledoc """
  HTTP endpoints for registering, signing in, signing out, and `GET /me`.

  Sessions are carried in a signed, httpOnly cookie. The browser only needs to
  send it back; the client never reads the token directly. Registration does
  not start a session: the account is locked until the emailed verification
  link is used, and password resets use the same single-use token machinery.
  """

  use Phoenix.Controller, formats: [:json]

  alias Grange.{Accounts, Mailer}

  @session_key :user_token

  def register(conn, params) do
    case Accounts.register(params) do
      {:ok, user} ->
        # Best-effort: a mail outage must not make the account appear missing.
        sent = match?(:ok, Accounts.send_verification_email(user))

        conn
        |> put_status(:created)
        |> json(%{
          ok: true,
          pending: true,
          emailSent: sent,
          message: "check your email to verify your account"
        })

      {:error, reason} ->
        conn |> put_status(:bad_request) |> json(%{ok: false, error: reason})
    end
  end

  def login(conn, params) do
    username = string(params, "username")
    password = string(params, "password")

    case Accounts.authenticate(username, password) do
      {:ok, user} ->
        {conn, token} = start_session(conn, user)
        json(conn, %{ok: true, user: user, token: token})

      {:error, :unverified} ->
        # Actionable, so it is distinguished from a generic credential failure;
        # no session is issued either way.
        conn
        |> put_status(:forbidden)
        |> json(%{
          ok: false,
          code: "unverified",
          error: "please verify your email before signing in"
        })

      {:error, reason} ->
        conn |> put_status(:unauthorized) |> json(%{ok: false, error: reason})
    end
  end

  def logout(conn, _params) do
    Accounts.destroy_session(get_session(conn, @session_key))

    conn
    |> delete_session(@session_key)
    |> json(%{ok: true})
  end

  def me(conn, _params) do
    case current_user(conn) do
      nil ->
        conn |> put_status(:unauthorized) |> json(%{ok: false, error: "not signed in"})

      user ->
        json(conn, %{ok: true, user: user, token: get_session(conn, @session_key)})
    end
  end

  def verify_email(conn, params) do
    case Accounts.verify_email(string(params, "token")) do
      {:ok, user} ->
        # Verifying is proof enough to start a session, so the user lands signed in.
        {conn, token} = start_session(conn, user)
        json(conn, %{ok: true, user: user, token: token})

      {:error, reason} ->
        conn |> put_status(:bad_request) |> json(%{ok: false, error: reason})
    end
  end

  def resend_verification(conn, params) do
    Accounts.resend_verification(string(params, "email"))
    json(conn, %{ok: true})
  end

  def request_password_reset(conn, params) do
    Accounts.request_password_reset(string(params, "email"))
    json(conn, %{ok: true})
  end

  def reset_password(conn, params) do
    case Accounts.reset_password(string(params, "token"), string(params, "password")) do
      {:ok, user} -> json(conn, %{ok: true, user: user})
      {:error, reason} -> conn |> put_status(:bad_request) |> json(%{ok: false, error: reason})
    end
  end

  # Test/dev seam: reads back the last email the console mailer captured. The
  # route only exists when `enable_test_routes` is set (dev/test, never prod).
  def mailbox(conn, params) do
    json(conn, %{ok: true, email: latest_email(string(params, "to"))})
  end

  defp latest_email(to) do
    if Mailer.impl() == Mailer.Console do
      case Mailer.Console.latest(to) do
        %{text: text} -> %{text: text}
        _ -> nil
      end
    end
  end

  defp start_session(conn, user) do
    token = Accounts.create_session(user.id)
    {put_session(conn, @session_key, token), token}
  end

  defp current_user(conn) do
    case Accounts.resolve_token(get_session(conn, @session_key)) do
      {:ok, user} -> user
      :error -> nil
    end
  end

  defp string(params, key) when is_map(params) do
    case Map.get(params, key) do
      value when is_binary(value) -> value
      _ -> ""
    end
  end

  defp string(_params, _key), do: ""
end
