# Hex notebook — cells in paste order

Build the notebook top to bottom. Each block below = one Hex cell. SQL cells run against
the `rx` ClickHouse connection; Python cells consume the dataframe a prior SQL cell emits
(Hex names the dataframe after the cell). Cell names are suggested in **bold**.

> Prereq: the data is loaded and `sql/03_scoped_tables.sql` has run, so
> `rx.rx_by_npi_drug` and `rx.pay_by_npi_drug` exist. (They do — verified.)

---

## Setup — connect Hex to ClickHouse Cloud (do this once)

In Hex: **Settings → Data sources → + Add → ClickHouse** (or "Generic / HTTP" if no native
tile), then fill in:

| Field | Value |
|---|---|
| Host | `rzxwreav7j.us-west-2.aws.clickhouse.cloud` |
| Port | `8443` |
| Protocol / SSL | **HTTPS / TLS on** |
| Username | `default` |
| Password | *(your CH password — same one in `.env`)* |
| Database | `rx` |

Test the connection, then set it as the default for SQL cells. Every SQL cell below runs
against this source. (Hex's ClickHouse driver speaks the same HTTPS:8443 interface our
Python loader used.)

> ⚠️ If SQL cells suddenly error with "connection reset", the Cloud service idled — open a
> ClickHouse SQL console once to wake it, and make sure Hex's egress IP is on the service's
> **IP Access List** (or set it to allow-anywhere for the demo).

---

## Cell 1 — **per_npi** (SQL)  ← the base dataframe

```sql
SELECT
    r.drug_key,
    r.npi,
    r.clms,
    r.specialty,
    ifNull(p.pay_amount, 0) AS pay_amount
FROM rx.rx_by_npi_drug AS r
LEFT JOIN rx.pay_by_npi_drug AS p USING (drug_key, npi)
```

## Cell 2 — **dose_response** (SQL)  ← THE money chart

```sql
SELECT
    r.drug_key,
    multiIf(
        p.pay_amount = 0 OR p.pay_amount IS NULL, '0 $0',
        p.pay_amount < 100,    '1 <$100',
        p.pay_amount < 1000,   '2 $100-1k',
        p.pay_amount < 10000,  '3 $1k-10k',
                               '4 $10k+')  AS pay_band,
    count()               AS n,
    round(avg(r.clms), 1) AS avg_claims
FROM rx.rx_by_npi_drug AS r
LEFT JOIN rx.pay_by_npi_drug AS p USING (drug_key, npi)
GROUP BY r.drug_key, pay_band
ORDER BY r.drug_key, pay_band
```

**Chart cell config (Hex Chart cell, source = `dose_response`):**

