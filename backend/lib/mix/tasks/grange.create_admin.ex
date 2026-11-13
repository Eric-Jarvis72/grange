defmodule Mix.Tasks.Grange.CreateAdmin do
  @shortdoc "Creates (or promotes) an admin account with all items and unlimited Grangecoin"

  @moduledoc """
  Creates an admin account, or promotes an existing one.

  Admins are handed every item in the game by the SPA on sign-in and have
  effectively unlimited Grangecoin.

      mix grange.create_admin
      mix grange.create_admin --username root --email root@example.test --password long-enough

  Options:

    * `--username` (default `admin`)
    * `--email` (default `admin@grange.test`)
    * `--password` - at least 8 characters; defaults to `grange-admin` for a new
      account, and resets an existing account's password only when passed

  If the username already exists the account is promoted instead, so the task
  is safe to re-run.
  """

  use Mix.Task

  @default_username "admin"
  @default_email "admin@grange.test"
  @default_password "grange-admin"
  @min_password 8

  @impl Mix.Task
  def run(args) do
    {opts, _argv, _invalid} =
      OptionParser.parse(args,
        strict: [username: :string, email: :string, password: :string]
      )

    username = opts[:username] || @default_username
    email = opts[:email] || @default_email
    reset_password = opts[:password]

    validate_password!(reset_password)
    start_app()
    create_or_promote(username, email, reset_password)
  end

  defp create_or_promote(username, email, reset_password) do
    attrs = %{
      "username" => username,
      "email" => email,
      "password" => reset_password || @default_password
    }

    case Grange.Accounts.register_admin(attrs) do
      {:ok, user} ->
        report(user, reset_password || @default_password)

      {:error, "that username is taken"} ->
        promote(username, reset_password)

      {:error, reason} ->
        Mix.raise("could not create admin account: #{reason}")
    end
  end

  defp validate_password!(nil), do: :ok

  defp validate_password!(password) do
    if String.length(password) < @min_password do
      Mix.raise("password must be at least #{@min_password} characters")
    end
  end

  defp promote(username, password) do
    case Grange.Accounts.grant_admin(username, password) do
      {:ok, user} -> report(user, password)
      {:error, reason} -> Mix.raise("could not promote #{username}: #{reason}")
    end
  end

  defp report(user, password) do
    password = password || "unchanged (existing account; pass --password to reset)"

    Mix.shell().info("""
    Admin account ready:
      username: #{user.username}
      email:    #{user.email}
      balance:  #{user.balance} (effectively unlimited)
      password: #{password}
    """)

    :ok
  end

  # Booting the app starts the Repo (it runs migrations) and the PubSub that
  # `Accounts.register/1` broadcasts on. The HTTP listener is turned off first
  # so the task does not fight a running dev server for the port.
  defp start_app do
    Mix.Task.run("loadpaths")

    endpoint = Application.get_env(:grange, GrangeWeb.Endpoint, [])
    Application.put_env(:grange, GrangeWeb.Endpoint, Keyword.put(endpoint, :server, false))

    Mix.Task.run("app.start", [])
  end
end
