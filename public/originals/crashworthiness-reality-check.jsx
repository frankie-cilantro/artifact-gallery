import { useState } from "react";
import { createRoot } from "react-dom/client";

// ─────────────────────────────────────────────────────────────────────────────
// Data — exported verbatim from the vehicle safety analytics pipeline
// (pipeline/outputs/, run 2026-07-26). Sources: IIHS driver death rates
// (MY2002–MY2020 cycles), IIHS crashworthiness ratings, FARS 2015–2023,
// CRSS 2016–2023 (survey-weighted), vPIC VIN decoding.
// ─────────────────────────────────────────────────────────────────────────────

const GATES = [
  { id: 1, label: "Fleet average, MY2020", computed: "38", target: "38", pass: true,
    note: "Exposure-weighted death rate per million registered vehicle years, reproduced exactly from IIHS published totals." },
  { id: 1, label: "Fleet average, MY2017", computed: "36", target: "36", pass: true,
    note: "Same check, prior study cycle. Also exact." },
  { id: 2, label: "Class mean: minicars", computed: "153", target: "153", pass: true,
    note: "MY2020 minicar class mean matches IIHS's published figure." },
  { id: 3, label: "Side rating ≈70% effect", computed: "not reproducible", target: "−70%", pass: false,
    note: "The published Good-vs-Poor side effect was measured on 2000s fleets. In MY2017/MY2020, 188 rated vehicles include exactly ONE Poor — the contrast no longer exists in the data." },
  { id: 4, label: "Placebo: side → frontal", computed: "p ≈ 2×10⁻⁶", target: "no effect", pass: false,
    note: "A side rating should not predict frontal survival. It does — strongly. That means residual confounding, not physics." },
];

// share of fleet rated "Good", per test and rating cohort (ceiling_diagnostic.csv)
const CEILING = [
  { test: "Moderate overlap front", y2017: 100.0, y2020: 100.0 },
  { test: "Side (original)",        y2017: 96.1,  y2020: 99.1 },
  { test: "Head restraints",        y2017: 98.6,  y2020: 97.2 },
  { test: "Roof strength",          y2017: 95.9,  y2020: 97.3 },
  { test: "Small overlap driver",   y2017: 50.7,  y2020: 80.7 },
  { test: "Small overlap passenger",y2017: 28.0,  y2020: 72.4 },
  { test: "Side (updated, 2021+)",  y2017: 22.2,  y2020: 21.4 },
];
const CEILING_CUT = 90;

// incremental R² blocks (variance_decomposition.csv), n = 145 rated nameplates
const VARIANCE = [
  { block: "Vehicle class", r2: 43.4, cum: 43.4,
    note: "What kind of vehicle it is — minicar vs large SUV — explains 43.4% of the variance in log death rates on its own." },
  { block: "+ Luxury flag", r2: 0.0, cum: 43.4,
    note: "Luxury adds nothing once class is in (luxury classes are already separate classes)." },
  { block: "+ Crashworthiness ratings", r2: 1.4, cum: 44.7,
    note: "The composite IIHS rating adds 1.4 points of R² on top of class. This is the headline." },
];

// conditional survival model, logit P(driver death | crash involvement)
// coefficient per rating step (Good=4 … Poor=1), from survival_model.csv
const FOREST = [
  { term: "Small overlap (driver) → frontal crashes", coef: 0.007, lo: -0.108, hi: 0.121, p: 0.91, n: 15168, placebo: false },
  { term: "Small overlap (passenger) → frontal crashes", coef: 0.014, lo: -0.035, hi: 0.062, p: 0.58, n: 15168, placebo: false },
  { term: "Updated side → left-side crashes", coef: 0.084, lo: -0.084, hi: 0.253, p: 0.33, n: 1106, placebo: false },
  { term: "Updated side → FRONTAL crashes (placebo)", coef: -0.146, lo: -0.206, hi: -0.087, p: 2e-6, n: 8485, placebo: true },
  { term: "Small overlap (driver) → left-side (placebo)", coef: 0.018, lo: -0.515, hi: 0.551, p: 0.95, n: 1946, placebo: true },
  { term: "Small overlap (passenger) → left-side (placebo)", coef: 0.043, lo: -0.093, hi: 0.179, p: 0.54, n: 1946, placebo: true },
];

