defmodule Grange.FarmGates do
  @moduledoc "Persists the gates a player has placed on their field."

  import Ecto.Query

  alias Grange.{FarmFence, FarmGate, FarmRecord, Repo}

  @doc "Every gate on the farm with its swing direction and open state."
  @spec list(String.t()) :: [map()]
  def list(owner) do
    Repo.all(
      from(g in FarmGate,
        where: g.owner == ^owner,
        order_by: [g.x, g.y],
        select: %{x: g.x, y: g.y, direction: g.direction, open: g.open}
      )
    )
  end

  @spec at(String.t(), integer(), integer()) :: FarmGate.t() | nil
  def at(owner, x, y) do
    Repo.one(from(g in FarmGate, where: g.owner == ^owner and g.x == ^x and g.y == ^y))
  end

  @doc "Places a gate, spending one from the farm's gate supply."
  @spec place(String.t(), integer(), integer()) :: :ok | {:error, String.t()}
  def place(owner, x, y) do
    farm = Repo.get!(FarmRecord, owner)

    cond do
      farm.gate_count <= 0 ->
        {:error, "no gates left"}

      at(owner, x, y) ->
        {:error, "gate already here"}

      fence_at(owner, x, y) ->
        {:error, "fence already here"}

      true ->
        Repo.insert!(%FarmGate{
          owner: owner,
          x: x,
          y: y,
          direction: direction_for(owner, x, y),
          open: false
        })

        Repo.update!(Ecto.Changeset.change(farm, gate_count: farm.gate_count - 1))
        :ok
    end
  end

  @doc "Removes a gate post and returns it to the farm's supply."
  @spec remove(String.t(), integer(), integer()) :: :ok | {:error, String.t()}
  def remove(owner, x, y) do
    case at(owner, x, y) do
      nil ->
        {:error, "no gate here"}

      gate ->
        Repo.delete!(gate)
        farm = Repo.get!(FarmRecord, owner)
        Repo.update!(Ecto.Changeset.change(farm, gate_count: farm.gate_count + 1))
        :ok
    end
  end

  @doc "Opens or closes an existing gate. Any visitor may call this."
  @spec toggle(String.t(), integer(), integer()) :: :ok | {:error, String.t()}
  def toggle(owner, x, y) do
    case at(owner, x, y) do
      nil ->
        {:error, "no gate here"}

      gate ->
        Repo.update!(Ecto.Changeset.change(gate, open: not gate.open))
        :ok
    end
  end

  @doc """
  Re-aims every gate so its swinging leaf points at a neighboring fence line.
  Horizontal neighbors win, then vertical, then the gate keeps a horizontal
  default. Called after any fence or gate is placed or removed.
  """
  @spec reorient(String.t()) :: :ok
  def reorient(owner) do
    nodes = nodes(owner)

    Repo.all(from(g in FarmGate, where: g.owner == ^owner))
    |> Enum.each(fn gate ->
      direction = direction_for_nodes(gate.x, gate.y, nodes)

      if gate.direction != direction do
        Repo.update!(Ecto.Changeset.change(gate, direction: direction))
      end
    end)

    :ok
  end

  @doc "The preferred swing direction for a gate at `(x, y)`."
  @spec direction_for(String.t(), integer(), integer()) :: String.t()
  def direction_for(owner, x, y), do: direction_for_nodes(x, y, nodes(owner))

  defp direction_for_nodes(x, y, nodes) do
    cond do
      Enum.member?(nodes, {x - 1, y}) or Enum.member?(nodes, {x + 1, y}) -> "horizontal"
      Enum.member?(nodes, {x, y - 1}) or Enum.member?(nodes, {x, y + 1}) -> "vertical"
      true -> "horizontal"
    end
  end

  defp nodes(owner) do
    fences =
      Repo.all(from(f in FarmFence, where: f.owner == ^owner, select: {f.x, f.y}))

    gates = Repo.all(from(g in FarmGate, where: g.owner == ^owner, select: {g.x, g.y}))
    fences ++ gates
  end

  defp fence_at(owner, x, y) do
    Repo.one(from(f in FarmFence, where: f.owner == ^owner and f.x == ^x and f.y == ^y))
  end
end
