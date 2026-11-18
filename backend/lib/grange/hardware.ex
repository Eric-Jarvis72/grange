defmodule Grange.Hardware do
  @moduledoc """
  The hardware store catalogue and purchases.

  Everything bought here is added to the farm's build supply (fences, gates,
  sprinklers) rather than the seed ledger, so the client mirrors it exactly like
  the existing supply counts. Tools (hoe, watering can, scythe, shovel) are
  bought client-side and are not in this catalogue. Prices are
  server-authoritative; the browser only renders them.
  """

  alias Grange.{FarmRecord, Repo, User}

  @prices %{"sprinkler" => 75, "fence" => 5, "gate" => 25}

  @doc "Buy price in Grangecoin for an item id, or nil when it is not sold."
  @spec price(String.t()) :: pos_integer() | nil
  def price(item), do: Map.get(@prices, item)

  @doc "The whole catalogue as `%{item => price}`."
  @spec catalog() :: %{String.t() => pos_integer()}
  def catalog, do: @prices

  @doc "Buys `quantity` of `item`, debiting the account balance."
  @spec buy(User.t(), String.t(), integer()) :: {:ok, map()} | {:error, String.t()}
  def buy(%User{} = user, item, quantity) when is_integer(quantity) and quantity > 0 do
    case price(item) do
      nil -> {:error, "unknown item"}
      unit -> purchase(user.id, user.username, item, quantity, unit * quantity)
    end
  end

  def buy(_user, _item, _quantity), do: {:error, "invalid purchase"}

  defp purchase(user_id, owner, item, quantity, cost) do
    case Repo.transaction(fn -> apply_supply(user_id, owner, item, quantity, cost) end) do
      {:ok, result} -> {:ok, result}
      {:error, :insufficient_funds} -> {:error, "insufficient funds"}
      {:error, _reason} -> {:error, "purchase failed"}
    end
  end

  defp apply_supply(user_id, owner, item, quantity, cost) do
    user = Repo.get!(User, user_id)

    if user.balance < cost do
      Repo.rollback(:insufficient_funds)
    end

    farm = Repo.get!(FarmRecord, owner)
    balance = user.balance - cost
    count = supply(farm, item) + quantity

    user |> Ecto.Changeset.change(balance: balance) |> Repo.update!()
    farm |> Ecto.Changeset.change(%{supply_field(item) => count}) |> Repo.update!()

    %{balance: balance, item: item, count: count}
  end

  defp supply(farm, "sprinkler"), do: farm.sprinkler_count
  defp supply(farm, "fence"), do: farm.fence_count
  defp supply(farm, "gate"), do: farm.gate_count

  defp supply_field("sprinkler"), do: :sprinkler_count
  defp supply_field("fence"), do: :fence_count
  defp supply_field("gate"), do: :gate_count
end