// Kendall τ between adjacent study cycles (persistence.csv)
const PERSIST = [
  { pair: "2002→04", tau: 0.66 }, { pair: "2004→08", tau: 0.44 },
  { pair: "2008→11", tau: 0.09 }, { pair: "2011→14", tau: 0.31 },
  { pair: "2014→17", tau: 0.60 }, { pair: "2017→20", tau: 0.56 },
];

// ─── palette (validated: dataviz six-checks, dark surface #0c0f1a) ───────────
const C = {
  surface: "#0c0f1a", panel: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.06)",
  ink: "#e5e7eb", ink2: "#9ca3af", ink3: "#6b7280",
  blue: "#3987e5", orange: "#d95926",
  good: "#0ca30c", critical: "#d03b3b",
  grid: "rgba(255,255,255,0.07)",
};
const MONO = "'DM Mono', ui-monospace, monospace";

// ─── tiny shared tooltip ─────────────────────────────────────────────────────
function useTip() {
  const [tip, setTip] = useState(null);
  const show = (e, content) => {
    const r = e.currentTarget.closest(".chart-wrap").getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, content });
  };
  return { tip, show, hide: () => setTip(null) };
}

function Tip({ tip }) {
  if (!tip) return null;
  return (
    <div style={{
      position: "absolute", left: Math.min(tip.x + 12, 560), top: tip.y + 12,
      background: "#171c2e", border: `1px solid ${C.border}`, borderRadius: 6,
      padding: "8px 10px", fontSize: 12.5, color: C.ink, pointerEvents: "none",
      maxWidth: 260, lineHeight: 1.45, zIndex: 5, boxShadow: "0 4px 16px rgba(0,0,0,.5)",
    }}>{tip.content}</div>
  );
}

// ─── layout bits ─────────────────────────────────────────────────────────────
function Section({ kicker, title, children, lead }) {
  return (
    <section style={{ margin: "56px 0" }}>
      <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.12em",
        textTransform: "uppercase", color: C.blue, marginBottom: 8 }}>{kicker}</div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: C.ink, marginBottom: 10,
        letterSpacing: "-0.01em" }}>{title}</h2>
      {lead && <p style={{ color: C.ink2, maxWidth: 640, lineHeight: 1.6, marginBottom: 20 }}>{lead}</p>}
      {children}
    </section>
  );
}

function Panel({ children, pad = 20 }) {
  return (
    <div className="chart-wrap" style={{ position: "relative", background: C.panel,
      border: `1px solid ${C.border}`, borderRadius: 10, padding: pad, overflowX: "auto" }}>
      {children}
    </div>
  );
}

