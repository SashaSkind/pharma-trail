# AGENTS.md — Pharma Trail

Repo overview and analyst behavior live in `CLAUDE.md`, `README.md`, and `ARCHITECTURE.md`.
This file adds environment/run notes for agents.

## Cursor Cloud specific instructions

### Layout / what to run
- `web/` is the product: a Next.js 16 (App Router, Turbopack) app. It is the only long-running
  service you normally start. Scripts are in `web/package.json` (`dev`, `build`, `start`); there is
  **no `lint` script and no ESLint config** — "lint" for this repo means the TypeScript check that
  `next build` runs.
- `neon-mcp/`, `mcp/`, and `scripts/` are optional/build-time only and are not needed to run or test
  the website (`scripts/` also needs multi-GB gitignored CMS files and DB admin creds — not runnable
  in a normal dev env).

### Running the web app
- Dependencies (`web/node_modules`) are installed by the startup update script (`npm --prefix web install`).
- Start dev from `web/`: `npm run dev` → http://localhost:3000 (Turbopack, ready in ~250ms). Run it
  in a tmux session, not a one-shot background process.

### External databases are required for data (not in the repo)
- The app is a thin client over two **remote managed** databases; there is no local/dockerized DB.
  Data routes read them via env vars set in `web/.env.local` (gitignored):
  - `NEON_DATABASE_URL` — Neon Postgres → home search, doctor pages (`lib/db.ts`).
  - `CH_HOST`, `CH_USER`, `CH_PASSWORD` — ClickHouse Cloud → `/explore`, specialties, payment
    scatter (`lib/ch.ts`, connects to `https://$CH_HOST:8443`).
- Without these vars: static pages (`/`, `/about`, `/mcp`, and the `/explore` shell) render fine, but:
  - `/api/search` (and any page importing `lib/db.ts`) returns **500** — `neon()` throws at module
    load when `NEON_DATABASE_URL` is unset.
  - ClickHouse routes return `getaddrinfo EAI_AGAIN undefined` (host is `undefined`); `/explore`
    shows a "Couldn't load the data" panel.
  - `npm run build` **fails at "Collecting page data"** for the same reason (compile + TypeScript
    still pass first). A full build/end-to-end run needs the four env vars present.
- Put credentials in **`web/.env.local`** (Next.js loads env from the `web/` project dir, where
  `next dev` runs — a repo-root `.env.local` is **not** picked up by the app). In Cursor Cloud, add
  them as Secrets so they are injected into the VM.
- The app reads `NEON_DATABASE_URL` + `CH_HOST`/`CH_USER`/`CH_PASSWORD`. It does **not** use `PG_DSN`
  (that's for the local Python CDC demo in `scripts/`).
