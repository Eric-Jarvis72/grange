defmodule Grange.Repo.Migrations.AddFarmProps do
  use Ecto.Migration

  def change do
    create table(:farm_props) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:source_index, :integer, null: false)
      add(:asset, :string, null: false)
      add(:x, :integer, null: false)
      add(:y, :integer, null: false)
      add(:carried, :boolean, null: false, default: false)
    end

    create(unique_index(:farm_props, [:owner, :source_index]))
  end
end
