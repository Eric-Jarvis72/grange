import Config

if config_env() == :prod do
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise "environment variable SECRET_KEY_BASE is missing"

  port = String.to_integer(System.get_env("PORT") || "3200")
  host = System.fetch_env!("PHX_HOST")

  config :grange, GrangeWeb.Endpoint,
    url: [host: host, scheme: "https", port: 443],
    check_origin: ["https://#{host}"],
    http: [ip: {0, 0, 0, 0, 0, 0, 0, 0}, port: port],
    secret_key_base: secret_key_base

  # The SQLite file lives next to the release and is created on first boot.
  database_path =
    System.get_env("DATABASE_PATH") ||
      Path.join([System.get_env("RELEASE_ROOT") || ".", "data", "grange.sqlite3"])

  File.mkdir_p!(Path.dirname(database_path))

  config :grange, Grange.Repo,
    database: database_path,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "1"),
    journal_mode: :wal,
    busy_timeout: 5_000
end
