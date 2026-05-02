import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ============================================================================
// PEI-001 DATA
// ============================================================================

const DECADES = ["1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];
const MAX_T = DECADES.length - 1;

const PRIMARY_DATA = {
  "1970s": { validity: 55, belief: 73, party: 15, measurability: 78, polarization: 5, universality: 0.91, ceiling: true },
  "1980s": { validity: 62, belief: 68, party: 40, measurability: 72, polarization: 8, universality: 0.91, ceiling: false },
  "1990s": { validity: 65, belief: 75, party: 25, measurability: 85, polarization: 10, universality: 0.91, ceiling: false },
  "2000s": { validity: 48, belief: 65, party: 55, measurability: 85, polarization: 18, universality: 0.87, ceiling: false },
  "2010s": { validity: 42, belief: 55, party: 65, measurability: 85, polarization: 32, universality: 0.84, ceiling: true },
  "2020s": { validity: 44, belief: 40, party: 60, measurability: 85, polarization: 38, universality: 0.82, ceiling: true },
};

const PERSONA_DATA = {
  WM: { label: "White men", color: "#5B7B8A", data: { "1970s": { v: 88, m: 82 }, "1980s": { v: 82, m: 72 }, "1990s": { v: 88, m: 85 }, "2000s": { v: 68, m: 85 }, "2010s": { v: 62, m: 85 }, "2020s": { v: 60, m: 85 } } },
  WF: { label: "White women", color: "#8A7B5B", data: { "1970s": { v: 35, m: 72 }, "1980s": { v: 48, m: 72 }, "1990s": { v: 58, m: 85 }, "2000s": { v: 40, m: 85 }, "2010s": { v: 40, m: 85 }, "2020s": { v: 42, m: 85 } } },
  BM: { label: "Black men", color: "#6B5B8A", data: { "1970s": { v: 45, m: 75 }, "1980s": { v: 62, m: 70 }, "1990s": { v: 60, m: 83 }, "2000s": { v: 38, m: 83 }, "2010s": { v: 32, m: 83 }, "2020s": { v: 38, m: 83 } } },
  BF: { label: "Black women", color: "#8A5B6B", data: { "1970s": { v: 25, m: 70 }, "1980s": { v: 42, m: 70 }, "1990s": { v: 50, m: 83 }, "2000s": { v: 32, m: 83 }, "2010s": { v: 22, m: 83 }, "2020s": { v: 25, m: 83 } } },
};

const COMPASS_COLOR = "#D4A054";

// ============================================================================
// DEMOGRAPHICS DATA (per decade, from YAML)
// ============================================================================

const DEMOGRAPHICS_DATA = {
  "1970s": { age: { raw: 0.08, ctrl: 0.06, peak: "Young adults (Boomers, slight)" }, education: { raw: 0.06, ctrl: 0.05, peak: "Non-college (very slight)" }, sex: { raw: 0.08, ctrl: 0.06, peak: "Men (slight)" }, race: { raw: 0.20, ctrl: 0.18, peak: "White Americans (~70%+)" }, income: { raw: 0.10, ctrl: 0.08, peak: "Upper-income (slight)" }, religion: { raw: 0.10, ctrl: 0.06, peak: "Protestant Christians" }, universality_raw: 0.90, universality_ctrl: 0.92 },
  "1980s": { age: { raw: 0.10, ctrl: 0.08, peak: "50+ adults" }, education: { raw: 0.08, ctrl: 0.06, peak: "Non-college (slight)" }, sex: { raw: 0.08, ctrl: 0.06, peak: "Men (slight)" }, race: { raw: 0.20, ctrl: 0.18, peak: "White Americans (~70%)" }, income: { raw: 0.12, ctrl: 0.10, peak: "Upper-income" }, religion: { raw: 0.12, ctrl: 0.08, peak: "White evangelicals (~75-80%)" }, universality_raw: 0.88, universality_ctrl: 0.91 },
  "1990s": { age: { raw: 0.08, ctrl: 0.06, peak: "50+ adults (slight)" }, education: { raw: 0.08, ctrl: 0.06, peak: "Non-college (slight)" }, sex: { raw: 0.10, ctrl: 0.08, peak: "Men" }, race: { raw: 0.18, ctrl: 0.16, peak: "White Americans (~72%)" }, income: { raw: 0.14, ctrl: 0.10, peak: "Upper-income ($100K+)" }, religion: { raw: 0.14, ctrl: 0.08, peak: "White evangelicals (~75%)" }, universality_raw: 0.88, universality_ctrl: 0.91 },
  "2000s": { age: { raw: 0.15, ctrl: 0.12, peak: "50-64 and 65+" }, education: { raw: 0.12, ctrl: 0.15, peak: "Non-college → complex" }, sex: { raw: 0.12, ctrl: 0.10, peak: "Men" }, race: { raw: 0.18, ctrl: 0.16, peak: "White pre-crisis; Asian emerging" }, income: { raw: 0.18, ctrl: 0.14, peak: "Upper-income ($100K+)" }, religion: { raw: 0.18, ctrl: 0.12, peak: "White evangelicals" }, universality_raw: 0.85, universality_ctrl: 0.87 },
  "2010s": { age: { raw: 0.25, ctrl: 0.18, peak: "65+ (~68%); 50-64 (~61%)" }, education: { raw: 0.12, ctrl: 0.20, peak: "Non-college (within GOP)" }, sex: { raw: 0.18, ctrl: 0.12, peak: "Men" }, race: { raw: 0.22, ctrl: 0.20, peak: "Asian (70%), Hispanic (69%)" }, income: { raw: 0.22, ctrl: 0.18, peak: "Upper-middle ($75-150K)" }, religion: { raw: 0.22, ctrl: 0.10, peak: "White evangelicals (~70-80%)" }, universality_raw: 0.80, universality_ctrl: 0.84 },
  "2020s": { age: { raw: 0.30, ctrl: 0.22, peak: "65+ (~50% WSJ; ~68% Pew)" }, education: { raw: 0.12, ctrl: 0.22, peak: "Non-college (within GOP)" }, sex: { raw: 0.22, ctrl: 0.15, peak: "Men (~50% WSJ/NORC)" }, race: { raw: 0.22, ctrl: 0.20, peak: "Asian & Hispanic Americans" }, income: { raw: 0.25, ctrl: 0.20, peak: "Upper-income ($100K+)" }, religion: { raw: 0.22, ctrl: 0.08, peak: "White evangelicals (~65-75%)" }, universality_raw: 0.78, universality_ctrl: 0.82 },
};

const DIM_EXPLANATIONS = {
  age: { label: "Age", raw_q: "How concentrated is belief in specific age groups?", ctrl_q: "After removing partisan sorting by age, does age still predict belief?", insight: d => { const dd = DEMOGRAPHICS_DATA[d]?.age; if (!dd) return ""; const g = dd.raw - dd.ctrl; return g >= 0.06 ? `${Math.round(g*100)}% of the age pattern is partisan sorting — older Americans are more conservative, and conservatives believe this more.` : "Age predicts belief mostly independently of partisanship."; } },
  education: { label: "Education", raw_q: "How concentrated is belief by education level?", ctrl_q: "After removing partisan sorting, does education still predict belief?", insight: d => { const dd = DEMOGRAPHICS_DATA[d]?.education; if (!dd) return ""; if (dd.ctrl > dd.raw) return "Ideology-controlled concentration EXCEEDS raw — the education effect duplicates the partisan effect. Education is becoming an ideological proxy."; const g = dd.raw - dd.ctrl; return g < 0.03 ? "Education predicts belief independently of partisanship." : `About ${Math.round(g*100)}% of the education pattern reflects partisan alignment.`; } },
  sex: { label: "Sex", raw_q: "How concentrated is belief between men and women?", ctrl_q: "After removing the gender-ideology gap, does sex still predict belief?", insight: d => { const dd = DEMOGRAPHICS_DATA[d]?.sex; if (!dd) return ""; const g = dd.raw - dd.ctrl; return g >= 0.06 ? `The gender gap is partially driven by women’s leftward political shift — ${Math.round(g*100)}% is partisan sorting.` : "Sex predicts belief mostly independently — lived experience matters here."; } },
  race: { label: "Race", raw_q: "How concentrated is belief across racial groups?", ctrl_q: "After controlling for partisan identity, does race still predict belief?", insight: d => { const dd = DEMOGRAPHICS_DATA[d]?.race; if (!dd) return ""; const g = dd.raw - dd.ctrl; return g <= 0.03 ? "Race predicts belief almost entirely independently of partisanship. Lived experience of structural barriers drives this." : `Small partisan component (${Math.round(g*100)}%), but race is mostly an independent signal.`; } },
  income: { label: "Income", raw_q: "How concentrated is belief across income levels?", ctrl_q: "After controlling for ideology, does income still predict belief?", insight: d => { const dd = DEMOGRAPHICS_DATA[d]?.income; if (!dd) return ""; const g = dd.raw - dd.ctrl; return g >= 0.04 ? `About ${Math.round(g*100)}% is partisan sorting. But income still predicts belief independently — the mechanism works better for higher earners.` : "Income predicts belief independently. People whose income makes the mechanism plausible believe it more."; } },
  religion: { label: "Religion", raw_q: "How concentrated is belief across religious groups?", ctrl_q: "After removing partisanship, does religion still predict belief?", insight: d => { const dd = DEMOGRAPHICS_DATA[d]?.religion; if (!dd) return ""; const g = dd.raw - dd.ctrl; return g >= 0.10 ? `Almost entirely partisan proxy — ${Math.round(g*100)}% of the religious pattern vanishes after ideology controls. White evangelicals believe this because they’re Republican, not because they’re evangelical.` : g >= 0.04 ? `${Math.round(g*100)}% is partisan sorting. The Protestant work ethic tradition adds some independent signal.` : "Religion has modest independent explanatory power via work ethic traditions."; } },
};

const ALIGNMENT_DRIFT = {
  age: { label: "Age (young)", desc: "Young adults’ correlation with left ideology", values: { "1970s": 0.05, "1980s": 0.00, "1990s": -0.05, "2000s": 0.10, "2010s": 0.20, "2020s": 0.30 }, drift_note: "Young → left accelerating since 2000s" },
  education: { label: "Education (college)", desc: "College-educated correlation with left ideology", values: { "1970s": -0.15, "1980s": -0.10, "1990s": -0.05, "2000s": 0.10, "2010s": 0.25, "2020s": 0.40 }, drift_note: "Full inversion: right-leaning → strongly left (+0.55)" },
  sex: { label: "Sex (women)", desc: "Women’s correlation with left ideology", values: { "1970s": 0.05, "1980s": 0.05, "1990s": 0.05, "2000s": 0.10, "2010s": 0.15, "2020s": 0.25 }, drift_note: "Gender gap re-emerged, driven by young women" },
  race: { label: "Race (non-White)", desc: "Non-White correlation with left ideology", values: { "1970s": 0.35, "1980s": 0.35, "1990s": 0.35, "2000s": 0.35, "2010s": 0.35, "2020s": 0.30 }, drift_note: "Historically stable; slight rightward drift 2020s" },
  income: { label: "Income (low)", desc: "Low-income correlation with left ideology", values: { "1970s": 0.30, "1980s": 0.25, "1990s": 0.20, "2000s": 0.15, "2010s": 0.10, "2020s": 0.05 }, drift_note: "Weakening: class → party link eroding (-0.25)" },
  religion: { label: "Religion (secular)", desc: "Secular/unaffiliated correlation with left ideology", values: { "1970s": 0.10, "1980s": 0.15, "1990s": 0.20, "2000s": 0.30, "2010s": 0.40, "2020s": 0.45 }, drift_note: "Secularism now strongly predicts left lean (+0.35)" },
};

const NARRATIVE = {
  "1970s": { summary: "Postwar consensus holds. The mechanism works for white men — but women can’t get mortgages and redlining locks out Black families.", main: "The postwar prosperity consensus is still holding. Homeownership rate ~65% and rising, affordability ratio well above the viability threshold (0.246). The mechanism — work hard, save, buy a home — is lived reality for most white Americans. But women can’t independently get mortgages until 1974, and redlining keeps Black families locked out of the same housing markets.", events: [{ year: "1968", label: "Fair Housing Act (de jure end of redlining)", type: "legislation" }, { year: "1974", label: "Equal Credit Opportunity Act — women gain credit access", type: "legislation" }, { year: "1977", label: "Community Reinvestment Act", type: "legislation" }], persona_note: "White men score 88 — the mechanism works as advertised. Black women score 25 — intersecting credit barriers and racial discrimination make the same mechanism functionally broken. The 63-point gap is the largest in the entire time series." },
  "1980s": { summary: "Reagan’s “opportunity society” shifts the narrative rightward. Affordability still above threshold — the claim has empirical grounding.", main: "Reagan’s “opportunity society” framing begins shifting the bootstraps narrative rightward. Homeownership is still bipartisan policy, but the rhetorical framing of individual responsibility as the mechanism is becoming GOP-coded. Affordability remains above the viability threshold (0.209) — the claim still has empirical grounding.", events: [{ year: "1981", label: "Reagan inauguration — “opportunity society” rhetoric", type: "political" }, { year: "1986", label: "Tax Reform Act preserves mortgage interest deduction", type: "legislation" }], persona_note: "The gap narrows to 40 points (WM 82, BF 42) as post-ECOA gains begin showing for women. This is the only decade where all four groups trend upward simultaneously — rising tide, uneven boats." },
  "1990s": { summary: "Peak consensus. Both parties claim credit for rising homeownership. Belief at 75%. As good as it gets.", main: "Peak bipartisan consensus. Clinton’s National Homeownership Strategy (1995) makes expanding ownership a shared priority. Belief hits its highest point (75%). Affordability is straining (0.185) but employment access is excellent. The mechanism works for more people than any other decade — and the political system takes credit from both sides.", events: [{ year: "1995", label: "National Homeownership Strategy (bipartisan)", type: "legislation" }, { year: "1998", label: "Gallup: 81% say ‘plenty of opportunity’", type: "political" }], persona_note: "Black women hit their peak validity (50) — the only decade the claim reaches even a coin flip for this group. White men peak at 88. The gap (38 pts) is the narrowest it will ever be." },
  "2000s": { summary: "Housing boom inflates prices past the threshold. Then 2008 destroys $7 trillion in household wealth. The foundation cracks.", main: "The housing boom inflates prices past the affordability threshold. Bush’s “Ownership Society” brands homeownership as GOP territory. Then the floor drops out: the 2008 crisis destroys $7 trillion in household wealth, disproportionately hitting minority communities targeted by subprime lenders. The claim’s empirical foundation cracks.", events: [{ year: "2004", label: "Bush “Ownership Society” speech", type: "political" }, { year: "2008", label: "Subprime crisis / Great Recession", type: "crisis" }], persona_note: "Black women drop to 32 — approaching the ceiling-trigger threshold. Black men fall from 60 to 38. The crisis destroys minority wealth disproportionately, but even white men drop from 88 to 68." },
  "2010s": { summary: "Post-crisis reckoning. “Bootstraps” becomes a partisan shibboleth. 28-point gap between R and D belief in meritocracy.", main: "Post-crisis reckoning. Affordability collapses to 0.134. Occupy Wall Street (2011) crystallizes structural critique. “Bootstraps” becomes a partisan shibboleth — Pew finds a 28-point gap between Republican (77%) and Democratic (49%) belief in meritocracy. The claim is now more identity marker than empirical proposition.", events: [{ year: "2011", label: "Occupy Wall Street — structural inequality narrative", type: "political" }, { year: "2017", label: "Pew: 28-pt partisan gap on meritocracy belief", type: "political" }], persona_note: "Ceiling triggered: Black women fall to 22 (structurally inaccessible). Black men hit 32. White men at 62 can still make it work with no disruptions. The mechanism is now only reliably functional for one group." },
  "2020s": { summary: "Record pessimism. Only 36% say the Dream “still holds.” Belief and reality have nearly converged on this claim.", main: "Record pessimism. WSJ/NORC 2023: only 36% say the American Dream “still holds true” — down from 75% at its peak. But here’s the finding: general meritocratic belief (~60%) still runs well above mechanism-specific belief (33–36%). People value hard work as a principle while recognizing it no longer produces homeownership. The gap between belief and reality has nearly closed on this specific claim.", events: [{ year: "2020", label: "COVID housing boom — prices up ~40%", type: "crisis" }, { year: "2023", label: "WSJ/NORC: 36% say Dream ‘still holds’", type: "political" }, { year: "2025", label: "WSJ/NORC: 31% — record low", type: "political" }], persona_note: "Ceiling still triggered (BF 25). Even white men (60) are now in “achievable with difficulty” territory — a single medical bill or job gap breaks the mechanism. The claim has gone from describing most people’s reality to describing almost nobody’s." },
};

// ============================================================================
// INTERPOLATION + ENCODING
// ============================================================================

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function getPrimary(tv) { const t = clamp(tv, 0, MAX_T); const i = Math.min(Math.floor(t), MAX_T - 1); const f = t >= MAX_T ? 0 : t - i; const a = PRIMARY_DATA[DECADES[i]]; const b = PRIMARY_DATA[DECADES[Math.min(i + 1, MAX_T)]]; return { validity: lerp(a.validity, b.validity, f), belief: lerp(a.belief, b.belief, f), party: lerp(a.party, b.party, f), measurability: lerp(a.measurability, b.measurability, f), polarization: lerp(a.polarization, b.polarization, f), universality: lerp(a.universality, b.universality, f), ceiling: a.ceiling }; }
function getPersonaVal(key, tv) { const t = clamp(tv, 0, MAX_T); const i = Math.min(Math.floor(t), MAX_T - 1); const f = t >= MAX_T ? 0 : t - i; const a = PERSONA_DATA[key].data[DECADES[i]]; const b = PERSONA_DATA[key].data[DECADES[Math.min(i + 1, MAX_T)]]; return { v: lerp(a.v, b.v, f), m: lerp(a.m, b.m, f) }; }
function partyColor(party) { const t = (party + 100) / 200; if (t <= 0.5) { const s = t / 0.5; return `rgb(${Math.round(lerp(45,155,s))},${Math.round(lerp(85,145,s))},${Math.round(lerp(185,140,s))})`; } else { const s = (t - 0.5) / 0.5; return `rgb(${Math.round(lerp(155,195,s))},${Math.round(lerp(145,55,s))},${Math.round(lerp(140,55,s))})`; } }
function partyColorAlpha(party, a) { const t = (party + 100) / 200; if (t <= 0.5) { const s = t / 0.5; return `rgba(${Math.round(lerp(45,155,s))},${Math.round(lerp(145,145,s))},${Math.round(lerp(185,140,s))},${a})`; } else { const s = (t - 0.5) / 0.5; return `rgba(${Math.round(lerp(155,195,s))},${Math.round(lerp(145,55,s))},${Math.round(lerp(140,55,s))},${a})`; } }
function edgeBlur(m) { return Math.max(0, (100 - m) * 0.18); }
function dotRadius(belief, base) { return base * 0.3 + base * 0.7 * (belief / 100); }
function shapeSides(u) { if (u > 0.75) return 0; if (u > 0.65) return 8; if (u > 0.55) return 6; if (u > 0.45) return 5; return 4; }
function polyPoints(cx, cy, r, n) { if (!n) return null; return Array.from({ length: n }, (_, i) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; }).join(" "); }
function validityZoneColor(v) { if (v >= 70) return "#3D7A44"; if (v >= 50) return "#6E7A3D"; if (v >= 30) return "#946B35"; return "#8B4040"; }

