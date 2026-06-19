#!/usr/bin/env python3
"""
filter_partd_csv.py — stream the full Part D 2024 CSV, keep only rows for the scoped drugs
(first-token brand match for branded drugs + generic match for the metformin control), and
batch-insert the raw rows into rx.partd_raw. The scoped tables derive drug_key via drug_map.

Reads the drug list from data/web/drug_map.csv (the single source of truth).
Inputs: data/partd_full_2024.csv. Env: CH_HOST/CH_USER/CH_PASSWORD.
Run: python3 scripts/filter_partd_csv.py
"""
import os, sys, csv, re, time
import clickhouse_connect

csv.field_size_limit(1 << 24)
PARTD = os.environ.get("PARTD_CSV", "data/partd_full_2024.csv")
YEAR = 2024
BATCH = 25000
_money = re.compile(r"[^0-9.\-]")

def f(s):
    if not s: return 0.0
    s = _money.sub("", s)
    try: return float(s) if s not in ("", "-", ".") else 0.0
    except ValueError: return 0.0
def i(s):
    if not s: return 0
    try: return int(float(s))
    except ValueError: return 0
def tok(s): s = (s or "").strip().upper(); return s.split(" ")[0] if s else ""

def main():
    for line in open(".env"):
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1); os.environ.setdefault(k, v)
    # drug set from drug_map.csv
    BRANDS, GENERICS = set(), set()
    for row in csv.DictReader(open("data/web/drug_map.csv")):
        if row["match_on"] == "brand" and row["brnd_name"]:
            BRANDS.add(row["brnd_name"].upper())
        elif row["match_on"] == "generic" and row["gnrc_name"]:
            GENERICS.add(row["gnrc_name"].upper())
    print(f"   {len(BRANDS)} branded + {len(GENERICS)} generic-matched drugs")

    def mk():
        return clickhouse_connect.get_client(
            host=os.environ["CH_HOST"], port=8443, secure=True,
            username=os.environ["CH_USER"], password=os.environ["CH_PASSWORD"],
            connect_timeout=30, send_receive_timeout=300)
    c = mk()
    cols = ["npi","specialty","brnd_name","gnrc_name","tot_clms","tot_benes","tot_drug_cst","year"]
    def ins(rows):
        nonlocal c
        for a in range(1, 6):
            try: c.insert("rx.partd_raw", rows, column_names=cols); return
            except Exception as e:
                print(f"   retry {a}: {str(e)[:45]}", flush=True); time.sleep(2*a)
                try: c = mk()
                except Exception: pass
        raise RuntimeError("partd batch failed")

    if os.environ.get("APPEND") == "1":
        c.command(f"ALTER TABLE rx.partd_raw DELETE WHERE year={YEAR}")
    else:
        c.command("TRUNCATE TABLE IF EXISTS rx.partd_raw")

    fh = open(PARTD, newline="", encoding="utf-8", errors="replace")
    r = csv.reader(fh); H = {n: j for j, n in enumerate(next(r))}
    NPI, TYP, BN, GN = H["Prscrbr_NPI"], H["Prscrbr_Type"], H["Brnd_Name"], H["Gnrc_Name"]
    TC, TB, TD = H["Tot_Clms"], H["Tot_Benes"], H["Tot_Drug_Cst"]
    batch, scanned, kept = [], 0, 0
    for row in r:
        scanned += 1
        if scanned % 5_000_000 == 0: print(f"   scanned {scanned:,} ... kept {kept:,}", flush=True)
        gn = (row[GN] or "").strip().upper()
        if tok(row[BN]) not in BRANDS and gn not in GENERICS:
            continue
        npi = i(row[NPI])
        if not npi: continue
        batch.append([npi, row[TYP] or "", row[BN] or "", row[GN] or "",
                      i(row[TC]), i(row[TB]), f(row[TD]), YEAR])
        kept += 1
        if len(batch) >= BATCH: ins(batch); batch = []
    if batch: ins(batch)
    fh.close()
    tot = c.query("SELECT count(), uniqExact(npi) FROM rx.partd_raw").result_rows[0]
    print(f"\n   scanned {scanned:,}, kept {kept:,}  ->  rx.partd_raw: {tot[0]:,} rows, {tot[1]:,} NPIs")

if __name__ == "__main__":
    main()
