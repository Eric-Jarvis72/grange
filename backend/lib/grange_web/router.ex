defmodule GrangeWeb.Router do
  @moduledoc false

  use Phoenix.Router

  pipeline :api do
    plug(:accepts, ["json"])
    plug(:fetch_session)
  end

  # Omits `:accepts` so unmatched /api routes always get a JSON 404, even when
  # the request advertises `text/html` (e.g. browser navigation).
  pipeline :api_fallback do
    plug(:fetch_session)
  end

  scope "/api", GrangeWeb do
    pipe_through(:api)

    post("/auth/register", AuthController, :register)
    post("/auth/login", AuthController, :login)
    post("/auth/logout", AuthController, :logout)
    get("/auth/me", AuthController, :me)

    post("/economy/transaction", EconomyController, :transaction)
    post("/livestock/buy", LivestockController, :buy)
    get("/bank/balance", BankController, :balance)
    post("/bank/transfer", BankController, :transfer)
    post("/land/buy", BankController, :buy_land)

    get("/inventory", InventoryController, :index)
    put("/inventory", InventoryController, :replace)
    post("/inventory/buy", InventoryController, :buy)

    get("/state", HealthController, :state)

    # Test hook: lets e2e runs start from a clean slate. Compiled out of
    # production builds.
    if Application.compile_env(:grange, :enable_test_routes, false) do
      post("/reset", HealthController, :reset)
    end
  end

  # Catch unmatched /api routes here, before the SPA fallback below.
  scope "/api", GrangeWeb do
    pipe_through(:api_fallback)

    match(:*, "/*path", FallbackController, :not_found)
  end

  # SPA fallback: serve index.html for any unmatched client-side route.
  scope "/", GrangeWeb do
    get("/*path", PageController, :index)
  end
end
