# Pharma Trail — Technical Architecture

A public-transparency web app that joins two federal healthcare datasets to show whether
physicians who receive drug-specific industry payments prescribe more of that same drug.
Live: **https://pharma-trail.vercel.app**

---

## 1. System overview

```
                          ┌─────────────────────── BUILD-TIME (local, one-off) ────────────────────────┐
  CMS Open Payments  ─────┤  download 8.9GB CSV ──► stream-filter (Python) ──► ClickHouse payments_raw  │
  (general payments)      │                          │                                                  │
                          │                          └──► per-doctor aggregate (Python) ──► CSVs        │
  CMS Part D            ──┤  API pull (5 drugs) ────► ClickHouse partd_raw       │                      │
  (by provider & drug)    │                          │                          ▼                      │
                          │                          └──► scoped tables ◄──    Neon Postgres            │
                          └─────────────────────────────────────────────────────────────────────────── ┘
                                                       │                          │
                          ┌──────────────────────── RUN-TIME (Vercel) ───────────┼──────────────────────┐
                          │   Browser                                            │                      │
                          │     ├─ /  /doctor/[npi]  ──► /api/* ──► Neon (point lookups, name search)    │
                          │     └─ /explore          ──► /api/explore ──► ClickHouse (live aggregation)  │
                          └─────────────────────────────────────────────────────────────────────────── ┘
```

**Two databases on purpose (hybrid OLAP + OLTP):**
- **ClickHouse Cloud** — columnar OLAP. Powers the `/explore` page: live `GROUP BY`
  aggregation over ~830K scoped rows per request, recomputed on every filter change.
- **Neon (Postgres)** — row-store OLTP. Powers search + per-doctor pages: indexed point
  lookups returning a handful of rows.

The app code is identical at the edge; each query just goes to the right engine for its shape.

---

## 2. Source data

| Dataset | Source | Year | Raw size | Rows | Notes |
|---|---|---|---|---|---|
| Open Payments — General Payments Detail | openpaymentsdata.cms.gov (download + DKAN datastore API) | 2024 | **8.9 GB CSV** | 15.4M | 91 columns; dollar amount stored as **text**; up to 5 product-name columns per record |
| Part D — Prescribers by Provider and Drug | data.cms.gov data-api | 2024 | ~4 GB full (we pull a scoped slice) | 992,671 (our 5 drugs) | per (NPI, drug); rows with `Tot_Clms < 11` suppressed by CMS |

**Scope — the 5-drug lookup (`drug_map`).** Branded drugs match on brand name; metformin (the
control) matches on generic. The control intentionally gets **zero** payment matches — the
integrity check that the pipeline isn't manufacturing a correlation.

| drug_key | brand (Part D / OP) | generic | match_on |
|---|---|---|---|
| Eliquis | ELIQUIS | APIXABAN | brand |
| Xarelto | XARELTO | RIVAROXABAN | brand |
| Humira | HUMIRA | ADALIMUMAB | brand |
| Ozempic | OZEMPIC | SEMAGLUTIDE | brand |
| Metformin | (none) | METFORMIN HCL | generic |

**API specifics discovered/verified:**
- Part D data-api: `?filter[Brnd_Name]=Eliquis&size=5000&offset=N`, case-insensitive, 5000/page.
- Open Payments DKAN datastore: **POST** `query` with an OR-group across the 5 product columns;
  `limit` capped at **500/page** — too slow for bulk (≈45–78 s/page over 14.7M rows), so we
  download the full CSV and filter locally instead.

---

## 3. Data pipeline (build-time, local)

All Python; reusable and idempotent. Connection config in gitignored `.env`.

| Step | Script | What it does |
|---|---|---|
| Part D pull | `scripts/load_api.py --partd` | Paginated API pull of the 5 drugs → saves raw JSON → loads `partd_raw` |
| Part D load (batched) | `scripts/insert_partd_from_json.py` | Loads saved JSON into `partd_raw` in 25K-row batches with retry/reconnect (the single ~1M-row insert over HTTP flaked) |
| Open Payments filter | `scripts/filter_op_csv.py` | Streams the 8.9 GB CSV with `csv.reader`, keeps rows matching the 4 brands across the 5 product cols + physician/practitioner + has-NPI, casts `$`→Float, batch-inserts `payments_raw` |
| Scoped tables | `scripts/rebuild_scoped.py` | Rebuilds `rx_by_npi_drug` / `pay_by_npi_drug` for a given year |
| Per-doctor aggregate | `scripts/build_doctor_db.py` | Reads Part D JSON + OP CSV → emits 4 CSVs (doctors, doctor_drug, doctor_drug_mfr, peer_benchmark), incl. the precomputed bias metric |
| Neon load | `scripts/load_neon.py` | Creates schema + `pg_trgm`, `COPY`s the CSVs, builds indexes |

