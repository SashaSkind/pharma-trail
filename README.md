# Prescription Bias — CMS Payments × Prescribing

Do physicians who receive **drug-specific** industry payments prescribe **more of that same drug**?
Two real federal datasets, one program year. The metformin row gets **zero** payment matches by
design — that's the integrity check that our pipeline isn't just inventing a correlation.

- **OLAP:** ClickHouse Cloud (the heavy joins/aggregations).
- **OLTP:** Postgres `drug_review` watchlist → piped into ClickHouse (`review_events`).
- **Notebook:** Hex (charts + significance test + NL→SQL).

---

## What you (human) do vs. what's scripted

**Scripted here** (paste into the ClickHouse console / run locally): all SQL, the load + cast,
sanity checks, Python significance test, Postgres schema, and the PG→CH pipe.

**You do by hand:** account/credit setup, downloading the CSVs into `data/`, eyeballing headers,
smell-testing results, and building the Hex notebook UI.

---

## Run order

> Everything in `sql/` is written for the **ClickHouse SQL dialect** and is meant to be pasted into
> the ClickHouse Cloud console (or run via `clickhouse-client`). Run top to bottom.

1. **Drop the CSVs** into `data/`:
   - `data/open_payments_general_YYYY.csv`  (Open Payments — General Payments Detail)
   - `data/partd_provider_drug_YYYY.csv`    (Medicare Part D — by Provider and Drug)

2. **Check the headers match the DDL** (do this before anything else):
   ```bash
   bash scripts/check_headers.sh
   ```
   This prints row 1 of each CSV and the columns we expect. Eyeball the diff. If a name is off,
   tell me before we load — the loaders are positional/named and will silently mis-map otherwise.

3. **Create raw tables + the drug lookup** — paste into ClickHouse console:
   - `sql/01_create_raw.sql`
   - `sql/02_drug_map.sql`

4. **Load the data** (casts the dollar TEXT field → Float):
   ```bash
   bash scripts/load_clickhouse.sh
   ```
   ✅ Expect: `rx.payments_raw` and `rx.partd_raw` row counts in the millions; no all-zero NPIs.
   The script prints counts after each load so you can smell-test.

5. **Build scoped tables** — `sql/03_scoped_tables.sql`.
   ✅ Expect: `rx.rx_by_npi_drug` has all **5** drug_keys; `rx.pay_by_npi_drug` has **4** (NOT metformin).

6. **Run analyses** — `sql/04_analyses.sql`, then `scripts/sanity_check.sql`.
   ✅ Expect: paid avg_claims ≥ unpaid for the 4 branded drugs; metformin gap ~flat.

7. **Notebook** — `sql/05_per_npi_export.sql` feeds the Python cell. Everything paste-ready in
   `hex/cells.md`. NL→SQL prompts in `hex/nl_questions.md`.

8. **OLTP demo** — `postgres/watchlist.sql` (Postgres), then `scripts/seed_watchlist.py`
   (ClickHouse outliers → Postgres), then `scripts/pipe_pg_to_ch.py` (Postgres changes → ClickHouse
   `rx.review_events`, defined in `sql/06_review_events.sql`).

---

## Connection config

Both shell and Python scripts read these env vars (set them once, e.g. in `.env` or your shell):

```bash
export CH_HOST="your-instance.clickhouse.cloud"
export CH_PORT=9440           # native secure; use 8443 for HTTPS
export CH_USER="default"
export CH_PASSWORD="..."
export CH_DATABASE="rx"

export PG_DSN="postgresql://user:pass@host:5432/dbname"
```

---

## Target drugs (locked)

| drug_key  | brand (`Brnd_Name` / OP product) | generic (`Gnrc_Name`) | match_on |
|-----------|----------------------------------|-----------------------|----------|
| Eliquis   | ELIQUIS                          | APIXABAN              | brand    |
| Xarelto   | XARELTO                          | RIVAROXABAN           | brand    |
| Humira    | HUMIRA                           | ADALIMUMAB            | brand    |
| Ozempic   | OZEMPIC                          | SEMAGLUTIDE           | brand    |
| Metformin | (none — control)                 | METFORMIN HCL         | generic  |

Branded drugs match on **brand name**; metformin (control) matches on **generic**. The control
gets zero payment rows on purpose.

## Fallback ladder (cut in this order if time runs short)

1. Within-specialty control (5c) — drop first.
2. ClickPipes CDC → use `scripts/pipe_pg_to_ch.py` instead.
3. Ozempic — drop last.
4. **Never cut:** dose-response chart (5b) + the metformin control. That's the demo.
