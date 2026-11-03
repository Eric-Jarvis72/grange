defmodule Grange.WorldPosition do
  @moduledoc """
  Clamps cosmetic player positions into the world map.

  Like hub presence, these coordinates are only used to draw remote avatars; the
  server does not simulate movement or collisions.
  """

  @map_width 1152
  @map_height 768
  @edge_x 16
  @edge_top 32
  @edge_bottom 16

  @doc "Clamps a reported position into the walkable map bounds."
  @spec clamp(number(), number()) :: {:ok, {number(), number()}} | :error
  def clamp(x, y) when is_number(x) and is_number(y) do
    {:ok,
     {
       clamp(x, @edge_x, @map_width - @edge_x),
       clamp(y, @edge_top, @map_height - @edge_bottom)
     }}
  end

  def clamp(_x, _y), do: :error

  defp clamp(value, minimum, maximum), do: value |> max(minimum) |> min(maximum)
end
