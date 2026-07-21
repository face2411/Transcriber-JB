import { useEffect, useState } from "react";
import { THEME, TABS } from "@vee/shared";

// Placeholder shell. Proves the client -> server -> file-based data layer
// path works end to end. The five-step Workflow tab, Tagged Accounts, and
// Intelligence dashboard from spec.md get ported into this shell next.
export default function App() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [health, setHealth] = useState(null);
  const [companyCount, setCompanyCount] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setError(e.message));

    fetch("/api/companies")
      .then((r) => r.json())
      .then((list) => setCompanyCount(list.length))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div style={{ background: THEME.bg, color: THEME.textPrimary, minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ borderBottom: `1px solid ${THEME.border}`, padding: "16px 24px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", color: THEME.orange }}>
          VEE OPPORTUNITY INTELLIGENCE
        </div>
        <nav style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? THEME.surface3 : "transparent",
                color: activeTab === tab.id ? THEME.orange : THEME.textSecondary,
                border: `1px solid ${activeTab === tab.id ? THEME.orange : THEME.border}`,
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ padding: 24, maxWidth: 640 }}>
        <div style={{ background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: THEME.textMuted, marginBottom: 12 }}>
            Data layer status
          </div>
          {error && <div style={{ color: THEME.red, fontSize: 13 }}>Server unreachable: {error}</div>}
          {!error && (
            <>
              <div style={{ fontSize: 13, color: THEME.textSecondary }}>
                API health: {health ? <span style={{ color: THEME.green }}>ok</span> : "checking..."}
              </div>
              <div style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 4 }}>
                Companies in store: {companyCount === null ? "checking..." : companyCount}
              </div>
            </>
          )}
        </div>

        <p style={{ fontSize: 13, color: THEME.textMuted, marginTop: 20, lineHeight: 1.6 }}>
          This is the project scaffold: Express + file-based JSON persistence on the backend,
          Vite + React on the frontend, sharing constants (verticals, tag reasons, signal types,
          design tokens) from <code>@vee/shared</code>. The five-step Workflow tab, Tagged
          Accounts, and Intelligence dashboard from the spec come next.
        </p>
      </main>
    </div>
  );
}
