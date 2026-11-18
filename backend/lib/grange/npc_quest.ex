defmodule Grange.NpcQuest do
  @moduledoc """
  The farmhand's starter quest: hand in ten tomatoes, then ten lettuce and ten
  wheat. Progress is stored per farm and every hand-in runs in one transaction
  so the barn, the wallet, and the quest counters cannot disagree.

  The farmhand pays the same prices as the market; those numbers come from
  `Grange.Crops`, never from the client. Only the crop the current stage asks
  for is accepted, and the amount is always ten.
  """

  alias Grange.{Barn, Crops, NpcQuestRecord, Repo, User}

  @goal 10
  @stages ~w(intro tomatoes supplies complete)
  @sellable ~w(tomato lettuce wheat)
  @counter_crops %{
    "tomato" => :tomatoes_sold,
    "lettuce" => :lettuce_sold,
    "wheat" => :wheat_sold
  }

  @doc "The quest state for `owner`, creating a fresh row on first access."
  @spec status(String.t()) :: map()
  def status(owner), do: owner |> ensure() |> view()

  @doc "Marks the welcome dialogue as seen and moves on to the tomato request."
  @spec intro_seen(String.t()) :: map()
  def intro_seen(owner) do
    row = ensure(owner)
    row = if row.stage == "intro", do: update_row(row, %{stage: "tomatoes"}), else: row
    view(row)
  end

  @doc """
  Hands in the quest's ten `item` from the owner's barn.

  Rejects items the current stage does not want, a second hand-in of the same
  crop, and a barn that holds fewer than ten. The reply carries the new quest
  state and the credited wallet balance.
  """
  @spec sell(String.t(), String.t()) :: {:ok, map()} | {:error, String.t()}
  def sell(owner, item) when item in @sellable do
    case Repo.transaction(fn -> trade(owner, item) end) do
      {:ok, result} -> {:ok, result}
      {:error, reason} -> {:error, reason}
    end
  end

  def sell(_owner, _item), do: {:error, "not looking for that"}

  @doc """
  Test-only shortcut that rewrites the stage and counters without a trade.

  It backs the gated `/api/dev/npc` route Playwright uses to jump straight to
  the tomato or lettuce/wheat part of the quest. Production never calls it.
  """
  @spec force(String.t(), map()) :: {:ok, map()} | {:error, String.t()}
  def force(owner, attrs) when is_map(attrs) do
    row = ensure(owner)
    counters = force_counters(row, Map.get(attrs, "counters"))
    stage = Map.get(attrs, "stage") || stage_for(counters)

    if stage in @stages do
      {:ok, row |> update_row(Map.merge(counters, %{stage: stage})) |> view()}
    else
      {:error, "unknown stage"}
    end
  end

  def force(_owner, _attrs), do: {:error, "invalid quest"}

  defp trade(owner, item) do
    row = ensure(owner)

    cond do
      item not in wanted(row.stage) ->
        Repo.rollback("not looking for that")

      handed_in?(row, item) ->
        Repo.rollback("already handed in")

      true ->
        hand_over(owner, row, item)
    end
  end

  defp hand_over(owner, row, item) do
    case Barn.sell(owner, item, @goal) do
      :ok ->
        price = Crops.get(item).sell_value * @goal
        user = Repo.get_by!(User, username: owner)
        balance = user.balance + price
        user |> Ecto.Changeset.change(balance: balance) |> Repo.update!()
        row = update_row(row, %{counter(item) => @goal})
        row = update_row(row, %{stage: stage_for(row)})
        %{npc: view(row), balance: balance}

      {:error, _reason} ->
        Repo.rollback("you need ten #{item}")
    end
  end

  defp wanted("tomatoes"), do: ~w(tomato)
  defp wanted("supplies"), do: ~w(lettuce wheat)
  defp wanted(_stage), do: []

  defp counter(crop), do: Map.fetch!(@counter_crops, crop)

  defp handed_in?(row, item), do: Map.get(row, counter(item)) >= @goal

  defp stage_for(%{tomatoes_sold: tomatoes, lettuce_sold: lettuce, wheat_sold: wheat}) do
    cond do
      tomatoes >= @goal and lettuce >= @goal and wheat >= @goal -> "complete"
      tomatoes >= @goal -> "supplies"
      true -> "tomatoes"
    end
  end

  defp force_counters(row, counters) when is_map(counters) do
    %{
      tomatoes_sold: counter_value(counters, "tomatoes", row.tomatoes_sold),
      lettuce_sold: counter_value(counters, "lettuce", row.lettuce_sold),
      wheat_sold: counter_value(counters, "wheat", row.wheat_sold)
    }
  end

  defp force_counters(row, _counters) do
    %{
      tomatoes_sold: row.tomatoes_sold,
      lettuce_sold: row.lettuce_sold,
      wheat_sold: row.wheat_sold
    }
  end

  defp counter_value(counters, key, current) do
    case Map.get(counters, key) || Map.get(counters, String.to_atom(key)) do
      value when is_integer(value) -> value |> max(0) |> min(@goal)
      _other -> current
    end
  end

  defp ensure(owner) do
    case Repo.get_by(NpcQuestRecord, owner: owner) do
      %NpcQuestRecord{} = row ->
        row

      nil ->
        %NpcQuestRecord{}
        |> NpcQuestRecord.changeset(%{owner: owner, stage: "intro"})
        |> Repo.insert(on_conflict: :nothing)
        |> case do
          {:ok, row} -> row
          {:error, _changeset} -> Repo.get_by!(NpcQuestRecord, owner: owner)
        end
    end
  end

  defp update_row(row, attrs) do
    row |> NpcQuestRecord.changeset(attrs) |> Repo.update!()
  end

  defp view(row) do
    %{
      stage: row.stage,
      tomatoes: row.tomatoes_sold,
      lettuce: row.lettuce_sold,
      wheat: row.wheat_sold
    }
  end
end
