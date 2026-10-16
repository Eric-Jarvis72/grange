defmodule Grange.BarnItem do
  @moduledoc """
  One row of a player's barn: a produce item id and how many they hold.

  Replaces the old single `farms.tomatoes` counter so each crop is tracked (and
  sold) on its own. Item ids are crop ids such as `"wheat"` or `"tomato"`.
  """

  use Ecto.Schema

  import Ecto.Changeset

  schema "barn_items" do
    field(:owner, :string)
    field(:item, :string)
    field(:count, :integer, default: 0)
  end

  @type t :: %__MODULE__{
          owner: String.t(),
          item: String.t(),
          count: non_neg_integer()
        }

  @doc "Casts barn-item attributes."
  @spec changeset(t() | Ecto.Changeset.t(), map()) :: Ecto.Changeset.t()
  def changeset(row, attrs) do
    cast(row, attrs, [:owner, :item, :count])
  end
end
