defmodule Grange.FarmProps do
  @moduledoc "Persists movable starter props without duplicating their initial rows."
  import Ecto.Query
  alias Grange.{FarmProp, Repo}

  # Stable source indices match the starter prop list in src/world/mapData.ts.
  # The train (12) is intentionally excluded: it anchors market travel.
  @assets %{
    0 => {"farmhouse", 250},
    1 => {"barn", 270},
    2 => {"well", 96},
    3 => {"bench", 96},
    4 => {"sign", 54},
    5 => {"barrel", 54},
    6 => {"crate", 58},
    7 => {"oak-tree", 132},
    8 => {"pine-tree", 122},
    9 => {"apple-tree", 128},
    10 => {"oak-tree", 130},
    11 => {"pine-tree", 120},
    13 => {"daisies", 52},
    14 => {"marigolds", 52},
    15 => {"blue-flowers", 50},
    16 => {"daisies", 50}
  }

  def asset(index), do: @assets[index]

  def overrides(owner) do
    Repo.all(from(p in FarmProp, where: p.owner == ^owner, order_by: p.source_index))
    |> Enum.map(
      &%{index: &1.source_index, asset: &1.asset, x: &1.x, y: &1.y, carried: &1.carried}
    )
  end

  def inventory(owner) do
    Repo.all(from(p in FarmProp, where: p.owner == ^owner and p.carried == true, select: p.asset))
    |> Enum.frequencies()
  end

  def dig(owner, index) when is_integer(index) do
    case @assets[index] do
      nil -> {:error, "that object cannot be dug up"}
      {asset, _width} -> dig_known(owner, index, asset)
    end
  end

  def dig(_owner, _index), do: {:error, "invalid object"}

  def place(owner, asset, x, y) when is_binary(asset) and is_integer(x) and is_integer(y) do
    with {:ok, width} <- place_width(asset),
         true <- valid_spot?(x, y, width) do
      case carried_prop(owner, asset) do
        nil ->
          {:error, "object is not in inventory"}

        prop ->
          Repo.update!(Ecto.Changeset.change(prop, x: x, y: y, carried: false))
          :ok
      end
    else
      _ -> {:error, "invalid placement"}
    end
  end

  def place(_owner, _asset, _x, _y), do: {:error, "invalid placement"}

  defp dig_known(owner, index, asset) do
    case Repo.one(from(p in FarmProp, where: p.owner == ^owner and p.source_index == ^index)) do
      nil ->
        Repo.insert!(%FarmProp{
          owner: owner,
          source_index: index,
          asset: asset,
          x: 0,
          y: 0,
          carried: true
        })

        :ok

      %{carried: true} ->
        {:error, "object is already in inventory"}

      prop ->
        Repo.update!(Ecto.Changeset.change(prop, carried: true))
        :ok
    end
  end

  defp carried_prop(owner, asset) do
    Repo.one(
      from(p in FarmProp,
        where:
          p.owner == ^owner and p.asset == ^asset and
            p.carried == true,
        order_by: p.source_index,
        limit: 1
      )
    )
  end

  defp place_width(asset) do
    case Enum.find(@assets, fn {_index, {name, _width}} -> name == asset end) do
      nil -> :error
      {_index, {_name, width}} -> {:ok, width}
    end
  end

  defp valid_spot?(x, y, width) do
    rem(x, 2) == 0 and rem(y, 2) == 0 and
      x - div(width, 2) >= 0 and x + div(width, 2) <= 1152 and
      y >= 96 and y <= 640
  end

  @doc "Runs a dig/place prop action inside a transaction."
  @spec action(String.t(), map()) :: {:ok, :ok} | {:error, String.t()}
  def action(owner, action) when is_map(action) do
    case Repo.transaction(fn -> run_action(owner, action) end) do
      {:ok, :ok} -> {:ok, :ok}
      {:ok, {:error, reason}} -> {:error, reason}
      {:error, _reason} -> {:error, "could not update object"}
    end
  end

  def action(_owner, _action), do: {:error, "invalid prop action"}

  defp run_action(owner, action) do
    case fetch(action, "kind") do
      "dig" ->
        dig(owner, to_integer(fetch(action, "index")))

      "place" ->
        place(
          owner,
          fetch(action, "asset"),
          to_integer(fetch(action, "x")),
          to_integer(fetch(action, "y"))
        )

      _ ->
        {:error, "invalid prop action"}
    end
  end

  defp fetch(map, key), do: Map.get(map, key) || Map.get(map, String.to_atom(key))
  defp to_integer(value) when is_integer(value), do: value
  defp to_integer(_value), do: nil
end
