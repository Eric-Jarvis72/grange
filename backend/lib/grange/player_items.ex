defmodule Grange.PlayerItems do
  @moduledoc """
  Per-player personal items (`player_items`): the fishing rods a player owns and
  the fish in their creel.

  This is the durable source of truth for those items, so they survive a browser
  close or a server restart. Produce lives in the barn instead; tools, seeds, and
  buildings are still granted fresh on each session.
  """

  import Ecto.Query

  alias Grange.{PlayerItem, Repo}

  @doc "Adds `count` of `item` to the owner's items, inserting the row if new."
  @spec add(String.t(), String.t(), integer()) :: :ok
  def add(owner, item, count) when is_integer(count) and count > 0 do
    case Repo.get_by(PlayerItem, owner: owner, item: item) do
      nil ->
        %PlayerItem{}
        |> PlayerItem.changeset(%{owner: owner, item: item, count: count})
        |> Repo.insert!()

      row ->
        row |> PlayerItem.changeset(%{count: row.count + count}) |> Repo.update!()
    end

    :ok
  end

  def add(_owner, _item, _count), do: :ok

  @doc "Removes `count` of `item`, or fails when the player holds too few."
  @spec remove(String.t(), String.t(), integer()) :: :ok | {:error, String.t()}
  def remove(owner, item, count) when is_integer(count) and count > 0 do
    case Repo.get_by(PlayerItem, owner: owner, item: item) do
      %PlayerItem{count: held} = row when held >= count ->
        row |> PlayerItem.changeset(%{count: held - count}) |> Repo.update!()
        :ok

      _insufficient ->
        {:error, "not enough #{item}"}
    end
  end

  def remove(_owner, _item, _count), do: {:error, "invalid count"}

  @doc "The owner's items as an `%{item => count}` map."
  @spec map(String.t()) :: map()
  def map(owner) do
    from(p in PlayerItem, where: p.owner == ^owner)
    |> Repo.all()
    |> Map.new(&{&1.item, &1.count})
  end

  @doc "Deletes every player's items."
  @spec reset() :: :ok
  def reset do
    Repo.delete_all(PlayerItem)
    :ok
  end
end
