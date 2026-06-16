"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

type Band = { pay_band: string; n: number; avg_claims: number };
const LABELS: Record<string, string> = {
  "0 $0": "$0", "1 <$100": "<$100", "2 $100-1k": "$100–1k", "3 $1k-10k": "$1k–10k", "4 $10k+": "$10k+",
};

export default function ExploreChart({ bands }: { bands: Band[] }) {
  const data = bands.map((b) => ({ band: LABELS[b.pay_band] ?? b.pay_band, avg: b.avg_claims, n: b.n }));
  if (!data.length) return <div className="muted">No prescribers match these filters.</div>;
  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 4, right: 16, top: 24, bottom: 4 }}>
          <XAxis dataKey="band" stroke="#8a98ac" fontSize={13} />
          <YAxis stroke="#8a98ac" fontSize={12} label={{ value: "avg claims", angle: -90, position: "insideLeft", fill: "#8a98ac", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: "#1a212e", border: "1px solid #243044", borderRadius: 8 }}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            labelFormatter={(l) => `Payment band: ${l}`}
          />
          <Bar dataKey="avg" radius={[5, 5, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.band === "$0" ? "#5ec8a0" : "#4f9dff"} />)}
            <LabelList dataKey="avg" position="top" fill="#e6edf6" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
