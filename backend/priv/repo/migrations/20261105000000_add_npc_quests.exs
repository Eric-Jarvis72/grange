defmodule Grange.Repo.Migrations.AddNpcQuests do
  @moduledoc false

  use Ecto.Migration

  def change do
    create table(:npc_quests) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:stage, :string, null: false, default: "intro")
      add(:tomatoes_sold, :integer, null: false, default: 0)
      add(:lettuce_sold, :integer, null: false, default: 0)
      add(:wheat_sold, :integer, null: false, default: 0)
      timestamps(type: :utc_datetime_usec)
    end

    create(unique_index(:npc_quests, [:owner]))
  end
end