const PAD = { l: 72, r: 44, t: 48, b: 56 };
const MONO = "'DM Mono', monospace"; const SERIF = "'Newsreader', Georgia, serif";
const CARD_BG = "#FAF6F0"; const CARD_BORDER = "#DDD5C8"; const LABEL_COLOR = "#5A4E3C"; const VALUE_COLOR = "#2C2416";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PEIVisualization() {
  const [timeValue, setTimeValue] = useState(0);
  const [showPersonas, setShowPersonas] = useState(false);
  const [hoveredPersona, setHoveredPersona] = useState(null);
  const [showTrails, setShowTrails] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showScores, setShowScores] = useState(true);
  const [expandedInfo, setExpandedInfo] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [legendLayer, setLegendLayer] = useState(0);
  const [contextExpanded, setContextExpanded] = useState(false);
  const [showDemographics, setShowDemographics] = useState(false);
  const [showDrift, setShowDrift] = useState(false);
  const [controlsSticky, setControlsSticky] = useState(false);
  const containerRef = useRef(null); const controlsInlineRef = useRef(null);
  const animRef = useRef(null); const clickAnimRef = useRef(null); const tRef = useRef(0);
  const [dims, setDims] = useState({ w: 800, h: 520 });

  useEffect(() => { const measure = () => { if (containerRef.current) { const w = Math.max(380, containerRef.current.getBoundingClientRect().width); setDims({ w, h: Math.max(360, Math.min(560, w * 0.62)) }); } }; measure(); window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure); }, []);
  // Sticky controls: detect when inline controls scroll out of viewport
  useEffect(() => {
    const check = () => {
      const el = controlsInlineRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setControlsSticky(rect.bottom < 0);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    return () => { window.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, []);

  const isNarrow = dims.w < 520;
  const cW = dims.w - PAD.l - PAD.r; const cH = dims.h - PAD.t - PAD.b;
  const toX = useCallback((p) => PAD.l + ((p + 100) / 200) * cW, [cW]);
  const toY = useCallback((v) => PAD.t + (1 - v / 100) * cH, [cH]);
  const baseR = Math.min(36, cW * 0.048);

  useEffect(() => { if (!isPlaying) return; if (clickAnimRef.current) cancelAnimationFrame(clickAnimRef.current); tRef.current = timeValue; let last = performance.now(); const tick = (now) => { const dt = (now - last) / 1000; last = now; tRef.current = Math.min(tRef.current + dt * 0.55, MAX_T); setTimeValue(tRef.current); if (tRef.current >= MAX_T) { setIsPlaying(false); return; } animRef.current = requestAnimationFrame(tick); }; animRef.current = requestAnimationFrame(tick); return () => { if (animRef.current) cancelAnimationFrame(animRef.current); }; }, [isPlaying]);

  const cur = getPrimary(timeValue);
  const decadeIdx = Math.min(Math.floor(timeValue), MAX_T);
  const decadeLabel = DECADES[decadeIdx];
  const dotX = toX(cur.party); const dotY = toY(cur.validity);
  const r = dotRadius(cur.belief, baseR); const blur = edgeBlur(cur.measurability);
  const color = partyColor(cur.party); const sides = shapeSides(cur.universality);
  const narr = NARRATIVE[decadeLabel];

  const trail = useMemo(() => { const pts = DECADES.slice(0, decadeIdx + 1).map(d => { const dd = PRIMARY_DATA[d]; return { x: toX(dd.party), y: toY(dd.validity), r: dotRadius(dd.belief, baseR), color: partyColor(dd.party), decade: d }; }); if (timeValue - decadeIdx > 0.01 && decadeIdx < MAX_T) pts.push({ x: dotX, y: dotY, r, color, decade: "" }); return pts; }, [timeValue, decadeIdx, toX, toY, baseR, dotX, dotY, r, color]);
  const personas = useMemo(() => { if (!showPersonas) return []; return Object.entries(PERSONA_DATA).map(([key, pd]) => { const pv = getPersonaVal(key, timeValue); return { key, label: pd.label, color: pd.color, x: dotX, y: toY(pv.v), v: pv.v, blur: edgeBlur(pv.m), r: r * 0.5 }; }); }, [showPersonas, timeValue, dotX, toY, r]);
  const pTrails = useMemo(() => { if (!showPersonas || !showTrails) return {}; const frac = timeValue - decadeIdx; const out = {}; Object.entries(PERSONA_DATA).forEach(([key, pd]) => { const pts = DECADES.slice(0, decadeIdx + 1).map(d => ({ x: toX(PRIMARY_DATA[d].party), y: toY(pd.data[d].v) })); if (frac > 0.01 && decadeIdx < MAX_T) { const pv = getPersonaVal(key, timeValue); pts.push({ x: dotX, y: toY(pv.v) }); } out[key] = pts; }); return out; }, [showPersonas, showTrails, timeValue, decadeIdx, toX, toY, dotX]);

  const timeRef = useRef(timeValue); timeRef.current = timeValue;
  const animateTo = useCallback((targetIdx) => { setIsPlaying(false); if (clickAnimRef.current) cancelAnimationFrame(clickAnimRef.current); if (animRef.current) cancelAnimationFrame(animRef.current); const startVal = timeRef.current; const endVal = targetIdx; if (Math.abs(endVal - startVal) < 0.01) return; const dur = Math.max(400, Math.min(1200, Math.abs(endVal - startVal) * 400)); const t0 = performance.now(); const tick = (now) => { const p = Math.min(1, (now - t0) / dur); const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; setTimeValue(startVal + (endVal - startVal) * ease); if (p < 1) clickAnimRef.current = requestAnimationFrame(tick); }; clickAnimRef.current = requestAnimationFrame(tick); }, []);
  const togglePlay = () => { if (clickAnimRef.current) cancelAnimationFrame(clickAnimRef.current); if (timeValue >= MAX_T) setTimeValue(0); setIsPlaying(p => !p); };
  const personaGap = showPersonas && personas.length > 0 ? Math.round(Math.max(...personas.map(p => p.v)) - Math.min(...personas.map(p => p.v))) : 0;

  return (
    <div ref={containerRef} style={{ width: "100%", fontFamily: SERIF, background: "#FAF6F0", color: "#2C2416", fontSize: 14 }}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500;6..72,600&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      <style>{`.pei-range{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;background:linear-gradient(90deg,#DDD5C8,#C4B8A8);outline:none;margin-top:6px;cursor:pointer}.pei-range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#2C2416;border:2px solid #FAF6F0;box-shadow:0 1px 4px rgba(44,36,22,.3);cursor:grab}@keyframes contextFade{from{opacity:0}to{opacity:1}}@keyframes stickySlideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

      {/* FLOATING DECADE — always visible when scrolled */}
      {controlsSticky && <div style={{ position: "fixed", top: 12, right: 16, zIndex: 101, fontFamily: MONO, fontSize: 24, fontWeight: 600, color: "#FAF6F0", background: "#2C2416", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", padding: "6px 16px", borderRadius: 8, boxShadow: "0 2px 12px rgba(44,36,22,0.25)", animation: "stickySlideUp 0.15s ease" }}>{decadeLabel}</div>}

      {/* HEADER */}
      <div style={{ padding: "16px 20px 2px", display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.1em", color: "#7A6E5E", textTransform: "uppercase" }}>Political Epistemology Index</div>
          <h2 style={{ margin: "2px 0 0", fontSize: Math.max(20, Math.min(26, dims.w * 0.032)), fontWeight: 500, lineHeight: 1.3 }}>PEI-001: {"“"}Young people could buy homes if they just worked harder.{"”"}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>{["housing","labor","meritocracy","american-dream","wages","bootstraps","generational-wealth"].map(tag => <span key={tag} style={{ fontFamily: MONO, fontSize: 11, color: "#6B5E4F", padding: "2px 8px", borderRadius: 3, background: "#EDE8DF", border: "1px solid #DDD5C8" }}>#{tag}</span>)}</div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 300, opacity: 0.55, letterSpacing: "-0.03em", lineHeight: 1 }}>{decadeLabel}</div>
      </div>

      {/* LEGEND */}
      <div style={{ margin: "8px 20px 6px", borderRadius: 6, border: "1px solid #DDD5C8", overflow: "hidden", background: legendOpen ? "#F0EBE2" : "#F5F1EA" }}>
        <div onClick={() => setLegendOpen(o => !o)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, userSelect: "none" }}>
          <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: "#2C2416", textTransform: "uppercase", letterSpacing: "0.08em", flex: 1 }}>How to read the chart</div>
          <span style={{ fontFamily: MONO, fontSize: 12, color: "#9B8D7B", transition: "transform 0.2s", transform: legendOpen ? "rotate(180deg)" : "none", display: "inline-block" }}>{"▼"}</span>
        </div>
        {legendOpen && <LegendContent layer={legendLayer} setLayer={setLegendLayer} />}
      </div>

      {/* CONTEXT BAR */}
      {narr && <div onClick={() => setContextExpanded(e => !e)} style={{ margin: "0 20px 8px", padding: contextExpanded ? "10px 14px 12px" : "8px 14px", background: "#F7F4EE", borderRadius: 6, border: "1px solid #DDD5C8", cursor: "pointer" }}>
        <div key={decadeLabel} style={{ animation: "contextFade 0.35s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: "#2C2416", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>{decadeLabel}</span>
            <span style={{ fontSize: 14, color: "#4A3F32", lineHeight: 1.4, flex: 1 }}>{narr.summary}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "#9B8D7B", flexShrink: 0, transition: "transform 0.2s", transform: contextExpanded ? "rotate(180deg)" : "none", display: "inline-block" }}>{"▼"}</span>
          </div>
          {contextExpanded && <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 15, color: "#3D3428", lineHeight: 1.6 }}>{narr.main}</div>
            {narr.events.length > 0 && <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 5 }}>{narr.events.map((ev, i) => <span key={i} style={{ fontFamily: MONO, fontSize: 11, padding: "3px 8px", borderRadius: 3, background: ev.type === "legislation" ? "#E8EDE8" : ev.type === "crisis" ? "#EDDFDF" : "#E8E4DE", color: ev.type === "legislation" ? "#4A6B4A" : ev.type === "crisis" ? "#8B4A4A" : "#5A4E3C", border: `1px solid ${ev.type === "legislation" ? "#C4D4C4" : ev.type === "crisis" ? "#D4B8B8" : "#D4CEC4"}` }}>{ev.year && <b>{ev.year} </b>}{ev.label}</span>)}</div>}
            {showPersonas && narr.persona_note && <div style={{ marginTop: 8, padding: "6px 8px", background: "#F0EBE2", borderRadius: 4, border: "1px solid #DDD5C8", fontSize: 14, color: "#5A4E3C", lineHeight: 1.5, fontStyle: "italic" }}>{narr.persona_note}</div>}
          </div>}
        </div>
      </div>}

      {/* CHART */}
      <div style={{ position: "relative", margin: "0 20px" }}>
        <button onClick={() => { setShowPersonas(p => !p); setHoveredPersona(null); }} style={{ position: "absolute", top: 8, left: PAD.l + 6, zIndex: 10, background: "#2C2416", color: "#FAF6F0", border: "none", borderRadius: 4, padding: "5px 12px", cursor: "pointer", fontFamily: MONO, fontSize: 12, fontWeight: 500, boxShadow: "0 1px 4px rgba(44,36,22,0.25)", opacity: 0.9 }}>{showPersonas ? "← Aggregate" : "Split by persona ↓"}</button>
        <svg width={dims.w - 40} height={dims.h} style={{ display: "block" }}>
          <defs><filter id="fBlur"><feGaussianBlur stdDeviation={blur}/></filter>{personas.map(p => <filter key={`fb-${p.key}`} id={`fb-${p.key}`}><feGaussianBlur stdDeviation={p.blur}/></filter>)}</defs>
          <rect x={PAD.l} y={PAD.t} width={dims.w-40-PAD.l-PAD.r} height={cH} fill="#F4EFE6" rx={3}/>
          <rect x={PAD.l} y={toY(100)} width={dims.w-40-PAD.l-PAD.r} height={toY(70)-toY(100)} fill="#D0E0D0" opacity={.15}/><rect x={PAD.l} y={toY(70)} width={dims.w-40-PAD.l-PAD.r} height={toY(30)-toY(70)} fill="#E0DCC0" opacity={.12}/><rect x={PAD.l} y={toY(30)} width={dims.w-40-PAD.l-PAD.r} height={toY(0)-toY(30)} fill="#E0CCC0" opacity={.15}/>
          {[0,30,50,70,100].map(v => { const isTier=v===30||v===70; const isMid=v===50; return <g key={`gy${v}`}><line x1={PAD.l} y1={toY(v)} x2={PAD.l+cW} y2={toY(v)} stroke={isTier?"#B8AFA0":isMid?"#C8BFAF":"#DDD6CA"} strokeWidth={isTier?1:isMid?.7:.5} strokeDasharray={isTier?"4,3":isMid?"6,4":"2,4"}/><text x={PAD.l-8} y={toY(v)+3.5} textAnchor="end" fontSize={11} fontFamily={MONO} fill="#7A6E5E">{v}</text></g>; })}
          {[-100,-50,0,50,100].map(p => <line key={`gx${p}`} x1={toX(p)} y1={PAD.t} x2={toX(p)} y2={PAD.t+cH} stroke={p===0?"#C8BFAF":"#DDD6CA"} strokeWidth={p===0?1:.5} strokeDasharray={p===0?"6,4":"2,4"}/>)}
          <text x={26} y={PAD.t+cH/2} textAnchor="middle" fontSize={11} fontFamily={MONO} fill="#5A4E3C" fontWeight={500} transform={`rotate(-90,26,${PAD.t+cH/2})`}>EMPIRICAL VALIDITY</text>
          <text x={PAD.l} y={PAD.t+cH+32} fontSize={11} fontFamily={MONO} fill="#2D55B9" fontWeight={500}>{"←"} DNC</text>
          <text x={PAD.l+cW/2} y={PAD.t+cH+32} fontSize={11} fontFamily={MONO} fill="#5A4E3C" fontWeight={500} textAnchor="middle">PARTY OWNERSHIP</text>
          <text x={PAD.l+cW} y={PAD.t+cH+32} fontSize={11} fontFamily={MONO} fill="#A04040" fontWeight={500} textAnchor="end">GOP {"→"}</text>
          <text x={PAD.l+cW-6} y={toY(85)} fontSize={10} fontFamily={MONO} fill="#4A6A4A" opacity={.7} textAnchor="end">supported</text>
          <text x={PAD.l+cW-6} y={toY(50)} fontSize={10} fontFamily={MONO} fill="#6A6A4A" opacity={.7} textAnchor="end">mixed evidence</text>
          <text x={PAD.l+cW-6} y={toY(15)} fontSize={10} fontFamily={MONO} fill="#6A4A4A" opacity={.7} textAnchor="end">contradicted</text>
          {cur.ceiling && <g opacity={.5}><line x1={PAD.l} y1={toY(70)} x2={PAD.l+cW} y2={toY(70)} stroke="#C45B5B" strokeWidth={1} strokeDasharray="6,4"/><text x={PAD.l+6} y={toY(70)-4} fontSize={10} fontFamily={MONO} fill="#C45B5B" fontWeight={500}>ceiling cap = 70</text></g>}
          {showTrails && trail.length > 1 && trail.slice(0,-1).map((pt,i) => { const next=trail[i+1]; const age=trail.length-1-i; const op=Math.max(.06,.3-age*.06); return <g key={`at${i}`} opacity={showPersonas?op*.25:op}><line x1={pt.x} y1={pt.y} x2={next.x} y2={next.y} stroke={pt.color} strokeWidth={pt.r*.35} strokeLinecap="round"/><circle cx={pt.x} cy={pt.y} r={pt.r*.28} fill={pt.color}/><text x={pt.x} y={pt.y-pt.r*.38} textAnchor="middle" fontSize={8} fontFamily={MONO} fill="#9B8D7B" opacity={.8}>{pt.decade.slice(0,4)}</text></g>; })}
          {showPersonas && showTrails && Object.entries(pTrails).map(([key,pts]) => { const pc=PERSONA_DATA[key].color; const dim=hoveredPersona&&hoveredPersona!==key; return pts.length>1 && <g key={`pt${key}`}>{pts.slice(0,-1).map((pt,i) => { const next=pts[i+1]; const op=.08+.12*(i/pts.length); return <line key={i} x1={pt.x} y1={pt.y} x2={next.x} y2={next.y} stroke={pc} strokeWidth={2.5} strokeLinecap="round" opacity={dim?op*.15:op}/>; })}</g>; })}
          {!showPersonas && <g style={{cursor:"pointer"}} onClick={() => { setShowPersonas(true); setHoveredPersona(null); }}>{sides===0?<circle cx={dotX} cy={dotY} r={r} fill={color} filter={blur>.5?"url(#fBlur)":undefined} opacity={.85}/>:<polygon points={polyPoints(dotX,dotY,r,sides)} fill={color} filter={blur>.5?"url(#fBlur)":undefined} opacity={.85}/>}<rect x={dotX-r*.28} y={dotY-r*.28} width={r*.56} height={r*.56} fill={COMPASS_COLOR} rx={1.5} opacity={.9}/></g>}
          {showPersonas && personas.map(p => { const isH=hoveredPersona===p.key; const dim=hoveredPersona&&!isH; const trig=p.v<30; return <g key={`pd${p.key}`} onMouseEnter={()=>setHoveredPersona(p.key)} onMouseLeave={()=>setHoveredPersona(null)} style={{cursor:"pointer"}}>{trig&&<circle cx={p.x} cy={p.y} r={p.r+8} fill="#C45B5B" opacity={.1}/>}<circle cx={p.x+1} cy={p.y+1.5} r={isH?p.r+2:p.r} fill="#2C2416" opacity={dim?.03:.12}/><circle cx={p.x} cy={p.y} r={isH?p.r+2:p.r} fill={p.color} filter={p.blur>.5?`url(#fb-${p.key})`:undefined} opacity={dim?.18:1} stroke={isH?"#2C2416":dim?"none":"#2C2416"} strokeWidth={isH?2:dim?0:.8} strokeOpacity={isH?.6:.2}/><rect x={p.x-p.r*.28} y={p.y-p.r*.28} width={p.r*.56} height={p.r*.56} fill={COMPASS_COLOR} rx={1} opacity={dim?.1:.9}/><text x={p.x+p.r+8} y={p.y+4} fontSize={14} fontFamily={MONO} fill={trig?"#C45B5B":dim?"#9B8D7B":p.color} fontWeight={isH?700:dim?400:500} opacity={dim?.3:1}>{p.label} {"—"} {Math.round(p.v)}{trig?" ⚠":""}</text></g>; })}
          {showPersonas && personas.length>0 && (()=>{ const maxV=Math.max(...personas.map(p=>p.v)); const minV=Math.min(...personas.map(p=>p.v)); const midY=(toY(maxV)+toY(minV))/2; const ax=PAD.l+16; return <g opacity={.65}><line x1={ax} y1={toY(maxV)} x2={ax} y2={toY(minV)} stroke="#C45B5B" strokeWidth={1.2}/><line x1={ax-4} y1={toY(maxV)} x2={ax+4} y2={toY(maxV)} stroke="#C45B5B" strokeWidth={1.2}/><line x1={ax-4} y1={toY(minV)} x2={ax+4} y2={toY(minV)} stroke="#C45B5B" strokeWidth={1.2}/><text x={ax+8} y={midY+3} fontSize={11} fontFamily={MONO} fill="#C45B5B" fontWeight={500}>{personaGap}pt gap</text></g>; })()}
          {!showPersonas && <text x={dotX} y={dotY+r+20} textAnchor="middle" fontSize={14} fontFamily={MONO} fill="#2C2416" opacity={.7} fontWeight={500}>validity {Math.round(cur.validity)} {"·"} belief {Math.round(cur.belief)}%</text>}
        </svg>
      </div>

      {/* CONTROLS (inline) */}
      <div ref={controlsInlineRef} style={{ padding: "2px 20px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={togglePlay} style={{ background: "none", border: "1px solid #C4B8A8", borderRadius: 4, width: 36, height: 30, cursor: "pointer", fontFamily: MONO, fontSize: 14, color: "#5A4E3C", display: "flex", alignItems: "center", justifyContent: "center" }}>{isPlaying?"❚❚":timeValue>=MAX_T?"↺":"▶"}</button>
          <div style={{ display: "flex", flex: 1 }}>{DECADES.map((d,i) => { const isCur=decadeIdx===i; const isPassed=i<decadeIdx; const dP=PRIMARY_DATA[d].party; return <button key={d} onClick={()=>animateTo(i)} style={{ flex:1, padding:"5px 0", cursor:"pointer", background:isCur?"#2C2416":isPassed?partyColorAlpha(dP,.12):"transparent", color:isCur?"#FAF6F0":isPassed?"#5A4E3C":"#A89880", border:`1px solid ${isCur?"#2C2416":isPassed?partyColorAlpha(dP,.25):"#C4B8A8"}`, borderRight:i<MAX_T?"none":undefined, borderRadius:i===0?"4px 0 0 4px":i===MAX_T?"0 4px 4px 0":0, fontFamily:MONO, fontSize:14, fontWeight:isCur?600:400, transition:"all 0.25s" }}>{d}</button>; })}</div>
        </div>
        <input type="range" min={0} max={MAX_T} step={0.01} className="pei-range" value={timeValue} onChange={e => { if (clickAnimRef.current) cancelAnimationFrame(clickAnimRef.current); setTimeValue(+e.target.value); setIsPlaying(false); }} />
      </div>

      {/* ACTION BAR */}
      <div style={{ padding: "0 20px 10px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontFamily: MONO, fontSize: 14, color: "#5A4E3C" }}><input type="checkbox" checked={showTrails} onChange={()=>setShowTrails(t=>!t)} style={{ width:16, height:16 }}/> Trail</label>
        {showPersonas && <span style={{ fontFamily: MONO, fontSize: 14, color: "#7A6E5E", fontStyle: "italic" }}>The gap between dots is the finding.</span>}
      </div>

      {/* SCORES */}
      {showScores && <div style={{ margin: "0 20px 10px", padding: "14px 16px", background: "#F0EBE2", borderRadius: 6, border: "1px solid #DDD5C8", fontFamily: MONO }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 10, color: "#2C2416" }}>{decadeLabel} {"—"} Scores</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <ValidityGauge value={Math.round(cur.validity)} ceiling={cur.ceiling} expanded={expandedInfo==="validity"} onToggle={()=>setExpandedInfo(expandedInfo==="validity"?null:"validity")} />
          <BeliefGauge value={Math.round(cur.belief)} expanded={expandedInfo==="belief"} onToggle={()=>setExpandedInfo(expandedInfo==="belief"?null:"belief")} />
          <PartySlider value={Math.round(cur.party)} expanded={expandedInfo==="party"} onToggle={()=>setExpandedInfo(expandedInfo==="party"?null:"party")} />
          <PolarizationHeat value={Math.round(cur.polarization)} expanded={expandedInfo==="polarization"} onToggle={()=>setExpandedInfo(expandedInfo==="polarization"?null:"polarization")} />
          <MeasurabilityLens value={Math.round(cur.measurability)} expanded={expandedInfo==="measurability"} onToggle={()=>setExpandedInfo(expandedInfo==="measurability"?null:"measurability")} />
          <CompassCard expanded={expandedInfo==="compass"} onToggle={()=>setExpandedInfo(expandedInfo==="compass"?null:"compass")} />
        </div>
        <FullWidthInfoPanel id={expandedInfo} />
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #DDD5C8" }}>
          <div style={{ fontSize: 14, color: "#5A4E3C", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 500 }}>Validity by persona</div>
          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 6 }}>
            {Object.entries(PERSONA_DATA).map(([key,pd]) => { const pv=getPersonaVal(key,timeValue); const v=Math.round(pv.v); const trig=v<30; const zc=validityZoneColor(v); return <div key={key} style={{ padding:"6px 8px", borderRadius:4, textAlign:"center", background:trig?"#FFF5F0":CARD_BG, border:`1px solid ${trig?"#D4A0A0":CARD_BORDER}` }}><div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:3 }}><div style={{ width:8, height:8, borderRadius:"50%", background:pd.color }}/><div style={{ fontSize:14, fontFamily:MONO, color:"#3D3428" }}>{pd.label}</div></div><div style={{ fontSize:24, fontWeight:600, color:zc, lineHeight:1, fontFamily:MONO, marginTop:3 }}>{v}</div><div style={{ fontSize:12, fontFamily:MONO, color:zc, marginTop:2, fontWeight:500 }}>{v>=70?"supported":v>=50?"mixed ↑":v>=30?"mixed ↓":"contradicted"}</div>{trig&&<div style={{ fontSize:12, fontFamily:MONO, color:"#C45B5B", marginTop:1, fontWeight:500 }}>{"⚠"} ceiling</div>}</div>; })}
          </div>
          {cur.ceiling && <div style={{ marginTop:8, padding:"8px 10px", background:"#FFF8F5", border:"1px solid #E8D0C8", borderRadius:4, fontSize:14, color:"#7A5040", lineHeight:1.5 }}><b style={{ color:"#C45B5B" }}>Ceiling triggered:</b> At least one group scores below 30 on validity. Aggregate capped at 70.</div>}
        </div>
      </div>}

      <div style={{ padding: "0 20px 6px", display: "flex", justifyContent: "center" }}>
        <button onClick={()=>setShowScores(s=>!s)} style={{ background:showScores?"transparent":"#EDE8DF", color:showScores?"#7A6E5E":"#3D3428", border:`1px solid ${showScores?"#C4B8A8":"#B0A494"}`, borderRadius:4, padding:"6px 20px", cursor:"pointer", fontFamily:MONO, fontSize:14, fontWeight:showScores?400:500 }}>{showScores?"Hide scores":"↓ Show all scores"}</button>
      </div>

      {/* DEMOGRAPHICS PANEL */}
      <div style={{ margin: "4px 20px 6px", borderRadius: 6, border: "1px solid #DDD5C8", overflow: "hidden", background: showDemographics ? "#F5F1EA" : "#F7F4EE" }}>
        <div onClick={()=>setShowDemographics(o=>!o)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, userSelect: "none" }}>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: "#2C2416", textTransform: "uppercase", letterSpacing: "0.08em", flex: 1 }}>Who believes this? — Demographic concentration</div>
          <span style={{ fontFamily: MONO, fontSize: 14, color: "#9B8D7B", transition: "transform 0.2s", transform: showDemographics ? "rotate(180deg)" : "none", display: "inline-block" }}>{"▼"}</span>
        </div>
        {showDemographics && <DemographicsPanel decade={decadeLabel} />}
      </div>

      {/* ALIGNMENT DRIFT PANEL */}
      <div style={{ margin: "4px 20px 6px", borderRadius: 6, border: "1px solid #DDD5C8", overflow: "hidden", background: showDrift ? "#F5F1EA" : "#F7F4EE" }}>
        <div onClick={()=>setShowDrift(o=>!o)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, userSelect: "none" }}>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: "#2C2416", textTransform: "uppercase", letterSpacing: "0.08em", flex: 1 }}>Alignment drift — Demographics × ideology over time</div>
          <span style={{ fontFamily: MONO, fontSize: 14, color: "#9B8D7B", transition: "transform 0.2s", transform: showDrift ? "rotate(180deg)" : "none", display: "inline-block" }}>{"▼"}</span>
        </div>
        {showDrift && <AlignmentDriftPanel decade={decadeLabel} />}
      </div>

      <div style={{ height: controlsSticky ? (isNarrow ? 120 : 100) : 30 }} />

      {/* STICKY BOTTOM CONTROLS */}
      {controlsSticky && <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: "rgba(250,246,240,0.97)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: "2px solid #B0A494", padding: isNarrow ? "14px 10px 20px" : "12px 16px 14px", boxShadow: "0 -4px 24px rgba(44,36,22,0.12)", animation: "stickySlideUp 0.2s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: isNarrow ? 6 : 10, maxWidth: 800, margin: "0 auto" }}>
          <button onClick={togglePlay} style={{ background: "#2C2416", color: "#FAF6F0", border: "none", borderRadius: isNarrow ? 10 : 8, width: isNarrow ? 56 : 54, height: isNarrow ? 56 : 48, cursor: "pointer", fontFamily: MONO, fontSize: isNarrow ? 26 : 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(44,36,22,0.25)" }}>{isPlaying?"❚❚":timeValue>=MAX_T?"↺":"▶"}</button>
          <div style={{ display: "flex", flex: 1, minWidth: 0 }}>{DECADES.map((d,i) => { const isCur=decadeIdx===i; const isPassed=i<decadeIdx; const dP=PRIMARY_DATA[d].party; return <button key={d} onClick={()=>animateTo(i)} style={{ flex:1, padding: isNarrow ? "16px 0" : "12px 0", cursor:"pointer", background:isCur?"#2C2416":isPassed?partyColorAlpha(dP,.15):"transparent", color:isCur?"#FAF6F0":isPassed?"#3D3428":"#A89880", border:`1.5px solid ${isCur?"#2C2416":isPassed?partyColorAlpha(dP,.3):"#C4B8A8"}`, borderRight:i<MAX_T?"none":undefined, borderRadius:i===0?(isNarrow?"10px 0 0 10px":"8px 0 0 8px"):i===MAX_T?(isNarrow?"0 10px 10px 0":"0 8px 8px 0"):0, fontFamily:MONO, fontSize: isNarrow ? 15 : 18, fontWeight:isCur?700:500, transition:"all 0.25s", letterSpacing:"-0.02em" }}>{isNarrow ? d.slice(0,4) : d}</button>; })}</div>
        </div>
      </div>}
    </div>
  );
}

