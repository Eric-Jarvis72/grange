defmodule Grange.Repo.Migrations.AddFarmVisitorSettings do
  @moduledoc false

  use Ecto.Migration

  def change do
    alter table(:farms) do
      add(:is_public, :boolean, null: false, default: false)
      add(:visitor_edit, :boolean, null: false, default: false)
    end
  end
end
