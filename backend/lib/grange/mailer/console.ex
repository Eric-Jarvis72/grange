defmodule Grange.Mailer.Console do
  @moduledoc """
  Dev/test mailer.

  Instead of sending anything it logs the message and keeps it in memory, so the
  dev mailbox endpoint (and e2e tests) can read the verification or reset link
  back out. Never the provider in production when Mailtrap is configured.
  """

  @behaviour Grange.Mailer

  use Agent

  require Logger

  @spec start_link(term()) :: Agent.on_start()
  def start_link(_opts \\ []), do: Agent.start_link(fn -> [] end, name: __MODULE__)

  @impl Grange.Mailer
  def deliver(%{to: to} = email) do
    Logger.info("[mail] to=#{to} subject=#{inspect(email.subject)}\n#{email.text}")
    Agent.update(__MODULE__, &[email | &1])
    :ok
  end

  @doc "Most recent message captured for an address, or nil."
  @spec latest(String.t()) :: Grange.Mailer.email() | nil
  def latest(to) do
    address = String.downcase(to)

    Agent.get(__MODULE__, fn emails -> Enum.find(emails, &(String.downcase(&1.to) == address)) end)
  end

  @doc "Drops every captured message."
  @spec reset() :: :ok
  def reset do
    Agent.update(__MODULE__, fn _ -> [] end)
  end
end
