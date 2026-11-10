defmodule GrangeWeb.PageController do
  @moduledoc "Serves the built SPA shell for client-side routes."

  use Phoenix.Controller, formats: [:html]

  # Tells the SPA that the dev-only e2e hooks (deep-link boot scenes, faster
  # walking) are available. Production never injects it.
  @test_meta ~s(<meta name="grange-test-routes" content="true" />)

  def index(conn, _params) do
    path = Application.app_dir(:grange, "priv/static/index.html")

    cond do
      not File.exists?(path) ->
        send_resp(conn, 404, "Not found")

      test_routes?() ->
        path
        |> File.read!()
        |> inject_test_meta()
        |> then(&send_resp(put_resp_content_type(conn, "text/html"), 200, &1))

      true ->
        conn
        |> put_resp_content_type("text/html")
        |> send_file(200, path)
    end
  end

  # Read at runtime, not compile time: the injected tag must follow the boot
  # config (dev/e2e on, production off) without recompiling the controller.
  defp test_routes?, do: Application.get_env(:grange, :enable_test_routes, false)

  defp inject_test_meta(html) do
    case String.split(html, "</head>", parts: 2) do
      [head, rest] -> head <> @test_meta <> "</head>" <> rest
      _ -> html
    end
  end
end
