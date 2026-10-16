defmodule Grange.CropsTest do
  @moduledoc false
  use ExUnit.Case, async: true

  alias Grange.Crops

  test "registry exposes variable stage counts" do
    assert Crops.stage_count("tomato") == 5
    assert Crops.stage_count("wheat") == 5
    assert Crops.stage_count("lettuce") == 5
    assert Crops.stage_count("midas_wheat") == 4
    assert Crops.stage_count("frost_lettuce") == 4
    assert Crops.stage_count("sunburst_tomato") == 3
  end

  test "stage_sprite clamps into range and prefixes the folder" do
    assert Crops.stage_sprite("tomato", 0) == "crops/tomato_0_seed.webp"
    assert Crops.stage_sprite("tomato", 99) == "crops/tomato_4_mature.webp"
    assert Crops.stage_sprite("midas_wheat", -3) == "crops/midas_wheat_0_seed.webp"
  end

  test "harvest requirements depend on the tool" do
    assert Crops.can_harvest?("wheat", :scythe)
    refute Crops.can_harvest?("wheat", :hand)
    assert Crops.can_harvest?("tomato", :scythe)
    assert Crops.can_harvest?("tomato", :hand)
    assert Crops.can_harvest?("lettuce", :hand)
    assert Crops.can_harvest?("lettuce", :scythe)
  end

  test "parse and encode crop strings round-trip remaining harvests" do
    assert Crops.parse_crop("tomato:2") == {"tomato", 2}
    assert Crops.parse_crop("wheat") == {"wheat", 1}
    assert Crops.parse_crop(nil) == {"tomato", 1}
    assert Crops.parse_crop("bogus") == {"tomato", 1}
    assert Crops.encode_crop("tomato", 2) == "tomato:2"
    assert Crops.encode_crop("tomato", 1) == "tomato"
  end

  test "wheat packs and tomatoes are spaced" do
    assert_in_delta Crops.growth_speed_multiplier("wheat", []), 1.0, 1.0e-9
    assert_in_delta Crops.growth_speed_multiplier("wheat", [:wheat, :wheat]), 1.1, 1.0e-9

    assert_in_delta Crops.growth_speed_multiplier("wheat", [:wheat, :wheat, :wheat, :wheat]),
                    1.2,
                    1.0e-9

    assert_in_delta Crops.growth_speed_multiplier("tomato", [:tomato]), 0.8, 1.0e-9
    assert_in_delta Crops.growth_speed_multiplier("tomato", [:lettuce]), 1.15, 1.0e-9
  end

  test "synergy rules per family" do
    refute Crops.synergy_active?("wheat", :ready, [:wheat])
    assert Crops.synergy_active?("wheat", :ready, [:wheat, :wheat])
    assert Crops.synergy_active?("tomato", :ready, [:lettuce])
    refute Crops.synergy_active?("tomato", :ready, [:lettuce, :tomato])
    assert Crops.synergy_active?("lettuce", :watered, [:tomato])
    refute Crops.synergy_active?("lettuce", :planted, [:tomato])
  end

  test "combo tiers do not inflate coins" do
    assert Crops.combo_tier(4) == :none
    assert Crops.combo_tier(5) == :speed
    assert Crops.combo_tier(10) == :spread
    assert Crops.combo_tier(15) == :mutation
    assert_in_delta Crops.combo_move_multiplier(5), 1.1, 1.0e-9
    assert_in_delta Crops.combo_spread_chance(10), 0.15, 1.0e-9
    assert_in_delta Crops.combo_mutation_multiplier(15), 1.5, 1.0e-9
  end

  test "mutation chance caps at 0.6% under optimal conditions" do
    assert_in_delta Crops.mutation_chance(0, false), 0.0015, 1.0e-9
    assert_in_delta Crops.mutation_chance(0, true), 0.004, 1.0e-9
    assert_in_delta Crops.mutation_chance(15, true), 0.006, 1.0e-9
  end

  test "mutation_drop only fires for standard crops and above the roll" do
    assert Crops.mutation_drop("lettuce", 15, false, 0.0) == "frost-lettuce-seed"
    assert Crops.mutation_drop("lettuce", 0, false, 0.999) == nil
    assert Crops.mutation_drop("midas_wheat", 15, false, 0.0) == nil
  end
end
