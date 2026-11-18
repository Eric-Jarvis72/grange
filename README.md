# Grange

A small farming game. The frontend is a React/Vite SPA; the backend is
Elixir/Phoenix and talks to the SPA exclusively over Phoenix Channels.

## How to run this

1. Install <https://mise.jdx.dev/>
2. Install the toolchains (Node, pnpm, Erlang, Elixir): `mise install`
3. Run the dev servers: `pnpm dev`

Then visit <http://localhost:3000/>. In development Vite serves the SPA on 3000
and proxies `/socket` and `/api` to Phoenix on 3200.

`pnpm dev` performs the rest of the setup itself, skipping anything that is
already in place: JS dependencies (pnpm installs them before running a script,
and the bootstrap installs them too), Hex and the Elixir dependencies
(`mix deps.get`), and the git hooks described below. The SQLite database needs
no separate step - the backend creates and migrates it on boot (see
[Database](#database)).

## Dependencies

`pnpm setup` (or `pnpm bootstrap`) runs the same setup as `pnpm dev` without
starting the servers, which is handy to pre-warm a checkout (CI runs the
install steps directly). It is idempotent: if the lockfiles have not changed
since the last run it does nothing.

This is also automatic. `pnpm install` installs git hooks
(`.githooks/`, via `core.hooksPath`) that re-run the bootstrap after a clone,
branch switch, merge, pull, or rebase whenever a lockfile changed, so
dependencies are downloaded for you without a manual step. Run
`pnpm hooks:install` to reinstall the hooks, or
`git config --unset core.hooksPath` to opt out.

## Database

Accounts, sessions, farms, and tiles are stored in SQLite via Ecto. There is no
external database service to run: the app creates its database file and runs
migrations automatically on boot. Development and test use
`backend/priv/grange_dev.sqlite3` and `backend/priv/grange_test.sqlite3`;
production uses `<release-root>/data/grange.sqlite3` (override with
`DATABASE_PATH`).

## Admin account

An admin account is handed every item in the game and effectively unlimited
Grangecoin. Create one (or promote an existing account) with:

```sh
pnpm admin:create
pnpm admin:create -- --username root --email root@example.test --password long-enough
```

The default login is `admin` / `admin@grange.test` / `grange-admin`. Admins are
marked by the `is_admin` flag on the account. The SPA grants the full item
catalog on sign-in, and the wallet ignores spending while `is_admin` is set.

Re-running the command on an existing username promotes that account instead of
creating a new one; pass `--password` to also reset its password.

## Tests

- `pnpm test:backend` — Elixir unit + channel tests (ExUnit)
- `pnpm lint:backend` — Elixir formatting check + Credo (strict)
- `pnpm test:e2e` — Playwright e2e (builds the SPA, then Phoenix serves it)
- `pnpm check` — JS lint, unit tests, backend tests, and build

## Deploy

CI builds a Mix release (with the built SPA in `priv/static`) and syncs it to
the host, where systemd runs it. See `deploy/` for the unit and deploy script.