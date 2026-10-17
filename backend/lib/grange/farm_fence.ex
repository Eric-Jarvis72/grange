defmodule Grange.FarmFence do
  @moduledoc "One placed fence post on a player's farm."
  use Ecto.Schema

  schema "farm_fences" do
    field(:owner, :string)
    field(:x, :integer)
    field(:y, :integer)
  end
end
