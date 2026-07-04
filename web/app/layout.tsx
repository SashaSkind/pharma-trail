import type { Metadata } from "next";
import { Newsreader, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Providers from "./providers";

// Type families, each with a job (see the design system): Newsreader for
// headlines, Public Sans (the USWDS/gov typeface) for UI, IBM Plex Mono for figures.
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});
const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pharma Trail — follow the money from drug makers to prescribers",
  description:
    "Search any US prescriber and see their pharma payments alongside their Medicare Part D prescribing — public CMS data.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${newsreader.variable} ${publicSans.variable} ${plexMono.variable}`}>
      <body>
        <header className="site-header">
          <div className="container" style={{ display: "flex", alignItems: "center", gap: 20, height: 60 }}>
            <Link href="/" style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
              <LogoMark />
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 18, letterSpacing: "-0.01em" }}>Pharma Trail</span>
            </Link>
            <nav style={{ display: "flex", gap: 20, marginLeft: "auto", fontSize: 14, fontWeight: 500 }} className="muted">
              <Link href="/" className="link">Search</Link>
              <Link href="/explore" className="link">Explore</Link>
              <Link href="/mcp" className="link">Use via AI</Link>
              <Link href="/about" className="link">About the method</Link>
            </nav>
          </div>
        </header>
        <main className="container" style={{ paddingTop: 40, paddingBottom: 72, minHeight: "70vh" }}>
          <Providers>{children}</Providers>
        </main>
        <footer style={{ borderTop: "1px solid var(--border)", padding: "22px 0", background: "var(--surface-card)" }}>
          <div className="container muted" style={{ fontSize: 12, lineHeight: 1.7 }}>
            Source: public CMS <b>Open Payments</b> (general payments) + <b>Medicare Part D Prescribers by Provider
            and Drug</b>, program year 2024. This site shows <b>correlation, not proof</b>{" "}that any payment changed an
            individual prescriber&apos;s decisions. Not medical or legal advice — talk to your own clinician.
          </div>
        </footer>
      </body>
    </html>
  );
}

// "The Signal" — a heartbeat resolving into a rising trail of data points, in a
// rounded blue tile: health → evidence. Trailing dots go red to echo the payment signal.
function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, borderRadius: 9, background: "var(--accent)",
        boxShadow: "var(--shadow-xs)", flex: "0 0 auto",
      }}
    >
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24" fill="none">
        <path
          d="M2 13h3l2-5 3 9 2.5-11 2 8 1.5-3H22"
          stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
        <circle cx="18.5" cy="6.5" r="1.9" fill="var(--paid-bright)" />
      </svg>
    </span>
  );
}
