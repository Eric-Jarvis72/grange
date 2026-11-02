defmodule Grange.Repo.Migrations.AddFarmAnimals do
  use Ecto.Migration

  def up do
    columns = Ecto.Adapters.SQL.query!(repo(), "PRAGMA table_info(farms)", []).rows

    unless Enum.any?(columns, &(Enum.at(&1, 1) == "animals")) do
      alter table(:farms) do
        add(:animals, :map, null: false, default: %{})
      end
    end
  end

  # Existing developer databases may already have this column from the
  # migration version that collided with inventory_items on main.
  def down, do: :ok
end
