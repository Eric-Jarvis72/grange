defmodule Grange.FarmSettings do
  @moduledoc """
  Who may visit a farm and whether visitors may edit it.

  Farms default to private with visitor editing off. The persisted flags live on
  the farm row so a settings change survives restarts and can be re-checked on
  every action instead of trusting a client's cached view.
  """

  alias Grange.{FarmRecord, Repo}

  @doc "Whether strangers may join the farm."
  @spec public?(String.t()) :: boolean()
  def public?(owner) do
    case Repo.get(FarmRecord, owner) do
      nil -> false
      farm -> farm.is_public
    end
  end

  @doc "Whether visitors may perform farm actions."
  @spec edit_allowed?(String.t()) :: boolean()
  def edit_allowed?(owner) do
    case Repo.get(FarmRecord, owner) do
      nil -> false
      farm -> farm.visitor_edit
    end
  end

  @doc """
  Updates the farm's visitor flags.

  Missing keys are left unchanged. Strings are accepted so channel payloads can
  use either JSON booleans or `"true"`/`"false"`.
  """
  @spec update(String.t(), map()) :: {:ok, FarmRecord.t()} | {:error, String.t()}
  def update(owner, attrs) when is_map(attrs) do
    with %FarmRecord{} = farm <- Repo.get(FarmRecord, owner) || {:error, "farm not found"},
         {:ok, changes} <- changes(attrs) do
      farm |> Ecto.Changeset.change(changes) |> Repo.update()
    end
  end

  def update(_owner, _attrs), do: {:error, "invalid settings"}

  defp changes(attrs) do
    Enum.reduce_while(attrs, {:ok, %{}}, fn {key, value}, {:ok, acc} ->
      case field(key) do
        nil -> {:cont, {:ok, acc}}
        field -> reduce_setting(acc, field, value)
      end
    end)
  end

  defp reduce_setting(acc, field, value) do
    case boolean(value) do
      {:ok, parsed} -> {:cont, {:ok, Map.put(acc, field, parsed)}}
      :error -> {:halt, {:error, "invalid settings"}}
    end
  end

  defp field("is_public"), do: :is_public
  defp field(:is_public), do: :is_public
  defp field("visitor_edit"), do: :visitor_edit
  defp field(:visitor_edit), do: :visitor_edit
  defp field(_key), do: nil

  defp boolean(value) when is_boolean(value), do: {:ok, value}
  defp boolean("true"), do: {:ok, true}
  defp boolean("false"), do: {:ok, false}
  defp boolean(_value), do: :error
end
