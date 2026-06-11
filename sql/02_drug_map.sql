-- 02_drug_map.sql
-- The 5-row scope lookup. Branded drugs match on brand name; metformin (control)
-- matches on generic name. brnd_name is intentionally empty for the control so it
-- can NEVER match a payment row (payments only join on brnd_name) — that's the
-- integrity check: metformin must end up with zero payment matches.
--
-- Paste into the ClickHouse Cloud console after 01_create_raw.sql.

DROP TABLE IF EXISTS rx.drug_map;
CREATE TABLE rx.drug_map
(
    drug_key  String,
    brnd_name String,
    gnrc_name String,
    match_on  Enum8('brand' = 1, 'generic' = 2)
)
ENGINE = MergeTree ORDER BY drug_key;   -- TinyLog is rejected on ClickHouse Cloud (Shared DB)

INSERT INTO rx.drug_map VALUES
    ('Eliquis',   'ELIQUIS', 'APIXABAN',      'brand'),
    ('Xarelto',   'XARELTO', 'RIVAROXABAN',   'brand'),
    ('Humira',    'HUMIRA',  'ADALIMUMAB',    'brand'),
    ('Ozempic',   'OZEMPIC', 'SEMAGLUTIDE',   'brand'),
    ('Metformin', '',        'METFORMIN HCL', 'generic');

-- Sanity: should return 5 rows, exactly 1 with match_on='generic' and empty brnd_name.
-- SELECT * FROM rx.drug_map ORDER BY drug_key;
