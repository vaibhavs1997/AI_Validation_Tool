import { useState, useEffect } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { WorkspacePage } from "./features/workspace/WorkspacePage";
import { ResultsPage } from "./features/results/ResultsPage";
import { HistoryPage } from "./features/history/HistoryPage";

type View = "workspace" | "results" | "history";

export default function App() {
  const [currentView, setCurrentView] = useState<View>("workspace");

  // Apply theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Header view={currentView} />
        {currentView === "workspace" && <WorkspacePage />}
        {currentView === "results" && <ResultsPage />}
        {currentView === "history" && <HistoryPage />}
      </div>
    </div>
  );
}
