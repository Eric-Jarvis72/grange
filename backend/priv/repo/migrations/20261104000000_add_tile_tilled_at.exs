defmodule Grange.Repo.Migrations.AddTileTilledAt do
  @moduledoc """
  Stamps when a tile entered the bare `tilled` state so abandoned soil can
  revert to grass after `Grange.Farm.till_decay_ms/0`.

  Existing tilled rows are backfilled with the migration time so live farms
  get a fresh window instead of reverting immediately.
  """

  use Ecto.Migration

  def up do
    alter table(:tiles) do
      add(:tilled_at, :integer)
    end

    now = System.system_time(:millisecond)
    execute("UPDATE tiles SET tilled_at = #{now} WHERE state = 'tilled'")
  end

  def down do
    alter table(:tiles) do
      remove(:tilled_at)
    end
  end
end
