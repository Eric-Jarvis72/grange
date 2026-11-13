defmodule Grange.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    # The Migrator runs the boot migrations before the ticker and Endpoint start,
    # so the web server never serves a request against an unmigrated database.
    children =
      [
        {Phoenix.PubSub, name: Grange.PubSub},
        Grange.Repo,
        GrangeWeb.Presence,
        Grange.Migrator
      ] ++
        ticker_children() ++
        mailer_children() ++
        [GrangeWeb.Endpoint]

    opts = [strategy: :one_for_one, name: Grange.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # The ticker is unnecessary in tests, which drive `FarmStore.tick/1` directly.
  defp ticker_children do
    if Application.get_env(:grange, :start_ticker, true), do: [Grange.FarmTicker], else: []
  end

  # The console mailer captures messages in an Agent so the dev mailbox
  # endpoint (and e2e tests) can read verification/reset links back out. It is
  # only started when it is the configured adapter.
  defp mailer_children do
    if Grange.Mailer.impl() == Grange.Mailer.Console, do: [Grange.Mailer.Console], else: []
  end
end
