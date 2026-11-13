defmodule Grange.Bank do
  @moduledoc "Atomic transfers between a player's wallet and savings account."

  alias Grange.{Repo, User}

  def transfer(user_id, direction, amount)
      when direction in ["deposit", "withdraw"] and is_integer(amount) and amount > 0 do
    case Repo.transaction(fn -> do_transfer(user_id, direction, amount) end) do
      {:ok, result} -> {:ok, result}
      {:error, reason} -> {:error, reason}
    end
  end

  def transfer(_user_id, _direction, _amount), do: {:error, "enter a positive whole amount"}

  defp do_transfer(user_id, direction, amount) do
    user = Repo.get(User, user_id) || Repo.rollback("unknown user")

    {wallet, savings} =
      case direction do
        "deposit" ->
          if user.balance < amount, do: Repo.rollback("insufficient wallet funds")
          {user.balance - amount, user.bank_balance + amount}

        "withdraw" ->
          if user.bank_balance < amount, do: Repo.rollback("insufficient savings")
          {user.balance + amount, user.bank_balance - amount}
      end

    user
    |> Ecto.Changeset.change(balance: wallet, bank_balance: savings)
    |> Repo.update!()

    %{balance: wallet, bank_balance: savings}
  end
end
