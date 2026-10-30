defmodule Grange.FarmBootstrap do
  @moduledoc """
  Creates the owning farm row atomically.

  Sales, tiles, barn rows, and inventory rows all reference `farms.owner`, so
  the row must exist before any of them. `on_conflict: :nothing` makes two
  simultaneous first loads (for example, the inventory fetch and the channel
  join) safe: one creates the farm and the other sees `:existing`.
  """

  alias Grange.{FarmRecord, Repo}

  @spec ensure(String.t()) :: :created | :existing
  def ensure(owner) do
    now = DateTime.utc_now()
    row = %{owner: owner, inserted_at: now, updated_at: now}
    {count, _rows} = Repo.insert_all(FarmRecord, [row], on_conflict: :nothing)
    if count == 1, do: :created, else: :existing
  end
end
