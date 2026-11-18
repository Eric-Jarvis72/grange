defmodule Grange.Migrator do
  @moduledoc """
  Runs the database migrations during supervisor startup.

  It is listed after the Repo and before the farm ticker and the Endpoint, so
  migrations finish before the web server accepts any request. That keeps a
  fresh boot from answering a query (or `/api/reset`) against a database whose
  tables have not been created yet.
  """

  use GenServer

  def start_link(_opts), do: GenServer.start_link(__MODULE__, :ok, name: __MODULE__)

  @impl true
  def init(:ok) do
    migrations = Path.join(:code.priv_dir(:grange), "repo/migrations")
    Ecto.Migrator.run(Grange.Repo, migrations, :up, all: true, log: false)
    # Nothing left to do once migrations are applied.
    :ignore
  end
end
