defmodule GrangeWeb.UserSocket do
  @moduledoc false

  use Phoenix.Socket

  alias Grange.Accounts

  channel("lobby", GrangeWeb.LobbyChannel)
  channel("farm:*", GrangeWeb.FarmChannel)
  channel("hub:*", GrangeWeb.HubChannel)

  @impl true
  def connect(params, socket, _connect_info) do
    case Accounts.resolve_token(token(params)) do
      {:ok, user} -> {:ok, assign(socket, :user, user)}
      :error -> {:ok, socket}
    end
  end

  @impl true
  def id(socket) do
    case socket.assigns[:user] do
      %{id: id} -> id
      _ -> nil
    end
  end

  defp token(params) when is_map(params) do
    case Map.get(params, "token") do
      value when is_binary(value) -> value
      _ -> nil
    end
  end

  defp token(_params), do: nil
end
