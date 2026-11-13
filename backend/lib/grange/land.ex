defmodule Grange.Land do
  @moduledoc "Purchasable farm parcels; all prices and ownership checks live on the server."

  alias Grange.{FarmRecord, FarmStore, Repo, User}

  @prices [250, 500, 1000, 2000]

  def prices, do: @prices

  def check(owner, _kind, x, y, _bounds) do
    cond do
      not (is_integer(x) and is_integer(y) and x in -2..19 and y in -4..9) ->
        {:error, "out of bounds"}

      owned?(x, y, Repo.get!(FarmRecord, owner).land_level) ->
        :ok

      true ->
        {:error, "buy this land from the mayor first"}
    end
  end

  def bounds(level) do
    %{
      min_x: if(level >= 2, do: -2, else: 0),
      max_x: if(level >= 3, do: 19, else: 17),
      min_y: if(level >= 4, do: -4, else: if(level >= 1, do: -2, else: 0))
    }
  end

  def owned?(x, y, level) when is_integer(x) and is_integer(y) do
    b = bounds(level)
    x >= b.min_x and x <= b.max_x and y >= b.min_y and y <= 9
  end

  def owned?(_x, _y, _level), do: false

  def buy(user_id, owner) do
    case Repo.transaction(fn -> purchase(user_id, owner) end) do
      {:ok, result} ->
        FarmStore.refresh(owner)
        {:ok, result}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp purchase(user_id, owner) do
    user = Repo.get(User, user_id) || Repo.rollback("unknown user")
    farm = Repo.get(FarmRecord, owner) || Repo.rollback("farm not found")
    price = Enum.at(@prices, farm.land_level)

    cond do
      user.username != owner ->
        Repo.rollback("not your farm")

      is_nil(price) ->
        Repo.rollback("all land purchased")

      user.balance < price ->
        Repo.rollback("insufficient wallet funds")

      true ->
        balance = user.balance - price
        level = farm.land_level + 1
        user |> Ecto.Changeset.change(balance: balance) |> Repo.update!()
        farm |> Ecto.Changeset.change(land_level: level) |> Repo.update!()
        %{balance: balance, land_level: level}
    end
  end
end
