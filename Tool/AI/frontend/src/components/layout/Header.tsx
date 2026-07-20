interface HeaderProps {
  view: "workspace" | "results" | "history";
}

export function Header({ view }: HeaderProps) {
  const viewTitles = {
    workspace: { eyebrow: "QA automation platform", title: "Ticket-to-API Validation" },
    results: { eyebrow: "Results", title: "Recent Run Results" },
    history: { eyebrow: "History", title: "Run History" }
  };

  const titles = viewTitles[view];

  return (
    <header className="topbar" style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "24px",
      padding: "24px 28px",
      background: "#192633",
      color: "#fff",
      borderBottom: "1px solid #263746"
    }}>
      <div>
        <span className="eyebrow" style={{
          display: "block",
          marginBottom: "5px",
          color: "#91d0b4",
          fontSize: "12px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em"
        }}>
          {titles.eyebrow}
        </span>
        <h1 style={{ margin: 0, fontSize: "27px" }}>
          {titles.title}
        </h1>
      </div>
      <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          title="Toggle dark mode"
          style={{
            minHeight: "34px",
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            borderRadius: "6px",
            padding: "7px 12px",
            cursor: "pointer"
          }}
        >
          🌙
        </button>
        <details className="dev-dropdown" style={{ position: "relative" }}>
          <summary
            className="dev-trigger link-button ghost"
            title="Developer tools"
             style={{
               listStyle: "none",
               cursor: "pointer",
               minHeight: "34px",
               border: "1px solid rgba(255,255,255,0.22)",
               background: "rgba(255,255,255,0.08)",
               color: "#fff",
               borderRadius: "6px",
               padding: "7px 12px"
             }}
          >
            Dev
          </summary>
          <div className="dev-menu" style={{
            position: "absolute",
            top: "100%",
            right: 0,
            zIndex: 50,
            minWidth: "140px",
            marginTop: "4px",
            padding: "4px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "6px",
            boxShadow: "var(--shadow)"
          }}>
            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="dev-item"
              style={{
                display: "block",
                padding: "8px 12px",
                borderRadius: "4px",
                color: "var(--ink)",
                textDecoration: "none",
                fontSize: "13px"
              }}
            >
              Health
            </a>
            <a
              href="/api/runs"
              target="_blank"
              rel="noreferrer"
              className="dev-item"
              style={{
                display: "block",
                padding: "8px 12px",
                borderRadius: "4px",
                color: "var(--ink)",
                textDecoration: "none",
                fontSize: "13px"
              }}
            >
              Runs API
            </a>
          </div>
        </details>
      </div>
    </header>
  );
}