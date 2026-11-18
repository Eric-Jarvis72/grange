defmodule Grange.MailerTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.Mailer.Mailtrap

  test "the app starts the HTTP client and TLS stack the mailer needs" do
    applications = Application.spec(:grange, :applications)

    assert :inets in applications
    assert :ssl in applications
  end

  test "Mailtrap reports missing configuration instead of crashing the caller" do
    keys = ["MAILTRAP_API_TOKEN", "MAIL_FROM_EMAIL"]
    saved = Map.new(keys, &{&1, System.get_env(&1)})

    Enum.each(keys, &System.delete_env/1)

    on_exit(fn ->
      Enum.each(saved, fn
        {key, nil} -> System.delete_env(key)
        {key, value} -> System.put_env(key, value)
      end)
    end)

    email = %{to: "user@example.test", subject: "hi", text: "body"}

    assert {:error, message} = Mailtrap.deliver(email)
    assert message =~ "not configured"
  end
end
