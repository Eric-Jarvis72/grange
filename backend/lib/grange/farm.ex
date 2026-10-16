defmodule Grange.Farm do
  @moduledoc """
  Pure helpers for a player's field: bounds, crop timing, and tile transitions.

  A field is a `grid_size/0` x `grid_size/0` grid. Only tilled tiles are
  tracked; any coordinate without a tile is bare ground. Tiles cycle
  `tilled -> planted -> watered -> ready -> tilled` as the player hoes, plants,
  waters, and harvests.
  """

  @grid_size 15
  @grow_ms 10_000
  @harvest_yield 3

  @typedoc "The lifecycle state of a field tile."
  @type state :: :tilled | :planted | :watered | :ready

  @typedoc "One planted or tilled tile of a player's field."
  @type tile :: %{
          x: non_neg_integer(),
          y: non_neg_integer(),
          state: state(),
          crop: String.t(),
          planted_at: integer() | nil,
          watered_at: integer() | nil,
          ready_at: integer() | nil
        }

  @doc "The field is this many tiles on each side."
  @spec grid_size() :: pos_integer()
  def grid_size, do: @grid_size

  @doc "How long a watered tile takes to become ready, in milliseconds."
  @spec grow_ms() :: pos_integer()
  def grow_ms, do: @grow_ms

  @doc "How many tomatoes a harvest yields."
  @spec harvest_yield() :: pos_integer()
  def harvest_yield, do: @harvest_yield

  @doc "True when `{x, y}` is an integer coordinate inside the field."
  @spec in_bounds?(integer(), integer()) :: boolean()
  def in_bounds?(x, y), do: in_bounds?(x, y, @grid_size)

  @spec in_bounds?(integer(), integer(), pos_integer()) :: boolean()
  def in_bounds?(x, y, size) do
    is_integer(x) and is_integer(y) and x >= 0 and y >= 0 and x < size and y < size
  end

  @doc "A freshly tilled tile."
  @spec new_tile(integer(), integer()) :: tile()
  def new_tile(x, y) do
    %{x: x, y: y, state: :tilled, crop: "tomato"}
    |> Map.merge(%{planted_at: nil, watered_at: nil, ready_at: nil})
  end

  @doc "Plants a seed in a tilled tile."
  @spec plant(tile(), integer()) :: {:ok, tile()} | {:error, String.t()}
  def plant(%{state: :tilled} = tile, now), do: {:ok, %{tile | state: :planted, planted_at: now}}
  def plant(_tile, _now), do: {:error, "tile is not tilled"}

  @doc "Waters a planted tile, scheduling when it becomes ready."
  @spec water(tile(), integer()) :: {:ok, tile()} | {:error, String.t()}
  def water(%{state: :planted} = tile, now), do: water(tile, now, @grow_ms)
  def water(_tile, _now), do: {:error, "tile is not planted"}

  @doc """
  Waters a planted tile with an explicit grow time, so synergy (wheat packs,
  tomato spacing) can shorten or lengthen the ripening window.
  """
  @spec water(tile(), integer(), number()) :: {:ok, tile()} | {:error, String.t()}
  def water(%{state: :planted} = tile, now, grow_ms) do
    {:ok, %{tile | state: :watered, watered_at: now, ready_at: now + round(grow_ms)}}
  end

  def water(_tile, _now, _grow_ms), do: {:error, "tile is not planted"}

  @doc "Harvests a ready tile back to tilled ground."
  @spec harvest(tile()) :: {:ok, tile()} | {:error, String.t()}
  def harvest(%{state: :ready} = tile) do
    {:ok, %{tile | state: :tilled, watered_at: nil, ready_at: nil}}
  end

  def harvest(_tile), do: {:error, "tile is not ready"}

  @doc "True when a watered tile's ready time has passed."
  @spec ready?(tile(), integer()) :: boolean()
  def ready?(%{state: :watered, ready_at: ready_at}, now) do
    is_integer(ready_at) and now >= ready_at
  end

  def ready?(_tile, _now), do: false

  @doc "Flips a ripe watered tile to ready."
  @spec mark_ready(tile()) :: tile()
  def mark_ready(%{state: :watered} = tile), do: %{tile | state: :ready}
end
