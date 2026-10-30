defmodule Grange.InventoryItem do
  @moduledoc """
  One row of an account's seed inventory: a seed item id and how many are held.

  Unlike the barn, which stores produce, this table is for planted goods. A row
  is kept even when its count reaches zero: its existence marks the account as
  having received the lazy starter kit, so spending every seed does not grant a
  fresh pouch on the next load.
  """

  use Ecto.Schema

  import Ecto.Changeset

  schema "inventory_items" do
    field(:owner, :string)
    field(:item, :string)
    field(:count, :integer, default: 0)
  end

  @type t :: %__MODULE__{
          owner: String.t(),
          item: String.t(),
          count: non_neg_integer()
        }

  @doc "Casts inventory-item attributes."
  @spec changeset(t() | Ecto.Changeset.t(), map()) :: Ecto.Changeset.t()
  def changeset(row, attrs) do
    cast(row, attrs, [:owner, :item, :count])
  end
end
