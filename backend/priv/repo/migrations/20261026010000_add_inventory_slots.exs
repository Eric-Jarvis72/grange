defmodule Grange.Repo.Migrations.AddInventorySlots do
  @moduledoc false

  use Ecto.Migration

  def change do
    create table(:inventory_slots) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:area, :string, null: false)
      add(:slot, :integer, null: false)
      add(:item, :string, null: false)
      add(:count, :integer, null: false, default: 0)
    end

    create(unique_index(:inventory_slots, [:owner, :area, :slot]))
  end
end
