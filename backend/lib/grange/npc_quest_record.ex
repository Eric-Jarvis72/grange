defmodule Grange.NpcQuestRecord do
  @moduledoc """
  One row of the farmhand's starter quest, keyed to a farm's owner.

  The row only tracks how far the player is through the three deliveries; the
  crops themselves stay in the barn until they are handed in. `stage` is one of
  `"intro"`, `"tomatoes"`, `"supplies"`, or `"complete"`.
  """

  use Ecto.Schema

  import Ecto.Changeset

  schema "npc_quests" do
    field(:owner, :string)
    field(:stage, :string, default: "intro")
    field(:tomatoes_sold, :integer, default: 0)
    field(:lettuce_sold, :integer, default: 0)
    field(:wheat_sold, :integer, default: 0)
    timestamps(type: :utc_datetime_usec)
  end

  @type t :: %__MODULE__{
          owner: String.t(),
          stage: String.t(),
          tomatoes_sold: non_neg_integer(),
          lettuce_sold: non_neg_integer(),
          wheat_sold: non_neg_integer(),
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  @doc "Casts quest attributes."
  @spec changeset(t() | Ecto.Changeset.t(), map()) :: Ecto.Changeset.t()
  def changeset(row, attrs) do
    row
    |> cast(attrs, [:owner, :stage, :tomatoes_sold, :lettuce_sold, :wheat_sold])
    |> validate_required([:owner, :stage])
    |> validate_inclusion(:stage, ~w(intro tomatoes supplies complete))
  end
end
