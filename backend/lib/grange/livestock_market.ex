defmodule Grange.LivestockMarket do
  @moduledoc "Purchases livestock with account funds and saves it to the owner's farm."

  alias Grange.{FarmRecord, FarmStore, Repo, User}

  @prices %{"hen" => 25, "pig" => 55, "sheep" => 70, "cow" => 120}
  @max_owned 99

  @spec buy(String.t(), String.t(), String.t()) ::
          {:ok, %{balance: non_neg_integer(), owned: non_neg_integer()}}
          | {:error, String.t()}
  def buy(user_id, owner, animal) when is_binary(animal) do
    case Map.fetch(@prices, animal) do
      :error ->
        {:error, "unknown animal"}

      {:ok, price} ->
        do_buy(user_id, owner, animal, price)
    end
  end

  def buy(_user_id, _owner, _animal), do: {:error, "unknown animal"}

  defp do_buy(user_id, owner, animal, price) do
    case Repo.transaction(fn -> purchase(user_id, owner, animal, price) end) do
      {:ok, result} ->
        FarmStore.refresh(owner)
        {:ok, result}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp purchase(user_id, owner, animal, price) do
    user = Repo.get(User, user_id) || Repo.rollback("unknown user")
    farm = Repo.get(FarmRecord, owner) || Repo.rollback("farm not found")
    owned = Map.get(farm.animals, animal, 0)

    cond do
      user.username != owner -> Repo.rollback("not your farm")
      owned >= @max_owned -> Repo.rollback("animal inventory is full")
      user.balance < price -> Repo.rollback("insufficient funds")
      true -> save_purchase(user, farm, animal, price, owned)
    end
  end

  defp save_purchase(user, farm, animal, price, owned) do
    balance = user.balance - price
    user |> Ecto.Changeset.change(balance: balance) |> Repo.update!()

    farm
    |> Ecto.Changeset.change(animals: Map.put(farm.animals, animal, owned + 1))
    |> Repo.update!()

    %{balance: balance, owned: owned + 1}
  end
end
