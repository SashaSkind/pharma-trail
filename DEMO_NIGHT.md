# Pharma Trail — ClickHouse AI Demo Night (SF, July 1) · 7-minute run-of-show

**The audience is ClickHouse engineers at an *AI* night.** So the spine of the demo is:
*a visceral question → answered live by ClickHouse → that any AI can now ask itself.*

**The ONE lean-forward moment:** the **MCP** — connect Claude to ClickHouse and watch an AI write the
SQL, query 6M rows, and chart the kickback pattern on stage. AI + ClickHouse in one move. That's the
thing nobody else will show.

**The reliable backbone (if the AI moment ever stalls):** the `/explore` live aggregation — ClickHouse
re-computing paid-vs-unpaid over ~1.8M rows per request in ~100ms. Pure speed flex, never fails.

---

## Run-of-show (7:00)

### 0:00–0:45 — Hook (title slide only)
> "Quick show of hands — has anyone checked whether *your own doctor* takes money from drug companies?
> Both halves of this are already public: what your doctor gets *paid* (CMS Open Payments), and what
> they *prescribe* (Medicare Part D). But they sit in two separate government databases that nobody
> connects — so the one question that matters, *does your doctor prescribe more of the exact drug
> they're paid for?*, there's no way to ask it. That's what I built. And then I let an AI query it."

*(Accuracy note: do NOT say "no one can use the data" — CMS has a public payments search at
openpaymentsdata.cms.gov, and ProPublica's Dollars for Docs existed until 2019. The real gap is that
the two datasets aren't LINKED, and that you can't query it conversationally. Lead with linkage.)*

### 0:45–2:00 — The visceral demo (live app: search)
- Search the pre-picked doctor (see "Demo doctor" below).
- Land on their page: payments received + their prescribing vs **unpaid peers in the same specialty**.
> "Real physician, real public data. Paid $X for this drug — and prescribes N% more of it than peers
> who took nothing. You can look up literally any US prescriber."

### 2:00–3:30 — The big picture + the ClickHouse flex (`/explore`)
- Open `/explore`. Change the drug / specialty filter **live**.
> "This is the part ClickHouse people will care about: none of this is precomputed. Every time I
> change a filter, ClickHouse joins ~1.8M prescribing rows against the payments table and aggregates
> the paid-vs-unpaid lift **live, in about 100 milliseconds**. Postgres would choke; this is instant."
- Land on a strong drug (Jardiance): **paid prescribers write +57% more — and +49% even within
  the same specialty**, so it isn't specialty mix.

### 3:30–5:30 — THE WOW: ask an AI (the MCP)
> "Here's the part that still surprises me. I put a read-only **MCP server in front of ClickHouse**.
> So I can connect Claude — or ChatGPT — and just *ask*."
- In Claude, send the canned prompt (see below). Let it run **live**:
  - it calls `run_query`, writes SQL against ClickHouse, and **charts** the result.
> "I never told it the schema in the chat — the MCP *advertises* the schema and the 'use metformin as a
> control, compare within specialty' playbook to the model on connect. So any AI that connects becomes
> a pharma-data analyst for free."
- Punchline: point at metformin in the chart → "$0 in payments by design, and look — no effect. The
  control behaves exactly like a control."

### 5:30–6:30 — Tech slide + what was hard
- Show the **architecture slide** (below).
> "Two engines: **ClickHouse for OLAP** — the live aggregation and the MCP — and **Neon Postgres for
> OLTP**, the name search and per-doctor pages. The hardest part wasn't the dashboard; it was
> **linking two messy federal datasets** — matching a drug across Open Payments and Part D when one
> calls it 'Abilify Maintena' and the other 'ABILIFY', plus a generic fallback for the control. And
> building an MCP that's **self-describing**, because Claude reads the server instructions but ChatGPT
> doesn't — so the schema had to live in the tool definitions too."

### 6:30–7:00 — Close
> "All public CMS data. The app is free, the MCP is open, anyone can connect their own AI to it.
> It's correlation, not causation — manufacturers also court high prescribers — but the pattern is
> striking, and now it's one question away. **pharma-trail.vercel.app.** Thanks!"

