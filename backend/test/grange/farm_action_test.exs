defmodule Grange.FarmActionTest do
  @moduledoc false
  use ExUnit.Case, async: true

  alias Grange.FarmAction

  test "opts/1 normalises crop, animal, and tool fields" do
    opts = %{"crop" => "wheat", "tool" => "scythe"}
    assert FarmAction.opts(opts) == %{crop: "wheat", animal: nil, tool: :scythe}
    assert FarmAction.opts(%{}) == %{crop: nil, animal: nil, tool: nil}
    assert FarmAction.opts(%{"crop" => "bogus", "tool" => "fork"})[:crop] == nil
    assert FarmAction.opts(%{"animal" => "hen"})[:animal] == "hen"
    assert FarmAction.opts(%{"animal" => "pig"})[:animal] == "pig"
    assert FarmAction.opts(%{"animal" => "dragon"})[:animal] == nil
  end
end
