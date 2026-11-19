defmodule Grange.DayNightTest do
  @moduledoc false
  use ExUnit.Case, async: true

  alias Grange.DayNight

  test "cycle constants match the 36-minute rule" do
    assert DayNight.cycle_ms() == 2_160_000
    assert DayNight.day_ms() == 1_440_000
    assert DayNight.night_ms() == 720_000
  end

  test "phase flips at the day/night boundary" do
    assert DayNight.phase(0) == :day
    assert DayNight.phase(DayNight.day_ms() - 1) == :day
    assert DayNight.phase(DayNight.day_ms()) == :night
    assert DayNight.phase(DayNight.cycle_ms() - 1) == :night
  end

  test "normalize wraps around cycles" do
    assert DayNight.normalize(DayNight.cycle_ms()) == 0
    assert DayNight.normalize(DayNight.cycle_ms() + 123) == 123
    assert DayNight.normalize(-1) == DayNight.cycle_ms() - 1
  end

  test "skip_to_day only skips nights" do
    assert DayNight.skip_to_day(0) == 0
    assert DayNight.skip_to_day(1_000) == 1_000
    assert DayNight.skip_to_day(DayNight.day_ms()) == 0
    assert DayNight.skip_to_day(DayNight.cycle_ms() - 1) == 0
  end
end
