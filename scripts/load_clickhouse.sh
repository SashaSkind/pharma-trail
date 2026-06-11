#!/usr/bin/env bash
# load_clickhouse.sh — load both CSVs into ClickHouse, casting the dollar TEXT field to Float.
#
# Strategy (resilient to the 91-col Open Payments file):
#   1. Create a STAGING table whose columns are named EXACTLY like the CSV headers, all String.
#   2. Load with FORMAT CSVWithNames + input_format_skip_unknown_fields=1 so ClickHouse maps by
#      HEADER NAME and silently ignores the ~78 columns we don't define.
#   3. INSERT ... SELECT from staging into the typed rx.* tables, casting dollars->Float, dates, ids.
#
# Run scripts/check_headers.sh FIRST and confirm the header names match the staging columns below.
#
# Prereqs:
#   - `clickhouse client` (or `clickhouse-client`) on PATH.
#   - rx.payments_raw / rx.partd_raw already created (sql/01_create_raw.sql).
#   - Connection via env vars (see README):
#       CH_HOST CH_PORT CH_USER CH_PASSWORD CH_DATABASE
#
# Usage:
#   bash scripts/load_clickhouse.sh            # load both
#   bash scripts/load_clickhouse.sh --reset    # drop+recreate raw tables first, then load
#
# A url()-function variant (load straight from a presigned URL, no local client streaming) is
# provided commented at the bottom — handy if you'd rather paste SQL into the Cloud console.

set -euo pipefail

OP_CSV="${OP_CSV:-$(ls data/open_payments_general_*.csv 2>/dev/null | head -1 || true)}"
PARTD_CSV="${PARTD_CSV:-$(ls data/partd_provider_drug_*.csv 2>/dev/null | head -1 || true)}"

: "${CH_HOST:?set CH_HOST}"
: "${CH_USER:?set CH_USER}"
: "${CH_PASSWORD:?set CH_PASSWORD}"
CH_PORT="${CH_PORT:-9440}"
CH_DATABASE="${CH_DATABASE:-rx}"

# Pick whichever binary name exists.
CH_BIN="$(command -v clickhouse-client || true)"
if [[ -z "$CH_BIN" ]]; then CH_BIN="$(command -v clickhouse || true) client"; fi
[[ -n "$CH_BIN" ]] || { echo "!! clickhouse client not found on PATH"; exit 1; }

# Wrapper: run a query (read from stdin if -- given).
CH() {
  $CH_BIN --host "$CH_HOST" --port "$CH_PORT" --user "$CH_USER" \
          --password "$CH_PASSWORD" --secure --database "$CH_DATABASE" "$@"
}

hr() { printf '%.0s─' {1..70}; echo; }

# ── optional reset ────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--reset" ]]; then
  echo ">> --reset: recreating raw tables from sql/01_create_raw.sql"
  CH --multiquery < sql/01_create_raw.sql
fi

# ── staging tables (all String, named to match CSV headers) ───────────────────
echo ">> creating staging tables"
CH --multiquery <<'SQL'
DROP TABLE IF EXISTS rx.payments_stage;
CREATE TABLE rx.payments_stage
(
    Covered_Recipient_NPI                                          String,
    Covered_Recipient_Type                                        String,
    Covered_Recipient_Specialty_1                                 String,
    Total_Amount_of_Payment_USDollars                            String,
    Nature_of_Payment_or_Transfer_of_Value                        String,
    Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name String,
    Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1      String,
    Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_2      String,
    Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_3      String,
    Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_4      String,
    Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_5      String,
    Program_Year                                                  String,
    Date_of_Payment                                              String
)
ENGINE = MergeTree ORDER BY tuple();

DROP TABLE IF EXISTS rx.partd_stage;
CREATE TABLE rx.partd_stage
(
    Prscrbr_NPI  String,
    Prscrbr_Type String,
    Brnd_Name    String,
    Gnrc_Name    String,
    Tot_Clms     String,
    Tot_Benes    String,
    Tot_Drug_Cst String,
    Tot_30day_Fills String
)
ENGINE = MergeTree ORDER BY tuple();
SQL

# Settings that make the wide-CSV-by-name load work:
LOAD_SETTINGS="--input_format_skip_unknown_fields=1 --input_format_with_names_use_header=1 --input_format_csv_skip_first_lines=0 --date_time_input_format=best_effort"

# ── load Open Payments ────────────────────────────────────────────────────────
if [[ -n "${OP_CSV:-}" && -f "$OP_CSV" ]]; then
  echo ">> loading Open Payments: $OP_CSV"
  CH $LOAD_SETTINGS --query "INSERT INTO rx.payments_stage FORMAT CSVWithNames" < "$OP_CSV"

  echo ">> casting payments_stage -> rx.payments_raw"
  CH --query "
    INSERT INTO rx.payments_raw
    SELECT
        toUInt64OrZero(Covered_Recipient_NPI)                              AS npi,
        Covered_Recipient_Type                                             AS recipient_type,
        Covered_Recipient_Specialty_1                                      AS specialty,
        toFloat64OrZero(replaceRegexpAll(Total_Amount_of_Payment_USDollars, '[^0-9.\\-]', '')) AS amount,
        Nature_of_Payment_or_Transfer_of_Value                            AS nature,
        Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name      AS manufacturer,
        Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1           AS drug1,
        Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_2           AS drug2,
        Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_3           AS drug3,
        Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_4           AS drug4,
        Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_5           AS drug5,
        toUInt16OrZero(Program_Year)                                       AS program_year,
        toDate(parseDateTimeBestEffortOrZero(Date_of_Payment))             AS payment_date
    FROM rx.payments_stage
  "
