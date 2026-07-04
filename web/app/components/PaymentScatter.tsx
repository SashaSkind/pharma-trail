"use client";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Event = { date: string; amount: number; manufacturer: string; drug: string };

const DRUG_COLOR: Record<string, string> = {
  ELIQUIS: "#2f6feb", XARELTO: "#7c5cff", OZEMPIC: "#e6a817", HUMIRA: "#dc3f45",
};

export default function PaymentScatter({ events }: { events: Event[] }) {
  if (!events.length) return null;
  // x = chronological event #, y = $ amount
  const data = events.map((e, i) => ({
    i: i + 1, amount: e.amount, drug: (e.drug || "").toUpperCase(),
    manufacturer: e.manufacturer, date: e.date,
  }));
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ left: 8, right: 16, top: 12, bottom: 16 }}>
          <XAxis type="number" dataKey="i" name="event" stroke="#5b6673" fontSize={12}
            label={{ value: "payment event #", position: "insideBottom", offset: -6, fill: "#5b6673", fontSize: 12 }} />
          <YAxis type="number" dataKey="amount" name="amount" stroke="#5b6673" fontSize={12}
            tickFormatter={(v) => `$${v}`} />
          <ZAxis range={[60, 60]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as (typeof data)[0] | undefined;
              if (!p) return null;
              return (
                <div style={{ background: "#ffffff", border: "1px solid #e4e7ec", borderRadius: 8, padding: "8px 10px", fontSize: 12, boxShadow: "0 4px 12px rgba(11,14,20,0.08)" }}>
                  <div><b>${p.amount.toLocaleString()}</b> · {p.drug}</div>
                  <div className="muted">{p.manufacturer}</div>
                  <div className="muted">{p.date}</div>
                </div>
              );
            }}
          />
          <Scatter data={data}>
            {data.map((d, i) => <Cell key={i} fill={DRUG_COLOR[d.drug] ?? "#5b6673"} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
