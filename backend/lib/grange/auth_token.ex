defmodule Grange.AuthToken do
  @moduledoc """
  A one-time, single-use token mailed to a user.

  Used for email verification and password resets. Only the SHA-256 hash of the
  token is stored, so a database leak cannot be replayed as a valid link.
  """

  use Ecto.Schema

  alias Grange.Repo

  @primary_key {:token_hash, :string, autogenerate: false}
  schema "auth_tokens" do
    field(:user_id, :string)
    field(:purpose, :string)
    field(:expires_at, :utc_datetime_usec)
    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  @type purpose :: :verify_email | :reset_password

  @type t :: %__MODULE__{
          token_hash: String.t(),
          user_id: String.t(),
          purpose: String.t(),
          expires_at: DateTime.t(),
          inserted_at: DateTime.t() | nil
        }

  @bytes 32
  @ttl_seconds %{"verify_email" => 24 * 60 * 60, "reset_password" => 60 * 60}

  @doc "Issues a fresh single-use token, returning the raw value to mail."
  @spec issue(String.t(), purpose()) :: String.t()
  def issue(user_id, purpose) do
    token = :crypto.strong_rand_bytes(@bytes) |> Base.url_encode64(padding: false)

    %__MODULE__{
      token_hash: hash(token),
      user_id: user_id,
      purpose: to_string(purpose),
      expires_at:
        DateTime.add(DateTime.utc_now(), Map.fetch!(@ttl_seconds, to_string(purpose)), :second)
    }
    |> Repo.insert!()

    token
  end

  @doc """
  Burns a token of `purpose`, returning the owning user id.

  A token is deleted whether or not it is still valid, so a link can never be
  reused; an expired one resolves to `:error`.
  """
  @spec consume(term(), purpose()) :: {:ok, String.t()} | :error
  def consume(token, purpose) when is_binary(token) and token != "" do
    case Repo.get(__MODULE__, hash(token)) do
      %__MODULE__{purpose: stored, user_id: user_id, expires_at: expires_at} = row ->
        Repo.delete!(row)

        if stored == to_string(purpose) and
             DateTime.compare(DateTime.utc_now(), expires_at) == :lt do
          {:ok, user_id}
        else
          :error
        end

      nil ->
        :error
    end
  end

  def consume(_token, _purpose), do: :error

  @doc "Deletes every outstanding token, used by the test reset hook."
  @spec reset() :: :ok
  def reset do
    Repo.delete_all(__MODULE__)
    :ok
  end

  defp hash(token), do: :crypto.hash(:sha256, token) |> Base.encode16(case: :lower)
end
