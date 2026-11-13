defmodule Grange.Repo.Migrations.AddStorageToFarms do
  @moduledoc false

  use Ecto.Migration

  def change do
    alter table(:farms) do
      add(:storage, :map, null: false, default: %{})
    end
  end
end
