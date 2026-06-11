-- 01_create_raw.sql
-- Raw landing tables for the two federal datasets, already typed.
-- The dollar field in Open Payments is TEXT in the source CSV; we cast it to Float64
-- during load (see scripts/load_clickhouse.sh), so payments_raw.amount is numeric here.
--
-- Paste this whole file into the ClickHouse Cloud console.

CREATE DATABASE IF NOT EXISTS rx;

-- Open Payments — General Payments Detail (only the ~13 columns we use, not all 91).
DROP TABLE IF EXISTS rx.payments_raw;
CREATE TABLE rx.payments_raw
(
    npi            UInt64,
    recipient_type LowCardinality(String),
    specialty      LowCardinality(String),
    amount         Float64,                 -- cast from TEXT on load
    nature         LowCardinality(String),
    manufacturer   String,
    drug1          String,
    drug2          String,
    drug3          String,
    drug4          String,
    drug5          String,
    program_year   UInt16,
    payment_date   Date
)
ENGINE = MergeTree
ORDER BY (npi, program_year);

-- Medicare Part D — Prescribers by Provider and Drug.
DROP TABLE IF EXISTS rx.partd_raw;
CREATE TABLE rx.partd_raw
(
    npi          UInt64,
    specialty    LowCardinality(String),
    brnd_name    String,
    gnrc_name    String,
    tot_clms     UInt32,
    tot_benes    UInt32,
    tot_drug_cst Float64,
    year         UInt16
)
ENGINE = MergeTree
ORDER BY (npi, brnd_name);
