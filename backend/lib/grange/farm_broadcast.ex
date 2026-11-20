defmodule Grange.FarmBroadcast do
  @moduledoc """
  PubSub fan-out for farm snapshots, lobby summaries, and catalyst results.

  Kept apart from `Grange.FarmStore` so the store's mutation and tick code stays
  under the repository's source-line budget.
  """

  @lobby_topic "lobby"

  @doc "Broadcasts the farm and lobby summaries after a farm change."
  @spec change(String.t()) :: :ok
  def change(owner) do
    farm(owner)
    lobby()
  end

  @doc "Broadcasts one farm's full snapshot."
  @spec farm(String.t()) :: :ok
  def farm(owner) do
    GrangeWeb.Endpoint.broadcast("farm:" <> owner, "farmUpdate", %{
      farm: Grange.FarmStore.view(owner)
    })

    :ok
  end

  @doc "Broadcasts the lobby's farm summaries."
  @spec lobby() :: :ok
  def lobby do
    GrangeWeb.Endpoint.broadcast(@lobby_topic, "farms", %{farms: Grange.FarmStore.summaries()})
    :ok
  end

  @doc "Announces each non-empty dawn catalyst transformation to its farm room."
  @spec catalysts([map()]) :: :ok
  def catalysts(results) do
    Enum.each(results, fn
      %{count: count} = result when count > 0 ->
        GrangeWeb.Endpoint.broadcast("farm:" <> result.owner, "catalystApplied", %{
          item: result.item,
          standard: result.standard,
          crop: result.crop,
          count: count
        })

      _empty ->
        :ok
    end)
  end
end
