# Talk to Pharma Trail in Claude (MCP)

Connect Claude to Pharma Trail's ClickHouse and ask the data questions in plain English —
Claude turns them into SQL and runs them against the live dataset. **Read-only**, scoped to the
`rx` database via a restricted `webapp` user.

> You ask: *"Which cardiologists got the most Eliquis money in 2024, and how much did they
> prescribe?"* → Claude runs the query and answers.

---

## Setup (official ClickHouse MCP server)

Requires [`uv`](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`).

### Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "pharma-trail": {
      "command": "uv",
      "args": ["run", "--with", "mcp-clickhouse", "--python", "3.10", "mcp-clickhouse"],
      "env": {
        "CLICKHOUSE_HOST": "rzxwreav7j.us-west-2.aws.clickhouse.cloud",
        "CLICKHOUSE_PORT": "8443",
        "CLICKHOUSE_SECURE": "true",
        "CLICKHOUSE_USER": "webapp",
        "CLICKHOUSE_PASSWORD": "PASTE_READONLY_PASSWORD",
        "CLICKHOUSE_DATABASE": "rx"
      }
    }
  }
}
```
Restart Claude Desktop. (Get the read-only password from the project owner.)

### Claude Code
```bash
claude mcp add pharma-trail \
  --env CLICKHOUSE_HOST=rzxwreav7j.us-west-2.aws.clickhouse.cloud \
  --env CLICKHOUSE_PORT=8443 --env CLICKHOUSE_SECURE=true \
  --env CLICKHOUSE_USER=webapp --env CLICKHOUSE_PASSWORD=PASTE_READONLY_PASSWORD \
  --env CLICKHOUSE_DATABASE=rx \
  -- uv run --with mcp-clickhouse --python 3.10 mcp-clickhouse
```

The server exposes read-only tools: `list_databases`, `list_tables`, `run_select_query`
(SELECT only — `CLICKHOUSE_ALLOW_WRITE_ACCESS` defaults to false).

---

## What's in `rx` (so you know what to ask)

Program year **2024**. Five drugs: Eliquis, Xarelto, Humira, Ozempic (branded) + Metformin
(generic **control — has zero payments by design**).

| Table | Grain | Key columns |
|---|---|---|
| `rx_by_npi_drug` | doctor × drug | `drug_key, npi, specialty, clms, drug_cst, benes` |
| `pay_by_npi_drug` | doctor × drug | `drug_key, npi, pay_amount, pay_count` (no Metformin) |
| `partd_raw` | raw prescribing | `npi, specialty, brnd_name, gnrc_name, tot_clms, tot_benes, tot_drug_cst, year` |
| `payments_raw` | raw payments | `npi, recipient_type, specialty, amount, manufacturer, drug1..5, program_year, payment_date` |
| `drug_map` | lookup | `drug_key, brnd_name, gnrc_name, match_on` |

The core join: `rx_by_npi_drug LEFT JOIN pay_by_npi_drug USING (drug_key, npi)` →
"this doctor's prescribing **and** payment for this drug."

---

## Example things to ask Claude

- "For each drug, average claims for paid vs unpaid prescribers."
- "Top 10 cardiologists by Eliquis payments, with their Eliquis claim counts."
- "Show the Ozempic payment dose-response: avg claims by payment band."
- "Within endocrinology, do paid Ozempic prescribers write more than unpaid ones?"
- "Confirm metformin has zero payment records." *(it does — the control)*
- "Which manufacturers paid the most for Xarelto?"

---

## Security model

- Connects as **`webapp`**, granted **`SELECT` on `rx.*` only** — no writes, no other databases.
- The MCP server is read-only by default (`run_select_query` rejects non-SELECT).
- Data is **public CMS data** (Open Payments + Medicare Part D), so read access exposes nothing
  sensitive.
- The password is intentionally kept out of this repo (a public read-only credential could still
  be abused to run heavy queries / consume compute). Owner shares it directly.