// ============================================================================
// DEMOGRAPHICS PANEL (sparklines + explanations)
// ============================================================================

function DemographicsPanel({ decade }) {
  const d = DEMOGRAPHICS_DATA[decade]; if (!d) return null;
  const dims = ["age","education","sex","race","income","religion"];
  const maxConc = 0.35; const spW = 160; const spH = 40; const spPad = 3;
  const decadeIdx = DECADES.indexOf(decade);

  return <div style={{ padding: "0 14px 14px" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {dims.map(dim => {
        const dd = d[dim]; const ex = DIM_EXPLANATIONS[dim];
        const gap = dd.raw - dd.ctrl;
        const gapSignal = gap >= 0.10 ? "partisan proxy" : gap >= 0.04 ? "partial sort" : dd.ctrl > dd.raw ? "ideology proxy" : "independent";
        const gapColor = gap >= 0.10 ? "#9B7040" : gap >= 0.04 ? "#7A7A5A" : dd.ctrl > dd.raw ? "#7040A0" : "#4A7A5A";

        const rawPts = DECADES.map((dec, i) => { const val = DEMOGRAPHICS_DATA[dec]?.[dim]?.raw ?? 0; return { x: spPad + (i / (DECADES.length - 1)) * (spW - 2 * spPad), y: Math.max(spPad, spH - spPad - (val / maxConc) * (spH - 2 * spPad)), val }; });
        const ctrlPts = DECADES.map((dec, i) => { const val = DEMOGRAPHICS_DATA[dec]?.[dim]?.ctrl ?? 0; return { x: spPad + (i / (DECADES.length - 1)) * (spW - 2 * spPad), y: Math.max(spPad, spH - spPad - (val / maxConc) * (spH - 2 * spPad)), val }; });
        const rawPath = rawPts.map((p,i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
        const ctrlPath = ctrlPts.map((p,i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ");

        return <div key={dim} style={{ background: CARD_BG, borderRadius: 6, padding: "10px 12px", border: `1px solid ${CARD_BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: VALUE_COLOR }}>{ex.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: gapColor, fontWeight: 500, padding: "1px 8px", borderRadius: 3, background: `${gapColor}12`, border: `1px solid ${gapColor}25` }}>{gapSignal}</span>
            </div>
            <div style={{ display: "flex", gap: 10, fontFamily: MONO, fontSize: 14, fontWeight: 600 }}>
              <span style={{ color: "#8B6B3A" }}>{(dd.raw*100).toFixed(0)}%</span>
              <span style={{ color: "#5B8858" }}>{(dd.ctrl*100).toFixed(0)}%</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <svg width={spW} height={spH+14} style={{ flexShrink: 0 }}>
              {DECADES.map((_,i) => { const x=spPad+(i/(DECADES.length-1))*(spW-2*spPad); return <line key={i} x1={x} y1={spH-spPad} x2={x} y2={spH-spPad+3} stroke="#C4B8A8" strokeWidth={.5}/>; })}
              <path d={rawPath} fill="none" stroke="#B8A078" strokeWidth={1.5} opacity={.35}/>
              <path d={rawPts.slice(0,decadeIdx+1).map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ")} fill="none" stroke="#8B6B3A" strokeWidth={2}/>
              <path d={ctrlPath} fill="none" stroke="#7BA878" strokeWidth={1.5} opacity={.35}/>
              <path d={ctrlPts.slice(0,decadeIdx+1).map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ")} fill="none" stroke="#5B8858" strokeWidth={2}/>
              <circle cx={rawPts[decadeIdx].x} cy={rawPts[decadeIdx].y} r={4} fill="#8B6B3A" stroke="#FAF6F0" strokeWidth={1.5}/>
              <circle cx={ctrlPts[decadeIdx].x} cy={ctrlPts[decadeIdx].y} r={4} fill="#5B8858" stroke="#FAF6F0" strokeWidth={1.5}/>
              <text x={spPad} y={spH+11} fontSize={9} fontFamily={MONO} fill="#9B8D7B">70s</text>
              <text x={spW-spPad} y={spH+11} textAnchor="end" fontSize={9} fontFamily={MONO} fill="#9B8D7B">20s</text>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "#3D3428", lineHeight: 1.5, marginBottom: 4 }}>{ex.insight(decade)}</div>
              <div style={{ fontSize: 14, color: LABEL_COLOR, fontStyle: "italic" }}>Peak: {dd.peak}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 6, fontFamily: MONO, fontSize: 12, color: LABEL_COLOR }}>
            <span><span style={{ display:"inline-block", width:14, height:2, background:"#8B6B3A", verticalAlign:"middle", marginRight:4 }}/>raw: {ex.raw_q.toLowerCase()}</span>
            <span><span style={{ display:"inline-block", width:14, height:2, background:"#5B8858", verticalAlign:"middle", marginRight:4 }}/>ctrl: {ex.ctrl_q.toLowerCase()}</span>
          </div>
        </div>;
      })}
    </div>
    <div style={{ marginTop:10, padding:"10px 12px", background:"#EDE8DF", borderRadius:6, border:`1px solid ${CARD_BORDER}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
      <div><div style={{ fontFamily:MONO, fontSize:14, color:VALUE_COLOR, fontWeight:600, textTransform:"uppercase" }}>Universality</div><div style={{ fontSize:14, color:LABEL_COLOR, marginTop:2 }}>1 = everyone believes equally. 0 = one group only.</div></div>
      <div style={{ display:"flex", gap:14, alignItems:"baseline" }}>
        <div style={{ textAlign:"center" }}><div style={{ fontFamily:MONO, fontSize:22, fontWeight:600, color:"#6B5B3A" }}>{(d.universality_raw??0).toFixed(2)}</div><div style={{ fontFamily:MONO, fontSize:12, color:"#8A7E6E" }}>raw</div></div>
        <div style={{ textAlign:"center" }}><div style={{ fontFamily:MONO, fontSize:22, fontWeight:600, color:"#5B7B5A" }}>{(d.universality_ctrl??0).toFixed(2)}</div><div style={{ fontFamily:MONO, fontSize:12, color:"#6B8B6A" }}>controlled</div></div>
      </div>
    </div>
  </div>;
}

// ============================================================================
// ALIGNMENT DRIFT PANEL
// ============================================================================

function AlignmentDriftPanel({ decade }) {
  const dims = ["education","sex","age","income","religion","race"];
  const decadeIdx = DECADES.indexOf(decade); if (decadeIdx < 0) return null;
  const spW = 160; const spH = 40; const spPad = 3;
  const yMid = spH / 2; const yScale = (spH / 2 - spPad) / 0.5;

  return <div style={{ padding: "0 14px 14px" }}>
    <div style={{ fontSize: 14, color: "#5A4E3C", lineHeight: 1.5, marginBottom: 10 }}>How the correlation between each demographic group and political ideology has shifted over time. When a demographic shifts left or right, beliefs that LOOK like they're changing might just be partisan realignment in disguise.</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {dims.map(dim => {
        const dd = ALIGNMENT_DRIFT[dim]; const curVal = dd.values[decade] ?? 0; const firstVal = dd.values["1970s"] ?? 0; const totalDrift = curVal - firstVal;
        const pts = DECADES.map((d,i) => ({ x: spPad+(i/(DECADES.length-1))*(spW-2*spPad), y: yMid-dd.values[d]*yScale, v: dd.values[d] }));
        const pathD = pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
        const driftColor = curVal > 0.15 ? "#3B6FA0" : curVal < -0.05 ? "#A04040" : "#8A8580";
        const arrowDir = totalDrift > 0.05 ? "↑" : totalDrift < -0.05 ? "↓" : "→";

        return <div key={dim} style={{ background: CARD_BG, borderRadius: 5, padding: "8px 10px", border: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 120, flexShrink: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: VALUE_COLOR }}>{dd.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: LABEL_COLOR, marginTop: 1 }}>{dd.desc}</div>
          </div>
          <svg width={spW} height={spH} style={{ flexShrink: 0 }}>
            <line x1={spPad} y1={yMid} x2={spW-spPad} y2={yMid} stroke="#C4B8A8" strokeWidth={.5} strokeDasharray="3,3"/>
            <text x={spW-spPad} y={spPad+7} textAnchor="end" fontSize={8} fontFamily={MONO} fill="#3B6FA0" opacity={.5}>left</text>
            <text x={spW-spPad} y={spH-spPad+1} textAnchor="end" fontSize={8} fontFamily={MONO} fill="#A04040" opacity={.5}>right</text>
            <path d={pathD} fill="none" stroke={driftColor} strokeWidth={1.5} opacity={.4}/>
            {decadeIdx>0 && (()=>{ const ap=pts.slice(0,decadeIdx+1); return <path d={ap.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ")} fill="none" stroke={driftColor} strokeWidth={2.5}/>; })()}
            {pts.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r={i===decadeIdx?4:2} fill={i<=decadeIdx?driftColor:"#C4B8A8"} stroke={i===decadeIdx?"#FAF6F0":"none"} strokeWidth={i===decadeIdx?1.5:0} opacity={i<=decadeIdx?1:.3}/>)}
          </svg>
          <div style={{ display:"flex", gap:8, alignItems:"baseline", flexShrink:0 }}>
            <div style={{ fontFamily:MONO, fontSize:18, fontWeight:600, color:driftColor }}>{curVal>0?"+":""}{curVal.toFixed(2)}</div>
            <div style={{ fontFamily:MONO, fontSize:14, color:totalDrift>0.05?"#3B6FA0":totalDrift<-0.05?"#A04040":"#8A8580" }}>{arrowDir}{Math.abs(totalDrift).toFixed(2)}</div>
          </div>
          <div style={{ fontSize:14, color:LABEL_COLOR, fontStyle:"italic", flex:1, minWidth:140 }}>{dd.drift_note}</div>
        </div>;
      })}
    </div>
    <div style={{ marginTop:10, padding:"10px 12px", background:"#EDE8DF", borderRadius:6, border:`1px solid ${CARD_BORDER}` }}>
      <div style={{ fontSize:14, color:"#4A3F32", lineHeight:1.5 }}><b style={{ fontFamily:MONO, fontSize:12, color:VALUE_COLOR }}>WHY THIS MATTERS:</b> When college-educated people shift from believing "hard work = homeownership" to doubting it, is it because <em>college-educated people changed their minds</em>, or because <em>who is college-educated and politically engaged</em> changed? Education's correlation with left ideology went from -0.15 to +0.40 — the biggest inversion in the table.</div>
    </div>
  </div>;
}

// ============================================================================
// LEGEND
// ============================================================================

function LegendContent({ layer, setLayer }) {
  return <div style={{ padding: "0 14px 14px" }}>
    <div style={{ display:"flex", gap:4, marginBottom:10 }}>{["The axes","The dot","Interactions"].map((label,i) => <button key={i} onClick={()=>setLayer(i)} style={{ background:layer===i?"#2C2416":"transparent", color:layer===i?"#FAF6F0":"#7A6E5E", border:`1px solid ${layer===i?"#2C2416":"#C4B8A8"}`, borderRadius:3, padding:"4px 12px", cursor:"pointer", fontFamily:MONO, fontSize:14, fontWeight:layer===i?600:400 }}>{label}</button>)}</div>
    {layer === 0 && <AxesLayer />}{layer === 1 && <DotLayer />}{layer === 2 && <InteractionsLayer />}
  </div>;
}
function LR({ visual, title, desc }) { return <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}><div style={{ flexShrink:0 }}>{visual}</div><div><div style={{ fontFamily:MONO, fontSize:15, fontWeight:600, color:"#2C2416", marginBottom:3 }}>{title}</div><div style={{ fontSize:14, color:"#4A3F32", lineHeight:1.55 }}>{desc}</div></div></div>; }
function AxesLayer() { return <div style={{ display:"flex", flexDirection:"column", gap:16 }}><LR visual={<svg width={120} height={88} viewBox="0 0 120 88"><rect x={8} y={6} width={104} height={76} fill="#F4EFE6" rx={3} stroke="#DDD5C8" strokeWidth={.8}/><line x1={12} y1={10} x2={12} y2={78} stroke="#B8AFA0"/><line x1={12} y1={78} x2={108} y2={78} stroke="#B8AFA0"/><path d="M12,10 L7,20 L17,20Z" fill="#5A7A5A" opacity={.6}/><text x={22} y={22} fontSize={10} fontFamily={MONO} fill="#5A7A5A">true</text><path d="M12,78 L7,68 L17,68Z" fill="#7A5A5A" opacity={.6}/><text x={22} y={73} fontSize={10} fontFamily={MONO} fill="#7A5A5A">false</text><circle cx={72} cy={32} r={9} fill="#9B9590" opacity={.8}/><rect x={69} y={29} width={6} height={6} fill="#D4A054" rx={1} opacity={.9}/></svg>} title="Vertical = how true" desc="Top = evidence supports. Bottom = evidence contradicts. Moves as data changes." /><LR visual={<svg width={120} height={88} viewBox="0 0 120 88"><rect x={8} y={6} width={104} height={76} fill="#F4EFE6" rx={3} stroke="#DDD5C8" strokeWidth={.8}/><defs><linearGradient id="lgP" x1="0" x2="1"><stop offset="0%" stopColor="#2D55B9"/><stop offset="50%" stopColor="#9B9590"/><stop offset="100%" stopColor="#C33737"/></linearGradient></defs><rect x={16} y={66} width={88} height={8} rx={4} fill="url(#lgP)" opacity={.5}/><text x={18} y={62} fontSize={9} fontFamily={MONO} fill="#3B6FA0">DNC</text><text x={102} y={62} textAnchor="end" fontSize={9} fontFamily={MONO} fill="#A04040">GOP</text><circle cx={76} cy={36} r={9} fill="#A09080" opacity={.8}/><rect x={73} y={33} width={6} height={6} fill="#D4A054" rx={1} opacity={.9}/></svg>} title="Horizontal = who owns it" desc="Left = Democrats. Right = Republicans. Center = bipartisan. Drifts as ownership shifts." /><div style={{ fontSize:14, color:"#5A4E3C", lineHeight:1.55, fontStyle:"italic", paddingTop:6, borderTop:"1px solid #DDD5C8" }}>The interesting stories happen when dots move.</div></div>; }
function DotLayer() { return <div style={{ display:"flex", flexDirection:"column", gap:16 }}><LR visual={<svg width={120} height={80} viewBox="0 0 120 80"><circle cx={30} cy={36} r={8} fill="#9B9590" opacity={.7}/><text x={30} y={62} textAnchor="middle" fontSize={10} fontFamily={MONO} fill="#9B8D7B">few</text><circle cx={82} cy={36} r={22} fill="#9B9590" opacity={.7}/><rect x={76} y={30} width={12} height={12} fill="#D4A054" rx={2} opacity={.9}/><text x={82} y={68} textAnchor="middle" fontSize={10} fontFamily={MONO} fill="#9B8D7B">many</text></svg>} title="Size = belief prevalence" desc="Bigger = more people hold this belief." /><LR visual={<svg width={120} height={80} viewBox="0 0 120 80"><circle cx={22} cy={36} r={12} fill="#2D55B9" opacity={.8}/><circle cx={60} cy={36} r={12} fill="#9B9590" opacity={.8}/><circle cx={98} cy={36} r={12} fill="#C33737" opacity={.8}/><text x={22} y={62} textAnchor="middle" fontSize={9} fontFamily={MONO} fill="#3B6FA0">DNC</text><text x={60} y={62} textAnchor="middle" fontSize={9} fontFamily={MONO} fill="#8A8580">neutral</text><text x={98} y={62} textAnchor="middle" fontSize={9} fontFamily={MONO} fill="#A04040">GOP</text></svg>} title="Color = party ownership" desc="Blue = Democrat. Red = Republican. Gray = bipartisan." /><LR visual={<svg width={120} height={80} viewBox="0 0 120 80"><defs><filter id="lgB"><feGaussianBlur stdDeviation={4}/></filter></defs><circle cx={32} cy={36} r={14} fill="#6B8A6B" opacity={.8}/><text x={32} y={62} textAnchor="middle" fontSize={9} fontFamily={MONO} fill="#5A7A5A">clear</text><circle cx={88} cy={36} r={14} fill="#6B8A6B" opacity={.65} filter="url(#lgB)"/><text x={88} y={62} textAnchor="middle" fontSize={9} fontFamily={MONO} fill="#9B8D7B">fuzzy</text></svg>} title="Blur = confidence" desc="Sharp = hard data. Fuzzy = proxies. Take with a grain of salt." /><LR visual={<svg width={120} height={80} viewBox="0 0 120 80"><circle cx={60} cy={36} r={22} fill="#9B9590" opacity={.7}/><rect x={53} y={29} width={14} height={14} fill="#D4A054" rx={2.5} opacity={.9}/><text x={60} y={70} textAnchor="middle" fontSize={9} fontFamily={MONO} fill="#8A7040">fixed</text></svg>} title="Inner square = ideology" desc="The gold square never changes. It's the anchor: same claim, different era." /></div>; }
function InteractionsLayer() { return <div style={{ display:"flex", flexDirection:"column", gap:16 }}><LR visual={<svg width={120} height={80} viewBox="0 0 120 80"><circle cx={20} cy={62} r={5} fill="#3B6FA0" opacity={.15}/><line x1={20} y1={62} x2={48} y2={44} stroke="#5B78A0" strokeWidth={2.5} opacity={.15}/><circle cx={48} cy={44} r={6} fill="#6B78A0" opacity={.25}/><line x1={48} y1={44} x2={80} y2={28} stroke="#9B9590" strokeWidth={3.5} opacity={.25}/><circle cx={80} cy={28} r={9} fill="#A09080" opacity={.8}/><rect x={76} y={24} width={8} height={8} fill="#D4A054" rx={1.5} opacity={.9}/><text x={20} y={74} textAnchor="middle" fontSize={8} fontFamily={MONO} fill="#9B8D7B">past</text><text x={80} y={46} textAnchor="middle" fontSize={8} fontFamily={MONO} fill="#7A6E5E">now</text></svg>} title="Trail = history" desc="Fading path shows where the dot has been. Thickness = past belief size." /><LR visual={<svg width={120} height={80} viewBox="0 0 120 80"><circle cx={60} cy={12} r={7} fill="#5B7B8A" opacity={.8}/><circle cx={60} cy={30} r={7} fill="#8A7B5B" opacity={.8}/><circle cx={60} cy={48} r={7} fill="#6B5B8A" opacity={.8}/><circle cx={60} cy={66} r={7} fill="#8A5B6B" opacity={.8}/><line x1={40} y1={12} x2={40} y2={66} stroke="#C45B5B" strokeWidth={1.5}/><line x1={36} y1={12} x2={44} y2={12} stroke="#C45B5B" strokeWidth={1.5}/><line x1={36} y1={66} x2={44} y2={66} stroke="#C45B5B" strokeWidth={1.5}/><text x={34} y={42} textAnchor="end" fontSize={10} fontFamily={MONO} fill="#C45B5B">gap</text><text x={72} y={15} fontSize={8} fontFamily={MONO} fill="#5B7B8A">WM</text><text x={72} y={33} fontSize={8} fontFamily={MONO} fill="#8A7B5B">WF</text><text x={72} y={51} fontSize={8} fontFamily={MONO} fill="#6B5B8A">BM</text><text x={72} y={69} fontSize={8} fontFamily={MONO} fill="#8A5B6B">BF</text></svg>} title="Personas = who the average erases" desc="Split the dot into demographic groups. The gap IS the finding." /></div>; }

// ============================================================================
// SCORE CARDS
// ============================================================================

const INFO_DEFS = { validity: "How true is this claim? 0–100 from three indicators: affordability ratio, employment access, hours to down payment. Above 70 = supported. 30–49 = mixed, more false. Below 30 = contradicted.", belief: "What % endorses this claim? From Gallup, Pew, GSS. General meritocratic belief (~60%) exceeds mechanism-specific belief (33–36%).", party: "Who advocates for this? −100 (core Dem) to +100 (core GOP). Measures political ownership, not ideology (that’s the compass).", polarization: "Rejection BECAUSE the other side advocates, not on substance? 0–20 = evidence-based. 50+ = tribal.", measurability: "How testable? 85+ = directly measurable. Below 50 = mostly subjective. Determines the dot’s blur.", compass: "The claim’s intrinsic ideology. PEI-001: economic +55, authority −10. Never moves. When compass and party ownership diverge, you’re seeing political realignment." };
function IB({ expanded, onToggle }) { return <span onClick={e=>{e.stopPropagation();onToggle()}} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:20, height:20, borderRadius:"50%", cursor:"pointer", background:expanded?"#2C2416":"transparent", color:expanded?"#FAF6F0":"#8A7E6E", border:`1px solid ${expanded?"#2C2416":"#B0A494"}`, fontFamily:MONO, fontSize:11, fontWeight:600, marginLeft:4 }}>i</span>; }
function CS({ children, label, infoId, expanded, onToggle, alert }) { const hl=expanded&&infoId; return <div style={{ background:alert?"#FDF6F3":hl?"#EDE8DF":CARD_BG, borderRadius:5, padding:"10px 12px", border:`1.5px solid ${alert?"#D4A8A0":hl?"#B0A490":CARD_BORDER}`, minHeight:100, display:"flex", flexDirection:"column", boxShadow:hl?"0 1px 4px #00000012":"none" }}><div style={{ display:"flex", alignItems:"center", marginBottom:6 }}><div style={{ fontFamily:MONO, fontSize:14, color:alert?"#8B5040":LABEL_COLOR, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:500 }}>{label}</div>{infoId&&<IB expanded={expanded} onToggle={onToggle}/>}</div>{children}</div>; }
function FullWidthInfoPanel({ id }) { if (!id || !INFO_DEFS[id]) return null; const t = { validity:"Validity", belief:"Belief Prevalence", party:"Party Ownership", polarization:"Polarization Resistance", measurability:"Measurability", compass:"Political Compass" }; return <div style={{ marginTop:10, padding:"10px 14px", borderRadius:4, background:"#E8E2D8", border:"1px solid #D4CEC4" }}><div style={{ fontFamily:MONO, fontSize:14, color:VALUE_COLOR, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{t[id]}</div><div style={{ fontSize:15, color:"#3D3428", lineHeight:1.6 }}>{INFO_DEFS[id]}</div></div>; }
function ValidityGauge({ value, ceiling, expanded, onToggle }) { const zc=validityZoneColor(value); return <CS label="Validity" infoId="validity" expanded={expanded} onToggle={onToggle} alert={ceiling}><div style={{ display:"flex", alignItems:"flex-end", gap:10, flex:1 }}><div style={{ fontSize:28, fontWeight:600, color:zc, lineHeight:1, fontFamily:MONO }}>{value}</div><svg width={18} height={58}><rect x={1} y={40.6} width={16} height={17.4} fill="#DCBCBC"/><rect x={1} y={29} width={16} height={11.6} fill="#DCD0B0"/><rect x={1} y={17.4} width={16} height={11.6} fill="#C8D4B4"/><rect x={1} y={0} width={16} height={17.4} rx={2} fill="#A8C8AC"/><rect x={0} y={58-(value/100)*58-2} width={18} height={4} rx={2} fill={zc} opacity={.9}/><rect x={1} y={0} width={16} height={58} rx={2} fill="none" stroke={CARD_BORDER}/></svg><div style={{ fontFamily:MONO, fontSize:14, color:zc, fontWeight:600 }}>{value>=70?"supported":value>=50?"mixed ↑":value>=30?"mixed ↓":"contradicted"}</div></div>{ceiling&&<div style={{ marginTop:6, fontFamily:MONO, fontSize:14, color:"#A04040", fontWeight:500 }}>{"⚠"} Capped at 70</div>}</CS>; }
function BeliefGauge({ value, expanded, onToggle }) { const fc="#4A6B8A"; return <CS label="Belief" infoId="belief" expanded={expanded} onToggle={onToggle}><div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}><div style={{ fontSize:28, fontWeight:600, color:VALUE_COLOR, lineHeight:1, fontFamily:MONO }}>{value}<span style={{ fontSize:14, fontWeight:400, color:LABEL_COLOR }}>%</span></div><svg width={24} height={48}><rect x={1} y={1} width={22} height={46} rx={3} fill="#DDD5C8" stroke={CARD_BORDER}/><rect x={2} y={47-(value/100)*44} width={20} height={(value/100)*44} rx={2} fill={fc} opacity={.8}/><line x1={1} y1={24} x2={23} y2={24} stroke="#B0A898" strokeWidth={.7} strokeDasharray="2,2"/></svg></div><div style={{ fontFamily:MONO, fontSize:14, color:value>=60?fc:LABEL_COLOR, fontWeight:500, marginTop:3 }}>{value>=60?"mainstream":value>=40?"divided":"minority view"}</div></CS>; }
function PartySlider({ value, expanded, onToggle }) { const pct=(value+100)/200*100; return <CS label="Party" infoId="party" expanded={expanded} onToggle={onToggle}><div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}><div style={{ position:"relative", height:14, borderRadius:7, overflow:"hidden", border:`1px solid ${CARD_BORDER}` }}><div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg,#3B6FA0 0%,#7A8B8F 35%,#B0A89C 50%,#A09080 65%,#A04040 100%)" }}/><div style={{ position:"absolute", top:-1, left:`${pct}%`, width:16, height:16, borderRadius:"50%", background:partyColor(value), border:"2px solid #FAF6F0", transform:"translateX(-8px)", boxShadow:"0 1px 4px #00000030" }}/></div><div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}><span style={{ fontFamily:MONO, fontSize:12, color:"#2D55B9", fontWeight:500 }}>DNC</span><span style={{ fontFamily:MONO, fontSize:14, color:partyColor(value), fontWeight:600 }}>{value>40?"GOP-coded":value>15?"leans GOP":value<-15?"leans DNC":"bipartisan"}</span><span style={{ fontFamily:MONO, fontSize:12, color:"#A04040", fontWeight:500 }}>GOP</span></div></div></CS>; }
function PolarizationHeat({ value, expanded, onToggle }) { const hc=value>50?"#A04040":value>25?"#A07040":value>10?"#8B8B5E":"#5E7B8B"; return <CS label="Polarization" infoId="polarization" expanded={expanded} onToggle={onToggle}><div style={{ display:"flex", alignItems:"flex-end", gap:10, flex:1 }}><div style={{ fontSize:28, fontWeight:600, color:hc, lineHeight:1, fontFamily:MONO }}>{value}</div><svg width={14} height={52}><rect x={1} y={1} width={12} height={50} rx={6} fill="#E8E2D8" stroke={CARD_BORDER}/>{value>0&&<rect x={2} y={51-(value/100)*48} width={10} height={Math.max(4,(value/100)*48)} rx={5} fill={hc} opacity={.4+.6*(value/100)}/>}</svg></div><div style={{ fontFamily:MONO, fontSize:14, color:hc, fontWeight:600, marginTop:3 }}>{value>50?"tribal":value>25?"identity component":value>10?"moderate":"substantive"}</div></CS>; }
function MeasurabilityLens({ value, expanded, onToggle }) { const bp=Math.max(0,(100-value)*.18); return <CS label="Measurability" infoId="measurability" expanded={expanded} onToggle={onToggle}><div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}><div style={{ fontSize:28, fontWeight:600, color:VALUE_COLOR, lineHeight:1, fontFamily:MONO }}>{value}</div><svg width={40} height={40}><defs><filter id="mB"><feGaussianBlur stdDeviation={bp}/></filter></defs><circle cx={20} cy={20} r={15} fill="#7B8B6B" opacity={.75} filter={bp>.3?"url(#mB)":undefined}/><circle cx={20} cy={20} r={15} fill="none" stroke="#B0A898" strokeWidth={.7} strokeDasharray="2,3"/></svg></div><div style={{ fontFamily:MONO, fontSize:14, color:LABEL_COLOR, fontWeight:500, marginTop:3 }}>{value>=85?"directly measurable":value>=70?"good proxies":"assumptions needed"}</div></CS>; }
function CompassCard({ expanded, onToggle }) { const s=56; const cx=s/2+(55/100)*(s/2); const cy=s/2-(-10/100)*(s/2); return <CS label="Compass (fixed)" infoId="compass" expanded={expanded} onToggle={onToggle}><div style={{ display:"flex", alignItems:"center", gap:8, flex:1 }}><svg width={s} height={s}><rect x={0} y={0} width={s/2} height={s/2} fill="#E8E0D4" opacity={.4}/><rect x={s/2} y={0} width={s/2} height={s/2} fill="#E0D4D4" opacity={.4}/><rect x={0} y={s/2} width={s/2} height={s/2} fill="#D4E0D4" opacity={.4}/><rect x={s/2} y={s/2} width={s/2} height={s/2} fill="#D8D4C8" opacity={.4}/><line x1={s/2} y1={0} x2={s/2} y2={s} stroke="#B0A898" strokeWidth={.5}/><line x1={0} y1={s/2} x2={s} y2={s/2} stroke="#B0A898" strokeWidth={.5}/><rect x={cx-5} y={cy-5} width={10} height={10} fill="#D4A054" rx={2} stroke="#2C2416" strokeWidth={.7} strokeOpacity={.4}/></svg><div style={{ display:"flex", flexDirection:"column", gap:2 }}><div style={{ fontFamily:MONO, fontSize:14, color:"#8A7040", fontWeight:600 }}>right libertarian</div><div style={{ fontFamily:MONO, fontSize:12, color:LABEL_COLOR }}>econ +55 {"·"} auth -10</div><div style={{ fontFamily:MONO, fontSize:12, color:LABEL_COLOR, fontStyle:"italic" }}>never changes</div></div></div></CS>; }
