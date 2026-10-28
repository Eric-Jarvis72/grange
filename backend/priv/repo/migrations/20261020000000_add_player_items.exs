defmodule Grange.Repo.Migrations.AddPlayerItems do
  @moduledoc false

  use Ecto.Migration

  def change do
    create table(:player_items) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:item, :string, null: false)
      add(:count, :integer, null: false, default: 0)
    end

    create(unique_index(:player_items, [:owner, :item]))
  end
end
