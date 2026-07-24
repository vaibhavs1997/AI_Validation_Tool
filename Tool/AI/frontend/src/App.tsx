import { useState, useEffect } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { SetupPage } from "./features/project-setup/SetupPage";
import { WorkspacePage } from "./features/workspace/WorkspacePage";
import { ResultsPage } from "./features/results/ResultsPage";
import { HistoryPage } from "./features/history/HistoryPage";

type View = "setup" | "workspace" | "results" | "history";

export default function App() {
  const [currentView, setCurrentView] = useState<View>("setup");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Apply theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("testforge-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (prefersDark ? "dark" : "light");
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
      } else if (hash.startsWith("#workspace") || hash.startsWith("#setup")) {
        setCurrentView(hash.startsWith("#workspace") ? "workspace" : "setup");
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Default to "default" project if none selected
  useEffect(() => {
    if (!activeProjectId) {
      // If no project is selected, go to setup view
      setCurrentView("setup");
    }
  }, [activeProjectId]);

  const handleActiveProjectChange = (projectId: string | null) => {
    setActiveProjectId(projectId);
    if (projectId) {
      // Navigate to workspace when project is selected
      setCurrentView("workspace");
    }
  };

  return (
    <div id="testforge-app" className="app-shell">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <div className="main-shell">
        <Header
          view={currentView === "setup" ? "workspace" : currentView}
          projectName={activeProjectId || undefined}
        />
        <main id="testforge-content" className="app-content">
          {currentView === "setup" && (
            <SetupPage
              activeProjectId={activeProjectId}
              onActiveProjectChange={handleActiveProjectChange}
            />
          )}
          {currentView === "workspace" && (
            <WorkspacePage activeProjectId={activeProjectId} />
          )}
          {currentView === "results" && <ResultsPage activeProjectId={activeProjectId} />}
          {currentView === "history" && <HistoryPage activeProjectId={activeProjectId} />}
        </main>
      </div>
    </div>
  );
}