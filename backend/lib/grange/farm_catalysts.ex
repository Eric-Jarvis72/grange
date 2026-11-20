defmodule Grange.FarmCatalysts do
  @moduledoc """
  Queues overnight crop catalysts and applies them at dawn.

  Using a catalyst consumes one from the player's durable `player_items` ledger
  and records a pending row for the next day start. `Grange.FarmStore.tick/1`
  applies due rows, and a successful sleep calls `apply_all/0` because sleeping
  jumps the world clock to the next morning. Applying a catalyst rewrites every
  matching standard-crop tile on the farm into its rare variant while leaving
  the tile's state and growth timestamps alone.
  """

  import Ecto.Query

  alias Grange.{
    Crops,
    FarmCatalyst,
    PlayerItems,
    Repo,
    Tile,
    WorldClock
  }

  @spec next_dawn_ms(integer()) :: integer()
  def next_dawn_ms(now_ms) do
    %{cycle_time_ms: cycle_time, cycle_length_ms: cycle_length} = WorldClock.snapshot()
    next_dawn_ms(now_ms, cycle_time, cycle_length)
  end

  @doc "The epoch millisecond of the next day start, given a cycle position."
  @spec next_dawn_ms(integer(), integer(), integer()) :: integer()
  def next_dawn_ms(now_ms, cycle_time, cycle_length) when cycle_length > 0 do
    cycle = Integer.mod(cycle_time, cycle_length)
    now_ms + cycle_length - cycle
  end

  @doc """
  Consumes one catalyst and queues its dawn transformation.

  Fails without consuming anything when the item is unknown, the same catalyst
  is already pending, the player holds none, or the farm has no matching crops.
  """
  @spec schedule(String.t(), String.t()) :: {:ok, map()} | {:error, String.t()}
  def schedule(owner, item) do
    case Crops.catalyst(item) do
      nil -> {:error, "unknown catalyst"}
      %{standard: standard, rare: rare} -> schedule(owner, item, standard, rare)
    end
  end

  @doc "Applies every pending catalyst whose dawn has passed."
  @spec apply_due(integer()) :: [map()]
  def apply_due(now_ms) do
    from(c in FarmCatalyst, where: c.applies_at <= ^now_ms, order_by: [c.owner, c.item])
    |> Repo.all()
    |> apply_rows()
  end

  @doc "Applies every pending catalyst regardless of its deadline (dawn skip)."
  @spec apply_all() :: [map()]
  def apply_all do
    from(c in FarmCatalyst, order_by: [c.owner, c.item])
    |> Repo.all()
    |> apply_rows()
  end

  defp schedule(owner, item, standard, rare) do
    result = Repo.transaction(fn -> queue(owner, item, standard, rare) end)

    case result do
      {:ok, pending} -> {:ok, pending}
      {:error, reason} when is_binary(reason) -> {:error, reason}
      {:error, _reason} -> {:error, "could not use catalyst"}
    end
  end

  defp queue(owner, item, standard, rare) do
    cond do
      pending?(owner, item) ->
        Repo.rollback("catalyst already brewing")

      matching_tiles(owner, standard) == 0 ->
        Repo.rollback("no #{Crops.get(standard).name} to transform")

      true ->
        consume_and_queue(owner, item, standard, rare)
    end
  end

  defp consume_and_queue(owner, item, standard, rare) do
    case PlayerItems.remove(owner, item, 1) do
      :ok ->
        applies_at = next_dawn_ms(now_ms())

        Repo.insert!(%FarmCatalyst{
          owner: owner,
          item: item,
          applies_at: applies_at
        })

        %{item: item, standard: standard, crop: rare, applies_at: applies_at}

      {:error, _reason} ->
        Repo.rollback("you don't have that catalyst")
    end
  end

  defp pending?(owner, item) do
    Repo.exists?(from(c in FarmCatalyst, where: c.owner == ^owner and c.item == ^item))
  end

  defp matching_tiles(owner, standard) do
    from(t in Tile, where: t.owner == ^owner and t.state != :tilled)
    |> Repo.all()
    |> Enum.count(fn tile ->
      {crop_id, _remaining} = Crops.parse_crop(tile.crop)
      crop_id == standard
    end)
  end

  defp apply_rows(rows) do
    Enum.map(rows, fn row ->
      case Crops.catalyst(row.item) do
        %{standard: standard, rare: rare} ->
          apply_row(row, standard, rare)

        nil ->
          Repo.delete!(row)
          %{owner: row.owner, item: row.item, standard: nil, crop: nil, count: 0}
      end
    end)
  end

  defp apply_row(row, standard, rare) do
    result =
      Repo.transaction(fn ->
        count = transform(row.owner, standard, rare)
        Repo.delete!(row)
        %{owner: row.owner, item: row.item, standard: standard, crop: rare, count: count}
      end)

    case result do
      {:ok, applied} -> applied
      _error -> %{owner: row.owner, item: row.item, standard: standard, crop: rare, count: 0}
    end
  end

  defp transform(owner, standard, rare) do
    harvests = Crops.get(rare)[:harvests] || 1
    encoded = Crops.encode_crop(rare, harvests)

    from(t in Tile, where: t.owner == ^owner and t.state != :tilled)
    |> Repo.all()
    |> Enum.count(fn tile ->
      case Crops.parse_crop(tile.crop) do
        {^standard, _remaining} ->
          tile
          |> Ecto.Changeset.change(crop: encoded)
          |> Repo.update!()

          true

        _other ->
          false
      end
    end)
  end

  defp now_ms, do: System.system_time(:millisecond)
end
