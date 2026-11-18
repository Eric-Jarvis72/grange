defmodule Grange.Mailer do
  @moduledoc """
  Delivery seam for transactional email.

  Auth code only talks to this module, so swapping providers means writing one
  more implementation behind the `deliver/1` callback. The console adapter is
  the default outside production; Mailtrap is used when its credentials are set.
  """

  @type email :: %{to: String.t(), subject: String.t(), text: String.t()}

  @callback deliver(email()) :: :ok | {:error, term()}

  require Logger

  @doc "Hands the message to the configured adapter."
  @spec deliver(email()) :: :ok | {:error, term()}
  def deliver(email) do
    adapter = impl()

    case adapter.deliver(email) do
      # Callers keep registration best-effort, so a delivery failure would
      # otherwise be invisible; log it so a misconfigured provider is obvious.
      {:error, reason} = error ->
        Logger.warning(
          "[mail] #{inspect(adapter)} delivery to #{email.to} failed: #{inspect(reason)}"
        )

        error

      result ->
        result
    end
  end

  @doc "The configured adapter module."
  @spec impl() :: module()
  def impl, do: Application.get_env(:grange, :mailer, Grange.Mailer.Console)

  @doc "Absolute base URL the frontend is served from, e.g. for links in mail."
  @spec app_url() :: String.t()
  def app_url do
    :grange
    |> Application.get_env(:app_url, "http://localhost:3200")
    |> to_string()
    |> String.trim_trailing("/")
  end

  @doc "Frontend link that completes signup by verifying an email address."
  @spec verify_link(String.t()) :: String.t()
  def verify_link(token), do: "#{app_url()}/verify?token=#{URI.encode_www_form(token)}"

  @doc "Frontend link that lets a user choose a new password."
  @spec reset_link(String.t()) :: String.t()
  def reset_link(token), do: "#{app_url()}/reset?token=#{URI.encode_www_form(token)}"

  @doc "Message that asks a new account to confirm its address."
  @spec verification_email(String.t(), String.t()) :: email()
  def verification_email(to, token) do
    %{
      to: to,
      subject: "Verify your Grange email",
      text: """
      Welcome to Grange!

      Confirm this address to finish setting up your account:
      #{verify_link(token)}

      This link expires in 24 hours. If you didn't sign up, ignore this email.
      """
    }
  end

  @doc "Message that carries a short-lived password reset link."
  @spec password_reset_email(String.t(), String.t()) :: email()
  def password_reset_email(to, token) do
    %{
      to: to,
      subject: "Reset your Grange password",
      text: """
      We received a request to reset your Grange password.

      Choose a new password here:
      #{reset_link(token)}

      This link expires in 1 hour. If you didn't ask for this, ignore this email.
      """
    }
  end
end