---

## The tech slide (one slide, required)

**Pharma Trail — built on:**
- **ClickHouse Cloud** — OLAP: live ad-hoc aggregation (~100ms over ~6M rows) + the public MCP
- **Neon Postgres** — OLTP: trigram name search + per-doctor pages; MCP hosted on **Neon Functions**
- **Model Context Protocol** — custom TypeScript MCP, schema + analyst playbook baked in (Claude / ChatGPT / Cursor)
- **Next.js + Vercel** — the web app
- Data: **CMS Open Payments × Medicare Part D, 2024** — ~6M payments, ~2M prescribing rows, 50 drugs

*(One diagram: AI client → MCP → ClickHouse; Browser → Next.js → ClickHouse (explore) + Neon (pages). Reuse `data_architecture.html`.)*

---

## Canned Claude prompt (rehearse this exact one)
> Using pharma-trail: across the top 8 drugs by total payments plus Metformin as a control, compare
> average Medicare claims for paid vs unpaid prescribers, give the % lift, and chart paid vs unpaid by
> drug. Note the sample sizes and end with the correlation-not-causation caveat.

*(8 drugs, not 12 — faster to run on stage. Pre-run it once right before you go up so it's warm/cached.)*

---

## Demo doctor — finalists (within-specialty lift, matches what the app page shows)
Open each live, pick the cleanest-rendering page, then lock ONE.
- **David Brabham** — Cardiology, Amarillo TX. $6,390 Jardiance (7 events), 490 claims vs 58.9 unpaid peers = **+732%**. *(recommended: general cardiologist, believable payment, huge gap.)*
- **Nikhil Narang** — Cardiology, Evanston IL. $8,695 (9 events), 413 claims vs 58.9 = **+601%**.
- **Sachin Bahl** — Internal Medicine, Pittsburgh PA. $2,978 (18 events), 448 claims vs 53.4 = **+739%**. *("only paid $3k and look" angle.)*
- AVOID heart-failure cardiologists (Jardiance is a HF drug → "of course" → weak story).

## Pre-flight checklist (do in order)
**Days before**
- [ ] Lock the **demo doctor** (paid + clearly higher prescribing; verify the page looks clean).
- [ ] **Record a 90-sec screen capture** of the full flow (search → explore → MCP) as the fallback video.
- [ ] Build the 2 slides (title + tech). Export to PDF (works without internet).
- [ ] Confirm ChatGPT connector perms = **Allow read actions** (or just demo on Claude).
- [ ] Rehearse the whole thing to **under 6:30** out loud, 3×.

**On-site (arrive 5:45 for AV check)**
- [ ] Bring **USB-C → HDMI adapter** (they have HDMI/HDMI-C + backup laptop).
- [ ] Join wifi; open ALL tabs in order: title slide, doctor page, /explore, Claude (connector on).
- [ ] **Pre-warm**: load each page once; run the Claude prompt once (caches the ClickHouse query).
- [ ] **Extend the ClickHouse trial** beforehand so the instance is definitely live (form already submitted).
- [ ] Phone hotspot ready as wifi backup.
- [ ] Laptop charged + plugged in; notifications/Slack **Do Not Disturb**; browser zoom up for readability.

## Failure handling (say it smoothly, don't apologize)
- **MCP stalls / connector flakes** → "While that thinks, here's the same query I ran earlier" → switch
  to the **pre-made chart** (`paid_vs_unpaid.html`) or the fallback video. Keep talking.
- **ClickHouse slow / cold** → you already pre-warmed; if not, narrate the speed *number* from a warm tab.
- **Wifi dies** → fallback video + PDF slides cover the whole story offline.

## The numbers to know cold (verified live, 2024)
- Jardiance: paid **74.4** vs unpaid **47.3** claims = **+57%**; within-specialty **+49%** (n: 47k paid / 151k unpaid).
- Mounjaro **+44%**, Vraylar **+35%**, Dupixent **+18%**.
- **Metformin control: 0 paid prescribers** (generic, $0 by design) — the null result.
- Every branded drug in the top 12 shows a positive lift; the effect persists within specialty.
