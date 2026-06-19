import Link from "next/link";
import SearchBox from "./components/SearchBox";

export default function Home() {
  return (
    <div>
      <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, marginBottom: 10 }}>
        Does your doctor take money from drug companies?
      </h1>
      <p className="muted" style={{ fontSize: 17, maxWidth: 680, marginBottom: 24 }}>
        Search any US prescriber to see the industry payments they received and how their Medicare
        prescribing of those same drugs compares to <b>unpaid peers in the same specialty</b>. All
        from public CMS data.
      </p>

      <SearchBox />

      <div style={{ display: "flex", gap: 16, marginTop: 36, flexWrap: "wrap" }}>
        <Feature title="See the payments" body="How much, from which manufacturer, for which drug — across 50 top branded drugs (diabetes, immunology, psychiatry, cardiology & more)." />
        <Feature title="See the prescribing gap" body="Claims vs the average unpaid prescriber in the same specialty." />
        <Feature title="Compare alternatives" body="Other in-specialty prescribers and their payment transparency." />
      </div>

      <div className="panel" style={{ marginTop: 28, padding: 16 }}>
        <b>Want the big picture?</b>{" "}
        <Link href="/explore" className="accent">Explore the live data →</Link>
        <span className="muted"> — filter ~1.5M records and watch the payment-vs-prescribing pattern recompute in milliseconds.</span>
      </div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel" style={{ flex: "1 1 260px", padding: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div className="muted" style={{ fontSize: 14 }}>{body}</div>
    </div>
  );
}
