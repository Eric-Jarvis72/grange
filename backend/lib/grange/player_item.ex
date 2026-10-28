defmodule Grange.PlayerItem do
  @moduledoc """
  One row of a player's personal inventory: a fishing rod or a caught fish.

  Rods are held one at a time (count 1); fish stack. Item ids are rod ids such
  as `"bamboo"` or fish ids such as `"minnow"`, matching the SPA's `ItemId`.
  """

  use Ecto.Schema

  import Ecto.Changeset

  schema "player_items" do
    field(:owner, :string)
    field(:item, :string)
    field(:count, :integer, default: 0)
  end

  @type t :: %__MODULE__{
          owner: String.t(),
          item: String.t(),
          count: non_neg_integer()
        }

  @doc "Casts player-item attributes."
  @spec changeset(t() | Ecto.Changeset.t(), map()) :: Ecto.Changeset.t()
  def changeset(row, attrs) do
    cast(row, attrs, [:owner, :item, :count])
  end
end
