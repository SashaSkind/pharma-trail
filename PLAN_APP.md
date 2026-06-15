# Plan — "Is My Doctor Paid?" web app

A patient-facing transparency app: search a doctor → see their industry payments (how much,
from whom, for which drug) and how their prescribing compares to *unpaid peers in the same
specialty* → see lower-conflict alternatives in that specialty. Built on the prescription-bias
analysis, using public CMS data.

> **Status: PLAN ONLY. No app code written yet.** Review this, then we build.

---

## 0. Open decision (need your call)

**Data year — not yet chosen.** 2024 is now published for *both* datasets (Part D released
~May 2026; Open Payments 2024 live). 2024 = current/credible but needs a re-pull (Part D fast +
OP 2024 CSV ~8 GB one-time). 2023 = already on disk, build starts now. **Recommendation: 2024**
for a portfolio piece that should look current. Everything below is year-agnostic.

---

## 1. Does this already exist? (positioning)

- **CMS Open Payments search** — official, shows payments, but **no prescribing link**.
- **ProPublica Dollars for Docs** — the famous one, but **retired ~2019 (data frozen at 2018)**.
- **Gap we fill:** per-doctor *payments ↔ prescribing*, quantified as "prescribes N% more than
  **unpaid peers in the same specialty**," plus **patient-facing alternatives**. Current data +
  that synthesis = the differentiator.

---

## 2. Cost & durability — all free, permanent

| Piece | Tier | Cost | Notes |
|---|---|---|---|
| Neon (Postgres) | Free | $0 | Permanent (not a trial), 0.5 GB, scale-to-zero, 100 CU-hr/mo |
| Vercel (hosting) | Hobby | $0 | `*.vercel.app` URL + serverless API |
| CMS data | Public | $0 | — |
| ClickHouse | — | $0 | **Not used by the app** — data derived locally; trial expiry irrelevant |
| Custom domain | optional | ~$12/yr | only for a vanity URL |

Caveats: Neon cold-start ~½s after 5 min idle; free-tier caps *pause* (never charge). Fine for
a portfolio.

---

## 3. Architecture

```
  Browser
     │  (search, doctor page)
     ▼
  Vercel — Next.js (App Router, TypeScript)
     │  API routes: /api/search, /api/doctor/[npi], /api/similar
     ▼
  Neon — serverless Postgres (4 tables, pg_trgm name search)
     ▲
     │  one-time load (scripts/load_neon.py)
  data/web/*.csv  ◄── build_doctor_db.py ◄── Part D JSONs + OP CSV (on disk)
```

No live dependency on ClickHouse. The pipeline that *builds* the data runs once, locally.

---

## 4. Data pipeline

`scripts/build_doctor_db.py` (drafted) reads the files on disk and emits 4 CSVs into
`data/web/`. **One tweak needed:** add `specialty` into `doctor_drug` (denormalized) so the
"similar doctors" query is a single fast index lookup.

| CSV | Grain | Columns | ~rows |
|---|---|---|---|
| `doctors.csv` | per NPI | npi, name, specialty, city, state, total_pay, total_claims | ~450k |
| `doctor_drug.csv` | per NPI×drug | npi, drug_key, **specialty**, claims, cost, benes, pay_amount, pay_count, peer_unpaid_avg, pct_vs_unpaid | ~765k |
| `doctor_drug_mfr.csv` | per NPI×drug×mfr | npi, drug_key, manufacturer, amount, n | ~400k |
| `peer_benchmark.csv` | per specialty×drug | specialty, drug_key, paid_avg, unpaid_avg, n_paid, n_unpaid | ~small |

**Bias metric (precomputed):** `pct_vs_unpaid = (doctor's claims − unpaid peer avg) / unpaid
peer avg × 100`, per specialty×drug. This is the headline number on a doctor's page.

---

## 5. Neon schema (DDL)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE doctors (
  npi          BIGINT PRIMARY KEY,
  name         TEXT NOT NULL,
  specialty    TEXT,
  city         TEXT,
  state        TEXT,
  total_pay    NUMERIC DEFAULT 0,
  total_claims INT     DEFAULT 0
);
CREATE INDEX idx_doctors_name_trgm ON doctors USING gin (lower(name) gin_trgm_ops);

CREATE TABLE doctor_drug (
  npi             BIGINT,
  drug_key        TEXT,
  specialty       TEXT,
  claims          INT,
  cost            NUMERIC,
  benes           INT,
  pay_amount      NUMERIC DEFAULT 0,
  pay_count       INT     DEFAULT 0,
  peer_unpaid_avg NUMERIC,
  pct_vs_unpaid   NUMERIC,
  PRIMARY KEY (npi, drug_key)
);
-- the "similar doctors" lookup: same drug + specialty, ranked by payment
CREATE INDEX idx_dd_similar ON doctor_drug (drug_key, specialty, pay_amount);

CREATE TABLE doctor_drug_mfr (
  npi          BIGINT,
  drug_key     TEXT,
  manufacturer TEXT,
  amount       NUMERIC,
  n            INT
);
CREATE INDEX idx_ddm ON doctor_drug_mfr (npi, drug_key);

