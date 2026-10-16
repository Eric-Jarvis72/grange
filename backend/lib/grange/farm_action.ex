defmodule Grange.FarmAction do
  @moduledoc """
  Parses an incoming farm action payload and evaluates its rare-seed drops.

  Kept separate from `Grange.FarmStore` so the store stays focused on database
  transactions. All functions here are pure and unit-testable.
  """

  alias Grange.Crops

  @combo_mutation_tier 15
  @combo_mutation_multiplier 1.5

  @doc "Normalises the optional crop, tool, and combo fields of a payload."
  @spec opts(map()) :: map()
  def opts(action) do
    %{
      crop: crop(fetch(action, "crop")),
      tool: tool(fetch(action, "tool")),
      combo: number(fetch(action, "comboMutationMultiplier"))
    }
  end

  @doc """
  Rare-seed drops for a mature harvest. Standard crops roll their mutation;
  rare crops and unsupported tools yield nothing.
  """
  @spec mutation_drops(String.t(), atom(), [atom()], map(), float()) :: [String.t()]
  def mutation_drops(crop_id, state, neighbor_families, opts, roll) do
    if crop_id in Crops.standard_ids() do
      synergy = Crops.synergy_active?(crop_id, state, neighbor_families)

      case Crops.mutation_drop(crop_id, combo_count(opts), synergy, roll) do
        nil -> []
        seed -> [seed]
      end
    else
      []
    end
  end

  @doc "The combo count implied by a client-sent mutation multiplier."
  @spec combo_count(map()) :: non_neg_integer()
  def combo_count(opts) do
    case opts[:combo] do
      multiplier when is_number(multiplier) and multiplier >= @combo_mutation_multiplier ->
        @combo_mutation_tier

      _ ->
        0
    end
  end

  defp crop(value) when is_binary(value) do
    if Crops.id?(value), do: value, else: nil
  end

  defp crop(_value), do: nil

  defp tool("scythe"), do: :scythe
  defp tool("hand"), do: :hand
  defp tool(_value), do: nil

  defp number(value) when is_number(value), do: value
  defp number(_value), do: nil

  defp fetch(map, key), do: Map.get(map, key) || Map.get(map, String.to_atom(key))
end
