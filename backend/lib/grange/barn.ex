defmodule Grange.Barn do
  @moduledoc "Per-crop produced-goods storage for a farm (`barn_items`)."

  import Ecto.Query

  alias Grange.{BarnItem, Repo}

  @doc "Adds `count` of `item` to the owner's barn, inserting the row if new."
  @spec add(String.t(), String.t(), integer()) :: :ok
  def add(owner, item, count) when is_integer(count) and count > 0 do
    case Repo.get_by(BarnItem, owner: owner, item: item) do
      nil ->
        %BarnItem{}
        |> BarnItem.changeset(%{owner: owner, item: item, count: count})
        |> Repo.insert!()

      row ->
        row |> BarnItem.changeset(%{count: row.count + count}) |> Repo.update!()
    end

    :ok
  end

  @doc "Removes `count` of `item`, or fails when the barn holds too little."
  @spec sell(String.t(), String.t(), integer()) :: :ok | {:error, String.t()}
  def sell(owner, item, count) when is_integer(count) and count > 0 do
    case Repo.get_by(BarnItem, owner: owner, item: item) do
      %BarnItem{count: held} = row when held >= count ->
        row |> BarnItem.changeset(%{count: held - count}) |> Repo.update!()
        :ok

      _insufficient ->
        {:error, "not enough #{item}"}
    end
  end

  @doc "The owner's barn as a `%{item => count}` map."
  @spec map(String.t()) :: map()
  def map(owner) do
    from(b in BarnItem, where: b.owner == ^owner)
    |> Repo.all()
    |> Map.new(&{&1.item, &1.count})
  end
end
