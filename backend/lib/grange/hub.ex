defmodule Grange.Hub do
  @moduledoc """
  Rules for the shared hub areas where players see each other.

  The marketplace and casino broadcast player presence. Hub positions are
  cosmetic, so this module only validates the area and clamps coordinates into
  the map. It is not a movement authority.
  """

  alias Grange.WorldPosition

  @areas ~w(marketplace casino)

  @doc "The hub areas that broadcast player presence."
  def areas, do: @areas

  @doc "Whether `area` is a shared hub area."
  def area?(area), do: area in @areas

  @doc """
  Clamps a reported hub position into the walkable map bounds.

  Returns `:error` when either coordinate is not a number.
  """
  def clamp_position(x, y), do: WorldPosition.clamp(x, y)
end
