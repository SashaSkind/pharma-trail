"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Hit = {
  npi: number; name: string | null; specialty: string | null;
  city: string | null; state: string | null; total_pay: number;
};

export default function SearchBox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setHits([]); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const j = await r.json();
        setHits(j.results ?? []);
        setOpen(true);
      } finally { setLoading(false); }
    }, 220);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return (
    <div style={{ position: "relative" }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        placeholder="Search a doctor by name… e.g. Smith"
        autoFocus
        style={{
          width: "100%", padding: "14px 16px", fontSize: 17, borderRadius: 12,
          background: "var(--panel)", border: "1px solid var(--border)", outline: "none",
        }}
      />
      {loading && <div className="muted" style={{ position: "absolute", right: 14, top: 16, fontSize: 13 }}>…</div>}
      {open && hits.length > 0 && (
        <div className="panel" style={{ position: "absolute", top: 56, left: 0, right: 0, zIndex: 10, overflow: "hidden" }}>
          {hits.map((h) => (
            <button
              key={h.npi}
              onClick={() => router.push(`/doctor/${h.npi}`)}
              style={{
                display: "flex", width: "100%", textAlign: "left", gap: 10, padding: "11px 14px",
                background: "transparent", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer",
              }}
            >
              <span style={{ flex: 1 }}>
                <b>{h.name ?? `NPI ${h.npi}`}</b>
                <span className="muted" style={{ fontSize: 13 }}>
                  {" "}— {h.specialty || "—"} · {[h.city, h.state].filter(Boolean).join(", ")}
                </span>
              </span>
              <span className={`pill ${h.total_pay > 0 ? "badge-paid" : "badge-unpaid"}`}
                style={{ flexShrink: 0, whiteSpace: "nowrap", alignSelf: "center" }}>
                {h.total_pay > 0 ? `$${Math.round(h.total_pay).toLocaleString()}` : "no payments"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
