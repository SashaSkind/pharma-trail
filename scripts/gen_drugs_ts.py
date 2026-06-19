#!/usr/bin/env python3
"""gen_drugs_ts.py — generate web/lib/drugs.ts from data/web/drug_map.csv (source of truth)."""
import csv
rows = list(csv.DictReader(open("data/web/drug_map.csv")))
branded = [r for r in rows if r["match_on"] == "brand"]
control = [r for r in rows if r["match_on"] == "generic"]
keys = [r["drug_key"] for r in branded] + [r["drug_key"] for r in control]

out = ["// AUTO-GENERATED from data/web/drug_map.csv by scripts/gen_drugs_ts.py — do not edit by hand.",
       f"// {len(branded)} branded drugs + metformin control.",
       "export const DRUGS = [",
       "  " + ", ".join(f'"{k}"' for k in keys) + ",",
       "] as const;",
       "export type DrugKey = (typeof DRUGS)[number];",
       "",
       "export const DRUG_META: Record<string, { label: string; generic: string; control?: boolean }> = {"]
for r in branded + control:
    g = r["gnrc_name"].lower().replace('"', "").replace("\\", "")
    if r["match_on"] == "generic":
        out.append(f'  "{r["drug_key"]}": {{ label: "{r["drug_key"]}", generic: "generic — control (no payments)", control: true }},')
    else:
        out.append(f'  "{r["drug_key"]}": {{ label: "{r["drug_key"]}", generic: "{g}" }},')
out += ["};", "", "export const DATA_YEAR = 2024; // program year currently loaded", ""]
open("web/lib/drugs.ts", "w").write("\n".join(out))
print(f"wrote web/lib/drugs.ts with {len(keys)} drugs")
