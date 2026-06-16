import Link from "next/link";
import { notFound } from "next/navigation";
import { getDoctor, getSimilar } from "@/lib/db";
import { DRUG_META } from "@/lib/drugs";
import BiasChart from "../../components/BiasChart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const num = (v: unknown) => (v == null ? 0 : Number(v));

export default async function DoctorPage({ params }: { params: Promise<{ npi: string }> }) {
  const { npi } = await params;
  const data = await getDoctor(Number(npi));
  if (!data) return notFound();
  const { doctor, drugs, manufacturers } = data;

  const totalPay = num(doctor.total_pay);
  // primary drug = the one they were paid most for (else most prescribed)
  const primary = [...drugs].sort((a, b) => num(b.pay_amount) - num(a.pay_amount) || num(b.claims) - num(a.claims))[0];
  const similar =
    primary && doctor.specialty
      ? await getSimilar(doctor.specialty, primary.drug_key, doctor.npi, 12)
      : [];

  const mfrByDrug: Record<string, { manufacturer: string; amount: number }[]> = {};
  for (const m of manufacturers) {
    (mfrByDrug[m.drug_key] ??= []).push({ manufacturer: m.manufacturer, amount: num(m.amount) });
  }

  return (
    <div>
      <Link href="/" className="muted" style={{ fontSize: 13 }}>← search</Link>

      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "10px 0 2px" }}>{doctor.name ?? `NPI ${doctor.npi}`}</h1>
      <div className="muted" style={{ marginBottom: 18 }}>
        {doctor.specialty || "Specialty unknown"} · {[doctor.city, doctor.state].filter(Boolean).join(", ") || "—"} ·
        NPI {doctor.npi}
      </div>

      {/* payments */}
      <div className="panel" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 15, marginBottom: 4 }}>
          {totalPay > 0 ? (
            <>💵 Received <b className="up">{money(totalPay)}</b> in industry payments for these drugs (2023)</>
          ) : (
            <>✅ <b className="down">No industry payments</b> recorded for these drugs (2023)</>
          )}
        </div>
        {drugs.filter((d) => num(d.pay_amount) > 0).map((d) => (
          <div key={d.drug_key} style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            <b>{d.drug_key}</b> <span className="muted">{DRUG_META[d.drug_key]?.generic}</span>
            <span style={{ float: "right" }} className="up">{money(num(d.pay_amount))}</span>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              from {(mfrByDrug[d.drug_key] ?? []).map((m) => m.manufacturer).join(", ") || "—"}
            </div>
          </div>
        ))}
      </div>

      {/* prescribing vs peers */}
      <div className="panel" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Prescribing vs unpaid peers (same specialty)</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Medicare Part D claims for each drug, next to the average <i>unpaid</i> {doctor.specialty || "peer"}.
        </div>
        {drugs.filter((d) => num(d.claims) > 0).map((d) => {
          const pct = d.pct_vs_unpaid == null ? null : Number(d.pct_vs_unpaid);
          return (
            <div key={d.drug_key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <span style={{ width: 90 }}><b>{d.drug_key}</b></span>
              <span style={{ width: 120 }}>{num(d.claims).toLocaleString()} claims</span>
              <span className="muted" style={{ width: 150, fontSize: 13 }}>
                peer avg {Math.round(num(d.peer_unpaid_avg))}
              </span>
              {pct != null && (
                <span className={pct >= 0 ? "up" : "down"} style={{ fontWeight: 700 }}>
                  {pct >= 0 ? "▲ +" : "▼ "}{pct}% vs unpaid
                </span>
              )}
            </div>
          );
        })}
        <div style={{ marginTop: 14 }}>
          <BiasChart rows={drugs.map((d) => ({ drug_key: d.drug_key, claims: num(d.claims), peer_unpaid_avg: num(d.peer_unpaid_avg) }))} />
        </div>
      </div>

      {/* alternatives */}
      {similar.length > 0 && primary && (
        <div className="panel" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>
            Other {doctor.specialty} prescribers of {primary.drug_key}
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Sorted by least industry money first — for transparency, not a recommendation to switch.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr 0.9fr", gap: 6, fontSize: 14 }}>
            <div className="muted">Name</div><div className="muted">City</div>
            <div className="muted">Claims</div><div className="muted">Paid?</div>
            {similar.map((s) => (
              <DoctorRowCells key={s.npi} npi={s.npi} name={s.name} city={[s.city, s.state].filter(Boolean).join(", ")}
                claims={num(s.claims)} pay={num(s.pay_amount)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DoctorRowCells({ npi, name, city, claims, pay }:
  { npi: number; name: string | null; city: string; claims: number; pay: number }) {
  return (
    <>
      <Link href={`/doctor/${npi}`} className="accent" style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
        {name ?? `NPI ${npi}`}
      </Link>
      <div className="muted" style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>{city || "—"}</div>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>{claims.toLocaleString()}</div>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
        {pay > 0 ? <span className="up">${Math.round(pay).toLocaleString()}</span> : <span className="down">none ✓</span>}
      </div>
    </>
  );
}
