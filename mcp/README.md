# Pharma Trail — hosted public MCP endpoint

A remote, **read-only** MCP server that lets anyone connect any MCP-capable AI (Claude, ChatGPT,
Cursor, VS Code Copilot, …) to the Pharma Trail ClickHouse dataset by URL — no credentials shared.

**🟢 Live (Neon Functions):** `https://br-wild-smoke-ajj9b4o9-mcp.compute.c-3.us-east-2.aws.neon.tech/mcp`
— a custom **TypeScript** MCP (Hono + `@hono/mcp` Streamable HTTP) that advertises `instructions`
(schema + auto-visualize playbook) on connect, so a bare connection already knows how to behave.
Source + deploy: **`neon-mcp/`** (see `neon-mcp/README.md`). Verified end-to-end
(initialize → tools/list → run_query / find_doctor) against the public URL.

```
AI client (Claude / ChatGPT / Cursor …) ──HTTPS──► Neon Function (/mcp) ──► ClickHouse (webapp, rx)
```

Because the ClickHouse connection happens **from the function** (not from the AI side), this works
even from sandboxed/cloud environments that can't reach `*.clickhouse.cloud`.

> **Note:** the original hosted instance ran the stock Python `mcp-clickhouse` on Google Cloud Run.
> That instance has been **retired** (to avoid idle billing); the Cloud Run / Docker instructions
> below are kept as a **self-host alternative**. The current live endpoint is the Neon Function above.

---

## Tools exposed
`run_query`, `find_doctor` (name lookup), `list_tables` — all SELECT-only / read-only.
*(The legacy Python self-host below instead exposes `list_databases`, `list_tables`, `run_query`.)*

## Required env (set at deploy — never commit the password)
```
CLICKHOUSE_HOST=rzxwreav7j.us-west-2.aws.clickhouse.cloud
CLICKHOUSE_PORT=8443
CLICKHOUSE_SECURE=true
CLICKHOUSE_DATABASE=rx
CLICKHOUSE_USER=webapp
CLICKHOUSE_PASSWORD=<the read-only webapp password>
```

---

## Deploy

### Option 1 — Google Cloud Run (recommended: scales to zero, $0 at demo volume)
Run from the **repo root**. `--max-instances 2` caps spend if the open URL gets hit by a bot;
scale-to-zero is the default (`min-instances` unset = 0), so idle costs nothing.
```bash
gcloud run deploy pharma-mcp \
  --source mcp \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --max-instances 2 \
  --set-env-vars CLICKHOUSE_HOST=rzxwreav7j.us-west-2.aws.clickhouse.cloud,CLICKHOUSE_USER=webapp,CLICKHOUSE_DATABASE=rx,CLICKHOUSE_PORT=8443,CLICKHOUSE_SECURE=true \
  --set-env-vars CLICKHOUSE_PASSWORD=PASTE_READONLY_PASSWORD
```
→ gives a URL like `https://pharma-mcp-xxxx.run.app`. Your MCP endpoint is that **+ `/mcp`**.

**One-time setup before the deploy:**
```bash
# 1. install the gcloud CLI (macOS): https://cloud.google.com/sdk/docs/install
# 2. log in + pick/create a project (billing must be enabled on it)
gcloud auth login
gcloud projects create pharma-trail-mcp --name="Pharma Trail MCP"   # or use an existing project
gcloud config set project pharma-trail-mcp
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
# 3. (safety) set a budget alert so you're emailed long before any charge:
#    Console → Billing → Budgets & alerts → Create budget → $1–5/month
```

### Option 2 — Fly.io
```bash
cd mcp
fly launch --no-deploy            # generates fly.toml; set internal_port = 8080
fly secrets set CLICKHOUSE_PASSWORD=PASTE_READONLY_PASSWORD
fly deploy
```

### Option 3 — Railway / Render
Point the service at `mcp/Dockerfile`, set the env vars above, expose port 8080.

### Test it locally first
```bash
docker build -t pharma-mcp mcp
docker run -d -p 8090:8080 \
  -e CLICKHOUSE_HOST=rzxwreav7j.us-west-2.aws.clickhouse.cloud \
  -e CLICKHOUSE_USER=webapp -e CLICKHOUSE_PASSWORD=… pharma-mcp
curl http://localhost:8090/healthz        # -> ok
# MCP endpoint: http://localhost:8090/mcp
```

---

## Connect Claude to the deployed URL

Let `BASE` = your deployed URL (e.g. `https://pharma-mcp-xxxx.run.app`).

- **Claude Code:** `claude mcp add --transport http pharma-trail $BASE/mcp`
- **Claude Desktop:** Settings → Connectors → Add custom connector → URL `$BASE/mcp`
- **claude.ai (web):** Settings → Connectors → Add custom connector → URL `$BASE/mcp`
  *(custom connectors generally require a paid Claude plan; if the UI demands OAuth, use the
  Desktop/Code methods, which accept a plain URL.)*

Then ask, e.g.: *"Using pharma-trail, show average Eliquis claims for paid vs unpaid
cardiologists, and confirm metformin has zero payment rows."*

---

## Security & cost

- Connects as **`webapp`** — `SELECT on rx.*` only; the server also rejects non-SELECT. Worst
  case for a caller: reading **public** CMS data, read-only.
- **`--allow-unauthenticated` makes the URL public**, so anyone can run read-only queries →
  that consumes **ClickHouse compute** (cost on your plan). For a demo this is fine; to limit
  abuse you can: put it behind an auth token / API gateway, rate-limit, run it against a small
  dedicated ClickHouse service, or take the endpoint down after the event.
- **Rotate** the read-only password anytime: `ALTER USER webapp IDENTIFIED BY '…'` (then update
  the host's env var).
