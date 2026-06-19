# Pharma Trail MCP on Neon Functions

The MCP server as a **Neon Function** — a Workers-style `fetch(request)` handler (Hono) that
exposes read-only ClickHouse tools to any Claude. Unlike the stock `mcp-clickhouse`, this one
**advertises `instructions`** on connect (schema + "visualize the result"), so a bare connection
already knows the dataset. Verified locally: `initialize` returns the instructions and `run_query`
returns live ClickHouse data.

```
Claude (web/desktop/code) ──Streamable HTTP──► Neon Function (/mcp) ──fetch──► ClickHouse (rx, webapp, read-only)
```

ClickHouse is queried over its **HTTP interface via `fetch`** (no Node-only client), so it runs in
the WinterTC runtime. Read-only is enforced two ways: a SELECT-only guard + `readonly=1` on the
request (and the `webapp` user only has SELECT grants).

## Files
- `functions/mcp.ts` — the Hono app (`export default app`) with `run_query` + `list_tables` and the
  `instructions`. Also runs on Cloud Run / anywhere a fetch handler runs.
- `neon.ts` — Neon Functions config (`neonctl deploy` reads it).
- `local-test.mts` — drives the app via `app.fetch` (no server needed).

## Prereqs (private preview)
- **Functions preview access** (ask Andre @ Neon, or sign up).
- A **new Neon project in AWS us-east-2** (the function queries ClickHouse, not Neon — so the
  project is just the function host).
- `neonctl` (latest) + Node 18+ (24 recommended).

## Secrets (env vars)
The function reads ClickHouse creds from env — set these as Function secrets (see Neon's
"environment variables" docs):
```
CLICKHOUSE_HOST=rzxwreav7j.us-west-2.aws.clickhouse.cloud
CLICKHOUSE_USER=webapp
CLICKHOUSE_PASSWORD=<read-only webapp password>
```
> Confirm with Neon that the function has **outbound HTTPS egress** to ClickHouse Cloud.

## Test locally
```bash
cd neon-mcp && npm install
CLICKHOUSE_HOST=… CLICKHOUSE_USER=webapp CLICKHOUSE_PASSWORD=… npx tsx local-test.mts
```

## Deploy (once preview access is granted)
```bash
cd neon-mcp
neonctl bootstrap          # links a us-east-2 project + pulls config deps (or use the `hono` template)
# set CLICKHOUSE_* secrets per Neon's env-vars docs
neonctl deploy             # reads neon.ts, deploys the function
```
You get a public URL like `https://<branch_id>-<slug>.compute.<cell>.us-east-2.aws.neon.tech`.
Your MCP endpoint is that **+ `/mcp`**. Add it to Claude:
`claude mcp add --transport http pharma-trail-neon <url>/mcp`

## Note
This is the **preview/showcase** deployment. Keep the Cloud Run MCP (`../mcp`) as the stable
endpoint until Functions is GA.
