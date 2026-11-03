defmodule Grange.FarmPresence do
  @moduledoc """
  Tracks which logged-in players are currently on each farm channel.

  Each farm channel process registers itself on join. A process monitor cleans
  up automatically if the channel closes or crashes, and every change notifies
  `Grange.SleepVotes` so an in-flight vote can drop players who left.
  """

  use GenServer

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(_opts \\ []),
    do: GenServer.start_link(__MODULE__, %{monitors: %{}, farms: %{}}, name: __MODULE__)

  @spec join(String.t(), String.t()) :: :ok
  def join(owner, username), do: GenServer.call(__MODULE__, {:join, owner, username})

  @spec leave(String.t(), String.t()) :: :ok
  def leave(owner, username), do: GenServer.call(__MODULE__, {:leave, owner, username})

  @spec active(String.t()) :: [String.t()]
  def active(owner), do: GenServer.call(__MODULE__, {:active, owner})

  @impl true
  def init(state), do: {:ok, state}

  @impl true
  def handle_call({:join, owner, username}, {pid, _ref}, state) do
    if Map.has_key?(state.monitors, pid) do
      {:reply, :ok, state}
    else
      ref = Process.monitor(pid)
      monitors = Map.put(state.monitors, pid, {ref, owner, username})
      farms = bump(state.farms, owner, username, 1)
      notify(owner, farms)
      {:reply, :ok, %{state | monitors: monitors, farms: farms}}
    end
  end

  def handle_call({:leave, owner, username}, {pid, _ref}, state) do
    {:reply, :ok, remove(state, pid, owner, username)}
  end

  def handle_call({:active, owner}, _from, state) do
    {:reply, state.farms |> Map.get(owner, %{}) |> Map.keys(), state}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, _reason}, state) do
    case Map.get(state.monitors, pid) do
      nil -> {:noreply, state}
      {_ref, owner, username} -> {:noreply, remove(state, pid, owner, username)}
    end
  end

  defp remove(state, pid, owner, username) do
    case Map.pop(state.monitors, pid) do
      {nil, _monitors} ->
        state

      {{ref, _owner, _username}, monitors} ->
        Process.demonitor(ref, [:flush])
        farms = bump(state.farms, owner, username, -1)
        notify(owner, farms)
        %{state | monitors: monitors, farms: farms}
    end
  end

  defp bump(farms, owner, username, delta) do
    farm = Map.get(farms, owner, %{})
    count = Map.get(farm, username, 0) + delta

    farm =
      if count > 0, do: Map.put(farm, username, count), else: Map.delete(farm, username)

    if map_size(farm) > 0, do: Map.put(farms, owner, farm), else: Map.delete(farms, owner)
  end

  defp notify(owner, farms) do
    if Process.whereis(Grange.SleepVotes) do
      users = farms |> Map.get(owner, %{}) |> Map.keys()
      Grange.SleepVotes.presence_changed(owner, users)
    end
  end
end
