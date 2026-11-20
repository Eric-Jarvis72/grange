defmodule Grange.FarmCatalyst do
  @moduledoc """
  One overnight catalyst waiting for the next dawn on a farm.

  `item` is the player-facing catalyst id and `applies_at` is the wall-clock
  epoch millisecond when the transformation should run. A farm can have one
  pending row per catalyst type.
  """

  use Ecto.Schema

  import Ecto.Changeset

  schema "farm_catalysts" do
    field(:owner, :string)
    field(:item, :string)
    field(:applies_at, :integer)
    timestamps(type: :utc_datetime_usec)
  end

  @type t :: %__MODULE__{
          owner: String.t(),
          item: String.t(),
          applies_at: integer()
        }

  @doc "Casts pending-catalyst attributes."
  @spec changeset(t() | Ecto.Changeset.t(), map()) :: Ecto.Changeset.t()
  def changeset(row, attrs) do
    cast(row, attrs, [:owner, :item, :applies_at])
  end
end
