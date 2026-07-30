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
import { RequirementPage } from "./features/requirements/RequirementPage";
import { ImplementationMappingsPage } from "./features/implementation-mappings/ImplementationMappingsPage";
import { ExecutableTestsPage } from "./features/executable-tests/ExecutableTestsPage";
import { ExecutionWorkspacePage } from "./features/execution-workspace/ExecutionWorkspacePage";
import { TestCasesPage } from "./features/test-cases/TestCasesPage";

type View = "setup" | "knowledge" | "catalog" | "requirements" | "test-cases" | "implementation-mappings" | "executable-tests" | "execution-workspace" | "workspace" | "results" | "history" | "settings";

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

  // Synchronize view with URL path on mount and change
  useEffect(() => {
    const applyPath = () => {
      const path = window.location.pathname;
      if (path.startsWith("/results")) {
        setCurrentView("results");
      } else if (path.startsWith("/history")) {
        setCurrentView("history");
      } else if (path.startsWith("/catalog")) {
        setCurrentView("catalog");
      } else if (path.startsWith("/knowledge")) {
        setCurrentView("knowledge");
      } else if (path.startsWith("/requirements")) {
        setCurrentView("requirements");
      } else if (path.startsWith("/test-cases")) {
        setCurrentView("test-cases");
      } else if (path.startsWith("/implementation-mappings")) {
        setCurrentView("implementation-mappings");
      } else if (path.startsWith("/executable-tests")) {
        setCurrentView("executable-tests");
      } else if (path.startsWith("/execution-workspace")) {
        setCurrentView("execution-workspace");
      } else if (path.startsWith("/workspace")) {
        setCurrentView("workspace");
      } else if (path.startsWith("/settings")) {
        setCurrentView("settings");
      } else {
        setCurrentView("setup");
      }
    };

    applyPath();
    window.addEventListener("popstate", applyPath);
    return () => window.removeEventListener("popstate", applyPath);
  }, []);

  const navigate = (view: View) => {
    const path = view === "setup" ? "/setup" : `/${view}`;
    window.history.pushState({}, "", path);
    setCurrentView(view);
    if (view === "setup") {
      setActiveProjectId(null);
      try { sessionStorage.removeItem("testforge:activeProjectId"); } catch {}
    }
  };

  const handleActiveProjectChange = async (projectId: string | null) => {
    const normalized = projectId && String(projectId).trim() ? String(projectId).trim() : null;
    setActiveProjectId(normalized);
    if (normalized) {
      try {
        sessionStorage.setItem("testforge:activeProjectId", normalized);
      } catch {}
      navigate("knowledge");
    } else {
      try {
        sessionStorage.removeItem("testforge:activeProjectId");
      } catch {}
      navigate("setup");
    }
  };

  return (
    <div id="testforge-app" className="app-shell">
      <Sidebar currentView={currentView} onViewChange={navigate} activeProjectId={activeProjectId} />
      <div className="main-shell">
        <Header
          view={currentView}
          projectName={activeProjectId || undefined}
          onNavigateToProjects={() => handleActiveProjectChange(null)}
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
          {currentView === "requirements" && <RequirementPage activeProjectId={activeProjectId} />}
          {currentView === "test-cases" && <TestCasesPage activeProjectId={activeProjectId} />}
          {currentView === "implementation-mappings" && <ImplementationMappingsPage activeProjectId={activeProjectId} />}
          {currentView === "executable-tests" && <ExecutableTestsPage activeProjectId={activeProjectId} />}
          {currentView === "execution-workspace" && <ExecutionWorkspacePage activeProjectId={activeProjectId} />}
        </main>
      </div>
    </div>
  );
}
