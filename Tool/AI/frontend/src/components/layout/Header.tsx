import { useState, useEffect } from "react";

const IconSun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const IconMoon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

interface HeaderProps {
  view: "workspace" | "results" | "history";
  projectName?: string;
  environment?: string;
}

export function Header({ view, projectName, environment }: HeaderProps) {
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const theme = document.documentElement.getAttribute("data-theme") as "light" | "dark" || "light";
    setCurrentTheme(theme);
  }, []);

  const setTheme = (theme: "light" | "dark") => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("testforge-theme", theme);
    setCurrentTheme(theme);
  };

  const viewConfig = {
    workspace: { eyebrow: "API TESTING", title: "Test Workspace" },
    results: { eyebrow: "API TESTING", title: "Results" },
    history: { eyebrow: "API TESTING", title: "History" }
  };

  const config = viewConfig[view];

  return (
    <header id="testforge-header" className="app-header">
      <div className="header-left">
        <span className="product-context-badge">{config.eyebrow}</span>
        <h1 className="header-title">{config.title}</h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
        {(projectName || environment) && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {projectName && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Project:</span>
                <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>{projectName}</span>
              </div>
            )}
            {environment && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Environment:</span>
                <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>{environment}</span>
              </div>
            )}
          </div>
        )}

        <div id="theme-switcher" className="theme-switcher">
          <button
            type="button"
            className={`theme-option ${currentTheme === "light" ? "active" : ""}`}
            aria-pressed={currentTheme === "light"}
            onClick={() => setTheme("light")}
          >
            <span className="theme-icon"><IconSun /></span>
            Light
          </button>
          <button
            type="button"
            className={`theme-option ${currentTheme === "dark" ? "active" : ""}`}
            aria-pressed={currentTheme === "dark"}
            onClick={() => setTheme("dark")}
          >
            <span className="theme-icon"><IconMoon /></span>
            Dark
          </button>
        </div>
      </div>
    </header>
  );
}