| Setting | Value |
|---|---|
| Chart type | **Line** (or Grouped bar) |
| X axis | `pay_band` (categorical, sorts correctly thanks to the `0…4` prefix) |
| Y axis | `avg_claims` (aggregate = **none / first** — it's already aggregated) |
| Color / Series | `drug_key` |
| Y axis label | "Avg Part D claims per prescriber" |
| X axis label | "Drug-specific payment received" |

Story: avg_claims climbs across the bands for the 4 branded drugs. Metformin has only the
`0 $0` point — a flat dot on the left = the control. **Add a text annotation** on the `4 $10k+`
band: "small n (9–107 prescribers) — noise". Expected shape (from our run):

```
pay_band     Eliquis  Xarelto  Ozempic   (Metformin = 124.9 at $0 only)
0 $0           70       39       41
1 <$100       134       68       54
2 $100-1k     223       94       84
3 $1k-10k     623      291      319   ← the punchline
```

## Cell 3 — **paid_vs_unpaid** (SQL)  ← headline numbers

```sql
SELECT
    r.drug_key,
    if(p.pay_amount > 0, 'paid', 'unpaid') AS grp,
    count()                AS n_prescribers,
    round(avg(r.clms), 1)  AS avg_claims,
    round(avg(r.drug_cst)) AS avg_drug_cost
FROM rx.rx_by_npi_drug AS r
LEFT JOIN rx.pay_by_npi_drug AS p USING (drug_key, npi)
GROUP BY r.drug_key, grp
ORDER BY r.drug_key, grp
```

**Chart cell config (source = `paid_vs_unpaid`):**

| Setting | Value |
|---|---|
| Chart type | **Grouped bar** |
| X axis | `drug_key` |
| Y axis | `avg_claims` |
| Color / Series | `grp` (paid vs unpaid) — set paid = a strong color, unpaid = grey |
| Sort X | by paid `avg_claims` desc, or leave alphabetical |

Story: for every branded drug the paid bar towers over unpaid (Eliquis 147 vs 70, Xarelto 77
vs 39, Ozempic 64 vs 41). Metformin has a single unpaid bar (125) — no paid bar exists.
Humira's two bars are equal (16 vs 16) — the honest "doesn't always work" example.

## Cell 4 — **significance** (Python)  ← controls for specialty, prints effect + p-value

Input: the `per_npi` dataframe from Cell 1. (In Hex, reference it by the cell's dataframe
name — shown here as `per_npi`.)

```python
import numpy as np
import statsmodels.formula.api as smf

df = per_npi.copy()
df['paid'] = (df['pay_amount'].fillna(0) > 0).astype(int)
df['log_clms'] = np.log(df['clms'] + 1)

rows = []
for drug in sorted(df['drug_key'].unique()):
    sub = df[df['drug_key'] == drug]
    # Metformin has no paid prescribers -> 'paid' is constant -> skip the model.
    if sub['paid'].nunique() < 2:
        rows.append((drug, None, None, '(control: no paid prescribers)'))
        continue
    m = smf.ols('log_clms ~ paid + C(specialty)', data=sub).fit()
    coef, p = m.params['paid'], m.pvalues['paid']
    # exp(coef)-1 ~ approx % more claims for paid vs unpaid, holding specialty fixed
    rows.append((drug, round(coef, 3), round(p, 4),
                 f'{round((np.exp(coef)-1)*100,1)}% more claims if paid'))

import pandas as pd
result = pd.DataFrame(rows, columns=['drug_key', 'paid_coef', 'p_value', 'interpretation'])
result
```

**Read it:** positive `paid_coef` with small `p_value` = paid physicians prescribe more of
that drug, even within the same specialty. Metformin row stays empty — the honest control.
Expected output (from our run — display this `result` df as a Hex table):

```
drug_key   paid_coef  p_value       interpretation
Eliquis    0.492      <1e-300       +63.6% more claims if paid
Xarelto    0.358      <1e-300       +43.1% more claims if paid
Ozempic    0.329      <1e-300       +39.0% more claims if paid
Humira     0.005      0.895         +0.5%  (not significant)
Metformin  —          —             (control: no paid prescribers)
```

> `p=0.0000` shows in the table because the true p is below floating-point precision
> (< 1e-300). Say "p < 0.001" on the slide — don't claim "p = 0".

## Cell 5 — **within_specialty** (SQL, optional — fallback ladder #1, drop first if short on time)

```sql
SELECT
    r.drug_key, r.specialty,
    if(p.pay_amount > 0, 'paid', 'unpaid') AS grp,
    count()               AS n,
    round(avg(r.clms), 1) AS avg_claims
FROM rx.rx_by_npi_drug AS r
LEFT JOIN rx.pay_by_npi_drug AS p USING (drug_key, npi)
GROUP BY r.drug_key, r.specialty, grp
HAVING n >= 30
ORDER BY r.drug_key, r.specialty, grp
```

**Chart cell config (source = `within_specialty`):** filter to one drug first (e.g.
`drug_key = 'Eliquis'`) via a Hex filter or `WHERE`, else it's too busy.

| Setting | Value |
|---|---|
| Chart type | **Grouped/horizontal bar** |
| Y axis | `specialty` (horizontal reads better — long labels) |
| X axis | `avg_claims` |
| Color / Series | `grp` |

Story: the paid bar beats unpaid in **every single specialty** (Cardiology 1.5×, Electro­
physiology 1.4×, Internal Medicine 1.6×, NP/PA 1.8×). That's the "it's not just specialty mix"
proof — no Simpson's paradox.

## Cell 6 — **brand_vs_generic_cost** (SQL)  ← the cost angle

Average drug cost per claim, paid vs unpaid — branded drugs cost far more per script than
their generics, so paid-driven brand prescribing has a real dollar footprint.

```sql
SELECT
    r.drug_key,
    if(p.pay_amount > 0, 'paid', 'unpaid') AS grp,
    round(sum(r.drug_cst) / sum(r.clms), 2) AS cost_per_claim,
    round(sum(r.drug_cst))                  AS total_drug_cost
FROM rx.rx_by_npi_drug AS r
LEFT JOIN rx.pay_by_npi_drug AS p USING (drug_key, npi)
GROUP BY r.drug_key, grp
ORDER BY r.drug_key, grp
```

**Chart cell config (source = `brand_vs_generic_cost`):** single-value KPIs or a grouped bar
of `cost_per_claim` by `drug_key` × `grp`. The angle: branded drugs run hundreds of $/claim
vs metformin's ~$15/claim, so payment-driven brand prescribing has a real dollar footprint.
Pair with `total_drug_cost` as a "Medicare $ exposed" KPI.

---

## Optional Cell 7 — **review_queue** (SQL)  ← the OLTP→OLAP bonus, live

Shows the Postgres watchlist decisions that `pipe_pg_to_ch.py` streamed into ClickHouse —
proves the OLTP→OLAP loop on one screen. Run a sync (or `--watch`) before the demo.

```sql
SELECT review_id,
       argMax(drug_key, synced_at)    AS drug_key,
       argMax(npi, synced_at)         AS npi,
       round(argMax(pay_amount, synced_at)) AS pay_amount,
       argMax(status, synced_at)      AS status,
       argMax(assigned_to, synced_at) AS assigned_to,
       max(updated_at)                AS updated_at
FROM rx.review_events
GROUP BY review_id
ORDER BY pay_amount DESC
```

Story: edit a row's status in Postgres → run the pipe → re-run this cell → the status flips
in ClickHouse. That's the operational layer on top of the analytics.
