defmodule Grange.Inventory do
  @moduledoc """
  Account-scoped seed ledger and persisted hotbar/grid layout.

  Seeds are the part of the inventory the server must validate: purchases,
  planting, and harvest drops all update `inventory_items`. The visual layout is
  stored in `inventory_slots`; saves are allowed to move and split stacks but
  may not contain more seeds than the ledger holds.
  """

  import Ecto.Query

  alias Grange.{
    Crops,
    FarmRecord,
    InventoryItem,
    InventorySlot,
    ItemCatalog,
    Repo,
    User
  }

  @seed_items ~w(seed-bag wheat-seed lettuce-seed midas-wheat-seed frost-lettuce-seed sunburst-tomato-seed)
  @animal_items ~w(cow hen sheep pig)
  @starter %{"seed-bag" => 10}
  @max_stack 99
  @hotbar_size 10
  @grid_size 24
  @market_crops %{
    "tomato-seed" => "tomato",
    "wheat-seed" => "wheat",
    "lettuce-seed" => "lettuce"
  }

  @doc "The inventory item id that plants `crop`, or nil for an unknown crop."
  @spec seed_item(String.t() | nil) :: String.t() | nil
  def seed_item(crop) do
    case Crops.get(crop) do
      %{seed: "tomato-seed"} -> "seed-bag"
      %{seed: seed} -> seed
      _ -> nil
    end
  end

  @doc "The seed map for an owner, creating the starter kit and layout on first access."
  @spec ensure(String.t()) :: map()
  def ensure(owner) do
    ensure_seed_rows(owner)
    ensure_layout(owner)
    seeds(owner)
  end

  @doc "Seed item id -> count for `owner`."
  @spec seeds(String.t()) :: map()
  def seeds(owner) do
    from(i in InventoryItem,
      where: i.owner == ^owner and i.item in ^@seed_items,
      select: {i.item, i.count}
    )
    |> Repo.all()
    |> Map.new()
  end

  @doc "Adds `count` of a seed, keeping the row when the result is zero."
  @spec add(String.t(), String.t(), integer()) :: :ok
  def add(owner, item, count) when item in @seed_items and is_integer(count) and count > 0 do
    row = Repo.get_by(InventoryItem, owner: owner, item: item)
    held = if row, do: row.count, else: 0
    put_count(owner, item, held + count)
  end

  def add(_owner, _item, _count), do: :ok

  @doc "Spends `count` seeds, or fails when the owner holds too few."
  @spec take(String.t(), String.t(), integer()) :: :ok | {:error, String.t()}
  def take(owner, item, count) when item in @seed_items and is_integer(count) and count > 0 do
    case Repo.get_by(InventoryItem, owner: owner, item: item) do
      %InventoryItem{count: held} = row when held >= count ->
        row |> Ecto.Changeset.change(count: held - count) |> Repo.update!()
        :ok

      _ ->
        {:error, "no seeds"}
    end
  end

  def take(_owner, _item, _count), do: {:error, "no seeds"}

  @doc "Buys a market seed atomically, debiting the account balance."
  @spec buy(User.t(), String.t(), integer()) :: {:ok, map()} | {:error, String.t()}
  def buy(%User{} = user, market_item, quantity) when is_integer(quantity) and quantity > 0 do
    with {:ok, crop} <- market_crop(market_item),
         seed when is_binary(seed) <- seed_item(crop) do
      purchase_seeds(user, seed, quantity, Crops.get(crop).seed_cost * quantity)
    else
      nil -> {:error, "unknown seed"}
      {:error, reason} -> {:error, reason}
    end
  end

  def buy(_user, _market_item, _quantity), do: {:error, "invalid purchase"}

  @doc "The saved hotbar/grid slots for an owner as a list of maps."
  @spec layout(String.t()) :: [map()]
  def layout(owner) do
    from(s in InventorySlot,
      where: s.owner == ^owner,
      order_by: [s.area, s.slot],
      select: %{area: s.area, slot: s.slot, item: s.item, count: s.count}
    )
    |> Repo.all()
  end

  @doc """
  Replaces an owner's saved layout.

  Seed sums in the submitted slots may not exceed the authoritative seed
  ledger. A snapshot may contain fewer seed slots than the ledger when the
  hotbar and grid are full; those seeds stay in `inventory_items` and reappear
  as soon as space opens up. This keeps moving and splitting stacks from
  becoming a way to create seeds.
  """
  @spec save_layout(String.t(), [map()]) :: {:ok, [map()]} | {:error, String.t()}
  def save_layout(owner, slots) when is_list(slots) do
    with {:ok, normalized} <- normalize_slots(slots),
         :ok <- validate_seed_totals(owner, normalized),
         :ok <- validate_animal_totals(owner, normalized),
         :ok <- replace_layout(owner, normalized) do
      {:ok, layout(owner)}
    end
  end

  def save_layout(_owner, _slots), do: {:error, "invalid inventory"}

  defp replace_layout(owner, rows) do
    case Repo.transaction(fn -> replace_rows(owner, rows) end) do
      {:ok, _result} -> :ok
      {:error, _reason} -> {:error, "could not save inventory"}
    end
  end

  defp replace_rows(owner, rows) do
    Repo.delete_all(from(s in InventorySlot, where: s.owner == ^owner))

    rows
    |> Enum.map(&Map.put(&1, :owner, owner))
    |> then(&Repo.insert_all(InventorySlot, &1))
  end

  @doc "Fills every seed stack for an admin account."
  @spec grant_all_seeds(String.t()) :: map()
  def grant_all_seeds(owner) do
    Enum.each(@seed_items, &put_count(owner, &1, @max_stack))
    seeds(owner)
  end

  @doc "Removes all persisted inventory rows."
  @spec reset() :: :ok
  def reset do
    Repo.delete_all(InventoryItem)
    Repo.delete_all(InventorySlot)
    :ok
  end

  defp ensure_seed_rows(owner) do
    unless Repo.exists?(from(i in InventoryItem, where: i.owner == ^owner)) do
      Repo.insert_all(
        InventoryItem,
        Enum.map(@starter, fn {item, count} -> %{owner: owner, item: item, count: count} end),
        on_conflict: :nothing
      )
    end
  end

  defp ensure_layout(owner) do
    unless Repo.exists?(from(s in InventorySlot, where: s.owner == ^owner)) do
      starter_layout(owner)
      |> Enum.map(&Map.put(&1, :owner, owner))
      |> then(&Repo.insert_all(InventorySlot, &1, on_conflict: :nothing))
    end

    :ok
  end

  defp starter_layout(owner) do
    farm = Repo.get(FarmRecord, owner)

    fence =
      if farm, do: farm.fence_count, else: 20

    gate =
      if farm, do: farm.gate_count, else: 2

    seed_bag = owner |> seeds() |> Map.get("seed-bag", 0)

    [
      %{area: "hotbar", slot: 0, item: "hoe", count: 1},
      %{area: "hotbar", slot: 2, item: "watering-can", count: 1},
      %{area: "hotbar", slot: 3, item: "scythe", count: 1},
      %{area: "hotbar", slot: 6, item: "shovel", count: 1},
      %{area: "hotbar", slot: 7, item: "bamboo", count: 1}
    ]
    |> add_if_positive("hotbar", 5, "fence", fence)
    |> add_if_positive("hotbar", 4, "gate", gate)
    |> add_if_positive("hotbar", 1, "seed-bag", seed_bag)
  end

  defp add_if_positive(rows, _area, _slot, _item, count) when count <= 0, do: rows

  defp add_if_positive(rows, area, slot, item, count) do
    max = ItemCatalog.max_stack(item) || @max_stack
    [%{area: area, slot: slot, item: item, count: min(count, max)} | rows]
  end

  defp normalize_slots(slots) do
    slots
    |> Enum.reduce_while({:ok, [], MapSet.new()}, &normalize_slot_into/2)
    |> finish_slots()
  end

  defp normalize_slot_into(raw, {:ok, acc, seen}) do
    case normalize_slot(raw) do
      {:ok, slot} ->
        key = {slot.area, slot.slot}

        if MapSet.member?(seen, key) do
          {:halt, {:error, "duplicate inventory slot"}}
        else
          {:cont, {:ok, [slot | acc], MapSet.put(seen, key)}}
        end

      {:error, _reason} = error ->
        {:halt, error}
    end
  end

  defp finish_slots({:ok, acc, _seen}), do: {:ok, Enum.reverse(acc)}
  defp finish_slots({:error, _reason} = error), do: error

  defp normalize_slot(raw) when is_map(raw) do
    area = value(raw, "area")
    slot = value(raw, "slot")
    item = value(raw, "item")
    count = value(raw, "count")

    with {:ok, area} <- normalize_area(area),
         {:ok, slot} <- normalize_position(area, slot),
         {:ok, item, max} <- normalize_item(item),
         {:ok, count} <- normalize_count(max, count) do
      {:ok, %{area: area, slot: slot, item: item, count: count}}
    end
  end

  defp normalize_slot(_raw), do: {:error, "invalid inventory slot"}

  defp normalize_area(area) when area in ["hotbar", "grid"], do: {:ok, area}
  defp normalize_area(_area), do: {:error, "invalid inventory slot"}

  defp normalize_position(area, slot) when is_integer(slot) and slot >= 0 do
    if slot < slot_count(area), do: {:ok, slot}, else: {:error, "invalid inventory slot"}
  end

  defp normalize_position(_area, _slot), do: {:error, "invalid inventory slot"}

  defp normalize_item(item) when is_binary(item) do
    case ItemCatalog.max_stack(item) do
      max when is_integer(max) -> {:ok, item, max}
      nil -> {:error, "invalid inventory slot"}
    end
  end

  defp normalize_item(_item), do: {:error, "invalid inventory slot"}

  defp normalize_count(max, count) when is_integer(count) and count > 0 and count <= max do
    {:ok, count}
  end

  defp normalize_count(_max, _count), do: {:error, "invalid inventory slot"}

  defp slot_count("hotbar"), do: @hotbar_size
  defp slot_count("grid"), do: @grid_size

  defp validate_seed_totals(owner, slots) do
    actual = seed_totals(slots)
    expected = seeds(owner)

    if Enum.all?(@seed_items, &(Map.get(actual, &1, 0) <= Map.get(expected, &1, 0))) do
      :ok
    else
      {:error, "seed count mismatch"}
    end
  end

  defp seed_totals(slots) do
    Enum.reduce(slots, %{}, fn
      %{item: item, count: count}, totals when item in @seed_items ->
        Map.update(totals, item, count, &(&1 + count))

      _slot, totals ->
        totals
    end)
  end

  defp validate_animal_totals(owner, slots) do
    farm = Repo.get(FarmRecord, owner)
    owned = if farm, do: farm.animals, else: %{}

    actual =
      slots |> Enum.filter(&(&1.item in @animal_items)) |> Enum.group_by(& &1.item, & &1.count)

    valid? =
      Enum.all?(@animal_items, &(Enum.sum(Map.get(actual, &1, [])) <= Map.get(owned, &1, 0)))

    if valid? do
      :ok
    else
      {:error, "animal count mismatch"}
    end
  end

  defp value(map, key), do: Map.get(map, key) || Map.get(map, String.to_atom(key))

  defp purchase_seeds(user, seed, quantity, cost) do
    case Repo.transaction(fn -> purchase(user.id, user.username, seed, quantity, cost) end) do
      {:ok, result} -> {:ok, result}
      {:error, :insufficient_funds} -> {:error, "insufficient funds"}
      {:error, :inventory_full} -> {:error, "not enough space"}
      {:error, _reason} -> {:error, "purchase failed"}
    end
  end

  defp purchase(user_id, owner, seed, quantity, cost) do
    user = Repo.get!(User, user_id)

    if user.balance < cost do
      Repo.rollback(:insufficient_funds)
    end

    row = Repo.get_by(InventoryItem, owner: owner, item: seed)
    held = if row, do: row.count, else: 0

    if held + quantity > @max_stack do
      Repo.rollback(:inventory_full)
    end

    updated = user |> Ecto.Changeset.change(balance: user.balance - cost) |> Repo.update!()
    put_count(owner, seed, held + quantity)
    %{balance: updated.balance, seeds: seeds(owner)}
  end

  defp put_count(owner, item, count) do
    case Repo.get_by(InventoryItem, owner: owner, item: item) do
      nil -> Repo.insert!(%InventoryItem{owner: owner, item: item, count: count})
      row -> row |> Ecto.Changeset.change(count: count) |> Repo.update!()
    end

    :ok
  end

  defp market_crop(item) do
    case Map.fetch(@market_crops, item) do
      {:ok, crop} -> {:ok, crop}
      :error -> {:error, "unknown seed"}
    end
  end
end
