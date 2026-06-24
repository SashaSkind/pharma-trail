# What a connecting model actually sees — before vs. after

This dataset's MCP went through two iterations. The contrast is the whole point of the
custom-`instructions` upgrade, so both are recorded here.

## BEFORE — stock `mcp-clickhouse` (retired)

Captured live from the old Cloud Run instance `pharma-mcp-…run.app/mcp` (now deleted). We ran the
**stock `mcp-clickhouse`** unchanged, so none of this was defined in our repo. On connect the model received:

- **serverInfo:** `mcp-clickhouse` v2.14.7
- **`instructions` field: `None`** ← the model got NO guidance (no "visualize", no schema, no caveats)
- **Tools:** `list_databases`, `list_tables`, `run_query`

**Implication:** a user who just added the URL got a model that *could* query but knew nothing about
the dataset and was told nothing about charting. Whether it offered a chart was up to the client's
own proactivity — not guaranteed.

## AFTER — custom TypeScript MCP on Neon Functions (live)

Captured live from `https://br-wild-smoke-ajj9b4o9-mcp.compute.c-3.us-east-2.aws.neon.tech/mcp`
(source: `neon-mcp/functions/mcp.ts`). On connect the model now receives:

- **serverInfo:** `pharma-trail` v1.0.0
- **`instructions` field: ~3,500 chars** ← schema + a per-question workflow ("run SQL aggregated,
  then ALWAYS build a chart"), explicit chart recipes (bar / grouped bar / line / scatter), the
  50-drug set with Metformin as the control, the within-specialty playbook, small-n flags, and the
  correlation-not-causation / suppression caveats.
- **Tools:** `run_query` (read-only SELECT), `find_doctor` (name lookup), `list_tables`.

**Implication:** anyone who just adds the URL — in Claude, ChatGPT, Cursor, VS Code Copilot, etc. —
gets dataset awareness + a visualize nudge with **zero client config**. The `instructions` field is
the MCP-spec mechanism compliant clients inject into the model's context on connect; the stock
server left it null, ours fills it. (Tradeoff: a custom server to maintain; clients honor
`instructions` to varying degrees — reliable "offer", less guaranteed "always auto-build".)

The bulletproof complement remains client-side instructions (a claude.ai Project, `CLAUDE.md`, or an
agent's Instructions field) — see `SYSTEM_PROMPT.md`.
