defmodule Grange.Repo.Migrations.ReconcileInventoryItems do
  @moduledoc false
  use Ecto.Migration

  def up do
    create_if_not_exists table(:inventory_items) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:item, :string, null: false)
      add(:count, :integer, null: false, default: 0)
    end

    create_if_not_exists unique_index(:inventory_items, [:owner, :item])
  end

  def down, do: :ok
end
