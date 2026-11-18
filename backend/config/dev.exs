import Config

config :grange, GrangeWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.get_env("PORT") || "3200")],
  check_origin: false,
  debug_errors: true,
  server: true

config :grange, enable_test_routes: true

# E2E runs shrink the growth window so specs do not wait 10s per crop. Normal
# development keeps the full cycle unless GRANGE_GROW_MS is set.
config :grange, grow_ms: String.to_integer(System.get_env("GRANGE_GROW_MS") || "10000")

# The farm ticker ripens watered crops and reverts stale soil. E2E shortens it
# so a spec's crop is ready on the next sweep instead of the next second.
config :grange,
  tick_ms: String.to_integer(System.get_env("GRANGE_TICK_MS") || "1000")

# Playwright registers an account per test; the production Argon2 cost makes
# those registrations a measurable part of the suite. E2E opts into the same
# cheap parameters the ExUnit suite uses. Normal dev keeps the real cost.
if System.get_env("GRANGE_FAST_HASH") == "1" do
  config :grange, :argon2_opts, t_cost: 1, m_cost: 8, parallelism: 1
end

config :logger, level: :info

config :grange, Grange.Repo,
  database: Path.expand("../priv/grange_dev.sqlite3", __DIR__),
  # SQLite takes one writer at a time, so a single connection keeps mutations
  # serialized (as the old GenServers did) and avoids first-boot lock races.
  pool_size: 1,
  journal_mode: :wal,
  busy_timeout: 5_000
