defmodule GrangeWeb.Presence do
  @moduledoc """
  Tracks who is standing on each farm and in each shared hub area.

  Presence is ephemeral: it lives in memory and is cleaned up automatically
  when a socket or channel process exits. Farm presence is cosmetic, exactly
  like hub presence; it never influences gameplay.
  """

  use Phoenix.Presence, otp_app: :grange, pubsub_server: Grange.PubSub
end
