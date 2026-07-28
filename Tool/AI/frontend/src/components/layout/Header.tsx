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
  view: "setup" | "knowledge" | "catalog" | "workspace" | "results" | "history" | "settings";
  projectName?: string;
  environment?: string;
}

export function Header({ view, projectName, environment }: HeaderProps) {
  const [currentTheme, setCurrentTheme] = useState<"slate" | "mist">("slate");

  useEffect(() => {
    const theme = document.documentElement.getAttribute("data-theme") as "slate" | "mist" || "slate";
    setCurrentTheme(theme);
  }, []);

  const setTheme = (theme: "slate" | "mist") => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("testforge-theme", theme);
    setCurrentTheme(theme);
  };

  const viewConfig: {
    [key in typeof view]: { eyebrow: string; title: string }
  } = {
    setup: { eyebrow: "API TESTING", title: "Project Setup" },
    knowledge: { eyebrow: "KNOWLEDGE", title: "Knowledge" },
    catalog: { eyebrow: "API CATALOG", title: "API Catalog" },
    workspace: { eyebrow: "API TESTING", title: "Test Builder" },
    results: { eyebrow: "API TESTING", title: "Reports" },
    history: { eyebrow: "API TESTING", title: "History" },
    settings: { eyebrow: "SYSTEM", title: "Settings" }
  };

  const config = viewConfig[view];

  return (
    <header id="testforge-header" className="app-header">
      <div className="header-left">
        <span className="product-context-badge">{config.eyebrow}</span>
        <h1 className="header-title">{config.title}</h1>
      </div>

      <div className="header-context">
        {(projectName || environment) && (
          <div className="header-meta">
            {projectName && (
              <div className="header-meta-item">
                <span className="header-meta-label">Project:</span>
                <span className="header-meta-value">{projectName}</span>
              </div>
            )}
            {environment && (
              <div className="header-meta-item">
                <span className="header-meta-label">Environment:</span>
                <span className="header-meta-value">{environment}</span>
              </div>
            )}
          </div>
        )}

        <div id="theme-switcher" className="theme-switcher">
          <button
            type="button"
            className={`theme-option ${currentTheme === "slate" ? "active" : ""}`}
            aria-pressed={currentTheme === "slate"}
            onClick={() => setTheme("slate")}
          >
            <span className="theme-icon"><IconMoon /></span>
            Slate
          </button>
          <button
            type="button"
            className={`theme-option ${currentTheme === "mist" ? "active" : ""}`}
            aria-pressed={currentTheme === "mist"}
            onClick={() => setTheme("mist")}
          >
            <span className="theme-icon"><IconSun /></span>
            Mist
          </button>
        </div>
      </div>
    </header>
  );
}
