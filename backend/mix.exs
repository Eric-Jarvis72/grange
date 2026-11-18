defmodule Grange.MixProject do
  use Mix.Project

  def project do
    [
      app: :grange,
      version: "0.1.0",
      elixir: "~> 1.14",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      test_ignore_filters: [
        &String.starts_with?(&1, "test/support/credo/")
      ],
      aliases: aliases(),
      deps: deps()
    ]
  end

  def cli do
    [
      preferred_envs: [precommit: :test]
    ]
  end

  defp aliases do
    [
      "ecto.setup": ["ecto.create --quiet", "ecto.migrate --quiet"],
      "ecto.reset": ["ecto.drop --quiet", "ecto.setup"]
    ]
  end

  def application do
    [
      mod: {Grange.Application, []},
      # :inets/:ssl back the Mailtrap REST client (Grange.Mailer.Mailtrap uses
      # :httpc over HTTPS); without them delivery fails at runtime.
      extra_applications: [:logger, :runtime_tools, :crypto, :inets, :ssl]
    ]
  end

  # Credo's custom checks live under `test/support/credo/` and are loaded by
  # Credo's `requires` in an isolated runtime, so exclude them from the normal
  # test compilation.
  defp elixirc_paths(:test) do
    test_support_files =
      Path.wildcard("test/support/**/*.ex")
      |> Enum.reject(&String.contains?(&1, "credo/"))

    ["lib" | test_support_files]
  end

  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      {:phoenix, "~> 1.7"},
      {:phoenix_pubsub, "~> 2.1"},
      {:jason, "~> 1.4"},
      {:bandit, "~> 1.5"},
      {:argon2_elixir, "~> 4.0"},
      {:ecto_sql, "~> 3.12"},
      {:ecto_sqlite3, "~> 0.17"},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false}
    ]
  end
end