else
  echo "!! Open Payments CSV not found; skipping. (set OP_CSV=path or drop into data/)"
fi

# ── load Part D ───────────────────────────────────────────────────────────────
if [[ -n "${PARTD_CSV:-}" && -f "$PARTD_CSV" ]]; then
  echo ">> loading Part D: $PARTD_CSV"
  CH $LOAD_SETTINGS --query "INSERT INTO rx.partd_stage FORMAT CSVWithNames" < "$PARTD_CSV"

  echo ">> casting partd_stage -> rx.partd_raw"
  # Program year isn't a column in the Part D file; stamp it from the filename (…_2022.csv).
  PARTD_YEAR="$(echo "$PARTD_CSV" | grep -oE '20[0-9]{2}' | head -1)"
  PARTD_YEAR="${PARTD_YEAR:-0}"
  CH --query "
    INSERT INTO rx.partd_raw
    SELECT
        toUInt64OrZero(Prscrbr_NPI)                                        AS npi,
        Prscrbr_Type                                                       AS specialty,
        Brnd_Name                                                          AS brnd_name,
        Gnrc_Name                                                          AS gnrc_name,
        toUInt32OrZero(Tot_Clms)                                           AS tot_clms,
        toUInt32OrZero(Tot_Benes)                                          AS tot_benes,
        toFloat64OrZero(replaceRegexpAll(Tot_Drug_Cst, '[^0-9.\\-]', ''))  AS tot_drug_cst,
        toUInt16OrZero('${PARTD_YEAR}')                                    AS year
    FROM rx.partd_stage
  "
else
  echo "!! Part D CSV not found; skipping. (set PARTD_CSV=path or drop into data/)"
fi

# ── sanity numbers (smell-test these) ─────────────────────────────────────────
hr
echo "SANITY — row counts & basic health"
hr
CH --query "
SELECT 'payments_raw'  AS tbl, count() AS rows,
       countIf(npi = 0) AS zero_npi,
       round(sum(amount)) AS total_dollars,
       countIf(amount > 0) AS rows_with_dollars
FROM rx.payments_raw
UNION ALL
SELECT 'partd_raw' AS tbl, count() AS rows,
       countIf(npi = 0) AS zero_npi,
       round(sum(tot_drug_cst)) AS total_dollars,
       countIf(tot_clms > 0) AS rows_with_dollars
FROM rx.partd_raw
FORMAT PrettyCompact
"
hr
echo "Expect: rows in the millions, zero_npi small (OP has some non-NPI recipients),"
echo "        total_dollars non-zero (proves the TEXT->Float cast worked)."
echo
echo "Staging tables (rx.payments_stage / rx.partd_stage) can be dropped once you're happy:"
echo "  DROP TABLE rx.payments_stage; DROP TABLE rx.partd_stage;"

# ──────────────────────────────────────────────────────────────────────────────
# ALTERNATIVE: url() variant — paste into the ClickHouse Cloud console instead of
# streaming through the local client. Replace <PRESIGNED_URL> with a public/presigned
# link to the CSV. skip_unknown_fields lets you name only the columns you want.
# ──────────────────────────────────────────────────────────────────────────────
# SET input_format_skip_unknown_fields = 1;
#
# INSERT INTO rx.payments_raw
# SELECT
#     toUInt64OrZero(Covered_Recipient_NPI),
#     Covered_Recipient_Type,
#     Covered_Recipient_Specialty_1,
#     toFloat64OrZero(replaceRegexpAll(Total_Amount_of_Payment_USDollars, '[^0-9.\-]', '')),
#     Nature_of_Payment_or_Transfer_of_Value,
#     Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name,
#     Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1,
#     Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_2,
#     Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_3,
#     Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_4,
#     Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_5,
#     toUInt16OrZero(Program_Year),
#     toDate(parseDateTimeBestEffortOrZero(Date_of_Payment))
# FROM url('<PRESIGNED_URL>', 'CSVWithNames',
#   'Covered_Recipient_NPI String, Covered_Recipient_Type String,
#    Covered_Recipient_Specialty_1 String, Total_Amount_of_Payment_USDollars String,
#    Nature_of_Payment_or_Transfer_of_Value String,
#    Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name String,
#    Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1 String,
#    Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_2 String,
#    Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_3 String,
#    Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_4 String,
#    Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_5 String,
#    Program_Year String, Date_of_Payment String');
