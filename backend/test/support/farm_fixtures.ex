defmodule Grange.FarmFixtures do
  @moduledoc """
  Shared farm setup for ExUnit tests.

  The farm tests all need the same few operations: wipe the previous test's
  state, create a farm whose whole grid is unlocked, read a tile back from the
  server view, and advance growth. Keeping them here stops each new test file
  from growing its own copy.
  """

  alias Grange.{Farm, FarmRecord, FarmStore, Repo}

  @doc "Wipes persisted farm state; call from a test's `setup`."
  @spec reset_farm_state() :: :ok
  def reset_farm_state, do: FarmStore.reset()

  @doc """
  Creates `owner`'s farm with every land parcel unlocked.

  Land level 4 unlocks the full action grid, which most tile tests assume.
  """
  @spec full_farm(String.t()) :: map()
  def full_farm(owner) do
    set_farm!(owner, land_level: 4)
    FarmStore.view(owner)
  end

  @doc "Creates a farm that strangers may join."
  @spec public_farm(String.t()) :: map()
  def public_farm(owner) do
    view = full_farm(owner)
    {:ok, _farm} = FarmStore.update_settings(owner, %{"is_public" => true})
    view
  end

  @doc "Creates a public farm whose visitors may also edit it."
  @spec editable_farm(String.t()) :: map()
  def editable_farm(owner) do
    view = public_farm(owner)
    {:ok, _farm} = FarmStore.update_settings(owner, %{"visitor_edit" => true})
    view
  end

  @doc "Updates a farm row directly, for supplies and land level."
  @spec set_farm!(String.t(), keyword() | map()) :: FarmRecord.t()
  def set_farm!(owner, attrs) do
    FarmStore.ensure(owner)

    Repo.get!(FarmRecord, owner)
    |> Ecto.Changeset.change(attrs)
    |> Repo.update!()
  end

  @doc "The farm's tile at `{x, y}`, or nil when the ground is bare."
  @spec tile_at(String.t(), integer(), integer()) :: map() | nil
  def tile_at(owner, x, y) do
    FarmStore.view(owner).tiles
    |> Enum.find(&(&1.x == x and &1.y == y))
  end

  @doc """
  Waters the tile and runs a tick far enough ahead that it is ready.

  The tick is driven directly because the ticker is disabled in tests.
  """
  @spec grow(String.t(), integer(), integer()) :: :ok
  def grow(owner, x, y) do
    FarmStore.action(owner, %{"kind" => "water", "x" => x, "y" => y})

    future = System.system_time(:millisecond) + Farm.grow_ms() + 60_000
    FarmStore.tick(future)
    :ok
  end
end
