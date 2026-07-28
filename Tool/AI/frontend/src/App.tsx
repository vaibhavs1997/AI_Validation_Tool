import { useState, useEffect } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { SetupPage } from "./features/project-setup/SetupPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { WorkspacePage } from "./features/workspace/WorkspacePage";
import { ResultsPage } from "./features/results/ResultsPage";
import { HistoryPage } from "./features/history/HistoryPage";
import { ApiCatalogPage } from "./features/api-collection/ApiCatalogPage";
import { ProjectKnowledgePage } from "./features/knowledge/ProjectKnowledgePage";

type View = "setup" | "knowledge" | "catalog" | "workspace" | "results" | "history" | "settings";

export default function App() {
  const [currentView, setCurrentView] = useState<View>("setup");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    try {
      const saved = sessionStorage.getItem("testforge:activeProjectId");
      return saved || null;
    } catch {
      return null;
    }
  });

  // Apply theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("testforge-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (prefersDark ? "slate" : "mist");
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  // Synchronize view with URL hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#results")) {
        setCurrentView("results");
      } else if (hash.startsWith("#history")) {
        setCurrentView("history");
      } else if (hash.startsWith("#catalog")) {
        setCurrentView("catalog");
      } else if (hash.startsWith("#knowledge")) {
        setCurrentView("knowledge");
      } else if (hash.startsWith("#workspace") || hash.startsWith("#setup") || hash.startsWith("#settings")) {
        if (hash.startsWith("#workspace")) {
          setCurrentView("workspace");
        } else if (hash.startsWith("#settings")) {
          setCurrentView("settings");
        } else {
          setCurrentView("setup");
        }
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // When no project is selected, default to setup view (but not when on settings)
  useEffect(() => {
    if (!activeProjectId && currentView !== "settings") {
      setCurrentView("setup");
    }
  }, [activeProjectId, currentView]);

  const handleActiveProjectChange = async (projectId: string | null) => {
    const normalized = projectId && String(projectId).trim() ? String(projectId).trim() : null;
    setActiveProjectId(normalized);
    if (normalized) {
      try {
        sessionStorage.setItem("testforge:activeProjectId", normalized);
      } catch {}
      setCurrentView("knowledge");
    } else {
      try {
        sessionStorage.removeItem("testforge:activeProjectId");
      } catch {}
    }
  };

  return (
    <div id="testforge-app" className="app-shell">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} activeProjectId={activeProjectId} />
      <div className="main-shell">
        <Header
          view={currentView}
          projectName={activeProjectId || undefined}
        />
        <main id="testforge-content" className="app-content">
          {currentView === "setup" && (
            <SetupPage
              activeProjectId={activeProjectId}
              onActiveProjectChange={handleActiveProjectChange}
            />
          )}
          {currentView === "settings" && (
            <SettingsPage activeProjectId={activeProjectId} />
          )}
          {currentView === "workspace" && (
            <WorkspacePage activeProjectId={activeProjectId} />
          )}
          {currentView === "results" && <ResultsPage activeProjectId={activeProjectId} />}
          {currentView === "history" && <HistoryPage activeProjectId={activeProjectId} />}
          {currentView === "catalog" && <ApiCatalogPage activeProjectId={activeProjectId} />}
          {currentView === "knowledge" && <ProjectKnowledgePage activeProjectId={activeProjectId} />}
        </main>
      </div>
    </div>
  );
}
