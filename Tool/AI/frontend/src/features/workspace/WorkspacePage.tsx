import { useState, useEffect } from "react";
import type { ActiveRequirement } from "../requirements/RequirementTypes";
import type { TestCase, PrepareResponse } from "../../types";
import { WorkflowStatus } from "../../components/workflow/WorkflowStatus";
import { RequirementsPanel } from "../requirements/RequirementsPanel";
import { TestCasesPanel } from "../test-cases/TestCasesPanel";
import { ApiMatchingPanel } from "../api-matching/ApiMatchingPanel";
import { TestPreparePanel } from "../test-prepare/TestPreparePanel";
import { ExecutionPanel } from "../test-prepare/ExecutionPanel";
import { getProject } from "../project-setup/ProjectService";

interface WorkspacePageProps {
  activeProjectId: string | null;
}

export function WorkspacePage({ activeProjectId }: WorkspacePageProps) {
  const [activeRequirement, setActiveRequirement] = useState<ActiveRequirement | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [generatedCount, setGeneratedCount] = useState<number>(0);
  const [includedTestCases, setIncludedTestCases] = useState<TestCase[]>([]);
  const [matchedCount, setMatchedCount] = useState<number>(0);
  const [confirmedMappings, setConfirmedMappings] = useState<any[]>([]);
  const [prepareResponse, setPrepareResponse] = useState<PrepareResponse | null>(null);
  const [executionKey, setExecutionKey] = useState<number>(0);

  useEffect(() => {
    if (!activeProjectId) {
      setProjectName("");
      return;
    }
    getProject(activeProjectId)
      .then((project) => setProjectName(project?.name || ""))
      .catch(() => setProjectName(""));
  }, [activeProjectId]);

  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ marginBottom: "20px" }}>Workspace</h2>
        <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
          Select or create a project in Setup before generating tests.
        </p>
        <p style={{ color: "var(--muted)", fontSize: "13px" }}>
          Go to Setup to choose a project. APIs registered in that project will be used automatically.
        </p>
      </div>
    );
  }

  const projectLabel = projectName ? `Project: ${projectName} (${activeProjectId})` : `Project: ${activeProjectId}`;

  return (
    <div>
      <div style={{
        padding: "10px 22px",
        maxWidth: "1520px",
        margin: "0 auto",
        fontSize: "13px",
        color: "var(--ink)",
        background: "var(--surface)",
        borderBottom: "1px solid var(--line)"
      }}>
        {projectLabel}
      </div>
      <WorkflowStatus
        activeRequirement={activeRequirement}
        testCaseCount={generatedCount}
        includedCount={includedTestCases.length}
        matchedCount={matchedCount}
        runSummary={undefined}
        reportUrl={undefined}
      />
      <main id="workspace" className="workspace" style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gap: "18px",
        padding: "22px",
        maxWidth: "1520px",
        margin: "0 auto"
      }}>
        <RequirementsPanel
          activeRequirement={activeRequirement}
          onActiveRequirementChange={setActiveRequirement}
        />
        <TestCasesPanel
          activeProjectId={activeProjectId}
          activeRequirement={activeRequirement}
          onGenerated={setGeneratedCount}
          onIncludedChange={setIncludedTestCases}
          onContinue={(included) => {
            setIncludedTestCases(included);
          }}
        />
        <ApiMatchingPanel
          activeProjectId={activeProjectId}
          includedTestCases={includedTestCases}
          onGenerated={setMatchedCount}
          onConfirm={(response) => {
            // Pass confirmed mappings to next workflow state (STEP 5.5E boundary)
            setConfirmedMappings(response.mappings);
          }}
        />
        {confirmedMappings.length > 0 && (
          <TestPreparePanel
            activeProjectId={activeProjectId}
            includedTestCases={includedTestCases}
            confirmedMappings={confirmedMappings}
            onPrepared={(response) => {
              setPrepareResponse(response);
              setExecutionKey(prev => prev + 1);
            }}
          />
        )}
        {prepareResponse && (
          <ExecutionPanel
            key={executionKey}
            activeProjectId={activeProjectId}
            prepareResponse={prepareResponse}
          />
        )}
      </main>
    </div>
  );
}
