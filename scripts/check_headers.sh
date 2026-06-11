#!/usr/bin/env bash
# check_headers.sh — print row 1 of each CSV next to the columns the DDL expects.
# Run this BEFORE loading. Eyeball the diff: gov CSV headers are verbose and sometimes
# drift between program years. If a name is off, the loaders below will mis-map silently.
#
# Usage:  bash scripts/check_headers.sh
# Override file paths with env vars if your filenames differ:
#   OP_CSV=data/foo.csv PARTD_CSV=data/bar.csv bash scripts/check_headers.sh

set -euo pipefail

OP_CSV="${OP_CSV:-$(ls data/open_payments_general_*.csv 2>/dev/null | head -1 || true)}"
PARTD_CSV="${PARTD_CSV:-$(ls data/partd_provider_drug_*.csv 2>/dev/null | head -1 || true)}"

hr() { printf '%.0s─' {1..78}; echo; }

# Print a CSV header one column per line, numbered, so it's easy to scan/grep.
dump_header() {
  local f="$1"
  head -1 "$f" \
    | tr -d '\r' \
    | tr ',' '\n' \
    | nl -ba -w3 -s'  '
}

echo
hr
echo "OPEN PAYMENTS — General Payments Detail"
echo "file: ${OP_CSV:-<not found>}"
hr
if [[ -n "${OP_CSV:-}" && -f "$OP_CSV" ]]; then
  echo "[ actual header columns ]"
  dump_header "$OP_CSV"
  echo
  echo "[ columns the loader extracts (must exist by these exact names) ]"
  cat <<'EOF'
  Covered_Recipient_NPI
  Covered_Recipient_Type
  Covered_Recipient_Specialty_1
  Total_Amount_of_Payment_USDollars        (TEXT in source -> cast Float)
  Nature_of_Payment_or_Transfer_of_Value
  Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name
  Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1
  Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_2
  Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_3
  Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_4
  Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_5
  Program_Year
  Date_of_Payment
EOF
else
  echo "!! CSV not found. Drop it in data/ or set OP_CSV=path."
fi

echo
hr
echo "MEDICARE PART D — by Provider and Drug"
echo "file: ${PARTD_CSV:-<not found>}"
hr
if [[ -n "${PARTD_CSV:-}" && -f "$PARTD_CSV" ]]; then
  echo "[ actual header columns ]"
  dump_header "$PARTD_CSV"
  echo
  echo "[ columns the loader extracts (must exist by these exact names) ]"
  cat <<'EOF'
  Prscrbr_NPI
  Prscrbr_Type
  Brnd_Name
  Gnrc_Name
  Tot_Clms
  Tot_Benes
  Tot_Drug_Cst
  Tot_30day_Fills            (loaded if present; not required by analyses)
EOF
else
  echo "!! CSV not found. Drop it in data/ or set PARTD_CSV=path."
fi

echo
hr
echo "If every 'expected' name appears in the 'actual' list above, you're good to load."
echo "If a name differs (e.g. _1 suffix moved, or 'Prscrbr' vs 'Prscribr'), tell Claude before loading."
hr
