defmodule Grange.DayNight do
  @moduledoc """
  Pure day/night cycle tuning. Mirrors the constants in `shared/mechanics.ts`.

  A full cycle is 36 real-world minutes: 24 minutes of day and 12 minutes of
  night. The clock itself lives in `Grange.WorldClock`; this module only knows
  how to wrap and classify a cycle time.
  """

  @cycle_ms 36 * 60 * 1000
  @day_ms 24 * 60 * 1000
  @night_ms 12 * 60 * 1000

  @spec cycle_ms() :: pos_integer()
  def cycle_ms, do: @cycle_ms

  @spec day_ms() :: pos_integer()
  def day_ms, do: @day_ms

  @spec night_ms() :: pos_integer()
  def night_ms, do: @night_ms

  @doc "Wraps any cycle time into `[0, cycle_ms/0)`."
  @spec normalize(integer()) :: non_neg_integer()
  def normalize(ms) when is_integer(ms), do: Integer.mod(ms, @cycle_ms)

  @doc "Classifies a cycle time as `:day` or `:night`."
  @spec phase(integer()) :: :day | :night
  def phase(cycle_time_ms) when is_integer(cycle_time_ms) do
    if normalize(cycle_time_ms) < @day_ms, do: :day, else: :night
  end

  @doc """
  The cycle time to use after sleeping. Night jumps to the start of the next
  day; daytime is left untouched.
  """
  @spec skip_to_day(integer()) :: non_neg_integer()
  def skip_to_day(cycle_time_ms) when is_integer(cycle_time_ms) do
    if phase(cycle_time_ms) == :night, do: 0, else: normalize(cycle_time_ms)
  end
end
