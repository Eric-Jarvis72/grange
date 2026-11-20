defmodule Grange.FarmAction do
  @moduledoc """
  Parses an incoming farm action payload.

  Kept separate from `Grange.FarmStore` so the store stays focused on database
  transactions. All functions here are pure and unit-testable.
  """

  alias Grange.Crops

  @kinds %{
    "till" => :till,
    "plant" => :plant,
    "water" => :water,
    "harvest" => :harvest,
    "place_fence" => :place_fence,
    "remove_fence" => :remove_fence,
    "place_gate" => :place_gate,
    "remove_gate" => :remove_gate,
    "place_animal" => :place_animal,
    "remove_animal" => :remove_animal,
    "place_sprinkler" => :place_sprinkler,
    "remove_sprinkler" => :remove_sprinkler
  }

  def kind(value), do: Map.get(@kinds, to_string(value))

  @doc "Normalises the optional crop, animal, and tool fields of a payload."
  @spec opts(map()) :: map()
  def opts(action) do
    %{
      crop: crop(fetch(action, "crop")),
      animal: animal(fetch(action, "animal")),
      tool: tool(fetch(action, "tool"))
    }
  end

  defp crop(value) when is_binary(value) do
    if Crops.id?(value), do: value, else: nil
  end

  defp crop(_value), do: nil

  defp animal(value) when value in ~w(cow hen sheep pig), do: value
  defp animal(_value), do: nil

  defp tool("scythe"), do: :scythe
  defp tool("hand"), do: :hand
  defp tool(_value), do: nil

  defp fetch(map, key), do: Map.get(map, key) || Map.get(map, String.to_atom(key))
end
