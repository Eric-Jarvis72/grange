defmodule Grange.FarmProp do
  @moduledoc "A farm prop moved from its original position or carried in inventory."
  use Ecto.Schema

  schema "farm_props" do
    field(:owner, :string)
    field(:source_index, :integer)
    field(:asset, :string)
    field(:x, :integer)
    field(:y, :integer)
    field(:carried, :boolean, default: false)
  end
end
