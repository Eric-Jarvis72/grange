defmodule Grange.FarmActionTest do
  @moduledoc false
  use ExUnit.Case, async: true

  alias Grange.FarmAction

  test "opts/1 normalises crop, tool, and combo fields" do
    opts = %{"crop" => "wheat", "tool" => "scythe", "comboMutationMultiplier" => 1.5}
    assert FarmAction.opts(opts) == %{crop: "wheat", tool: :scythe, combo: 1.5}
    assert FarmAction.opts(%{}) == %{crop: nil, tool: nil, combo: nil}
    assert FarmAction.opts(%{"crop" => "bogus", "tool" => "fork"})[:crop] == nil
  end

  test "combo_count maps the multiplier into a tier count" do
    assert FarmAction.combo_count(%{combo: 1.5}) == 15
    assert FarmAction.combo_count(%{combo: 1.0}) == 0
    assert FarmAction.combo_count(%{}) == 0
  end

  test "mutation_drops only fires for standard crops" do
    assert FarmAction.mutation_drops("lettuce", :ready, [], %{combo: 1.5}, 0.0) ==
             ["frost-lettuce-seed"]

    assert FarmAction.mutation_drops("midas_wheat", :ready, [], %{combo: 1.5}, 0.0) == []
    assert FarmAction.mutation_drops("lettuce", :ready, [], %{}, 0.999) == []
  end
end
