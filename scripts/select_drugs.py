#!/usr/bin/env python3
"""
select_drugs.py — data-driven drug selection for the scoped dataset.

Picks the top-N branded drugs that are BOTH heavily promoted (Open Payments) AND actually
prescribed in Medicare Part D (so vaccines / IV-infused oncology with no retail prescribing fall
out automatically). Derives each drug's generic name from Part D. Writes data/web/drug_map.csv
(the single source of truth the rest of the pipeline reads).

Matching is by the FIRST TOKEN of the brand name (so "Dupixent Pen"/"Dupixent Syringe" collapse to
"DUPIXENT"), which the loaders also use — robust to device-suffixed brands.

Inputs: data/op_gnrl_2024.csv, data/partd_full_2024.csv
Run: python3 scripts/select_drugs.py [N]   (default N=49 branded + metformin control)
"""
import csv, re, sys
from collections import defaultdict, Counter

csv.field_size_limit(1 << 24)
OP = "data/op_gnrl_2024.csv"
PARTD = "data/partd_full_2024.csv"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 49
MIN_PARTD_PRESCRIBERS = 500   # ensures the drug is actually filled at retail (not infused/vaccine)
_money = re.compile(r"[^0-9.\-]")

def tok(s):  # first token of the brand name, uppercased
    s = (s or "").strip().upper()
    return s.split(" ")[0] if s else ""

# 1) Open Payments: payment count + $ per brand token (drugs/biologicals only)
print("scanning Open Payments ...", flush=True)
op_count, op_dollars = defaultdict(int), defaultdict(float)
with open(OP, newline="", encoding="utf-8", errors="replace") as fh:
    r = csv.reader(fh); H = {n: i for i, n in enumerate(next(r))}
    NM = H["Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1"]
    IND = H["Indicate_Drug_or_Biological_or_Device_or_Medical_Supply_1"]
    AMT = H["Total_Amount_of_Payment_USDollars"]
    for row in r:
        ind = row[IND].strip().lower()
        if not (ind.startswith("drug") or ind.startswith("bio")):
            continue
        t = tok(row[NM])
        if not t:
            continue
        op_count[t] += 1
        try: op_dollars[t] += float(_money.sub("", row[AMT]) or 0)
        except ValueError: pass
candidates = {b for b, _ in sorted(op_count.items(), key=lambda x: -x[1])[:150]}
print(f"  {len(candidates)} candidate brands (top by payment count)", flush=True)

# 2) Part D: prescriber rows + claims + generic per candidate brand
print("scanning Part D ...", flush=True)
pd_presc, pd_clms, gen = defaultdict(int), defaultdict(int), defaultdict(Counter)
with open(PARTD, newline="", encoding="utf-8", errors="replace") as fh:
    r = csv.reader(fh); H = {n: i for i, n in enumerate(next(r))}
    BN, GN, TC = H["Brnd_Name"], H["Gnrc_Name"], H["Tot_Clms"]
    for row in r:
        t = tok(row[BN])
        if t not in candidates:
            continue
        pd_presc[t] += 1
        try: pd_clms[t] += int(float(row[TC] or 0))
        except ValueError: pass
        g = (row[GN] or "").strip().upper()
        if g: gen[t][g] += 1

# 3) eligible = promoted AND prescribed at retail; rank by promotion breadth (OP payment count)
elig = [b for b in candidates if pd_presc.get(b, 0) >= MIN_PARTD_PRESCRIBERS]
elig.sort(key=lambda b: -op_count[b])
sel = elig[:N]

import os
os.makedirs("data/web", exist_ok=True)
with open("data/web/drug_map.csv", "w", newline="") as o:
    w = csv.writer(o); w.writerow(["drug_key", "brnd_name", "gnrc_name", "match_on"])
    for b in sel:
        gname = gen[b].most_common(1)[0][0] if gen[b] else ""
        w.writerow([b.capitalize(), b, gname, "brand"])
    w.writerow(["Metformin", "", "METFORMIN HCL", "generic"])  # control

print(f"\nselected {len(sel)} branded + metformin -> data/web/drug_map.csv\n")
print(f"  {'drug':16}{'Part D prescribers':>20}{'OP payments':>14}  generic")
for b in sel:
    g = gen[b].most_common(1)[0][0] if gen[b] else "?"
    print(f"  {b.capitalize():16}{pd_presc[b]:>20,}{op_count[b]:>14,}  {g.lower()}")