**Resilience pattern (important).** `clickhouse-connect` over HTTPS intermittently failed
large inserts (`Empty query` / binary-parsed-as-SQL). Fix: **25K-row batches** + a retry loop
that **reconnects a fresh client** on failure. After that, zero retries needed.

**The bias metric** is precomputed in `build_doctor_db.py`, per (specialty, drug):
`pct_vs_unpaid = (doctor_claims − unpaid_peer_avg) / unpaid_peer_avg × 100`. So the app never
computes it live — it's a column read.

---

## 4. ClickHouse layer (OLAP)

ClickHouse Cloud (v25.12, AWS us-west-2). All tables `MergeTree` (Cloud transparently uses
**SharedMergeTree** — storage on object storage, separate compute, scale-to-zero after idle).

| Table | Engine / ORDER BY | Rows | Role |
|---|---|---|---|
| `rx.partd_raw` | MergeTree `(npi, brnd_name)` *(loaded with year col)* | 992,671 | raw prescribing |
| `rx.payments_raw` | MergeTree `(npi, program_year)` | 512,191 | raw scoped payments |
| `rx.drug_map` | MergeTree `(drug_key)` | 5 | the lookup (TinyLog rejected on Cloud → MergeTree) |
| `rx.rx_by_npi_drug` | MergeTree `(drug_key, npi)` | 831,932 | prescribing per NPI×drug (Explore reads this) |
| `rx.pay_by_npi_drug` | MergeTree `(drug_key, npi)` | 168,596 | payments per NPI×drug |

- Whole `rx` DB compresses ≈ **6×** (e.g. 165 MB → 26 MB) via columnar storage.
- The `/explore` query is a single **parameterized** (`{name:Type}`) `multiIf` payment-band
  `GROUP BY` with a `LEFT JOIN`, filtered on `drug_key` (the lead sort key → data skipping).
  Typical: **scan ~260K rows in ~50 ms**.
- `LowCardinality(String)` used for specialty/recipient_type/nature columns.

---

## 5. Neon layer (OLTP)

Neon serverless Postgres (v18, AWS us-east-1, free tier — permanent, scale-to-zero, 0.5 GB).

```sql
doctors(npi PK, name, specialty, city, state, total_pay, total_claims)
  └ GIN trigram index on lower(name)   -- fast ILIKE name search
  └ btree on specialty
doctor_drug(npi, drug_key, specialty, claims, cost, benes,
            pay_amount, pay_count, peer_unpaid_avg, pct_vs_unpaid)  PK(npi, drug_key)
  └ btree (drug_key, specialty, pay_amount)  -- the "similar doctors" lookup
doctor_drug_mfr(npi, drug_key, manufacturer, amount, n)  └ btree (npi, drug_key)
peer_benchmark(specialty, drug_key, paid_avg, unpaid_avg, n_paid, n_unpaid)
```

| Table | Rows |
|---|---|
| doctors | 401,943 |
| doctor_drug | 831,932 |
| doctor_drug_mfr | 177,483 |
| peer_benchmark | 451 |

DB size ≈ 234 MB (within the 0.5 GB free limit). Search uses the **pg_trgm GIN index**
(verified via `EXPLAIN` → `Bitmap Index Scan on idx_doctors_name_trgm`).

---

## 6. Web app (Next.js)

`web/` — Next.js **16.2.9** (App Router), React 19, TypeScript, Tailwind v4, Recharts. Node 24.

```
web/
  lib/
    db.ts       Neon access (@neondatabase/serverless): searchDoctors, getDoctor, getSimilar
    ch.ts       ClickHouse access (@clickhouse/client): explore(), specialtiesForDrug()
    drugs.ts    drug metadata + DATA_YEAR
  app/
    layout.tsx          header/nav/footer, metadata, favicon (logo.png)
    page.tsx            home + search hero
    doctor/[npi]/page.tsx   server component: payments by drug/mfr, bias bars, similar doctors
    explore/page.tsx        client component: filters → /api/explore → live chart + speed badge
    about/page.tsx          methodology + honest caveats
    components/
      SearchBox.tsx     debounced trigram autocomplete (client)
      BiasChart.tsx     per-doctor claims vs peer avg (Recharts, client)
      ExploreChart.tsx  payment-band dose-response bar (Recharts, client)
    api/
      search/route.ts        GET ?q=        → Neon
      specialties/route.ts   GET ?drug=     → ClickHouse
      explore/route.ts       GET ?drug=&specialty=&minClms=&payMax= → ClickHouse
```

