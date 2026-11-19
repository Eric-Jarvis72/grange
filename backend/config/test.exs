import Config

config :grange, GrangeWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 3201],
  server: false,
  secret_key_base: "test-secret-key-base-that-is-at-least-64-bytes-long-for-phoenix-ok"

config :grange, enable_test_routes: true
config :logger, level: :warning
config :grange, start_ticker: false
config :grange, start_world_clock: false

# Fast, insecure Argon2 parameters for tests only. Prod/dev use the library
# defaults (empty opts) for real password hashing strength.
config :grange, :argon2_opts, t_cost: 1, m_cost: 8, parallelism: 1

config :grange, Grange.Repo,
  database: Path.expand("../priv/grange_test.sqlite3", __DIR__),
  pool_size: 1,
  busy_timeout: 5_000
