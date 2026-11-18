defmodule Grange.WorldPosition do
  @moduledoc """
  Clamps cosmetic player positions into the map for each world area.

  Like hub presence, these coordinates are only used to draw remote avatars; the
  server does not simulate movement or collisions.
  """

  # Original map, used by the casino and as the legacy/default clamp.
  @casino %{min_x: 16, max_x: 1136, min_y: 32, max_y: 752}
  # Marketplace world: -8 columns to the left and -8 rows above the old map.
  @marketplace %{min_x: -496, max_x: 2032, min_y: -480, max_y: 752}
  # Full farm world (-6..24 columns, -4..11 rows) with the player insets.
  @farm %{min_x: -368, max_x: 1584, min_y: -224, max_y: 752}

  @doc "Clamps a reported position into the default (casino) map bounds."
  @spec clamp(number(), number()) :: {:ok, {number(), number()}} | :error
  def clamp(x, y), do: clamp(x, y, @casino)

  @doc "Clamps a hub position using the bounds for that hub area."
  @spec clamp_hub(String.t(), number(), number()) ::
          {:ok, {number(), number()}} | :error
  def clamp_hub(area, x, y), do: clamp(x, y, bounds(area))

  @doc "Clamps a farm presence position into the expanded farm world."
  @spec clamp_farm(number(), number()) :: {:ok, {number(), number()}} | :error
  def clamp_farm(x, y), do: clamp(x, y, @farm)

  def clamp(x, y, bounds) when is_number(x) and is_number(y) do
    {:ok, {between(x, bounds.min_x, bounds.max_x), between(y, bounds.min_y, bounds.max_y)}}
  end

  def clamp(_x, _y, _bounds), do: :error

  defp bounds("marketplace"), do: @marketplace
  defp bounds(_area), do: @casino

  defp between(value, minimum, maximum), do: value |> max(minimum) |> min(maximum)
end
