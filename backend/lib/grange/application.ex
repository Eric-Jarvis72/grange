defmodule Grange.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children =
      [
        {Phoenix.PubSub, name: Grange.PubSub},
        Grange.Repo,
        GrangeWeb.Presence
      ] ++
        ticker_children() ++
        [GrangeWeb.Endpoint]

    opts = [strategy: :one_for_one, name: Grange.Supervisor]

    with {:ok, supervisor} <- Supervisor.start_link(children, opts) do
      migrate()
      {:ok, supervisor}
    end
  end

  # The ticker is unnecessary in tests, which drive `FarmStore.tick/1` directly.
  defp ticker_children do
    if Application.get_env(:grange, :start_ticker, true), do: [Grange.FarmTicker], else: []
  end

  # SQLite needs no separate "create" step, and running migrations here keeps
  # development, tests, and the production release all in sync.
  defp migrate do
    migrations = Path.join(:code.priv_dir(:grange), "repo/migrations")
    Ecto.Migrator.run(Grange.Repo, migrations, :up, all: true, log: false)
  end
end
