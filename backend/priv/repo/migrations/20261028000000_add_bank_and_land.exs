defmodule Grange.Repo.Migrations.AddBankAndLand do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add(:bank_balance, :integer, default: 0, null: false)
    end

    alter table(:farms) do
      add(:land_level, :integer, default: 0, null: false)
    end
  end
end
