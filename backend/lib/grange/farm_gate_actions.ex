defmodule Grange.FarmGateActions do
  @moduledoc "Validates and applies visitor-safe gate toggles, then rebroadcasts."

  alias Grange.{FarmGates, FarmStore, Repo}

  @type result :: {:ok, map()} | {:error, String.t()}

  @doc "Toggles one gate for any logged-in visitor of the farm."
  @spec toggle(String.t(), map()) :: result()
  def toggle(owner, action) when is_map(action) do
    kind = to_string(value(action, "kind"))
    x = integer(action, "x")
    y = integer(action, "y")

    if valid?(kind, x, y) do
      apply_toggle(owner, x, y)
    else
      {:error, "invalid gate action"}
    end
  end

  def toggle(_owner, _action), do: {:error, "invalid gate action"}

  @world_min_x -6
  @world_max_corner_x 25
  @world_min_y -4
  @world_max_corner_y 10

  defp valid?(kind, x, y) do
    kind == "toggle_gate" and is_integer(x) and is_integer(y) and
      x >= @world_min_x and x <= @world_max_corner_x and
      y >= @world_min_y and y <= @world_max_corner_y
  end

  defp apply_toggle(owner, x, y) do
    case Repo.transaction(fn -> FarmGates.toggle(owner, x, y) end) do
      {:ok, :ok} -> FarmStore.refresh(owner)
      {:ok, {:error, reason}} -> {:error, reason}
      {:error, _reason} -> {:error, "could not update gate"}
    end
  end

  defp value(action, key), do: Map.get(action, key) || Map.get(action, String.to_atom(key))

  defp integer(action, key) do
    case value(action, key) do
      number when is_integer(number) -> number
      text when is_binary(text) -> parse_integer(text)
      _ -> nil
    end
  end

  defp parse_integer(text) do
    case Integer.parse(text) do
      {number, ""} -> number
      _ -> nil
    end
  end
end
