import Link from "next/link";

export const metadata = { title: "Use Pharma Trail from any AI (MCP) — Pharma Trail" };

const MCP_URL = "https://br-wild-smoke-ajj9b4o9-mcp.compute.c-3.us-east-2.aws.neon.tech/mcp";

const code: React.CSSProperties = {
  display: "block", background: "var(--panel-2)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "10px 12px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 13, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: "6px 0",
};

export default function McpPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <Link href="/" className="muted" style={{ fontSize: 13 }}>← search</Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "10px 0 6px" }}>Use it from any AI (MCP)</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Pharma Trail exposes its data through a <b>read-only MCP server</b>. MCP is an open standard,
        so you can connect any MCP-capable assistant — <b>Claude</b>, <b>ChatGPT</b>, <b>Cursor</b>,
        <b> VS&nbsp;Code Copilot</b>, and others — to the live dataset and ask in plain English. It
        writes the SQL, runs it, and builds charts. Same public CMS data as the site.
      </p>

      <div className="panel" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Endpoint</div>
        <code style={code}>{MCP_URL}</code>
        <div className="muted" style={{ fontSize: 13 }}>
          Streamable HTTP transport · read-only · no credentials needed · public data.
        </div>
      </div>

      <div className="panel" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Connect</div>

        <div style={{ marginBottom: 12 }}>
          <b>Any MCP client</b>
          <div className="muted" style={{ fontSize: 14 }}>
            Add a custom / remote MCP server and paste the endpoint URL above (transport: <i>HTTP</i> /
            Streamable HTTP). No API key — it’s public and read-only.
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <b>Claude Code</b>
          <code style={code}>claude mcp add --transport http pharma-trail {MCP_URL}</code>
        </div>

        <div style={{ marginBottom: 12 }}>
          <b>Claude Desktop / claude.ai</b>
          <div className="muted" style={{ fontSize: 14 }}>
            Settings → Connectors → Add custom connector → paste the URL → enable Artifacts (for charts).
            (Custom connectors need a paid Claude plan.)
          </div>
        </div>

        <div>
          <b>ChatGPT / Cursor / VS Code</b>
          <div className="muted" style={{ fontSize: 14 }}>
            Add it as a remote MCP server in the app’s connector/MCP settings and paste the URL.
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Things to ask</div>
        <ul className="muted" style={{ fontSize: 14, lineHeight: 1.9, margin: 0, paddingLeft: 18 }}>
          <li>“Look up Dr. John Smith — payments and prescribing vs unpaid peers.”</li>
          <li>“For each drug, average claims for paid vs unpaid prescribers — and chart it.”</li>
          <li>“Top 10 cardiologists by Eliquis payments, with their claim counts.”</li>
          <li>“Show the Ozempic payment dose-response and confirm metformin has zero payments.”</li>
          <li>“Which manufacturers paid the most for Xarelto?”</li>
        </ul>
      </div>

      <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
        The server exposes read-only tools (<code style={{ ...code, display: "inline", padding: "1px 5px" }}>run_query</code>,
        <code style={{ ...code, display: "inline", padding: "1px 5px" }}>find_doctor</code>,
        <code style={{ ...code, display: "inline", padding: "1px 5px" }}>list_tables</code>) over the{" "}
        <code style={{ ...code, display: "inline", padding: "1px 5px" }}>rx</code> database, and ships
        schema + charting instructions on connect. It cannot write or modify anything.
      </div>
    </div>
  );
}
