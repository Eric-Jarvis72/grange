defmodule Grange.User do
  @moduledoc "A registered account. The password hash never leaves the server."

  use Ecto.Schema

  import Ecto.Changeset

  @starting_balance 100

  @primary_key {:id, :string, autogenerate: false}
  schema "users" do
    field(:username, :string)
    field(:email, :string)
    field(:password_hash, :string)
    field(:balance, :integer, default: @starting_balance)
    field(:bank_balance, :integer, default: 0)
    field(:is_admin, :boolean, default: false)
    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  @type t :: %__MODULE__{
          id: String.t(),
          username: String.t(),
          email: String.t(),
          password_hash: String.t(),
          inserted_at: DateTime.t() | nil,
          balance: non_neg_integer(),
          bank_balance: non_neg_integer(),
          is_admin: boolean()
        }

  @doc "Builds a new (unsaved) user with a generated id and opening balance."
  @spec new(map()) :: t()
  def new(attrs) do
    %__MODULE__{
      id: id(),
      username: attrs.username,
      email: attrs.email,
      password_hash: attrs.password_hash,
      balance: @starting_balance
    }
  end

  @doc "Casts and validates account attributes."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:username, :email, :password_hash, :is_admin])
    |> validate_required([:username, :email, :password_hash])
    |> unique_constraint(:username,
      name: :users_username_index,
      message: "that username is taken"
    )
    |> unique_constraint(:email,
      name: :users_email_index,
      message: "that email is already registered"
    )
  end

  @doc "Returns a random opaque id."
  @spec id() :: String.t()
  def id, do: :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
end

defimpl Jason.Encoder, for: Grange.User do
  def encode(user, opts) do
    Jason.Encode.map(
      %{
        id: user.id,
        username: user.username,
        email: user.email,
        inserted_at: iso8601(user.inserted_at),
        balance: user.balance,
        bank_balance: user.bank_balance,
        is_admin: user.is_admin
      },
      opts
    )
  end

  defp iso8601(nil), do: nil
  defp iso8601(datetime), do: DateTime.to_iso8601(datetime)
end
