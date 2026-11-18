defmodule GrangeWeb.PageController do
  @moduledoc "Serves the built SPA shell for client-side routes."

  use Phoenix.Controller, formats: [:html]

  # Tells the SPA that the dev-only test routes (deep-link boot scenes,
  # reset hook) are available. Production never injects it.
  @test_meta ~s(<meta name="grange-test-routes" content="true" />)

  # Playwright-only gameplay overrides: 3x walking and shortened wall-clock
  # animations. A normal dev session must not get these.
  @e2e_meta ~s(<meta name="grange-e2e" content="true" />)

  def index(conn, _params) do
    path = Application.app_dir(:grange, "priv/static/index.html")

    cond do
      not File.exists?(path) ->
        send_resp(conn, 404, "Not found")

      test_routes?() ->
        meta = if e2e?(), do: @test_meta <> @e2e_meta, else: @test_meta

        path
        |> File.read!()
        |> inject_meta(meta)
        |> then(&send_resp(put_resp_content_type(conn, "text/html"), 200, &1))

      true ->
        conn
        |> put_resp_content_type("text/html")
        |> send_file(200, path)
    end
  end

  # Read at runtime, not compile time: the injected tags must follow the boot
  # config (dev/e2e on, production off) without recompiling the controller.
  defp test_routes?, do: Application.get_env(:grange, :enable_test_routes, false)

  defp e2e?, do: test_routes?() and System.get_env("GRANGE_E2E") == "1"

  defp inject_meta(html, meta) do
    case String.split(html, "</head>", parts: 2) do
      [head, rest] -> head <> meta <> "</head>" <> rest
      _ -> html
    end
  end
end
