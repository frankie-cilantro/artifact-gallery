import { useState, useEffect, useRef, useCallback } from "react";

const ACCENTS = {
  intro: "#a78bfa",
  editing: "#f97316",
  navigation: "#10b981",
  history: "#06b6d4",
  process: "#f43f5e",
  tmux: "#eab308",
  git: "#3b82f6",
  servers: "#14b8a6",
  ports: "#ec4899",
};

const SECTIONS = [
  { id: "intro", label: "Why text?" },
  { id: "editing", label: "Editing" },
  { id: "navigation", label: "Moving around" },
  { id: "history", label: "Recall" },
  { id: "process", label: "Processes" },
  { id: "servers", label: "Servers" },
  { id: "ports", label: "Ports" },
  { id: "tmux", label: "tmux" },
  { id: "git", label: "Git workflow" },
];

// ============================================================
// SHARED PRIMITIVES
// ============================================================

const Panel = ({ accent, children, style }) => (
  <div style={{
    background: "rgba(30,41,59,0.5)",
    border: `1px solid ${accent}30`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: "6px",
    padding: "20px 24px",
    marginBottom: "16px",
    ...style,
  }}>{children}</div>
);

const SectionHeading = ({ accent, label, title }) => (
  <div style={{ marginBottom: "20px" }}>
    <div style={{
      fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em",
      color: accent, opacity: 0.7, marginBottom: "6px",
    }}>{label}</div>
    <h2 style={{
      fontSize: "22px", fontWeight: 600, margin: 0, color: "#f8fafc",
      letterSpacing: "-0.01em",
    }}>{title}</h2>
  </div>
);

