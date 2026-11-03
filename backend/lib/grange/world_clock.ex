defmodule Grange.WorldClock do
  @moduledoc """
  The authoritative global day/night clock.

  A full cycle is 36 real-world minutes (24 day, 12 night). The clock keeps a
  base cycle time and a monotonic start point so reads are cheap and the value
  advances smoothly. Dev/prod broadcast a snapshot once a second so clients can
  extrapolate lighting between syncs; tests disable the broadcast.
  """

  use GenServer

  alias Grange.DayNight

  @topic "lobby"
  @interval_ms 1_000

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @doc "The current clock snapshot shared with farm views and the lobby."
  @spec snapshot() :: map()
  def snapshot, do: GenServer.call(__MODULE__, :snapshot)

  @doc "Skips the rest of the night. Returns the new snapshot."
  @spec skip_to_day() :: map()
  def skip_to_day, do: GenServer.call(__MODULE__, :skip_to_day)

  @impl true
  def init(opts) do
    state = %{
      base: Keyword.get(opts, :cycle_time_ms, 0),
      started_at: System.system_time(:millisecond)
    }

    if Keyword.get(opts, :broadcast, Application.get_env(:grange, :start_world_clock, true)) do
      schedule()
    end

    {:ok, state}
  end

  @impl true
  def handle_call(:snapshot, _from, state), do: {:reply, payload(state), state}

  def handle_call(:skip_to_day, _from, state) do
    next = %{state | base: 0, started_at: System.system_time(:millisecond)}
    broadcast(next)
    {:reply, payload(next), next}
  end

  @impl true
  def handle_info(:broadcast, state) do
    broadcast(state)
    schedule()
    {:noreply, state}
  end

  defp schedule, do: Process.send_after(self(), :broadcast, @interval_ms)

  defp payload(state) do
    cycle_time =
      DayNight.normalize(state.base + (System.system_time(:millisecond) - state.started_at))

    %{
      cycle_time_ms: cycle_time,
      cycle_length_ms: DayNight.cycle_ms(),
      day_length_ms: DayNight.day_ms(),
      night_length_ms: DayNight.night_ms(),
      phase: DayNight.phase(cycle_time),
      server_time_ms: System.system_time(:millisecond)
    }
  end

  defp broadcast(state) do
    GrangeWeb.Endpoint.broadcast(@topic, "worldTime", %{time: payload(state)})
  end
end