- **Server components** (doctor page) query Neon directly via `lib/db`; **client components**
  (search, explore) hit API routes for interactivity.
- API routes run on the **Node.js runtime** (`@clickhouse/client` needs it), `dynamic =
  "force-dynamic"` (no caching of live data).
- Charts are client-only (Recharts); pages are server-rendered.

---

## 7. Deployment & ops

- **Host:** Vercel Hobby (free). Project `pharma-trail`, root dir `web/`, alias
  `pharma-trail.vercel.app`. Deployed via Vercel CLI (`vercel deploy --prod`).
- **Env vars** (Vercel production + local `web/.env.local`, both gitignored): `NEON_DATABASE_URL`,
  `CH_HOST`, `CH_USER`, `CH_PASSWORD`.
- **Deployment Protection** (Vercel SSO auth, on by default) disabled via the Vercel REST API
  (`PATCH /v9/projects/{id}` `ssoProtection: null`) so the public URL returns 200.

---

## 8. Security model

The app connects to ClickHouse as a **read-only user** (`webapp`): `GRANT SELECT ON rx.* ` only
— no writes, no other databases. Admin (`default`) creds live solely in the loader's root
`.env`, never in the app or Vercel.

ClickHouse IP Access List is set to **allow-from-anywhere**, which is acceptable here because:
(1) the app/serverless egress IPs aren't fixed, (2) the connection is still TLS + credential
authenticated, and (3) the exposed user is read-only over **already-public** CMS data. The
"proper" alternatives (static egress IP, PrivateLink) require paid Vercel/ClickHouse tiers.

Neon has no IP list (credential + TLS auth, same model as most managed Postgres).

---

## 9. Analysis methodology (the thesis)

- **Paid vs unpaid:** avg claims per prescriber, grouped by whether they received any payment.
- **Dose-response:** avg claims by payment band ($0 / <$100 / $100–1k / $1k–10k / $10k+).
- **Within-specialty control + regression:** `log(claims+1) ~ paid + C(specialty)`
  (statsmodels OLS) → paid physicians prescribe **+40% to +64%** more, p < 0.001, for Eliquis /
  Xarelto / Ozempic; the effect persists inside every specialty (no Simpson's paradox).
- **Controls:** metformin (zero payments → flat) and Humira (specialty biologic → flat, n.s.)
  keep the method honest by showing where the effect *doesn't* appear.
- **Caveat:** observational; correlation, not proof of causation (manufacturers also target
  high prescribers).

---

## 10. Tools & stack summary

| Layer | Tech |
|---|---|
| OLAP / analytics | ClickHouse Cloud (SharedMergeTree) |
| OLTP / serving | Neon serverless Postgres 18 (+ pg_trgm) |
| Data pipeline | Python 3.11: `clickhouse-connect`, `psycopg2`, `requests`, stdlib `csv`/`json` |
| Stats | `statsmodels`, `numpy`, `pandas` |
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Recharts |
| DB drivers (app) | `@neondatabase/serverless`, `@clickhouse/client` |
| Host | Vercel Hobby; deploy via Vercel CLI + REST API |
| Original OLTP→OLAP demo | local Postgres (Docker) `drug_review` watchlist → `pipe_pg_to_ch.py` CDC → ClickHouse `review_events` |

---

## 11. Notable decisions & gotchas (war stories)

- **DKAN API too slow** (45–78 s/page) → downloaded the 8.9 GB CSV and filtered locally.
- **TinyLog rejected on ClickHouse Cloud** ("Shared database must use engines that don't store
  data on disk") → `drug_map` uses MergeTree.
- **`clickhouse-connect` large-insert flakiness** → 25K batches + retry/reconnect.
- **Repo path moved** mid-build (`~/prescriptionbias` → `~/Postman/prescriptionbias` → back).
- **Public IP rotated 4×**, breaking ClickHouse IP allow-list each time → resolved with
  allow-anywhere + read-only user.
- **ClickHouse Cloud scale-to-zero** → first query after idle times out/cold-starts (~1–2 s).
- **Cloud password policy** (upper + special + length) for the `webapp` user.
- **Next 16 async APIs** (`params: Promise<…>`), Recharts tooltip type changes.
