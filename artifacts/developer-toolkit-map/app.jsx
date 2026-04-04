import { useState, useCallback, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";

const TOOLS = {
  // Tier 1 - Must Understand
  git: { name: "Git", tier: 1, category: "version-control", x: 140, y: 120, description: "Tracks every change you make to your code, like a detailed undo history. When Claude Code edits files in your project, git records what changed, when, and why.", usage: "Both projects. Every Claude Code session creates git commits. Railway deploys from your git history.", connections: ["github", "claude-code", "railway", "terminal"] },
  github: { name: "GitHub", tier: 1, category: "version-control", x: 140, y: 220, description: "Cloud storage for your git repositories. Your code lives here, and Railway watches it to know when to redeploy.", usage: "Private repos for OptionsEdge and financial-literacy-playground. Railway auto-deploys when you push to the main branch — that's CI/CD, which you're already using.", connections: ["git", "railway"] },
  
  python: { name: "Python", tier: 1, category: "languages", x: 380, y: 80, description: "The programming language your backend is written in. Claude Code writes Python for you — you prompt it, it generates the code.", usage: "FastAPI backend, Finviz screening scripts, SEC EDGAR client, Denver Sheriff API scripts.", connections: ["fastapi", "pip", "sqlalchemy", "venv"] },
  react: { name: "React", tier: 1, category: "languages", x: 600, y: 80, description: "A JavaScript framework for building interactive user interfaces. Your frontends are React apps — the part users see and click.", usage: "OptionsEdge frontend, financial-literacy-playground (FRED dashboard, commodity map).", connections: ["npm", "tailwind", "javascript"] },
  javascript: { name: "JavaScript", tier: 1, category: "languages", x: 600, y: 180, description: "The programming language that runs in web browsers. React is built on JavaScript. When Claude Code writes your frontend, it's writing JavaScript.", usage: "Every React component, every interactive chart, every browser-side behavior.", connections: ["react", "npm"] },
  
  fastapi: { name: "FastAPI", tier: 1, category: "backend", x: 380, y: 200, description: "A Python framework for building APIs (the backend that your frontend talks to). It handles incoming requests, talks to the database, and returns data.", usage: "OptionsEdge backend. Handles routes like /api/options-chain, /api/screening, user auth.", connections: ["python", "sqlalchemy", "postgresql", "rest-api", "cors"] },
  postgresql: { name: "PostgreSQL", tier: 1, category: "data", x: 380, y: 420, description: "Your database — where structured data lives permanently. Tables for users, trades, screening results, watchlists.", usage: "OptionsEdge stores everything here. Hosted on Railway. You interact with it through SQLAlchemy, never directly.", connections: ["fastapi", "sqlalchemy", "alembic", "railway", "jsonb"] },
  
  terminal: { name: "Terminal / CLI", tier: 1, category: "dev-tools", x: 140, y: 340, description: "The text-based interface where you type commands. When you run Claude Code, git commands, npm install, or pip install — you're using the terminal.", usage: "Daily. Running Claude Code, installing packages, starting dev servers, git operations.", connections: ["git", "claude-code", "pip", "npm"] },
  "claude-code": { name: "Claude Code", tier: 1, category: "dev-tools", x: 140, y: 450, description: "The agentic coding tool that reads your files, writes code, runs commands, and iterates. Available in desktop app (Code tab) and CLI. Same engine, different interface.", usage: "Primary development tool for both projects. Writes all your Python and React code.", connections: ["terminal", "git", "mcp"] },
  
  rest_api: { name: "REST API", tier: 1, category: "concepts", x: 600, y: 420, description: "A standard way for programs to request data from each other over the internet. Your frontend calls your backend's REST API. Your backend calls Tastytrade's REST API.", usage: "Every data source: Tastytrade, FRED, SEC EDGAR, Finviz. Your own FastAPI backend exposes a REST API to your React frontend.", connections: ["fastapi", "json", "env-vars", "rate-limiting"] },
  json: { name: "JSON", tier: 1, category: "concepts", x: 780, y: 420, description: "A text format for structured data. Looks like: {\"name\": \"AAPL\", \"price\": 185.50}. Every API sends and receives JSON. Config files use it. Your data exports use it.", usage: "Everywhere. API responses, package.json, database JSONB columns, trade export format.", connections: ["rest_api", "jsonb"] },
  "env-vars": { name: "Environment Variables", tier: 1, category: "concepts", x: 780, y: 300, description: "Secret values (API keys, database passwords, URLs) stored outside your code so they don't get pushed to GitHub. Railway has its own env var panel; locally you use .env files.", usage: "Tastytrade API key, Railway database URL, any secret. Claude Code reads them from .env; Railway reads them from its dashboard.", connections: ["rest_api", "railway", "fastapi"] },
  
  pip: { name: "pip", tier: 1, category: "package-mgmt", x: 380, y: 310, description: "Installs Python packages. When Claude Code runs 'pip install fastapi', pip downloads it from the internet and makes it available to your Python code.", usage: "Every Python dependency: fastapi, sqlalchemy, alembic, finvizfinance, requests, scipy, numpy, pandas.", connections: ["python", "venv", "terminal"] },
  npm: { name: "npm", tier: 1, category: "package-mgmt", x: 600, y: 300, description: "Same as pip but for JavaScript. Installs React, Tailwind, chart libraries, etc. Also runs scripts defined in package.json (like 'npm start').", usage: "Every frontend dependency. React, Tailwind, Recharts, D3, etc.", connections: ["react", "javascript", "terminal"] },
  railway: { name: "Railway", tier: 1, category: "hosting", x: 380, y: 540, description: "Cloud hosting platform. Runs your backend, frontend, and database so other people (Tony) can access the app from their computer. Auto-deploys when you push to GitHub.", usage: "OptionsEdge lives here. PostgreSQL database, FastAPI backend, React frontend — all hosted on Railway.", connections: ["github", "postgresql", "env-vars", "docker"] },

  // Tier 2 - Should Understand
  sqlalchemy: { name: "SQLAlchemy", tier: 2, category: "backend", x: 260, y: 310, description: "An ORM — it lets you write Python classes instead of raw SQL to interact with your database. Your User model in Python maps directly to the users table in PostgreSQL.", usage: "All OptionsEdge database interactions. Claude Code writes SQLAlchemy models; Alembic turns them into real database tables.", connections: ["python", "postgresql", "alembic", "fastapi"] },
  alembic: { name: "Alembic", tier: 2, category: "backend", x: 260, y: 420, description: "Manages database migrations — when you add a column or table, Alembic generates a script that updates PostgreSQL without losing existing data.", usage: "OptionsEdge Phase 1: ran migrations to create 6 tables. Every schema change goes through Alembic.", connections: ["sqlalchemy", "postgresql"] },
  tailwind: { name: "Tailwind CSS", tier: 2, category: "languages", x: 740, y: 80, description: "A CSS framework that lets you style elements with utility classes like 'bg-blue-500 text-white p-4' instead of writing custom CSS files.", usage: "OptionsEdge frontend styling. Claude Code writes Tailwind classes in your React components.", connections: ["react"] },
  cors: { name: "CORS", tier: 2, category: "concepts", x: 500, y: 300, description: "A browser security rule that blocks your frontend from calling your backend unless the backend explicitly allows it. If your React app can't fetch data, CORS is usually why.", usage: "OptionsEdge: FastAPI must allow requests from your React frontend's URL. Financial-literacy-playground: you built an Express proxy specifically to solve a CORS problem with FRED.", connections: ["fastapi", "rest_api"] },
  venv: { name: "Virtual Environment", tier: 2, category: "package-mgmt", x: 500, y: 190, description: "An isolated folder where pip installs packages for one project. Prevents conflicts between projects that need different versions of the same package.", usage: "You should have one for OptionsEdge and one for financial-literacy-playground. If you don't, package conflicts will eventually bite you.", connections: ["python", "pip"] },
  mcp: { name: "MCP", tier: 2, category: "dev-tools", x: 140, y: 560, description: "Model Context Protocol — how Claude connects to external services like Google Drive, Gmail, Figma, and your calendar. Small programs that translate between Claude and each service's API.", usage: "Your current Claude setup has MCP connectors for Gmail, Google Calendar, Figma, Google Drive. Claude Code uses MCP extensions for additional tool access.", connections: ["claude-code"] },
  "rate-limiting": { name: "Rate Limiting", tier: 2, category: "concepts", x: 780, y: 540, description: "APIs restrict how many requests you can make per minute/hour/day. Hit the limit and you get blocked temporarily. Your code needs to handle this gracefully.", usage: "Tastytrade, FRED, SEC EDGAR, Polygon, GNews — all have rate limits. Your OptionsEdge api_cache table exists partly to reduce API calls.", connections: ["rest_api"] },
  jsonb: { name: "JSONB", tier: 2, category: "data", x: 500, y: 420, description: "A PostgreSQL column type that stores JSON data you can query. Useful when different rows need different fields — like user preferences or screening criteria that vary per user.", usage: "OptionsEdge: user_profiles.strategy_preferences, screening_results.raw_data, scoring weights.", connections: ["postgresql", "json"] },
  auth: { name: "Authentication", tier: 2, category: "concepts", x: 500, y: 540, description: "Verifying who someone is (login). Separate from authorization (what they're allowed to do). OptionsEdge uses simple email/password — no OAuth or third-party auth needed for 2 users.", usage: "OptionsEdge: Drue and Tony log in with email/password. API keys for Tastytrade/Polygon are also a form of authentication.", connections: ["fastapi", "env-vars"] },
  cicd: { name: "CI/CD", tier: 2, category: "hosting", x: 260, y: 540, description: "Continuous Integration / Continuous Deployment. Automatically tests and deploys code when you push to GitHub. You're already doing this — Railway auto-deploys from your main branch.", usage: "Every time you push OptionsEdge code to GitHub's main branch, Railway detects it and redeploys. That's CD. You're using it without knowing the term.", connections: ["railway", "github"] },

  // Tier 3 - Just Know It Exists
  docker: { name: "Docker", tier: 3, category: "hosting", x: 500, y: 640, description: "Packages an app with everything it needs to run into a 'container' so it works the same everywhere. Railway uses Docker under the hood — you never touch it directly.", usage: "Railway builds a Docker container from your code automatically. You don't configure this.", connections: ["railway"] },
  websockets: { name: "WebSockets", tier: 3, category: "concepts", x: 780, y: 640, description: "A persistent two-way connection between frontend and backend for real-time data. REST = you ask, it answers. WebSockets = it pushes updates to you continuously.", usage: "Not used yet. Would matter if you add live-streaming options prices in a future OptionsEdge phase.", connections: ["rest_api"] },
  ssh: { name: "SSH", tier: 3, category: "dev-tools", x: 140, y: 650, description: "Secure Shell — remotely control another computer via terminal. Like your terminal, but on someone else's machine.", usage: "Not needed. Railway handles your servers. Would only matter if you moved to a VPS or AWS.", connections: ["terminal"] },
};

const CATEGORIES = {
  "version-control": { label: "Version Control", color: "#f97316" },
  "languages": { label: "Languages & Frameworks", color: "#3b82f6" },
  "backend": { label: "Backend", color: "#8b5cf6" },
  "data": { label: "Data", color: "#06b6d4" },
  "dev-tools": { label: "Dev Tools", color: "#10b981" },
  "concepts": { label: "Concepts", color: "#f43f5e" },
  "package-mgmt": { label: "Package Management", color: "#eab308" },
  "hosting": { label: "Hosting & Deploy", color: "#ec4899" },
};

const TIER_LABELS = {
  1: { label: "Must Understand", color: "#f8fafc", border: "rgba(255,255,255,0.5)" },
  2: { label: "Should Understand", color: "#cbd5e1", border: "rgba(255,255,255,0.25)" },
  3: { label: "Just Know It Exists", color: "#64748b", border: "rgba(255,255,255,0.12)" },
};

function DeveloperToolkitMap() {
  const [selected, setSelected] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [filterTier, setFilterTier] = useState(null);
  const svgRef = useRef(null);
  const detailRef = useRef(null);

  useEffect(() => {
    if (selected && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selected]);

  const activeId = selected || hoveredNode;

  const isConnected = useCallback((id) => {
    if (!activeId) return false;
    const tool = TOOLS[activeId];
    if (!tool) return false;
    return tool.connections?.includes(id) || id === activeId;
  }, [activeId]);

  const getNodeOpacity = useCallback((id) => {
    if (filterTier && TOOLS[id].tier !== filterTier) return 0.15;
    if (!activeId) return 1;
    return isConnected(id) ? 1 : 0.12;
  }, [activeId, filterTier, isConnected]);

  const renderConnections = () => {
    const lines = [];
    const drawn = new Set();
    Object.entries(TOOLS).forEach(([id, tool]) => {
      (tool.connections || []).forEach(targetId => {
        const target = TOOLS[targetId];
        if (!target) return;
        const key = [id, targetId].sort().join("-");
        if (drawn.has(key)) return;
        drawn.add(key);
        
        const isActive = activeId && (isConnected(id) && isConnected(targetId));
        const dimmedByTier = filterTier && (tool.tier !== filterTier || target.tier !== filterTier);
        
        lines.push(
          <line
            key={key}
            x1={tool.x} y1={tool.y}
            x2={target.x} y2={target.y}
            stroke={isActive ? CATEGORIES[tool.category].color : "rgba(148,163,184,0.2)"}
            strokeWidth={isActive ? 2 : 0.75}
            opacity={dimmedByTier ? 0.05 : (isActive ? 0.7 : 0.15)}
            style={{ transition: "all 0.3s ease" }}
          />
        );
      });
    });
    return lines;
  };

  const selectedTool = selected ? TOOLS[selected] : null;

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      background: "#0c0f1a",
      color: "#e2e8f0",
      minHeight: "100vh",
      padding: "0",
    }}>
      <div style={{
        padding: "24px 28px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <h1 style={{
          fontSize: "15px", fontWeight: 600, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "#94a3b8", margin: 0,
        }}>Developer Toolkit Map</h1>
        <p style={{
          fontSize: "12px", color: "#475569", margin: "6px 0 0", letterSpacing: "0.02em",
        }}>Click any node to see what it does and how it connects to your projects</p>
      </div>

      <div style={{
        display: "flex", gap: "8px", padding: "12px 28px", flexWrap: "wrap",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <button onClick={() => setFilterTier(null)} style={{
          padding: "4px 12px", fontSize: "11px", fontFamily: "inherit",
          background: !filterTier ? "rgba(255,255,255,0.1)" : "transparent",
          border: "1px solid rgba(255,255,255,0.12)", borderRadius: "3px",
          color: !filterTier ? "#f8fafc" : "#64748b", cursor: "pointer", letterSpacing: "0.03em",
        }}>ALL</button>
        {Object.entries(TIER_LABELS).map(([tier, { label }]) => (
          <button key={tier} onClick={() => setFilterTier(filterTier === Number(tier) ? null : Number(tier))} style={{
            padding: "4px 12px", fontSize: "11px", fontFamily: "inherit",
            background: filterTier === Number(tier) ? "rgba(255,255,255,0.1)" : "transparent",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: "3px",
            color: filterTier === Number(tier) ? "#f8fafc" : "#64748b", cursor: "pointer", letterSpacing: "0.03em",
          }}>{label}</button>
        ))}
      </div>

      <div style={{
        display: "flex", gap: "14px", padding: "10px 28px", flexWrap: "wrap",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        {Object.entries(CATEGORIES).map(([key, { label, color }]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, opacity: 0.8 }} />
            <span style={{ fontSize: "10px", color: "#64748b", letterSpacing: "0.02em" }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ overflow: "auto", padding: "8px 0" }}>
        <svg ref={svgRef} viewBox="0 0 920 720" style={{ width: "100%", maxWidth: 920, display: "block", margin: "0 auto" }}>
          {renderConnections()}
          {Object.entries(TOOLS).map(([id, tool]) => {
            const cat = CATEGORIES[tool.category];
            const tierInfo = TIER_LABELS[tool.tier];
            const isSelected = selected === id;
            const opacity = getNodeOpacity(id);
            const nodeRadius = tool.tier === 1 ? 28 : tool.tier === 2 ? 22 : 18;
            
            return (
              <g key={id} onClick={() => setSelected(selected === id ? null : id)}
                onMouseEnter={() => setHoveredNode(id)} onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "pointer", transition: "opacity 0.3s ease" }} opacity={opacity}>
                {isSelected && (
                  <circle cx={tool.x} cy={tool.y} r={nodeRadius + 6} fill="none"
                    stroke={cat.color} strokeWidth={1.5} opacity={0.4} />
                )}
                <circle cx={tool.x} cy={tool.y} r={nodeRadius}
                  fill={isSelected ? cat.color : "rgba(15,23,42,0.9)"}
                  stroke={cat.color} strokeWidth={isSelected ? 2 : 1} opacity={isSelected ? 1 : 0.85} />
                <circle cx={tool.x + nodeRadius * 0.65} cy={tool.y - nodeRadius * 0.65}
                  r={3} fill={tierInfo.color} opacity={0.6} />
                <text x={tool.x} y={tool.y + nodeRadius + 14} textAnchor="middle"
                  fontSize={tool.tier === 1 ? "10px" : "9px"} fontFamily="inherit"
                  fill={tierInfo.color} fontWeight={tool.tier === 1 ? 600 : 400}
                  letterSpacing="0.03em">{tool.name}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {selectedTool && (
        <div ref={detailRef} style={{
          margin: "0 20px 20px", padding: "20px 24px",
          background: "rgba(30,41,59,0.5)",
          border: `1px solid ${CATEGORIES[selectedTool.category].color}30`,
          borderRadius: "6px",
          borderLeft: `3px solid ${CATEGORIES[selectedTool.category].color}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <div>
              <h2 style={{
                fontSize: "16px", fontWeight: 600, margin: 0,
                color: CATEGORIES[selectedTool.category].color,
              }}>{selectedTool.name}</h2>
              <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                <span style={{
                  fontSize: "10px", padding: "2px 8px", borderRadius: "2px",
                  background: `${CATEGORIES[selectedTool.category].color}18`,
                  color: CATEGORIES[selectedTool.category].color,
                  letterSpacing: "0.04em", textTransform: "uppercase",
                }}>{CATEGORIES[selectedTool.category].label}</span>
                <span style={{
                  fontSize: "10px", padding: "2px 8px", borderRadius: "2px",
                  background: "rgba(255,255,255,0.06)",
                  color: TIER_LABELS[selectedTool.tier].color,
                  letterSpacing: "0.04em", textTransform: "uppercase",
                }}>{TIER_LABELS[selectedTool.tier].label}</span>
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{
              background: "none", border: "none", color: "#64748b",
              cursor: "pointer", fontSize: "18px", fontFamily: "inherit", padding: "0 4px", lineHeight: 1,
            }}>&times;</button>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <h3 style={{
              fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em",
              color: "#64748b", margin: "0 0 6px", fontWeight: 500,
            }}>What it is</h3>
            <p style={{ fontSize: "13px", lineHeight: 1.65, color: "#cbd5e1", margin: 0 }}>{selectedTool.description}</p>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <h3 style={{
              fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em",
              color: "#64748b", margin: "0 0 6px", fontWeight: 500,
            }}>Where you use it</h3>
            <p style={{ fontSize: "13px", lineHeight: 1.65, color: "#94a3b8", margin: 0 }}>{selectedTool.usage}</p>
          </div>

          {selectedTool.connections?.length > 0 && (
            <div>
              <h3 style={{
                fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em",
                color: "#64748b", margin: "0 0 8px", fontWeight: 500,
              }}>Connects to</h3>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {selectedTool.connections.map(cId => {
                  const c = TOOLS[cId];
                  if (!c) return null;
                  return (
                    <button key={cId} onClick={(e) => { e.stopPropagation(); setSelected(cId); }} style={{
                      padding: "3px 10px", fontSize: "11px", fontFamily: "inherit",
                      background: `${CATEGORIES[c.category].color}12`,
                      border: `1px solid ${CATEGORIES[c.category].color}30`,
                      borderRadius: "3px", color: CATEGORIES[c.category].color,
                      cursor: "pointer", letterSpacing: "0.02em",
                    }}>{c.name}</button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{
        padding: "12px 28px 20px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        fontSize: "10px", color: "#334155", letterSpacing: "0.02em",
      }}>
        {Object.keys(TOOLS).length} tools &middot; Tier-coded by priority &middot; Tailored to OptionsEdge + financial-literacy-playground
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<DeveloperToolkitMap />);
