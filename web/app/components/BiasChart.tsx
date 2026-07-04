"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Row = { drug_key: string; claims: number; peer_unpaid_avg: number | null };

export default function BiasChart({ rows }: { rows: Row[] }) {
  const data = rows
    .filter((r) => r.claims > 0)
    .map((r) => ({
      drug: r.drug_key,
      "This doctor": r.claims,
      "Unpaid peer avg": Number(r.peer_unpaid_avg ?? 0),
    }));
  if (!data.length) return null;
  return (
    <div style={{ width: "100%", height: 60 + data.length * 64 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 24, top: 8, bottom: 8 }}>
          <XAxis type="number" stroke="#5b6673" fontSize={12} />
          <YAxis type="category" dataKey="drug" stroke="#5b6673" fontSize={13} width={78} />
          <Tooltip
            contentStyle={{ background: "#ffffff", border: "1px solid #e4e7ec", borderRadius: 8, boxShadow: "0 4px 12px rgba(11,14,20,0.08)" }}
            cursor={{ fill: "rgba(11,14,20,0.04)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="This doctor" fill="#2f6feb" radius={[0, 4, 4, 0]} />
          <Bar dataKey="Unpaid peer avg" fill="#1f9d70" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
