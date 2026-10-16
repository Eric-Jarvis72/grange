defmodule Grange.Crops do
  @moduledoc """
  Server mirror of the starter crop registry and grid mechanics.

  The browser owns the authoritative combo tracker; the backend keeps the same
  crop definitions, growth-stage counts, harvest requirements, neighbour
  synergy, and rare-mutation drop formula so the two stay in step. Everything
  here is pure and unit-testable without a database.
  """

  @type crop_id :: String.t()
  @type tool :: :hand | :scythe

  @base_mutation_chance 0.0015
  @synergy_mutation_bonus 0.0025
  @combo_mutation_multiplier 1.5
  @combo_mutation_tier 15
  @combo_speed_tier 5
  @combo_spread_tier 10
  @combo_speed_bonus 0.1
  @combo_spread_chance 0.15
  @combo_window_ms 1_500
  @combo_swap_grace_ms 400

  @wheat ~w(wheat_0_seed.webp wheat_1_sprout.webp wheat_2_young.webp wheat_3_golden.webp wheat_4_mature.webp)
  @lettuce ~w(lettuce_0_seed.webp lettuce_1_sprout.webp lettuce_2_leaf.webp lettuce_3_loose.webp lettuce_4_mature.webp)
  @tomato ~w(tomato_0_seed.webp tomato_1_sprout.webp tomato_2_medium.webp tomato_3_flowering.webp tomato_4_mature.webp)
  @midas ~w(midas_wheat_0_seed.webp midas_wheat_1_sprout.webp midas_wheat_2_radiant.webp midas_wheat_3_mature.webp)
  @ice ~w(frost_lettuce_0_seed.webp frost_lettuce_1_sprout.webp frost_lettuce_2_young.webp frost_lettuce_3_mature.webp)
  @sunburst ~w(sunburst_tomato_0_sprout.webp sunburst_tomato_1_flowering.webp sunburst_tomato_2_mature.webp)

  @crops %{
    "wheat" => %{
      name: "Wheat",
      stages: @wheat,
      harvested: "wheat_harvested.webp",
      seed: "wheat-seed",
      seed_cost: 2,
      sell_value: 4,
      harvest_tool: :scythe,
      harvests: 1,
      regrow_stage: -1,
      synergy: :pack,
      mutation_seed: "midas-wheat-seed"
    },
    "lettuce" => %{
      name: "Lettuce",
      stages: @lettuce,
      harvested: "lettuce_harvested.webp",
      seed: "lettuce-seed",
      seed_cost: 4,
      sell_value: 7,
      harvest_tool: :both,
      harvests: 1,
      regrow_stage: -1,
      synergy: :moisture,
      mutation_seed: "frost-lettuce-seed"
    },
    "tomato" => %{
      name: "Tomato",
      stages: @tomato,
      harvested: "tomato_harvested.webp",
      seed: "tomato-seed",
      seed_cost: 8,
      sell_value: 5,
      harvest_tool: :hand,
      harvests: 2,
      regrow_stage: 2,
      synergy: :space,
      mutation_seed: "sunburst-tomato-seed"
    },
    "midas_wheat" => %{
      name: "Midas Wheat",
      stages: @midas,
      harvested: "midas_wheat_harvested.webp",
      seed: "midas-wheat-seed",
      seed_cost: 0,
      sell_value: 10,
      harvest_tool: :scythe,
      harvests: 1,
      regrow_stage: -1,
      synergy: :pack,
      combo_bonus: 3
    },
    "frost_lettuce" => %{
      name: "Frost-Crisp Lettuce",
      stages: @ice,
      harvested: "frost_lettuce_harvested.webp",
      seed: "frost-lettuce-seed",
      seed_cost: 0,
      sell_value: 15,
      harvest_tool: :both,
      harvests: 1,
      regrow_stage: -1,
      synergy: :moisture,
      passive_water: true
    },
    "sunburst_tomato" => %{
      name: "Sun-Burst Tomato",
      stages: @sunburst,
      harvested: "sunburst_tomato_harvested.webp",
      seed: "sunburst-tomato-seed",
      seed_cost: 0,
      sell_value: 8,
      harvest_tool: :hand,
      harvests: 3,
      regrow_stage: 1,
      synergy: :space,
      bonus_seed: "tomato-seed",
      bonus_seed_chance: 0.1
    }
  }

  @doc "Every crop definition keyed by crop id."
  @spec all() :: map()
  def all, do: @crops

  @spec get(crop_id()) :: map() | nil
  def get(id), do: Map.get(@crops, id)

  @spec standard_ids() :: [crop_id()]
  def standard_ids, do: ["wheat", "lettuce", "tomato"]

  @spec id?(term()) :: boolean()
  def id?(id), do: is_map_key(@crops, id)

  @doc "The crop id and remaining-harvest count encoded in a tile's crop string."
  @spec parse_crop(String.t() | nil) :: {crop_id(), pos_integer()}
  def parse_crop(nil), do: {"tomato", 1}

  def parse_crop(crop) do
    {id, count} =
      case String.split(crop, ":", parts: 2) do
        [raw_id, raw_count] -> {raw_id, parse_remaining(raw_count)}
        [raw_id] -> {raw_id, 1}
      end

    {normalize_id(id), count}
  end

  defp parse_remaining(value) do
    case Integer.parse(value) do
      {count, ""} when count > 0 -> count
      _ -> 1
    end
  end

  defp normalize_id(id), do: if(id?(id), do: id, else: "tomato")

  @spec encode_crop(crop_id(), pos_integer()) :: String.t()
  def encode_crop(id, remaining) when remaining > 1, do: "#{id}:#{remaining}"
  def encode_crop(id, _remaining), do: id

  @spec stage_count(crop_id()) :: pos_integer()
  def stage_count(id), do: get(id) |> Map.fetch!(:stages) |> length()

  @spec mature_stage(crop_id()) :: non_neg_integer()
  def mature_stage(id), do: stage_count(id) - 1

  @spec stage_sprite(crop_id(), integer()) :: String.t()
  def stage_sprite(id, stage) do
    stages = get(id).stages
    index = stage |> max(0) |> min(length(stages) - 1)
    "crops/" <> Enum.at(stages, index)
  end

  @doc "Normalises a crop id to its synergy family (variants share a family)."
  @spec family(crop_id()) :: :wheat | :lettuce | :tomato
  def family("wheat"), do: :wheat
  def family("midas_wheat"), do: :wheat
  def family("lettuce"), do: :lettuce
  def family("frost_lettuce"), do: :lettuce
  def family(_), do: :tomato

  @doc """
  True when `tool` may harvest the mature crop. Only scythe-only crops require
  the scythe; hand and both crops accept either tool. `nil` counts as a hand.
  """
  @spec can_harvest?(crop_id(), tool() | nil) :: boolean()
  def can_harvest?(id, tool) do
    case get(id).harvest_tool do
      :scythe -> tool == :scythe
      _ -> true
    end
  end

  @doc "The crop a seed item plants, or nil."
  @spec seed_crop(String.t()) :: crop_id() | nil
  def seed_crop(seed) do
    Enum.find_value(@crops, fn {id, crop} -> if crop[:seed] == seed, do: id end)
  end

  # --- grid synergy ---------------------------------------------------------

  @doc """
  Growth-speed multiplier for a crop given the families of its four orthogonal
  neighbours. Wheat packs (+5% each, capped +20%); tomatoes are slowed by
  crowding and sped up by lettuce.
  """
  @spec growth_speed_multiplier(crop_id(), [atom()]) :: float()
  def growth_speed_multiplier(id, neighbor_families) do
    speed =
      case family(id) do
        :wheat ->
          packed = Enum.count(neighbor_families, &(&1 == :wheat))
          1.0 + min(0.2, packed * 0.05)

        :tomato ->
          crowding = if(:tomato in neighbor_families, do: 0.2, else: 0.0)
          companion = if(:lettuce in neighbor_families, do: 0.15, else: 0.0)
          1.0 - crowding + companion

        :lettuce ->
          1.0
      end

    max(0.1, speed)
  end

  @doc """
  Positive neighbour synergy for the mutation bonus, given the tile state and
  the growing neighbours' families.
  """
  @spec synergy_active?(crop_id(), atom(), [atom()]) :: boolean()
  def synergy_active?(id, state, neighbor_families) do
    case family(id) do
      :wheat ->
        Enum.count(neighbor_families, &(&1 == :wheat)) >= 2

      :lettuce ->
        state in [:watered, :ready] and neighbor_families != []

      :tomato ->
        :tomato not in neighbor_families and :lettuce in neighbor_families
    end
  end

  # --- combo tuning (client owns the tracker) -------------------------------

  @spec combo_tier(pos_integer()) :: :none | :speed | :spread | :mutation
  def combo_tier(count) when count >= @combo_mutation_tier, do: :mutation
  def combo_tier(count) when count >= @combo_spread_tier, do: :spread
  def combo_tier(count) when count >= @combo_speed_tier, do: :speed
  def combo_tier(_count), do: :none

  @spec combo_move_multiplier(pos_integer()) :: float()
  def combo_move_multiplier(count) do
    if combo_tier(count) == :none, do: 1.0, else: 1.0 + @combo_speed_bonus
  end

  @spec combo_spread_chance(pos_integer()) :: float()
  def combo_spread_chance(count) do
    if combo_tier(count) in [:spread, :mutation], do: @combo_spread_chance, else: 0.0
  end

  @spec combo_mutation_multiplier(pos_integer()) :: float()
  def combo_mutation_multiplier(count) do
    if combo_tier(count) == :mutation, do: @combo_mutation_multiplier, else: 1.0
  end

  @spec combo_window_ms() :: pos_integer()
  def combo_window_ms, do: @combo_window_ms

  @spec combo_swap_grace_ms() :: pos_integer()
  def combo_swap_grace_ms, do: @combo_swap_grace_ms

  # --- rare mutations -------------------------------------------------------

  @doc "Rare-seed drop chance, capped at (base + synergy) * 1.5 = 0.6%."
  @spec mutation_chance(pos_integer(), boolean()) :: float()
  def mutation_chance(combo_count, synergy_active) do
    bonus = if synergy_active, do: @synergy_mutation_bonus, else: 0.0
    (base_chance() + bonus) * combo_mutation_multiplier(combo_count)
  end

  @spec base_chance() :: float()
  def base_chance, do: @base_mutation_chance

  @doc """
  Rolls for a mature standard harvest's rare seed. `roll` is a float in `0..1`
  so callers (and tests) can inject determinism.
  """
  @spec mutation_drop(crop_id(), pos_integer(), boolean(), float()) :: String.t() | nil
  def mutation_drop(id, combo_count, synergy_active, roll) do
    seed = get(id)[:mutation_seed]
    if seed && roll < mutation_chance(combo_count, synergy_active), do: seed
  end
end