const Kbd = ({ children, accent = "#94a3b8" }) => (
  <kbd style={{
    fontFamily: "inherit",
    fontSize: "11px",
    padding: "2px 7px",
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${accent}40`,
    borderRadius: "3px",
    color: accent,
    margin: "0 2px",
    whiteSpace: "nowrap",
  }}>{children}</kbd>
);

const Callout = ({ accent, label, children }) => (
  <div style={{
    background: `${accent}10`,
    border: `1px solid ${accent}30`,
    borderRadius: "4px",
    padding: "12px 14px",
    marginTop: "14px",
    fontSize: "12px",
    lineHeight: 1.6,
    color: "#cbd5e1",
  }}>
    <div style={{
      fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em",
      color: accent, fontWeight: 600, marginBottom: "4px",
    }}>{label}</div>
    {children}
  </div>
);

// ============================================================
// INTRO SECTION
// ============================================================

const IntroSection = () => {
  const accent = ACCENTS.intro;
  return (
    <div>
      <SectionHeading accent={accent} label="The mental model" title="Why is the terminal like this?" />
      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#cbd5e1" }}>
        The terminal emulates a 1970s hardware device that read keystrokes as a stream. Each line you type
        gets consumed when you press <Kbd accent={accent}>Enter</Kbd> and becomes <strong style={{color:"#f8fafc"}}>read-only history</strong>.
        Only the current command line is editable.
      </p>
      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#cbd5e1" }}>
        That's why you can't click into past output and edit it — you're not in a document. You're in a stream.
        On macOS Terminal you <em>can</em> mouse-select text to <strong style={{color:"#f8fafc"}}>copy</strong> it with{" "}
        <Kbd accent={accent}>⌘C</Kbd>, but you can't move your typing cursor with a click. The cursor lives on the
        active input line and is driven by keyboard only.
      </p>

      <Panel accent={accent} style={{ marginTop: "20px" }}>
        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: accent, marginBottom: "10px", fontWeight: 600 }}>
          The three layers
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "10px 16px", fontSize: "13px", lineHeight: 1.6 }}>
          <div style={{ color: accent, fontWeight: 600 }}>Scrollback</div>
          <div style={{ color: "#cbd5e1" }}>Past output. Read-only. Selectable to copy, not editable.</div>
          <div style={{ color: accent, fontWeight: 600 }}>Prompt line</div>
          <div style={{ color: "#cbd5e1" }}>The line you're typing on right now. The only editable region. Keyboard-driven.</div>
          <div style={{ color: accent, fontWeight: 600 }}>Running process</div>
          <div style={{ color: "#cbd5e1" }}>When a command is running, the prompt is gone — output streams until the program exits.</div>
        </div>
      </Panel>

      <Callout accent={accent} label="If this annoys you">
        iTerm2 (free Terminal replacement) supports click-to-position the cursor when shell integration is enabled.
        Worth installing if mouse-free editing keeps slowing you down. Most macOS devs use iTerm2 over Terminal.app.
      </Callout>
    </div>
  );
};

// ============================================================
// EDITING SECTION — interactive cursor demo
// ============================================================

const EditingSection = () => {
  const accent = ACCENTS.editing;
  const initial = "cd /Users/druemclean/projects/options-edge";
  const [text, setText] = useState(initial);
  const [cursor, setCursor] = useState(initial.length);
  const [lastAction, setLastAction] = useState("Cursor at end of line");

  const reset = () => { setText(initial); setCursor(initial.length); setLastAction("Reset"); };

  const wordLeft = () => {
    let i = cursor - 1;
    while (i > 0 && text[i] === " ") i--;
    while (i > 0 && text[i - 1] !== " " && text[i - 1] !== "/") i--;
    setCursor(Math.max(0, i)); setLastAction("⌥ ← jumped one word back");
  };
  const wordRight = () => {
    let i = cursor;
    while (i < text.length && (text[i] === " " || text[i] === "/")) i++;
    while (i < text.length && text[i] !== " " && text[i] !== "/") i++;
    setCursor(Math.min(text.length, i)); setLastAction("⌥ → jumped one word forward");
  };
  const lineStart = () => { setCursor(0); setLastAction("⌃A jumped to start of line"); };
  const lineEnd = () => { setCursor(text.length); setLastAction("⌃E jumped to end of line"); };
  const killBefore = () => {
    setText(text.slice(cursor)); setLastAction(`⌃U deleted everything before cursor`);
    setCursor(0);
  };
  const killAfter = () => {
    setText(text.slice(0, cursor)); setLastAction(`⌃K deleted everything after cursor`);
  };
  const deleteWord = () => {
    let i = cursor - 1;
    while (i > 0 && text[i] === " ") i--;
    while (i > 0 && text[i - 1] !== " " && text[i - 1] !== "/") i--;
    const removed = text.slice(i, cursor);
    setText(text.slice(0, i) + text.slice(cursor));
    setCursor(i); setLastAction(`⌥ Delete removed "${removed}"`);
  };

  const buttons = [
    { label: "⌥ ←", title: "Word left", fn: wordLeft },
    { label: "⌥ →", title: "Word right", fn: wordRight },
    { label: "⌃ A", title: "Line start", fn: lineStart },
    { label: "⌃ E", title: "Line end", fn: lineEnd },
    { label: "⌥ Delete", title: "Delete word back", fn: deleteWord },
    { label: "⌃ U", title: "Kill before cursor", fn: killBefore },
    { label: "⌃ K", title: "Kill after cursor", fn: killAfter },
  ];

  return (
    <div>
      <SectionHeading accent={accent} label="The big payoff" title="Editing the line you're typing on" />
      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#cbd5e1" }}>
        These shortcuts replace what you'd normally do with a mouse. Click each one to see what it does.
        The cursor (the orange block) moves; deletions actually change the line.
      </p>

      {/* Terminal simulation */}
      <div style={{
        background: "#000", borderRadius: "6px", padding: "20px",
        border: `1px solid ${accent}30`, marginTop: "16px", fontSize: "14px",
        fontFamily: "inherit", lineHeight: 1.5,
      }}>
        <div style={{ color: "#10b981", marginBottom: "4px", fontSize: "11px" }}>
          druemclean@MacBook ~ %
        </div>
        <div style={{ color: "#e2e8f0", whiteSpace: "pre", overflowX: "auto" }}>
          <span style={{ color: "#64748b" }}>$ </span>
          {text.slice(0, cursor)}
          <span style={{
            background: accent, color: "#000",
            padding: "0 1px", animation: "blink 1s step-end infinite",
          }}>
            {text[cursor] || " "}
          </span>
          {text.slice(cursor + 1)}
        </div>
        <div style={{
          marginTop: "12px", paddingTop: "10px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: "11px", color: "#64748b",
        }}>
          → {lastAction}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "14px" }}>
        {buttons.map(b => (
          <button key={b.label}
            onClick={b.fn}
            title={b.title}
            style={{
              padding: "6px 12px", fontSize: "12px", fontFamily: "inherit",
              background: `${accent}15`, border: `1px solid ${accent}50`,
              borderRadius: "4px", color: accent, cursor: "pointer",
              letterSpacing: "0.02em",
            }}>
            {b.label} <span style={{ color: "#64748b", marginLeft: "4px" }}>{b.title}</span>
          </button>
        ))}
        <button onClick={reset} style={{
          padding: "6px 12px", fontSize: "12px", fontFamily: "inherit",
          background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "4px", color: "#94a3b8", cursor: "pointer", marginLeft: "auto",
        }}>↻ Reset</button>
      </div>

      <Callout accent={accent} label="The four to commit to muscle memory">
        <Kbd accent={accent}>⌥ ←</Kbd> / <Kbd accent={accent}>⌥ →</Kbd> word-jump replaces the slow character-by-character travel.{" "}
        <Kbd accent={accent}>⌃ A</Kbd> / <Kbd accent={accent}>⌃ E</Kbd> line-jump.{" "}
        <Kbd accent={accent}>⌃ U</Kbd> nukes the line so you can retype.{" "}
        <Kbd accent={accent}>⌥ Delete</Kbd> deletes the word you just typed wrong.
        Everything else is optional.
      </Callout>
    </div>
  );
};

// ============================================================
// NAVIGATION SECTION
// ============================================================

const NavigationSection = () => {
  const accent = ACCENTS.navigation;
  const [pwd, setPwd] = useState("/Users/druemclean");
  const [lastCmd, setLastCmd] = useState(null);

  const tree = {
    "/Users/druemclean": ["Documents", "Downloads", "projects", "Desktop"],
    "/Users/druemclean/projects": ["options-edge", "financial-literacy-playground", "artifact-gallery"],
    "/Users/druemclean/projects/options-edge": ["backend", "frontend", "README.md", ".git"],
    "/Users/druemclean/projects/financial-literacy-playground": ["src", "server", "README.md"],
  };

  const cd = (target) => {
    let next;
    if (target === "..") {
      next = pwd.split("/").slice(0, -1).join("/") || "/";
    } else if (target === "~") {
      next = "/Users/druemclean";
    } else {
      next = `${pwd}/${target}`;
    }
    setPwd(next); setLastCmd(`cd ${target}`);
  };

  const contents = tree[pwd] || [];

  return (
    <div>
      <SectionHeading accent={accent} label="Filesystem basics" title="Moving around with cd, ls, pwd" />

      <div style={{ background: "#000", borderRadius: "6px", padding: "20px",
        border: `1px solid ${accent}30`, fontSize: "13px", lineHeight: 1.7 }}>
        {lastCmd && <div style={{ color: "#64748b" }}>$ {lastCmd}</div>}
        <div style={{ color: "#64748b" }}>$ pwd</div>
        <div style={{ color: accent, marginBottom: "8px" }}>{pwd}</div>
        <div style={{ color: "#64748b" }}>$ ls</div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", color: "#e2e8f0" }}>
          {contents.length === 0
            ? <span style={{ color: "#64748b", fontStyle: "italic" }}>(no entries shown — leaf reached)</span>
            : contents.map(c => {
                const isDir = !c.includes(".");
                return (
                  <button key={c}
                    onClick={() => isDir && cd(c)}
                    disabled={!isDir}
                    style={{
                      background: "none", border: "none", padding: 0,
                      fontFamily: "inherit", fontSize: "13px",
                      color: isDir ? "#60a5fa" : "#94a3b8",
                      cursor: isDir ? "pointer" : "default",
                      textDecoration: isDir ? "underline" : "none",
                    }}>
                    {c}{isDir ? "/" : ""}
                  </button>
                );
              })}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
        <button onClick={() => cd("..")} style={btnStyle(accent)}>cd ..  (up one level)</button>
        <button onClick={() => cd("~")} style={btnStyle(accent)}>cd ~  (home)</button>
      </div>

      <Panel accent={accent} style={{ marginTop: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "8px 16px", fontSize: "13px", lineHeight: 1.6 }}>
          <code style={{ color: accent, fontFamily: "inherit" }}>pwd</code>
          <div style={{ color: "#cbd5e1" }}>"Where am I right now?" Prints your current directory.</div>
          <code style={{ color: accent, fontFamily: "inherit" }}>ls</code>
          <div style={{ color: "#cbd5e1" }}>List what's in this folder. Add <code>-la</code> for hidden files + details.</div>
          <code style={{ color: accent, fontFamily: "inherit" }}>cd folder</code>
          <div style={{ color: "#cbd5e1" }}>Go into <code>folder</code>. Hit <Kbd accent={accent}>Tab</Kbd> mid-word to autocomplete.</div>
          <code style={{ color: accent, fontFamily: "inherit" }}>cd ..</code>
          <div style={{ color: "#cbd5e1" }}>Go up one level.</div>
          <code style={{ color: accent, fontFamily: "inherit" }}>cd ~</code>
          <div style={{ color: "#cbd5e1" }}>Jump to your home folder (<code>/Users/druemclean</code>).</div>
          <code style={{ color: accent, fontFamily: "inherit" }}>cd -</code>
          <div style={{ color: "#cbd5e1" }}>Go back to where you just were. Useful for bouncing between two folders.</div>
        </div>
      </Panel>

      <Callout accent={accent} label="Tab is your friend">
        Type <code style={{ color: accent }}>cd /Users/druemclean/proj</code> then hit <Kbd accent={accent}>Tab</Kbd> —
        it autocompletes to <code style={{ color: accent }}>projects/</code>. Hit Tab twice when ambiguous to see all matches.
        This eliminates 90% of typing.
      </Callout>
    </div>
  );
};

// ============================================================
// HISTORY SECTION
// ============================================================

const HistorySection = () => {
  const accent = ACCENTS.history;
  const [search, setSearch] = useState("");
  const history = [
    "git push",
    "npm run dev",
    "cd /Users/druemclean/projects/options-edge",
    "source venv/bin/activate",
    "git status",
    "git commit -m 'add screening filters'",
    "alembic upgrade head",
    "pip install finvizfinance",
    "claude",
    "cd ../financial-literacy-playground",
    "git pull",
    "npm install recharts",
  ];
  const matches = search
    ? history.filter(h => h.toLowerCase().includes(search.toLowerCase()))
    : history;

  return (
    <div>
      <SectionHeading accent={accent} label="Don't retype" title="Recall what you've already run" />
      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#cbd5e1" }}>
        Every command you run gets saved to a history file. There are three ways to get back to it.
      </p>

      <Panel accent={accent}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 16px", fontSize: "13px", lineHeight: 1.6 }}>
          <Kbd accent={accent}>↑ / ↓</Kbd>
          <div style={{ color: "#cbd5e1" }}>Step backward and forward through recent commands. Fine for the last 2-3.</div>
          <Kbd accent={accent}>⌃ R</Kbd>
          <div style={{ color: "#cbd5e1" }}>Reverse search. Type a few letters and it finds matching commands. <strong style={{color:"#f8fafc"}}>The single highest-leverage shortcut in this list.</strong></div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>!!</code>
          <div style={{ color: "#cbd5e1" }}>Re-runs the last command. Most common use: <code>sudo !!</code> when you forgot you needed sudo.</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>history</code>
          <div style={{ color: "#cbd5e1" }}>Dumps the whole history list with line numbers.</div>
        </div>
      </Panel>

      <div style={{
        marginTop: "16px", background: "#000", borderRadius: "6px",
        padding: "16px 20px", border: `1px solid ${accent}30`,
      }}>
        <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "10px", letterSpacing: "0.04em" }}>
          ⌃ R DEMO — type to search history
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: accent, fontSize: "12px" }}>(reverse-i-search)`{search}':</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="try: git, npm, cd"
            style={{
              flex: 1, background: "transparent",
              border: "none", borderBottom: "1px solid rgba(255,255,255,0.15)",
              color: "#e2e8f0", fontFamily: "inherit", fontSize: "13px",
              padding: "4px 0", outline: "none",
            }}
          />
        </div>
        <div style={{ marginTop: "10px", fontSize: "13px", lineHeight: 1.7, color: "#94a3b8" }}>
          {matches.slice(0, 4).map((m, i) => (
            <div key={i} style={{ color: i === 0 ? accent : "#475569" }}>
              {i === 0 ? "▸ " : "  "}{m}
            </div>
          ))}
          {matches.length === 0 && <div style={{ color: "#475569" }}>(no matches — try git or npm)</div>}
        </div>
      </div>

      <Callout accent={accent} label="In your workflow">
        You retype <code>cd /Users/druemclean/projects/...</code> a lot. Stop.
        Hit <Kbd accent={accent}>⌃ R</Kbd>, type "options" or "literacy", press Enter. Done.
      </Callout>
    </div>
  );
};

// ============================================================
// PROCESS CONTROL SECTION
// ============================================================

const ProcessSection = () => {
  const accent = ACCENTS.process;
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState([]);
  const [interrupted, setInterrupted] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running && !interrupted) {
      intervalRef.current = setInterval(() => {
        setOutput(prev => [...prev, `[${prev.length + 1}] processing batch ${prev.length + 1}...`].slice(-6));
      }, 600);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, interrupted]);

  const start = () => { setOutput([]); setInterrupted(false); setRunning(true); };
  const interrupt = () => { setInterrupted(true); setRunning(false); setOutput(prev => [...prev, "^C", "KeyboardInterrupt"]); };
  const reset = () => { setRunning(false); setInterrupted(false); setOutput([]); };

  return (
    <div>
      <SectionHeading accent={accent} label="Killing what's stuck" title="Foreground, background, and Ctrl+C" />
      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#cbd5e1" }}>
        When you run a command, it takes over your terminal until it finishes. That's "foreground." If you need
        to stop it, you have a few options.
      </p>

      <div style={{
        marginTop: "16px", background: "#000", borderRadius: "6px",
        padding: "16px 20px", border: `1px solid ${accent}30`, minHeight: "180px",
      }}>
        <div style={{ color: "#64748b", fontSize: "13px" }}>$ python long_running_script.py</div>
        <div style={{ marginTop: "8px", fontSize: "12px", color: "#94a3b8", lineHeight: 1.7, fontFamily: "inherit" }}>
          {output.map((line, i) => (
            <div key={i} style={{ color: line.startsWith("^C") || line.includes("Interrupt") ? "#f87171" : "#94a3b8" }}>
              {line}
            </div>
          ))}
          {running && !interrupted && (
            <div style={{ color: accent }}>
              <span style={{ animation: "blink 1s step-end infinite" }}>▊</span> running...
            </div>
          )}
          {!running && output.length > 0 && (
            <div style={{ color: "#10b981", marginTop: "6px" }}>$ <span style={{ animation: "blink 1s step-end infinite" }}>▊</span></div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
        <button onClick={start} disabled={running} style={btnStyle(accent, running)}>▶ Run command</button>
        <button onClick={interrupt} disabled={!running} style={btnStyle(accent, !running)}>⌃ C — Interrupt</button>
        <button onClick={reset} style={{ ...btnStyle(accent), opacity: 0.6 }}>↻ Reset</button>
      </div>

      <Panel accent={accent} style={{ marginTop: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 16px", fontSize: "13px", lineHeight: 1.6 }}>
          <Kbd accent={accent}>⌃ C</Kbd>
          <div style={{ color: "#cbd5e1" }}>Interrupt — politely asks the program to stop. Works 95% of the time. <strong style={{color:"#f8fafc"}}>This is the one you already know.</strong></div>
          <Kbd accent={accent}>⌃ Z</Kbd>
          <div style={{ color: "#cbd5e1" }}>Suspend — pauses the program and gives you back the prompt. Resume with <code>fg</code> or kill with <code>kill %1</code>.</div>
          <Kbd accent={accent}>⌃ D</Kbd>
          <div style={{ color: "#cbd5e1" }}>End-of-input. Closes interactive sessions like Python REPL or SSH. Different from interrupting.</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>command &amp;</code>
          <div style={{ color: "#cbd5e1" }}>Run in background from the start. The <code>&amp;</code> at the end means "don't block my terminal."</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>jobs</code>
          <div style={{ color: "#cbd5e1" }}>Lists what's running in the background of this terminal.</div>
        </div>
      </Panel>

      <Callout accent={accent} label="When ⌃C doesn't work">
        Some programs trap <Kbd accent={accent}>⌃ C</Kbd> and ignore it. Try it twice. If it still won't die,
        suspend with <Kbd accent={accent}>⌃ Z</Kbd> and run <code>kill %1</code>. Last resort: close the terminal
        window — but if it's a server or a long task, you'll lose work.
      </Callout>
    </div>
  );
};

// ============================================================
// TMUX SECTION — the conceptually hardest one
// ============================================================

const TmuxSection = () => {
  const accent = ACCENTS.tmux;
  const [attached, setAttached] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <SectionHeading accent={accent} label="The persistent terminal" title="tmux: sessions that survive" />

      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#cbd5e1" }}>
        tmux is a "terminal multiplexer." It lets a terminal session keep running even after you close the window
        or your laptop disconnects. You <strong style={{color:"#f8fafc"}}>detach</strong> from a session (walk away)
        and <strong style={{color:"#f8fafc"}}>attach</strong> to it later (pick up where you left off).
        The session itself never stopped.
      </p>

      <Callout accent={accent} label="Honest priority">
        You probably don't need tmux <em>yet</em>. It becomes useful when you run long Claude Code sessions
        and don't want to lose them if the terminal closes, or when you start working on a remote server over SSH.
        For local React/FastAPI dev where you can just relaunch, it's overkill.
      </Callout>

      {/* Visual hierarchy */}
      <div style={{ marginTop: "20px" }}>
        <div style={{ fontSize: "11px", color: accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
          The hierarchy
        </div>

        <div style={{
          background: "#000", borderRadius: "8px", padding: "16px",
          border: `1px solid ${accent}30`,
        }}>
          {/* Server */}
          <div style={{
            border: `1px dashed ${accent}60`, borderRadius: "6px", padding: "12px",
            background: `${accent}05`,
          }}>
            <div style={{ color: accent, fontSize: "11px", letterSpacing: "0.06em", marginBottom: "10px" }}>
              TMUX SERVER (background process on your Mac)
            </div>

            {/* Session */}
            <div style={{
              border: `1px solid ${accent}50`, borderRadius: "5px", padding: "12px",
              background: `${accent}10`, opacity: attached ? 1 : 0.4, transition: "opacity 0.4s",
            }}>
              <div style={{ color: accent, fontSize: "11px", marginBottom: "10px", display: "flex", justifyContent: "space-between" }}>
                <span>SESSION: "claude-work"</span>
                <span style={{ fontSize: "10px", color: attached ? "#10b981" : "#64748b" }}>
                  {attached ? "● ATTACHED" : "○ DETACHED (still running)"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {/* Window 1 */}
                <div style={{
                  background: "rgba(0,0,0,0.6)", borderRadius: "4px", padding: "10px",
                  border: "1px solid rgba(234,179,8,0.2)",
                }}>
                  <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "6px" }}>Window 1: code</div>
                  <div style={{ fontSize: "11px", color: accent, fontFamily: "inherit" }}>
                    <span style={{ animation: "blink 1s step-end infinite" }}>▊</span> claude code session
                  </div>
                  <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
                    elapsed: {tick}s
                  </div>
                </div>

                {/* Window 2 */}
                <div style={{
                  background: "rgba(0,0,0,0.6)", borderRadius: "4px", padding: "10px",
                  border: "1px solid rgba(234,179,8,0.2)",
                }}>
                  <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "6px" }}>Window 2: server</div>
                  <div style={{ fontSize: "11px", color: "#10b981", fontFamily: "inherit" }}>
                    npm run dev (port 5173)
                  </div>
                  <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
                    uptime: {tick}s
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          {attached
            ? <button onClick={() => setAttached(false)} style={btnStyle(accent)}>⌃B then D — Detach</button>
            : <button onClick={() => setAttached(true)} style={btnStyle(accent)}>tmux attach — Reattach</button>}
        </div>
        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "8px", lineHeight: 1.6 }}>
          {attached
            ? "Currently attached. Your terminal window is showing the session live."
            : "Detached. The session is still running on your Mac (notice the timer kept going). Reattach any time, even after closing the terminal window."}
        </div>
      </div>

      <Panel accent={accent} style={{ marginTop: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 16px", fontSize: "13px", lineHeight: 1.6 }}>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>tmux</code>
          <div style={{ color: "#cbd5e1" }}>Start a new tmux session.</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>tmux new -s name</code>
          <div style={{ color: "#cbd5e1" }}>Start a session with a memorable name.</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>⌃B then D</code>
          <div style={{ color: "#cbd5e1" }}>Detach. Your stuff keeps running.</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>tmux ls</code>
          <div style={{ color: "#cbd5e1" }}>List running sessions.</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>tmux attach -t name</code>
          <div style={{ color: "#cbd5e1" }}>Reattach to a specific session.</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>⌃B then C</code>
          <div style={{ color: "#cbd5e1" }}>Create a new window inside the current session.</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>⌃B then %</code>
          <div style={{ color: "#cbd5e1" }}>Split the window into two side-by-side panes.</div>
        </div>
      </Panel>
    </div>
  );
};

// ============================================================
// GIT SECTION — animated pipeline
// ============================================================

const GitSection = () => {
  const accent = ACCENTS.git;
  const [stage, setStage] = useState(0);

  const stages = [
    { label: "Working Directory", desc: "Files you've edited but git hasn't been told about yet.", cmd: null },
    { label: "Staging Area", desc: "Files you've marked as ready to be saved together.", cmd: "git add ." },
    { label: "Local Commits", desc: "A permanent snapshot saved in your local git history.", cmd: "git commit -m 'message'" },
    { label: "Remote (GitHub)", desc: "Pushed to GitHub. Now Railway can deploy it. Now Tony can see it.", cmd: "git push" },
  ];

  return (
    <div>
      <SectionHeading accent={accent} label="The four-stage pipeline" title="What git push actually does" />
      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#cbd5e1" }}>
        Code goes through four stages. Each git command moves files from one stage to the next.
        Click through the stages to see your changes travel.
      </p>

      {/* Pipeline visualization */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
        gap: "8px",
        marginTop: "20px",
      }}>
        {stages.map((s, i) => (
          <div key={i}
            onClick={() => setStage(i)}
            style={{
              padding: "14px 12px",
              background: stage >= i ? `${accent}20` : "rgba(255,255,255,0.02)",
              border: `1px solid ${stage === i ? accent : `${accent}30`}`,
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.3s ease",
              opacity: stage >= i ? 1 : 0.5,
            }}>
            <div style={{
              fontSize: "10px", color: accent, textTransform: "uppercase",
              letterSpacing: "0.06em", marginBottom: "6px",
            }}>Stage {i + 1}</div>
            <div style={{ fontSize: "13px", color: "#f8fafc", fontWeight: 600, marginBottom: "4px" }}>
              {s.label}
            </div>
            <div style={{
              fontSize: "11px", color: "#94a3b8", lineHeight: 1.5,
              minHeight: "44px",
            }}>{s.desc}</div>
            {s.cmd && (
              <div style={{
                marginTop: "8px",
                fontSize: "11px",
                color: stage >= i ? accent : "#64748b",
                fontFamily: "inherit",
                paddingTop: "6px",
                borderTop: `1px solid ${accent}20`,
              }}>$ {s.cmd}</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        <button onClick={() => setStage(Math.max(0, stage - 1))} disabled={stage === 0} style={btnStyle(accent, stage === 0)}>
          ← Back
        </button>
        <button onClick={() => setStage(Math.min(3, stage + 1))} disabled={stage === 3} style={btnStyle(accent, stage === 3)}>
          Next stage →
        </button>
        <button onClick={() => setStage(0)} style={{ ...btnStyle(accent), opacity: 0.6, marginLeft: "auto" }}>
          ↻ Reset
        </button>
      </div>

      <Panel accent={accent} style={{ marginTop: "24px" }}>
        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: accent, fontWeight: 600, marginBottom: "10px" }}>
          The everyday commands
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 16px", fontSize: "13px", lineHeight: 1.6 }}>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>git status</code>
          <div style={{ color: "#cbd5e1" }}>"What's changed?" Shows what's in working dir, staging, and what's been committed but not pushed.</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>git add .</code>
          <div style={{ color: "#cbd5e1" }}>Stage everything you've edited. The dot means "all of it."</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>git commit -m "..."</code>
          <div style={{ color: "#cbd5e1" }}>Save a snapshot with a message describing what changed.</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>git push</code>
          <div style={{ color: "#cbd5e1" }}>Send your local commits up to GitHub. Triggers Railway redeploy on OptionsEdge.</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>git pull</code>
          <div style={{ color: "#cbd5e1" }}>Pull down whatever's on GitHub. You don't need this often as a solo dev. Matters more when Tony pushes.</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>git log</code>
          <div style={{ color: "#cbd5e1" }}>See past commits. Press <Kbd accent={accent}>q</Kbd> to exit.</div>
        </div>
      </Panel>

      <Callout accent={accent} label="Why this matters even though Claude Code does it for you">
        When Claude Code says "I committed and pushed," it ran <code>git add</code>, <code>git commit</code>,
        <code> git push</code>. When something goes wrong (merge conflict, "rejected" errors, missing pushes),
        knowing which stage broke is how you debug it. The pipeline is the diagnostic.
      </Callout>
    </div>
  );
};

// ============================================================
// SERVERS SECTION — localhost, dev servers, npm, the WiFi mental model
// ============================================================

const ServersSection = () => {
  const accent = ACCENTS.servers;
  const [wifi, setWifi] = useState(true);

  return (
    <div>
      <SectionHeading accent={accent} label="Local vs live" title="Servers, localhost, and the WiFi question" />

      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#cbd5e1" }}>
        A <strong style={{color:"#f8fafc"}}>server</strong> is just a program that waits for incoming requests
        and sends back responses. Your React app asks "give me the options data" — a server answers. That's it.
        Nothing magical about the word.
      </p>

      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#cbd5e1" }}>
        The confusing part is <em>where</em> servers run. There are two flavors and they live in completely different places.
      </p>

      <Panel accent={accent}>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "12px 16px", fontSize: "13px", lineHeight: 1.6 }}>
          <div style={{ color: accent, fontWeight: 600 }}>Local server</div>
          <div style={{ color: "#cbd5e1" }}>
            Runs on your laptop. Started when you run <code>npm run dev</code> or <code>uvicorn main:app</code>.
            Stops the moment you close the terminal. <strong style={{color:"#f8fafc"}}>Only you can see it.</strong>{" "}
            URL: <code>localhost:5173</code> or <code>127.0.0.1:8000</code>.
          </div>
          <div style={{ color: accent, fontWeight: 600 }}>Remote server</div>
          <div style={{ color: "#cbd5e1" }}>
            Runs on a computer somewhere else (Railway, AWS, a VPS) 24/7. Has a public URL.
            <strong style={{color:"#f8fafc"}}> Anyone with the URL can reach it.</strong>{" "}
            Your OptionsEdge on Railway is this.
          </div>
        </div>
      </Panel>

      {/* WiFi toggle demo */}
      <div style={{ marginTop: "24px" }}>
        <div style={{ fontSize: "11px", color: accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
          The WiFi test
        </div>
        <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.6, marginBottom: "16px" }}>
          Toggle the WiFi to see what survives. The answer reveals the whole mental model.
        </p>

        <div style={{
          background: "#000",
          border: `1px solid ${accent}30`,
          borderRadius: "8px",
          padding: "20px",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr auto 1fr",
            gap: "10px",
            alignItems: "stretch",
          }}>
            {/* Your laptop — always works */}
            <div style={{
              padding: "14px",
              border: `1px solid ${accent}50`,
              borderRadius: "6px",
              background: `${accent}10`,
            }}>
              <div style={{ fontSize: "10px", color: accent, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                Your laptop
              </div>
              <div style={{ fontSize: "11px", color: "#10b981", marginBottom: "3px" }}>
                ✓ localhost:5173
              </div>
              <div style={{ fontSize: "11px", color: "#10b981", marginBottom: "8px" }}>
                ✓ localhost:8000
              </div>
              <div style={{ fontSize: "10px", color: "#64748b", lineHeight: 1.5 }}>
                Always works.<br/>localhost = "this machine."
              </div>
            </div>

            {/* WiFi connection */}
            <div style={{ alignSelf: "center", textAlign: "center", minWidth: "50px" }}>
              <div style={{
                fontSize: "10px",
                color: wifi ? accent : "#f43f5e",
                marginBottom: "6px",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}>
                {wifi ? "WiFi" : "✗ OFF"}
              </div>
              <div style={{
                borderTop: `2px ${wifi ? "solid" : "dashed"} ${wifi ? accent : "#f43f5e"}`,
                opacity: wifi ? 1 : 0.5,
              }} />
            </div>

            {/* Railway */}
            <div style={{
              padding: "14px",
              border: `1px solid ${wifi ? `${accent}50` : "rgba(244,63,94,0.3)"}`,
              borderRadius: "6px",
              background: wifi ? `${accent}10` : "rgba(244,63,94,0.05)",
              opacity: wifi ? 1 : 0.4,
              transition: "all 0.3s",
            }}>
              <div style={{ fontSize: "10px", color: accent, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                Railway (cloud)
              </div>
              <div style={{ fontSize: "11px", color: wifi ? "#10b981" : "#f43f5e", marginBottom: "8px" }}>
                {wifi ? "✓" : "✗"} optionsedge.app
              </div>
              <div style={{ fontSize: "10px", color: "#64748b", lineHeight: 1.5 }}>
                {wifi ? "Reachable through internet." : "Need internet to reach it."}
              </div>
            </div>

            {/* Connection 2 */}
            <div style={{ alignSelf: "center", textAlign: "center", minWidth: "50px" }}>
              <div style={{ height: "16px" }} />
              <div style={{
                borderTop: `2px solid ${accent}`,
                opacity: wifi ? 1 : 0.2,
              }} />
            </div>

            {/* Tony */}
            <div style={{
              padding: "14px",
              border: `1px solid ${wifi ? `${accent}50` : "rgba(244,63,94,0.3)"}`,
              borderRadius: "6px",
              background: wifi ? `${accent}10` : "rgba(244,63,94,0.05)",
              opacity: wifi ? 1 : 0.4,
              transition: "all 0.3s",
            }}>
              <div style={{ fontSize: "10px", color: accent, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                Tony's laptop
              </div>
              <div style={{ fontSize: "11px", color: wifi ? "#10b981" : "#f43f5e", marginBottom: "3px" }}>
                {wifi ? "✓ Sees Railway" : "✗ Can't reach"}
              </div>
              <div style={{ fontSize: "11px", color: "#f43f5e", marginBottom: "8px" }}>
                ✗ Never sees localhost
              </div>
              <div style={{ fontSize: "10px", color: "#64748b", lineHeight: 1.5 }}>
                Even on the same WiFi.
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button onClick={() => setWifi(!wifi)} style={btnStyle(accent)}>
            Turn WiFi {wifi ? "OFF" : "ON"}
          </button>
          <div style={{ fontSize: "11px", color: "#64748b", alignSelf: "center", marginLeft: "8px", lineHeight: 1.5 }}>
            {wifi
              ? "Everything reachable. Tony can hit Railway, you can hit Railway, localhost works."
              : "Internet gone. localhost still works (it's just your laptop). Railway unreachable for everyone."}
          </div>
        </div>
      </div>

      <Callout accent={accent} label="The myth-buster">
        Tony has <em>never</em> been able to reach your localhost. Not on the same WiFi, not as a special favor.
        localhost literally means "this exact computer." When <code>npm run dev</code> said
        "Local: http://localhost:5173" — that URL is meaningless to anyone but you. To share with Tony you
        push to GitHub → Railway redeploys → Tony hits the Railway URL.
      </Callout>

      <Panel accent={accent} style={{ marginTop: "20px" }}>
        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: accent, fontWeight: 600, marginBottom: "10px" }}>
          npm's two jobs
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 16px", fontSize: "13px", lineHeight: 1.6 }}>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>npm install</code>
          <div style={{ color: "#cbd5e1" }}>
            Reads <code>package.json</code>, downloads every listed dependency into a local <code>node_modules/</code> folder.
            That folder gets huge (gitignored, never pushed). Run once after cloning a repo.
          </div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>npm install X</code>
          <div style={{ color: "#cbd5e1" }}>
            Adds package <code>X</code> to your project. Updates <code>package.json</code> so the next person who clones gets it too.
          </div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>npm run dev</code>
          <div style={{ color: "#cbd5e1" }}>
            Runs the "dev" script in <code>package.json</code>. For your projects this starts Vite (or Express) on localhost.
            Hot-reloads as you save files.
          </div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>npm run build</code>
          <div style={{ color: "#cbd5e1" }}>
            Compiles React into optimized static files for production. Railway runs this automatically when deploying.
          </div>
        </div>
      </Panel>

      <Callout accent={accent} label="Dev server vs production server">
        <strong style={{color:"#f8fafc"}}>Dev server</strong> (<code>npm run dev</code>): friendly, hot-reloads,
        shows full error stacktraces, slow but easy to debug. Lives on your laptop only.<br/><br/>
        <strong style={{color:"#f8fafc"}}>Production server</strong> (what Railway runs): optimized, minified,
        hides errors from users, fast. Lives in the cloud, runs 24/7.<br/><br/>
        Same code, different mode. <code>npm run build</code> is what transforms dev → production.
      </Callout>
    </div>
  );
};

// ============================================================
// PORTS SECTION — IPs, ports, URL anatomy, port collisions
// ============================================================

const PortsSection = () => {
  const accent = ACCENTS.ports;
  const [activePart, setActivePart] = useState("port");
  const [bindings, setBindings] = useState({
    3000: null,
    5173: { name: "Vite (React dev)", color: "#10b981" },
    8000: { name: "FastAPI backend", color: "#3b82f6" },
    5432: { name: "PostgreSQL", color: "#06b6d4" },
  });
  const [bindResult, setBindResult] = useState(null);

  const tryBind = (port, name, color) => {
    if (bindings[port]) {
      setBindResult({
        success: false,
        msg: `Error: listen EADDRINUSE: address already in use :::${port}`,
        detail: `${bindings[port].name} is already there.`,
      });
    } else {
      setBindings({ ...bindings, [port]: { name, color } });
      setBindResult({ success: true, msg: `${name} bound to port ${port}`, detail: null });
    }
  };

  const free = (port) => {
    if (!bindings[port]) return;
    const wasName = bindings[port].name;
    setBindings({ ...bindings, [port]: null });
    setBindResult({ success: true, msg: `Killed ${wasName} — port ${port} is now free`, detail: null });
  };

  const urlParts = [
    { id: "protocol", text: "https", desc: "Protocol — the 'language' the two computers will speak. http is plain, https adds encryption. Browsers show a padlock for https." },
    { id: "sep1", text: "://", desc: null },
    { id: "host", text: "options-edge.up.railway.app", desc: "Host — which computer to talk to. Either an IP address (like 127.0.0.1) or a name that DNS translates into an IP. Railway gave you this name." },
    { id: "sep2", text: ":", desc: null },
    { id: "port", text: "443", desc: "Port — which program ON that computer to talk to. 443 is the standard HTTPS port and is hidden by default. localhost:5173 means port 5173, where Vite is listening." },
    { id: "sep3", text: "", desc: null },
    { id: "path", text: "/api/options-chain", desc: "Path — which specific resource you want. The host:port gets you to a program; the path tells the program which feature to invoke." },
  ];

  return (
    <div>
      <SectionHeading accent={accent} label="Going deeper" title="Ports, IPs, and why localhost:5173 ≠ localhost:8000" />

      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#cbd5e1" }}>
        Every computer has an <strong style={{color:"#f8fafc"}}>IP address</strong> — its phone number on the
        network. <code>127.0.0.1</code> is a special IP that always means "this exact computer" — that's localhost.
      </p>

      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#cbd5e1" }}>
        But one computer can run dozens of programs at once. So each program claims a{" "}
        <strong style={{color:"#f8fafc"}}>port</strong> — a numbered slot at that IP. The IP is the building, the
        port is the suite number. Two programs cannot share a port, ever.
      </p>

      {/* URL Anatomy */}
      <div style={{ marginTop: "20px" }}>
        <div style={{ fontSize: "11px", color: accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
          Anatomy of a URL — click any part
        </div>

        <div style={{
          background: "#000", border: `1px solid ${accent}30`, borderRadius: "6px",
          padding: "20px", overflowX: "auto",
        }}>
          <div style={{ fontSize: "16px", whiteSpace: "nowrap" }}>
            {urlParts.map((p) => p.desc ? (
              <button key={p.id}
                onClick={() => setActivePart(p.id)}
                style={{
                  background: activePart === p.id ? `${accent}30` : "transparent",
                  border: "none",
                  borderBottom: activePart === p.id ? `2px solid ${accent}` : "2px solid transparent",
                  padding: "4px 4px",
                  fontFamily: "inherit",
                  fontSize: "16px",
                  color: activePart === p.id ? accent : "#94a3b8",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}>
                {p.text}
              </button>
            ) : (
              <span key={p.id} style={{ color: "#475569" }}>{p.text}</span>
            ))}
          </div>

          {activePart && (
            <div style={{
              marginTop: "16px", paddingTop: "12px",
              borderTop: `1px solid ${accent}20`,
              fontSize: "13px", lineHeight: 1.6, color: "#cbd5e1",
            }}>
              <div style={{
                fontSize: "10px", color: accent, textTransform: "uppercase",
                letterSpacing: "0.08em", marginBottom: "4px", fontWeight: 600,
              }}>{activePart}</div>
              {urlParts.find(p => p.id === activePart)?.desc}
            </div>
          )}
        </div>
      </div>

      {/* Port collision demo */}
      <div style={{ marginTop: "24px" }}>
        <div style={{ fontSize: "11px", color: accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
          Port collision demo
        </div>
        <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.6, marginBottom: "16px" }}>
          Each port can hold one program. Try starting another Vite while the first one is still running.
        </p>

        <div style={{
          background: "#000", border: `1px solid ${accent}30`,
          borderRadius: "8px", padding: "20px",
        }}>
          <div style={{
            fontSize: "10px", color: "#64748b", marginBottom: "12px", letterSpacing: "0.04em",
          }}>
            127.0.0.1 (your laptop)
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
          }}>
            {Object.entries(bindings).map(([port, prog]) => (
              <div key={port} style={{
                padding: "12px",
                border: `1px solid ${prog ? `${prog.color}50` : "rgba(148,163,184,0.2)"}`,
                background: prog ? `${prog.color}10` : "rgba(255,255,255,0.02)",
                borderRadius: "5px",
              }}>
                <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "4px", letterSpacing: "0.04em" }}>
                  PORT
                </div>
                <div style={{ fontSize: "16px", color: "#f8fafc", fontWeight: 600, marginBottom: "8px" }}>
                  :{port}
                </div>
                {prog ? (
                  <>
                    <div style={{ fontSize: "10px", color: prog.color, marginBottom: "8px", lineHeight: 1.4 }}>
                      ● {prog.name}
                    </div>
                    <button onClick={() => free(port)} style={{
                      ...btnStyle("#f43f5e"), padding: "3px 8px", fontSize: "10px", width: "100%",
                    }}>kill</button>
                  </>
                ) : (
                  <div style={{ fontSize: "10px", color: "#64748b", fontStyle: "italic" }}>(free)</div>
                )}
              </div>
            ))}
          </div>

          {bindResult && (
            <div style={{
              marginTop: "14px", padding: "10px 12px",
              background: bindResult.success ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)",
              border: `1px solid ${bindResult.success ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
              borderRadius: "4px",
              fontSize: "12px", lineHeight: 1.5,
              color: bindResult.success ? "#10b981" : "#f87171",
              fontFamily: "inherit",
            }}>
              <div>{bindResult.msg}</div>
              {bindResult.detail && (
                <div style={{ color: "#cbd5e1", marginTop: "4px", fontSize: "11px" }}>{bindResult.detail}</div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          <button onClick={() => tryBind(5173, "another Vite", "#f43f5e")} style={btnStyle(accent)}>
            $ npm run dev (try second Vite on 5173)
          </button>
          <button onClick={() => tryBind(3000, "Express", "#a78bfa")} style={btnStyle(accent)}>
            Start Express on 3000
          </button>
        </div>
      </div>

      <Panel accent={accent} style={{ marginTop: "24px" }}>
        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: accent, fontWeight: 600, marginBottom: "10px" }}>
          Common ports you'll see
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: "13px", lineHeight: 1.6 }}>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>3000</code>
          <div style={{ color: "#cbd5e1" }}>Express, old Create React App default</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>5173</code>
          <div style={{ color: "#cbd5e1" }}>Vite default — your gallery + financial-literacy-playground</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>8000 / 8080</code>
          <div style={{ color: "#cbd5e1" }}>FastAPI / Django / common alt-HTTP</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>5432</code>
          <div style={{ color: "#cbd5e1" }}>PostgreSQL default (your OptionsEdge database talks on this)</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>80</code>
          <div style={{ color: "#cbd5e1" }}>HTTP — hidden in URLs by default</div>
          <code style={{ color: accent, fontFamily: "inherit", fontSize: "12px" }}>443</code>
          <div style={{ color: "#cbd5e1" }}>HTTPS — hidden in URLs by default</div>
        </div>
        <div style={{
          fontSize: "11px", color: "#64748b", marginTop: "12px", paddingTop: "10px",
          borderTop: `1px solid ${accent}15`, lineHeight: 1.5,
        }}>
          Ports below 1024 (like 80 and 443) are "privileged" — they need root permission to bind to.
          That's why dev servers all use ports above 1024 — no sudo required.
        </div>
      </Panel>

      <Callout accent={accent} label="When you see EADDRINUSE">
        Means another process is already on that port. Either:<br/>
        • You started a dev server in another terminal and forgot, or<br/>
        • A previous run crashed without cleaning up.<br/><br/>
        Find it: <code>lsof -i :5173</code> shows the PID using port 5173.<br/>
        Kill it: <code>kill -9 PID</code> (replace PID with the number from lsof).<br/>
        Then re-run your dev server.
      </Callout>
    </div>
  );
};

// ============================================================
// SHARED BUTTON STYLE
// ============================================================

const btnStyle = (accent, disabled) => ({
  padding: "8px 14px", fontSize: "12px", fontFamily: "inherit",
  background: disabled ? "rgba(255,255,255,0.03)" : `${accent}15`,
  border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : `${accent}50`}`,
  borderRadius: "4px",
  color: disabled ? "#475569" : accent,
  cursor: disabled ? "not-allowed" : "pointer",
  letterSpacing: "0.02em",
  transition: "all 0.2s ease",
});

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function TerminalSurvivalGuide() {
  const [active, setActive] = useState("intro");

  const renderSection = () => {
    switch (active) {
      case "intro": return <IntroSection />;
      case "editing": return <EditingSection />;
      case "navigation": return <NavigationSection />;
      case "history": return <HistorySection />;
      case "process": return <ProcessSection />;
      case "servers": return <ServersSection />;
      case "ports": return <PortsSection />;
      case "tmux": return <TmuxSection />;
      case "git": return <GitSection />;
      default: return null;
    }
  };

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      background: "#0c0f1a",
      color: "#e2e8f0",
      minHeight: "100vh",
    }}>
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        button:hover:not(:disabled) { filter: brightness(1.2); }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "24px 28px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <h1 style={{
          fontSize: "15px", fontWeight: 600, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "#94a3b8", margin: 0,
        }}>Terminal Survival Guide</h1>
        <p style={{
          fontSize: "12px", color: "#475569", margin: "6px 0 0",
          letterSpacing: "0.02em",
        }}>Hands-on demos for the parts of the terminal that aren't obvious</p>
      </div>

      {/* Tab navigation */}
      <div style={{
        display: "flex", gap: "2px", padding: "10px 28px",
        flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        {SECTIONS.map(s => {
          const isActive = active === s.id;
          const accent = ACCENTS[s.id];
          return (
            <button key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                padding: "6px 14px", fontSize: "11px", fontFamily: "inherit",
                background: isActive ? `${accent}20` : "transparent",
                border: `1px solid ${isActive ? `${accent}60` : "transparent"}`,
                borderRadius: "3px",
                color: isActive ? accent : "#64748b",
                cursor: "pointer",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontWeight: isActive ? 600 : 400,
              }}>{s.label}</button>
          );
        })}
      </div>

      {/* Section content */}
      <div style={{ padding: "28px 28px 60px", maxWidth: "880px" }}>
        {renderSection()}
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 28px 20px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        fontSize: "10px", color: "#334155", letterSpacing: "0.02em",
      }}>
        Companion to Developer Toolkit Map · Click tabs above · All demos are live and interactive
      </div>
    </div>
  );
}