CREATE TABLE peer_benchmark (
  specialty TEXT, drug_key TEXT,
  paid_avg NUMERIC, unpaid_avg NUMERIC, n_paid INT, n_unpaid INT,
  PRIMARY KEY (specialty, drug_key)
);
```

Loaded via `scripts/load_neon.py` (psycopg2 `COPY`, reads `NEON_DATABASE_URL` from `.env`).

---

## 6. Pages & wireframes

### `/` — Search
```
┌──────────────────────────────────────────────┐
│   Is My Doctor Paid?                           │
│   ┌────────────────────────────────────────┐  │
│   │ 🔍  Search a doctor by name…           │  │
│   └────────────────────────────────────────┘  │
│   ▸ John Smith — Cardiology — Boston, MA       │  ← autocomplete (ILIKE, top 20)
│   ▸ John Smith — Internal Medicine — Akron, OH │
│                                                │
│   Banner: public CMS 2024 data · observational │
└──────────────────────────────────────────────┘
```

### `/doctor/[npi]` — Detail
```
┌──────────────────────────────────────────────┐
│  Dr. John Smith   Cardiology · Boston, MA      │
│  ─────────────────────────────────────────────│
│  💵 Received $4,250 from industry (2024)       │
│     ├ Eliquis  $3,100  (BMS, Pfizer)           │  ← by drug → by manufacturer
│     └ Xarelto  $1,150  (Janssen)               │
│                                                │
│  📈 Prescribing vs unpaid peers (same specialty)│
│     Eliquis: 308 claims  ▲ +51% vs unpaid cards │  ← the bias metric, per drug
│     Xarelto:  77 claims  ▲ +18%                 │
│     [ small bar chart: this dr vs peer avg ]    │
│                                                │
│  🔎 Other Cardiologists who prescribe Eliquis   │  ← similar doctors / alternatives
│     Name           City      Claims   Paid?     │
│     Dr. A. Lee     Boston    240      $0  ✓ none │  ← sorted least-paid first
│     Dr. B. Patel   Cambridge 190      $120       │
│                                                │
│  ⚠️ Disclaimer (see §8)                         │
└──────────────────────────────────────────────┘
```

---

## 7. API contracts

```
GET /api/search?q=<str>                 → [{npi,name,specialty,city,state,total_pay}]   (limit 20)
GET /api/doctor/<npi>                    → {
                                             doctor: {npi,name,specialty,city,state,total_pay},
                                             drugs:  [{drug_key,claims,cost,pay_amount,pay_count,
                                                       peer_unpaid_avg,pct_vs_unpaid}],
                                             manufacturers: [{drug_key,manufacturer,amount}]
                                           }
GET /api/similar?npi=<npi>&drug=<key>    → {
                                             drug, specialty,
                                             alternatives: [{npi,name,city,claims,pay_amount,
                                                             pct_vs_unpaid}]   (same specialty+drug,
                                             }                                  ordered pay_amount ASC)
```

DB driver: `@neondatabase/serverless` (HTTP, ideal for Vercel functions). Parameterized queries.

---

## 8. Ethics & framing (non-negotiable, built in)

- Every page: **"Source: public CMS Open Payments + Medicare Part D, <year>. This shows
  correlation, not proof that payments changed any individual's decisions."**
- Doctor pages state **facts** ("received $X", "prescribes N% more than unpaid peers"), never
  "corrupt"/"bought."
- "Alternatives" framed as *"other in-specialty prescribers and their payment transparency,"*
  with a note to **talk to your own doctor** — not "switch doctors."
- Show the **metformin control / Humira-flat** idea somewhere (an "About the method" page) so
  users see the analysis is honest about where the effect *doesn't* appear.

---

## 9. Build & deploy runbook (who does what)

| # | Step | Who |
|---|---|---|
| 1 | (if 2024) re-pull Part D + download OP 2024 CSV | me |
| 2 | `build_doctor_db.py` → `data/web/*.csv` (+ specialty tweak) | me |
| 3 | Create free **Neon** project → copy connection string → paste into `.env` as `NEON_DATABASE_URL` | **you** |
| 4 | `load_neon.py` → create schema + COPY CSVs | me |
| 5 | Scaffold Next.js app in `web/` (pages + API + `@neondatabase/serverless`) | me |
| 6 | Test locally (`npm run dev`) against Neon | me |
| 7 | Push repo; create **Vercel** project, root dir = `web/`, set env `NEON_DATABASE_URL`, deploy | **you** (I can do via Vercel CLI if you log in) |
| 8 | (optional) custom domain | you |

`web/` lives in this same repo (Vercel root dir = `web/`). `.env` stays gitignored;
`NEON_DATABASE_URL` is set as a Vercel env var, not committed.

---

## 10. Risks / caveats

- **Name collisions** — common names return several NPIs; the specialty+city in results
  disambiguates. NPI is the unique key.
- **Suppressed Part D rows** (`Tot_Clms < 11`) are absent → some paid doctors show little/no
  prescribing. We'll label "limited/suppressed prescribing data," not "0".
- **Specialty messiness** — `Prscrbr_Type` has many near-duplicate labels; peer groups use it
  as-is. Good enough; could normalize later.
- **Neon cold-start** — first query after idle ~½s. Add a tiny loading state.
- **Payment attribution** — a payment naming two of our drugs is counted under each (matches the
  analysis); rare, noted.

---

## 11. Stack summary

- **Frontend/SSR:** Next.js (App Router) + TypeScript + Tailwind; Recharts for the per-doctor bar.
- **DB:** Neon Postgres, `@neondatabase/serverless` driver.
- **Data prep:** Python (`build_doctor_db.py`, `load_neon.py`) — reuses files on disk.
- **Host:** Vercel Hobby (free).
