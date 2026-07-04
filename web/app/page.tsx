import Link from "next/link";
import SearchBox from "./components/SearchBox";

export default function Home() {
  return (
    <div>
      {/* ---- Hero: the search bar, front and center ---- */}
      <section style={{ textAlign: "center", padding: "24px 0 8px" }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Public CMS data · program year 2024</div>
        <h1 style={{ fontSize: 44, lineHeight: 1.1, margin: "0 auto 16px", maxWidth: 760 }}>
          Does your doctor take money from drug companies?
        </h1>
        <p className="muted" style={{ fontSize: 18, lineHeight: 1.55, maxWidth: 620, margin: "0 auto 28px" }}>
          Search any US prescriber to see the industry payments they received and how their Medicare
          prescribing of those same drugs compares to <b style={{ color: "var(--text)" }}>unpaid peers in the
          same specialty</b>.
        </p>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <SearchBox />
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 12 }}>
          Try a common last name like <span className="mono">Smith</span> — then pick your doctor.
        </div>
      </section>

      {/* ---- The graphs, explained ---- */}
      <section style={{ marginTop: 72 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>What you&apos;ll see</div>
        <h2 style={{ fontSize: 28, margin: "0 0 24px" }}>The graphs, explained</h2>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <Explainer
            marker="💵"
            title="The payments"
            body="How much your doctor received, from which manufacturer, for which of 50 top branded drugs — diabetes, immunology, psychiatry, cardiology and more."
          />
          <Explainer
            marker="▲"
            title="The prescribing gap"
            body="Their Medicare Part D claims for a paid drug, next to the average unpaid prescriber in the same specialty. A red ▲ means they prescribe more than clean peers."
          />
          <Explainer
            marker="✓"
            title="Lower-conflict alternatives"
            body="Other in-specialty prescribers of the same drug, ranked by least industry money first — for transparency, not a recommendation to switch."
          />
        </div>
      </section>

      {/* ---- Explore CTA (ink panel) ---- */}
      <section style={{ marginTop: 40 }}>
        <div className="panel ink" style={{ padding: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 8, color: "var(--text-muted-on-ink)" }}>The big picture</div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px" }}>
              <h2 style={{ fontSize: 24, margin: "0 0 6px", color: "#fff" }}>Explore the pattern across every drug</h2>
              <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
                Filter ~1.5M prescriber records and watch the payment-vs-prescribing pattern recompute in
                milliseconds — live, over the raw data.
              </p>
            </div>
            <Link href="/explore" className="btn btn-primary">Explore the live data →</Link>
          </div>
        </div>
      </section>

      {/* ---- Health close ---- */}
      <section style={{ margin: "64px auto 8px", maxWidth: 640, textAlign: "center" }}>
        <p className="serif" style={{ fontSize: 26, lineHeight: 1.4, fontStyle: "italic", color: "var(--ink)" }}>
          Maybe you&apos;ve never thought about any of this.{" "}
          <span style={{ color: "var(--accent)" }}>Now is the time to take care of your health.</span>
        </p>
        <p className="muted" style={{ fontSize: 14, marginTop: 14, lineHeight: 1.6 }}>
          This is public, observational data — it shows correlation, not proof that any single payment changed a
          decision. Bring what you find to a conversation with your own clinician.
        </p>
      </section>
    </div>
  );
}

function Explainer({ marker, title, body }: { marker: string; title: string; body: string }) {
  return (
    <div className="panel card-hover" style={{ padding: 20 }}>
      <div style={{ fontSize: 20, marginBottom: 10 }} aria-hidden>{marker}</div>
      <div className="serif" style={{ fontWeight: 600, fontSize: 18, marginBottom: 6 }}>{title}</div>
      <div className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}
