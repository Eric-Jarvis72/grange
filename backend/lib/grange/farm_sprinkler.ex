defmodule Grange.FarmSprinkler do
  @moduledoc """
  One placed sprinkler.

  The anchor `(x, y)` is the top-left tile of the 2x2 block it waters, so the
  sprinkler itself sits on the corner shared by those four tiles.
  """

  use Ecto.Schema

  schema "farm_sprinklers" do
    field(:owner, :string)
    field(:x, :integer)
    field(:y, :integer)
  end
end
