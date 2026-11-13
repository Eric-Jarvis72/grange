defmodule Grange.Tile do
  @moduledoc "The persisted row for one tile of a player's field."

  use Ecto.Schema

  import Ecto.Changeset

  alias Grange.Farm

  schema "tiles" do
    field(:owner, :string)
    field(:x, :integer)
    field(:y, :integer)
    field(:state, Ecto.Enum, values: [:tilled, :planted, :watered, :ready])
    field(:crop, :string, default: "tomato")
    field(:planted_at, :integer)
    field(:watered_at, :integer)
    field(:ready_at, :integer)
    field(:tilled_at, :integer)
  end

  @type t :: %__MODULE__{
          owner: String.t(),
          x: non_neg_integer(),
          y: non_neg_integer(),
          state: Farm.state(),
          crop: String.t(),
          planted_at: integer() | nil,
          watered_at: integer() | nil,
          ready_at: integer() | nil,
          tilled_at: integer() | nil
        }

  @doc "Casts tile attributes."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(tile, attrs) do
    cast(tile, attrs, [
      :owner,
      :x,
      :y,
      :state,
      :crop,
      :planted_at,
      :watered_at,
      :ready_at,
      :tilled_at
    ])
  end
end
