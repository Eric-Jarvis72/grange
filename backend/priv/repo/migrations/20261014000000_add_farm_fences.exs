defmodule Grange.Repo.Migrations.AddFarmFences do
  use Ecto.Migration

  def change do
    alter table(:farms) do
      add(:fence_count, :integer, null: false, default: 20)
    end

    create table(:farm_fences) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:x, :integer, null: false)
      add(:y, :integer, null: false)
    end

    create(unique_index(:farm_fences, [:owner, :x, :y]))
  end
end
