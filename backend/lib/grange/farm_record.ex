defmodule Grange.FarmRecord do
  @moduledoc """
  The persisted row for one player's farm: their barn inventory plus the
  tiles that make up their field.

  `Grange.Farm` holds the pure field rules; this module only maps a farm to
  its database row.
  """

  use Ecto.Schema

  @primary_key {:owner, :string, autogenerate: false}
  schema "farms" do
    field(:tomatoes, :integer, default: 0)
    field(:fence_count, :integer, default: 20)
    field(:gate_count, :integer, default: 2)
    field(:animals, :map, default: %{})
    field(:land_level, :integer, default: 0)
    has_many(:tiles, Grange.Tile, foreign_key: :owner, references: :owner)
    has_many(:barn_items, Grange.BarnItem, foreign_key: :owner, references: :owner)
    timestamps(type: :utc_datetime_usec)
  end

  @type t :: %__MODULE__{
          owner: String.t(),
          tomatoes: non_neg_integer(),
          fence_count: non_neg_integer(),
          gate_count: non_neg_integer(),
          animals: %{optional(String.t()) => non_neg_integer()},
          land_level: non_neg_integer(),
          tiles: [Grange.Tile.t()] | Ecto.Association.NotLoaded.t(),
          barn_items: [Grange.BarnItem.t()] | Ecto.Association.NotLoaded.t(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }
end
