defmodule Grange.Repo.Migrations.AddPlacedFarmAnimals do
  use Ecto.Migration

  def change do
    create table(:farm_animals) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:species, :string, null: false)
      add(:x, :integer, null: false)
      add(:y, :integer, null: false)
    end

    create(unique_index(:farm_animals, [:owner, :x, :y]))
  end
end
