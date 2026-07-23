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
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
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
    <div className="app-shell">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Header view={currentView === "setup" ? "workspace" : currentView} />
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
      </div>
    </div>
  );
}
