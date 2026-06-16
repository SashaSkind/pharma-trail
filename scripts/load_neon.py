#!/usr/bin/env python3
"""
load_neon.py — create the app schema in Neon and COPY the per-doctor CSVs in.

Reads NEON_DATABASE_URL from .env. Idempotent: drops + recreates the 4 tables each run.
Indexes are created AFTER the COPY (faster bulk load).

Input: data/web/{doctors,doctor_drug,doctor_drug_mfr,peer_benchmark}.csv  (build_doctor_db.py)
Run:   python3 scripts/load_neon.py
"""
import os, sys, psycopg2

WEB = "data/web"

def dsn():
    for line in open(".env"):
        if line.startswith("NEON_DATABASE_URL="):
            return line.strip().split("=", 1)[1]
    sys.exit("!! NEON_DATABASE_URL missing in .env")

DDL = """
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TABLE IF EXISTS doctors, doctor_drug, doctor_drug_mfr, peer_benchmark;

CREATE TABLE doctors (
  npi          BIGINT PRIMARY KEY,
  name         TEXT,
  specialty    TEXT,
  city         TEXT,
  state        TEXT,
  total_pay    NUMERIC DEFAULT 0,
  total_claims INT     DEFAULT 0
);

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
  pct_vs_unpaid   NUMERIC
);

CREATE TABLE doctor_drug_mfr (
  npi          BIGINT,
  drug_key     TEXT,
  manufacturer TEXT,
  amount       NUMERIC,
  n            INT
);

CREATE TABLE peer_benchmark (
  specialty TEXT, drug_key TEXT,
  paid_avg NUMERIC, unpaid_avg NUMERIC, n_paid INT, n_unpaid INT
);
"""

INDEXES = """
CREATE INDEX idx_doctors_name_trgm ON doctors USING gin (lower(name) gin_trgm_ops);
CREATE INDEX idx_doctors_specialty ON doctors (specialty);
ALTER TABLE doctor_drug ADD PRIMARY KEY (npi, drug_key);
CREATE INDEX idx_dd_similar ON doctor_drug (drug_key, specialty, pay_amount);
CREATE INDEX idx_ddm ON doctor_drug_mfr (npi, drug_key);
ALTER TABLE peer_benchmark ADD PRIMARY KEY (specialty, drug_key);
ANALYZE;
"""

COPIES = [
    ("doctors",         "doctors.csv"),
    ("doctor_drug",     "doctor_drug.csv"),
    ("doctor_drug_mfr", "doctor_drug_mfr.csv"),
    ("peer_benchmark",  "peer_benchmark.csv"),
]

def main():
    for _, fn in COPIES:
        if not os.path.exists(f"{WEB}/{fn}"):
            sys.exit(f"!! {WEB}/{fn} not found — run build_doctor_db.py first")
    c = psycopg2.connect(dsn()); c.autocommit = False
    cur = c.cursor()
    print("   creating schema ...")
    cur.execute(DDL); c.commit()
    for table, fn in COPIES:
        print(f"   COPY {fn} -> {table} ...", flush=True)
        with open(f"{WEB}/{fn}") as f:
            cur.copy_expert(
                f"COPY {table} FROM STDIN WITH (FORMAT csv, HEADER true, NULL '')", f)
        c.commit()
    print("   building indexes ...")
    cur.execute(INDEXES); c.commit()

    print("\n   row counts:")
    for table, _ in COPIES:
        cur.execute(f"SELECT count(*) FROM {table}")
        print(f"     {table:18} {cur.fetchone()[0]:,}")
    c.close()
    print("\n   Neon load complete.")

if __name__ == "__main__":
    main()
