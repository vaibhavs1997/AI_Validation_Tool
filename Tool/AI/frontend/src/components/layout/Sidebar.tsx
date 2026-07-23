interface SidebarProps {
  currentView: "setup" | "workspace" | "results" | "history";
  onViewChange: (view: "setup" | "workspace" | "results" | "history") => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside className="sidebar" style={{
      position: "sticky",
      top: 0,
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      gap: "22px",
      padding: "22px",
      background: "var(--nav)",
      color: "#fff"
    }}>
      {/* Brand */}
      <div className="brand" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div className="brand-mark" style={{
          width: "42px",
          height: "42px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          background: "#38a36f",
          color: "#fff",
          fontWeight: 800
        }}>
          AV
        </div>
        <div>
          <strong style={{ display: "block", fontSize: "16px" }}>API Validator</strong>
          <span style={{ display: "block", marginTop: "2px", color: "#b7c6d3", fontSize: "12px" }}>
            QA Automation Platform
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="side-nav" aria-label="Primary navigation">
        <a
          href="#setup"
          className={currentView === "setup" ? "active" : ""}
          style={{
            display: "block",
            padding: "10px 12px",
            borderRadius: "6px",
            color: "#dce6ee",
            textDecoration: "none"
          }}
          onClick={(e) => {
            e.preventDefault();
            onViewChange("setup");
          }}
        >
          Setup
        </a>
        <a
          href="#workspace"
          className={currentView === "workspace" ? "active" : ""}
          style={{
            display: "block",
            padding: "10px 12px",
            borderRadius: "6px",
            color: "#dce6ee",
            textDecoration: "none"
          }}
          onClick={(e) => {
            e.preventDefault();
            onViewChange("workspace");
          }}
        >
          Workspace
        </a>
        <a
          href="#results"
          className={currentView === "results" ? "active" : ""}
          style={{
            display: "block",
            padding: "10px 12px",
            borderRadius: "6px",
            color: "#dce6ee",
            textDecoration: "none"
          }}
          onClick={(e) => {
            e.preventDefault();
            onViewChange("results");
          }}
        >
          Recent Run
        </a>
        <a
          href="#history"
          className={currentView === "history" ? "active" : ""}
          style={{
            display: "block",
            padding: "10px 12px",
            borderRadius: "6px",
            color: "#dce6ee",
            textDecoration: "none"
          }}
          onClick={(e) => {
            e.preventDefault();
            onViewChange("history");
          }}
        >
          Run History
        </a>
      </nav>

      {/* Server status card placeholder */}
      <div className="server-card" style={{
        marginTop: "auto",
        padding: "14px",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "8px",
        background: "rgba(255,255,255,0.06)"
      }}>
        <span style={{ color: "#b7c6d3" }}>Server</span>
        <strong style={{ display: "block", margin: "5px 0", color: "#fff" }}>Ready</strong>
        <p style={{ margin: 0, fontSize: "12px", lineHeight: "1.45", color: "#b7c6d3" }}>
          Backend accessible
        </p>
      </div>
    </aside>
  );
}