defmodule Grange.Repo.Migrations.AddBarnItems do
  @moduledoc false

  use Ecto.Migration

  def change do
    create table(:barn_items) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:item, :string, null: false)
      add(:count, :integer, null: false, default: 0)
    end

    create(unique_index(:barn_items, [:owner, :item]))

    # Backfill the legacy single-crop barn so existing players keep their
    # tomatoes. `farms.tomatoes` is left in place, deprecated.
    execute(
      "INSERT INTO barn_items (owner, item, count) " <>
        "SELECT owner, 'tomato', tomatoes FROM farms WHERE tomatoes > 0",
      "DELETE FROM barn_items WHERE item = 'tomato'"
    )
  end
end
