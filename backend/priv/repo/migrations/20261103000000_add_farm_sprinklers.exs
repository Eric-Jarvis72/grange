defmodule Grange.Repo.Migrations.AddFarmSprinklers do
  @moduledoc "Sprinklers placed at tile corners plus the farm's sprinkler supply."
  use Ecto.Migration

  def change do
    alter table(:farms) do
      add(:sprinkler_count, :integer, null: false, default: 0)
    end

    create table(:farm_sprinklers) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:x, :integer, null: false)
      add(:y, :integer, null: false)
    end

    create(unique_index(:farm_sprinklers, [:owner, :x, :y]))
  end
end
