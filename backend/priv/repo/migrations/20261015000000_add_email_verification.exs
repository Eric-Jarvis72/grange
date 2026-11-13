defmodule Grange.Repo.Migrations.AddEmailVerification do
  @moduledoc false

  use Ecto.Migration

  def change do
    alter table(:users) do
      add(:email_verified_at, :utc_datetime_usec)
    end

    # Accounts created before verification existed are grandfathered in rather
    # than locked out on deploy.
    execute(
      "UPDATE users SET email_verified_at = inserted_at WHERE email_verified_at IS NULL",
      "UPDATE users SET email_verified_at = NULL"
    )

    create table(:auth_tokens, primary_key: false) do
      add(:token_hash, :string, primary_key: true)
      add(:user_id, references(:users, type: :string, on_delete: :delete_all), null: false)
      add(:purpose, :string, null: false)
      add(:expires_at, :utc_datetime_usec, null: false)
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create(index(:auth_tokens, [:user_id]))
  end
end
