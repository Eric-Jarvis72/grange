defmodule Grange.InventorySlot do
  @moduledoc """
  One occupied hotbar or grid slot in an account's saved inventory layout.

  Seed totals remain authoritative in `inventory_items`; these rows persist the
  visual arrangement and stack sizes. Saves verify that seed sums match the
  ledger before replacing an account's layout.
  """

  use Ecto.Schema

  import Ecto.Changeset

  schema "inventory_slots" do
    field(:owner, :string)
    field(:area, :string)
    field(:slot, :integer)
    field(:item, :string)
    field(:count, :integer, default: 0)
  end

  @type t :: %__MODULE__{
          owner: String.t(),
          area: String.t(),
          slot: non_neg_integer(),
          item: String.t(),
          count: pos_integer()
        }

  @doc "Casts inventory-slot attributes."
  @spec changeset(t() | Ecto.Changeset.t(), map()) :: Ecto.Changeset.t()
  def changeset(row, attrs) do
    cast(row, attrs, [:owner, :area, :slot, :item, :count])
  end
end
