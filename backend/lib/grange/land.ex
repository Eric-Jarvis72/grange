defmodule Grange.Land do
  @moduledoc "Purchasable farm parcels; all prices and ownership checks live on the server."

  alias Grange.{FarmRecord, FarmStore, Repo, User}

  @prices [250, 500, 1000, 2000, 4000]

  # Full farm world extents. The final land purchase unlocks all of it.
  @world_min_x -6
  @world_max_x 24
  @world_min_y -4
  @world_walk_max_y 9

  def prices, do: @prices

  def check(owner, kind, x, y, _bounds) do
    level = Repo.get!(FarmRecord, owner).land_level

    cond do
      not in_map?(kind, x, y, level) ->
        {:error, "out of bounds"}

      fence_action?(kind) or owned?(x, y, level) ->
        :ok

      true ->
        {:error, "buy this land from the mayor first"}
    end
  end

  defp fence_action?(kind), do: kind in [:place_fence, :remove_fence, :place_gate, :remove_gate]

  defp in_map?(kind, x, y, level) when is_integer(x) and is_integer(y) do
    if fence_action?(kind) do
      b = bounds(level)
      x >= b.min_x and x <= b.max_x + 1 and y >= b.min_y and y <= 10
    else
      x >= @world_min_x and x <= @world_max_x and
        y >= @world_min_y and y <= @world_walk_max_y
    end
  end

  defp in_map?(_kind, _x, _y, _level), do: false

  def bounds(level) do
    %{
      min_x: if(level >= 5, do: @world_min_x, else: if(level >= 2, do: -2, else: 0)),
      max_x: if(level >= 5, do: @world_max_x, else: if(level >= 3, do: 19, else: 17)),
      min_y: if(level >= 4, do: @world_min_y, else: if(level >= 1, do: -2, else: 0))
    }
  end

  def owned?(x, y, level) when is_integer(x) and is_integer(y) do
    b = bounds(level)

    x >= b.min_x and x <= b.max_x and
      y >= b.min_y and y <= @world_walk_max_y
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