// ─── gates ───────────────────────────────────────────────────────────────────
function GateTiles() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
      {GATES.map((g, i) => (
        <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`,
          borderTop: `2px solid ${g.pass ? C.good : C.critical}`, borderRadius: 8, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span aria-hidden="true" style={{ color: g.pass ? C.good : C.critical, fontSize: 13 }}>
              {g.pass ? "✓" : "✕"}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.ink3 }}>
              GATE {g.id} · {g.pass ? "PASS" : "FAIL"}</span>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, marginBottom: 6 }}>{g.label}</div>
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.ink2, marginBottom: 8 }}>
            {g.computed} <span style={{ color: C.ink3 }}>vs {g.target}</span></div>
          <div style={{ fontSize: 12, color: C.ink3, lineHeight: 1.5 }}>{g.note}</div>
        </div>
      ))}
    </div>
  );
}

// ─── ceiling chart: paired horizontal bars vs the 90% line ──────────────────
function CeilingChart() {
  const { tip, show, hide } = useTip();
  const W = 640, rowH = 44, padL = 190, padR = 46, padT = 26, padB = 8;
  const H = padT + CEILING.length * rowH + padB;
  const x = (v) => padL + (v / 100) * (W - padL - padR);
  return (
    <Panel>
      <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 12, color: C.ink2 }}>
        <span><span style={sw(C.blue)} /> MY2020 cohort</span>
        <span><span style={sw("#86b6ef")} /> MY2017 cohort</span>
        <span style={{ color: C.ink3 }}>┊ 90% = test excluded as non-discriminating</span>
      </div>
      <svg width={W} height={H} style={{ minWidth: 560, display: "block" }} role="img"
        aria-label="Share of fleet rated Good per IIHS test">
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={padT - 8} y2={H - padB} stroke={C.grid} />
            <text x={x(v)} y={padT - 12} fontSize="10.5" fill={C.ink3} textAnchor="middle"
              fontFamily={MONO}>{v}%</text>
          </g>
        ))}
        <line x1={x(CEILING_CUT)} x2={x(CEILING_CUT)} y1={padT - 8} y2={H - padB}
          stroke={C.orange} strokeDasharray="3 4" strokeWidth="1.5" />
        {CEILING.map((d, i) => {
          const y0 = padT + i * rowH;
          const flagged = d.y2020 > CEILING_CUT && d.y2017 > CEILING_CUT;
          return (
            <g key={d.test}
              onMouseMove={(e) => show(e, <>
                <b>{d.test}</b><br />MY2020: {d.y2020}% Good · MY2017: {d.y2017}% Good<br />
                {flagged ? "At ceiling in both cohorts — excluded from the survival model."
                  : "Still discriminates — usable in the survival model."}</>)}
              onMouseLeave={hide} style={{ cursor: "default" }}>
              <rect x={0} y={y0} width={W} height={rowH} fill="transparent" />
              <text x={padL - 10} y={y0 + rowH / 2 + 4} fontSize="12" fill={flagged ? C.ink3 : C.ink}
                textAnchor="end">{d.test}</text>
              <rect x={padL} y={y0 + 7} width={x(d.y2020) - padL} height={11} rx={2}
                fill={C.blue} opacity={flagged ? 0.45 : 1} />
              <rect x={padL} y={y0 + 22} width={x(d.y2017) - padL} height={11} rx={2}
                fill="#86b6ef" opacity={flagged ? 0.45 : 1} />
              <text x={x(Math.max(d.y2020, d.y2017)) + 6} y={y0 + rowH / 2 + 4} fontSize="11"
                fontFamily={MONO} fill={flagged ? C.orange : C.ink2}>
                {flagged ? "ceiling" : `${d.y2020}%`}</text>
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
    </Panel>
  );
}

// ─── variance decomposition ──────────────────────────────────────────────────
function VarianceChart() {
  const { tip, show, hide } = useTip();
  const W = 640, rowH = 54, padL = 190, padR = 60, padT = 26;
  const H = padT + VARIANCE.length * rowH + 8;
  const x = (v) => padL + (v / 50) * (W - padL - padR);
  return (
    <Panel>
      <svg width={W} height={H} style={{ minWidth: 560, display: "block" }} role="img"
        aria-label="Incremental R squared per model block">
        {[0, 10, 20, 30, 40, 50].map(v => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={padT - 8} y2={H - 8} stroke={C.grid} />
            <text x={x(v)} y={padT - 12} fontSize="10.5" fill={C.ink3} textAnchor="middle"
              fontFamily={MONO}>{v}</text>
          </g>
        ))}
        {VARIANCE.map((d, i) => {
          const y0 = padT + i * rowH;
          return (
            <g key={d.block}
              onMouseMove={(e) => show(e, <><b>{d.block}</b><br />
                incremental R²: {d.r2.toFixed(1)} pts · cumulative: {d.cum.toFixed(1)}%<br />{d.note}</>)}
              onMouseLeave={hide}>
              <rect x={0} y={y0} width={W} height={rowH} fill="transparent" />
              <text x={padL - 10} y={y0 + 22} fontSize="12.5" fill={C.ink} textAnchor="end">{d.block}</text>
              <rect x={padL} y={y0 + 10} width={Math.max(x(d.cum) - padL, 2)} height={16} rx={3}
                fill="none" stroke={C.grid} />
              <rect x={i === 0 ? padL : x(VARIANCE[i - 1].cum) + (d.r2 > 0 ? 2 : 0)} y={y0 + 10}
                width={Math.max(x(d.cum) - (i === 0 ? padL : x(VARIANCE[i - 1].cum)) - (d.r2 > 0 && i > 0 ? 2 : 0), d.r2 === 0 ? 0 : 2)}
                height={16} rx={3} fill={i === 2 ? C.orange : C.blue} />
              {i > 0 && <rect x={padL} y={y0 + 10} width={x(VARIANCE[i - 1].cum) - padL} height={16}
                rx={3} fill={C.blue} opacity={0.25} />}
              <text x={x(d.cum) + 8} y={y0 + 23} fontSize="12" fontFamily={MONO}
                fill={i === 2 ? C.orange : C.ink2}>
                {d.r2 === 0 ? "+0.0" : (i === 0 ? d.r2.toFixed(1) : `+${d.r2.toFixed(1)}`)}</text>
            </g>
          );
        })}
        <text x={padL} y={H - 2} fontSize="10.5" fill={C.ink3} fontFamily={MONO}>
          R² of log(driver death rate), n = 145 rated nameplates · curb weight unavailable (vPIC) — class stands in for mass</text>
      </svg>
      <Tip tip={tip} />
    </Panel>
  );
}

// ─── forest plot: matched-direction vs placebo coefficients ─────────────────
function ForestChart() {
  const { tip, show, hide } = useTip();
  const W = 640, rowH = 46, padL = 250, padR = 24, padT = 30;
  const H = padT + FOREST.length * rowH + 26;
  const lo = -0.6, hi = 0.6;
  const x = (v) => padL + ((v - lo) / (hi - lo)) * (W - padL - padR);
  return (
    <Panel>
      <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 12, color: C.ink2 }}>
        <span><span style={sw(C.blue)} /> rating matched to its crash direction</span>
        <span><span style={sw(C.orange)} /> placebo (mismatched direction)</span>
      </div>
      <svg width={W} height={H} style={{ minWidth: 560, display: "block" }} role="img"
        aria-label="Survival model coefficients with confidence intervals">
        {[-0.5, -0.25, 0, 0.25, 0.5].map(v => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={padT - 8} y2={H - 22} stroke={v === 0 ? "rgba(255,255,255,0.25)" : C.grid} />
            <text x={x(v)} y={padT - 12} fontSize="10.5" fill={C.ink3} textAnchor="middle"
              fontFamily={MONO}>{v}</text>
          </g>
        ))}
        {FOREST.map((d, i) => {
          const y = padT + i * rowH + rowH / 2;
          const col = d.placebo ? C.orange : C.blue;
          const sig = d.p < 0.05;
          return (
            <g key={d.term}
              onMouseMove={(e) => show(e, <><b>{d.term}</b><br />
                coef {d.coef.toFixed(3)} per rating step [{d.lo.toFixed(3)}, {d.hi.toFixed(3)}]<br />
                p = {d.p < 0.001 ? d.p.toExponential(0) : d.p} · n = {d.n.toLocaleString()}<br />
                {sig ? "Statistically significant — and it's the placebo. Residual confounding."
                  : "No significant effect."}</>)}
              onMouseLeave={hide}>
              <rect x={0} y={y - rowH / 2} width={W} height={rowH} fill="transparent" />
              <text x={padL - 10} y={y - 3} fontSize="11.5" fill={sig ? C.ink : C.ink2}
                textAnchor="end">{d.term.split(" → ")[0]}</text>
              <text x={padL - 10} y={y + 11} fontSize="10.5" fill={C.ink3} textAnchor="end"
                fontFamily={MONO}>→ {d.term.split(" → ")[1]}</text>
              <line x1={x(d.lo)} x2={x(d.hi)} y1={y} y2={y} stroke={col} strokeWidth="2" />
              <circle cx={x(d.coef)} cy={y} r={sig ? 5.5 : 4.5} fill={col}
                stroke={C.surface} strokeWidth="2" />
              {sig && <text x={x(d.hi) + 8} y={y + 4} fontSize="11" fontFamily={MONO}
                fill={C.orange}>p≈2×10⁻⁶ ⚠</text>}
            </g>
          );
        })}
        <text x={padL} y={H - 6} fontSize="10.5" fill={C.ink3} fontFamily={MONO}>
          log-odds of driver death per one rating step (Good→Poor direction positive) · controls: class, age, sex, vehicles, road, speed limit</text>
      </svg>
      <Tip tip={tip} />
    </Panel>
  );
}

// ─── persistence mini-bars ───────────────────────────────────────────────────
function PersistChart() {
  const { tip, show, hide } = useTip();
  const W = 640, H = 150, padL = 60, padR = 20, padT = 20, padB = 34;
  const bw = (W - padL - padR) / PERSIST.length;
  const y = (v) => padT + (1 - v) * (H - padT - padB);
  return (
    <Panel>
      <svg width={W} height={H} style={{ minWidth: 560, display: "block" }} role="img"
        aria-label="Kendall tau between adjacent study cycles">
        {[0, 0.25, 0.5, 0.75].map(v => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={C.grid} />
            <text x={padL - 8} y={y(v) + 4} fontSize="10.5" fill={C.ink3} textAnchor="end"
              fontFamily={MONO}>{v}</text>
          </g>
        ))}
        {PERSIST.map((d, i) => (
          <g key={d.pair}
            onMouseMove={(e) => show(e, <><b>{d.pair.replace("→", " → MY")}</b><br />
              Kendall τ = {d.tau.toFixed(2)} across nameplates present in both cycles</>)}
            onMouseLeave={hide}>
            <rect x={padL + i * bw + bw * 0.18} y={y(d.tau)} width={bw * 0.64}
              height={y(0) - y(d.tau)} rx={3} fill={C.blue} />
            <text x={padL + i * bw + bw / 2} y={H - padB + 16} fontSize="11" fill={C.ink2}
              textAnchor="middle" fontFamily={MONO}>{d.pair}</text>
          </g>
        ))}
        <text x={padL} y={H - 2} fontSize="10.5" fill={C.ink3} fontFamily={MONO}>
          rank persistence (Kendall τ) of nameplate death rates, adjacent cycles</text>
      </svg>
      <Tip tip={tip} />
    </Panel>
  );
}

const sw = (c) => ({ display: "inline-block", width: 10, height: 10, borderRadius: 2,
  background: c, marginRight: 6, verticalAlign: "-1px" });

// ─── data table (accessibility fallback) ─────────────────────────────────────
function DataTable() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(!open)} style={{
        background: "none", border: `1px solid ${C.border}`, color: C.ink2, borderRadius: 6,
        padding: "6px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
        {open ? "Hide" : "Show"} model coefficients as a table
      </button>
      {open && (
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5, fontFamily: MONO, color: C.ink2 }}>
            <thead><tr>{["term", "coef", "95% CI", "p", "n", "placebo"].map(h =>
              <th key={h} style={thtd(true)}>{h}</th>)}</tr></thead>
            <tbody>{FOREST.map(d => (
              <tr key={d.term}>
                <td style={thtd()}>{d.term}</td>
                <td style={thtd()}>{d.coef.toFixed(3)}</td>
                <td style={thtd()}>[{d.lo.toFixed(3)}, {d.hi.toFixed(3)}]</td>
                <td style={thtd()}>{d.p < 0.001 ? d.p.toExponential(0) : d.p}</td>
                <td style={thtd()}>{d.n.toLocaleString()}</td>
                <td style={thtd()}>{d.placebo ? "yes" : "no"}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
const thtd = (h) => ({ border: `1px solid ${C.border}`, padding: "5px 10px",
  textAlign: h ? "left" : "right", color: h ? "#9ca3af" : undefined });

// ─── app ─────────────────────────────────────────────────────────────────────
function App() {
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: C.ink,
      maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px" }}>

      <header style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.12em",
          textTransform: "uppercase", color: C.ink3, marginBottom: 12 }}>
          IIHS ratings × FARS/CRSS crash data · 2015–2023</div>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          Crashworthiness, honestly
        </h1>
        <p style={{ color: C.ink2, fontSize: 16.5, lineHeight: 1.65, marginTop: 16, maxWidth: 640 }}>
          Do IIHS crashworthiness ratings predict who actually dies on the road?
          We joined eight years of federal crash data (101,908 FARS fatal-crash vehicles,
          177,830 survey-weighted CRSS involvements) to IIHS death rates and ratings,
          and ran the test everyone skips: separating <em>who crashes</em> from{" "}
          <em>who survives a crash</em>. The answer the data supports is smaller and
          stranger than the marketing: <b>vehicle class explains 43% of the variance in
          death rates; ratings add 1.4 points</b> — and the model's own placebo check
          failed, which caps what any of the rating coefficients are allowed to mean.
        </p>
      </header>

      <Section kicker="Validation gates" title="Two pass exactly. Two fail — and the failures are the story."
        lead="The pipeline refuses to interpret results past a failing gate. Gates 1–2 prove the data replication is sound. Gates 3–4 fail for reasons worth understanding, not hiding.">
        <GateTiles />
      </Section>

      <Section kicker="Why gate 3 can't pass" title="Almost everything is rated Good now"
        lead={<>The famous side-test result — Good-rated vehicles ≈70% lower death risk than
          Poor — came from 2000s fleets, when Poor-rated cars actually existed. Today four of
          seven tests sit above a 90% "Good" share: they no longer distinguish vehicles, so the
          survival model excludes them. What remains is honest but thin.</>}>
        <CeilingChart />
      </Section>

      <Section kicker="Variance decomposition" title="Class explains 43.4%. Ratings add 1.4."
        lead="Sequential R² blocks on log death rates across 145 rated nameplates. Before asking what a rating adds, ask what the vehicle's class — its size, mass, and the driving population it selects — already explains.">
        <VarianceChart />
      </Section>

      <Section kicker="The placebo failed" title="A side rating 'predicts' frontal deaths. It shouldn't."
        lead={<>The conditional survival model — P(driver death | crash involvement) — matches
          each rating to its own crash direction, with mismatched fits as placebos. Every
          matched-direction effect is null. The only significant coefficient in the whole
          panel is a <b>placebo</b>: the updated side rating predicting <em>frontal</em> survival.
          A side-impact structure cannot cause that. Buyers of highly-rated cars differ in ways
          the controls don't capture — so none of these coefficients may be read as
          crashworthiness effects.</>}>
        <ForestChart />
        <DataTable />
      </Section>

      <Section kicker="What is real" title="Death-rate differences persist — something durable is there"
        lead="Nameplate death rates rank-correlate strongly across recent study cycles (τ ≈ 0.55–0.60). Real, durable differences between vehicles exist. This analysis shows the published ratings are not the variable carrying that signal once class is controlled — not that all cars are equally safe.">
        <PersistChart />
      </Section>

      <Section kicker="Read the fine print" title="What this can and cannot say">
        <ul style={{ color: C.ink2, lineHeight: 1.7, paddingLeft: 20, fontSize: 14.5,
          display: "grid", gap: 8 }}>
          <li>Nothing here is causal. Selection into vehicle class and trim is not random and cannot be fully adjusted away.</li>
          <li>Death rates adjust for driver age and sex only — not income, mileage, road mix, or driving style, all large and unmeasured.</li>
          <li>CRSS involvement counts are survey-weighted estimates from a complex sample; raw counts are never used.</li>
          <li>Curb weight is structurally unavailable (vPIC publishes none for light vehicles), so mass enters only through class.</li>
          <li>Low-volume makes below IIHS's publication threshold are absent by construction. Absence is not safety.</li>
          <li>FARS pools heavy-duty pickup variants under one code; variant-level crash assignment is approximate.</li>
          <li>Buy the safe car anyway: modern vehicles are dramatically safer than 2000s vehicles — that's <em>why</em> the ratings hit their ceiling.</li>
        </ul>
        <p style={{ marginTop: 20, fontSize: 12.5, color: C.ink3, fontFamily: MONO, lineHeight: 1.6 }}>
          Pipeline: IIHS driver death rates (7 study cycles, gates 1–2 reproduce published
          totals exactly) · IIHS ratings (145/252 nameplates) · FARS 2015–2023 · CRSS 2016–2023
          · vPIC VIN decoding · 247-row entity-resolution crosswalk (every MY2017/MY2020 row
          resolved). Full code and outputs in the repo's <code>pipeline/</code> directory.
        </p>
      </Section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
