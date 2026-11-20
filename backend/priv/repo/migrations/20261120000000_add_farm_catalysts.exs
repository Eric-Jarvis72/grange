defmodule Grange.Repo.Migrations.AddFarmCatalysts do
  @moduledoc false

  use Ecto.Migration

  def change do
    create table(:farm_catalysts) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:item, :string, null: false)
      add(:applies_at, :integer, null: false)
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:farm_catalysts, [:owner, :item]))
    create(index(:farm_catalysts, [:applies_at]))
  end
end
