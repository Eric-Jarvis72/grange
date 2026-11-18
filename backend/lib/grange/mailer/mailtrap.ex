defmodule Grange.Mailer.Mailtrap do
  @moduledoc """
  Sends through Mailtrap's REST API over `:httpc`, so no SMTP dependency is
  needed.

  Requires the `:inets` and `:ssl` applications (started via `extra_applications`)
  plus the `MAILTRAP_API_TOKEN` and `MAIL_FROM_EMAIL` environment variables
  (`MAIL_FROM_NAME` is optional; `MAILTRAP_FROM` is accepted as a fallback From
  address). A missing configuration is reported as an error rather than crashing
  the caller, so registration can still succeed.
  """

  @behaviour Grange.Mailer

  @endpoint ~c"https://send.api.mailtrap.io/api/send"
  @timeout 10_000

  @impl Grange.Mailer
  def deliver(%{to: to, subject: subject, text: text}) do
    case credentials() do
      {:ok, token, from, name} -> send(token, from, name, to, subject, text)
      {:error, reason} -> {:error, reason}
    end
  rescue
    # The mail adapter is a best-effort seam: a transport-level crash must not
    # take down registration or a password-reset request.
    error -> {:error, Exception.message(error)}
  end

  defp send(token, from, name, to, subject, text) do
    body =
      Jason.encode!(%{
        from: %{email: from, name: name},
        to: [%{email: to}],
        subject: subject,
        text: text
      })

    headers = [
      {~c"api-token", String.to_charlist(token)},
      {~c"content-type", ~c"application/json"}
    ]

    request = {@endpoint, headers, ~c"application/json", body}

    case :httpc.request(:post, request, http_options(), []) do
      {:ok, {{_, status, _}, _headers, _body}} when status in 200..299 ->
        :ok

      {:ok, {{_, status, _}, _headers, resp}} ->
        {:error, "Mailtrap send failed: #{status} #{resp}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp http_options do
    [
      timeout: @timeout,
      connect_timeout: @timeout,
      ssl: [
        verify: :verify_peer,
        cacerts: :public_key.cacerts_get(),
        depth: 3,
        customize_hostname_check: [
          match_fun: :public_key.pkix_verify_hostname_match_fun(:https)
        ]
      ]
    ]
  end

  defp credentials do
    token = System.get_env("MAILTRAP_API_TOKEN") || ""
    from = System.get_env("MAIL_FROM_EMAIL") || System.get_env("MAILTRAP_FROM") || ""
    name = System.get_env("MAIL_FROM_NAME") || "Grange"

    if token == "" or from == "" do
      {:error, "Mailtrap is not configured (set MAILTRAP_API_TOKEN and MAIL_FROM_EMAIL)"}
    else
      {:ok, token, from, name}
    end
  end
end
