defmodule Grange.SleepVotes do
  @moduledoc """
  Farm-scoped sleep votes.

  A lone player skips the night immediately. With more players present, a vote
  opens for everyone currently on the farm and the night advances only when all
  of them accept. Votes expire after 30 seconds. Broadcasts go to the farm's
  own channel topic so every visitor sees the prompt.
  """

  use GenServer

  alias Grange.{DayNight, FarmPresence, WorldClock}

  @timeout_ms 30_000

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(_opts \\ []), do: GenServer.start_link(__MODULE__, %{}, name: __MODULE__)

  @spec request(String.t(), String.t()) :: {:ok, atom()} | {:error, String.t()}
  def request(owner, initiator), do: GenServer.call(__MODULE__, {:request, owner, initiator})

  @spec vote(String.t(), String.t(), :accept | :decline) ::
          {:ok, atom()} | {:error, String.t()}
  def vote(owner, username, decision),
    do: GenServer.call(__MODULE__, {:vote, owner, username, decision})

  @spec presence_changed(String.t(), [String.t()]) :: :ok
  def presence_changed(owner, users),
    do: GenServer.cast(__MODULE__, {:presence_changed, owner, users})

  @impl true
  def init(state), do: {:ok, state}

  defp night? do
    DayNight.phase(WorldClock.snapshot().cycle_time_ms) == :night
  end

  defp start_request(state, owner, initiator) do
    users = FarmPresence.active(owner)

    if length(users) <= 1 do
      WorldClock.skip_to_day()
      broadcast(owner, "sleepResult", %{result: "skipped", initiator: initiator})
      {:reply, {:ok, :skipped}, state}
    else
      vote = new_vote(owner, initiator, users)
      broadcast(owner, "sleepVote", %{vote: public(vote)})
      {:reply, {:ok, :voting}, Map.put(state, owner, vote)}
    end
  end

  defp new_vote(owner, initiator, users) do
    %{
      initiator: initiator,
      required: MapSet.new(users),
      accepted: MapSet.new([initiator]),
      declined: MapSet.new(),
      timer: Process.send_after(self(), {:timeout, owner}, @timeout_ms)
    }
  end

  @impl true
  def handle_call({:request, owner, initiator}, _from, state) do
    cond do
      Map.has_key?(state, owner) ->
        {:reply, {:error, "a sleep vote is already in progress"}, state}

      not night?() ->
        {:reply, {:error, "it is not night yet"}, state}

      true ->
        start_request(state, owner, initiator)
    end
  end

  def handle_call({:vote, owner, username, decision}, _from, state) do
    case Map.get(state, owner) do
      nil ->
        {:reply, {:error, "no sleep vote in progress"}, state}

      vote ->
        {reply, next} = apply_vote(state, owner, vote, username, decision)
        {:reply, reply, next}
    end
  end

  @impl true
  def handle_cast({:presence_changed, owner, users}, state) do
    case Map.get(state, owner) do
      nil ->
        {:noreply, state}

      vote ->
        active = MapSet.new(users)
        required = MapSet.intersection(vote.required, active)

        cond do
          not MapSet.member?(active, vote.initiator) ->
            {next, _result} = finish(state, owner, vote, "expired")
            {:noreply, next}

          MapSet.subset?(required, vote.accepted) ->
            {next, _result} = finish(state, owner, vote, "accepted")
            {:noreply, next}

          true ->
            {:noreply, Map.put(state, owner, %{vote | required: required})}
        end
    end
  end

  @impl true
  def handle_info({:timeout, owner}, state) do
    case Map.get(state, owner) do
      nil ->
        {:noreply, state}

      vote ->
        {next, _result} = finish(state, owner, vote, "expired")
        {:noreply, next}
    end
  end

  defp apply_vote(state, _owner, _vote, username, _decision)
       when not is_binary(username) do
    {{:error, "not logged in"}, state}
  end

  defp apply_vote(state, owner, vote, username, decision) do
    accepted = MapSet.member?(vote.accepted, username)
    declined = MapSet.member?(vote.declined, username)

    cond do
      not MapSet.member?(vote.required, username) ->
        {{:error, "you are not part of this vote"}, state}

      accepted or declined ->
        {{:error, "you already voted"}, state}

      decision == :accept ->
        next = %{vote | accepted: MapSet.put(vote.accepted, username)}

        if MapSet.subset?(next.required, next.accepted) do
          {state, result} = finish(state, owner, next, "accepted")
          {{:ok, result}, state}
        else
          broadcast(owner, "sleepVote", %{vote: public(next)})
          {{:ok, :accepted}, Map.put(state, owner, next)}
        end

      decision == :decline ->
        next = %{vote | declined: MapSet.put(vote.declined, username)}
        {state, result} = finish(state, owner, next, "declined")
        {{:ok, result}, state}

      true ->
        {{:error, "invalid vote"}, state}
    end
  end

  defp finish(state, owner, vote, result) do
    Process.cancel_timer(vote.timer)
    if result == "accepted", do: WorldClock.skip_to_day()
    broadcast(owner, "sleepResult", %{result: result, initiator: vote.initiator})
    {Map.delete(state, owner), String.to_atom(result)}
  end

  defp public(vote) do
    %{
      initiator: vote.initiator,
      required: MapSet.to_list(vote.required),
      accepted: MapSet.to_list(vote.accepted),
      declined: MapSet.to_list(vote.declined)
    }
  end

  defp broadcast(owner, event, payload) do
    GrangeWeb.Endpoint.broadcast("farm:" <> owner, event, payload)
  end
end
