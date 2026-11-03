defmodule Grange.ItemCatalog do
  @moduledoc """
  Server-side stack limits for item ids the saved inventory may contain.

  The browser owns item presentation, but layout saves must still reject
  invented item ids and over-full stacks.
  """

  @single_stack ~w(hoe watering-can scythe shovel bamboo fiberglass carbon master)

  @stackable ~w(
    seed-bag tomato wheat lettuce midas_wheat frost_lettuce sunburst_tomato
    wheat-seed lettuce-seed midas-wheat-seed frost-lettuce-seed sunburst-tomato-seed
    fence gate farmhouse barn well bench sign barrel crate oak-tree pine-tree apple-tree
    daisies marigolds blue-flowers
    cow hen sheep pig
    minnow bluegill carp catfish trout salmon golden-carp phishing loan-sharks-brother
  )

  @doc "Maximum stack size for a known item id, or nil for an unknown item."
  @spec max_stack(String.t()) :: pos_integer() | nil
  def max_stack(item) when item in @single_stack, do: 1
  def max_stack(item) when item in @stackable, do: 99
  def max_stack(_item), do: nil
end
