defmodule Grange.FarmAnimal do
  @moduledoc "A placed farm animal; unplaced animals remain in the farm's inventory map."
  use Ecto.Schema

  schema "farm_animals" do
    field(:owner, :string)
    field(:species, :string)
    field(:x, :integer)
    field(:y, :integer)
  end
end
