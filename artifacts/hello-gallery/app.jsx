import { useState, useEffect, Fragment } from "react";
import { createRoot } from "react-dom/client";

const DEPLOYED_AT = "2026-05-01";

function App() {
  const [clicks, setClicks] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [stored, setStored] = useState(() => {
    try {
      return Number(localStorage.getItem("hello-gallery-clicks") || 0);
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    if (clicks === 0) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 200);
    try {
      const next = stored + 1;
      localStorage.setItem("hello-gallery-clicks", String(next));
      setStored(next);
    } catch {}
    return () => clearTimeout(t);
  }, [clicks]);

  const wrap = {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    gap: "32px",
  };

  const eyebrow = {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#4b5563",
  };

  const headline = {
    fontSize: 56,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    lineHeight: 1.05,
    textAlign: "center",
    transition: "transform 0.2s ease, color 0.2s ease",
    transform: pulse ? "scale(1.03)" : "scale(1)",
    color: pulse ? "#34d399" : "#e5e7eb",
  };

  const sub = {
    fontSize: 15,
    color: "#6b7280",
    maxWidth: 520,
    textAlign: "center",
    lineHeight: 1.6,
  };

  const card = {
    background: "rgba(255, 255, 255, 0.02)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: 10,
    padding: "20px 28px",
    display: "flex",
    gap: 24,
    alignItems: "center",
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
  };

  const divider = {
    width: 1,
    height: 24,
    background: "rgba(255, 255, 255, 0.06)",
  };

  const button = {
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    padding: "12px 28px",
    borderRadius: 6,
    border: "1px solid rgba(52, 211, 153, 0.25)",
    background: "rgba(16, 185, 129, 0.08)",
    color: "#34d399",
    cursor: "pointer",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    transition: "all 0.15s ease",
  };

  const note = {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    color: "#374151",
    textAlign: "center",
    lineHeight: 1.7,
  };

  const stats = [
    { label: "DEPLOYED", value: DEPLOYED_AT, accent: "#60a5fa" },
    { label: "PIPELINE", value: "vite → pages", accent: "#34d399" },
    { label: "CLICKS", value: clicks, accent: "#f59e0b" },
  ];

  return (
    <div style={wrap}>
      <div style={eyebrow}>artifact gallery / pipeline test</div>
      <h1 style={headline}>Hello, Gallery.</h1>
      <p style={sub}>
        First artifact deployed via the Cowork-driven pipeline. If you can read
        this, Vite compiled JSX in CI, GitHub Actions deployed to Pages, and the
        loop is closed.
      </p>

      <div style={card}>
        {stats.map((s, i) => (
          <Fragment key={s.label}>
            <div>
              <div style={{ color: "#4b5563", marginBottom: 4 }}>{s.label}</div>
              <div style={{ color: s.accent, fontWeight: 500 }}>{s.value}</div>
            </div>
            {i < stats.length - 1 && <div style={divider} />}
          </Fragment>
        ))}
      </div>

      <button
        style={button}
        onClick={() => setClicks((c) => c + 1)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(16, 185, 129, 0.16)";
          e.currentTarget.style.borderColor = "rgba(52, 211, 153, 0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(16, 185, 129, 0.08)";
          e.currentTarget.style.borderColor = "rgba(52, 211, 153, 0.25)";
        }}
      >
        Ping the pipeline
      </button>

      <div style={note}>
        persistent across reloads · {stored} total pings on this device
        <br />
        proof that localStorage works on your own pages site
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
