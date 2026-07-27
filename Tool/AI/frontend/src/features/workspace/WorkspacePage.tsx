import { useState, useEffect, useCallback } from "react";
import type { ActiveRequirement } from "../requirements/RequirementTypes";
import type { TestCase, PrepareResponse } from "../../types";
import { RequirementsPanel } from "../requirements/RequirementsPanel";
import { TestCasesPanel } from "../test-cases/TestCasesPanel";
import { ApiMatchingPanel } from "../api-matching/ApiMatchingPanel";
import { TestPreparePanel } from "../test-prepare/TestPreparePanel";
import { ExecutionPanel } from "../test-prepare/ExecutionPanel";
import { getProject } from "../project-setup/ProjectService";
import { listServices } from "../project-setup/ServiceRegistrationService";
import { getProjectKnowledge } from "../project-setup/KnowledgeService";

interface WorkspacePageProps {
  activeProjectId: string | null;
}

type RunOutcome = {
  passed: number;
  failed: number;
  blocked: number;
  runId?: string;
};

/** Contextual recommendation based on the project's current workflow state. */
interface RecommendedAction {
  title: string;
  description: string;
  actionLabel: string;
  actionView: string;
}

/**
 * Determines the "Next Recommended Action" for the project dashboard.
 * Follows the onboarding sequence:
 *   Project → API Catalog → Knowledge → Requirements → Test Generation → Execution → Reports
 */
function getRecommendedAction(state: {
  hasCatalog: boolean;
  hasKnowledge: boolean;
  hasRequirements: boolean;
  hasTests: boolean;
  hasRun: boolean;
  lastRunFailed: boolean;
}): RecommendedAction {
  if (!state.hasCatalog) {
    return {
      title: "Import Your API Collection",
      description: "Importing an API contract is the required first step. Upload an OpenAPI, Postman, or HAR file to begin test generation.",
      actionLabel: "Import APIs",
      actionView: "catalog",
    };
  }
  if (!state.hasKnowledge) {
    return {
      title: "Run Knowledge Engine",
      description: "Discover API dependencies and authentication flows automatically. This helps generate better, more accurate tests.",
      actionLabel: "Configure Knowledge",
      actionView: "setup",
    };
  }
  if (!state.hasRequirements) {
    return {
      title: "Add Requirements",
      description: "Define acceptance criteria to enable test generation. You can import from Jira, Azure DevOps, or add manually.",
      actionLabel: "Add Requirements",
      actionView: "workspace",
    };
  }
  if (!state.hasTests) {
    return {
      title: "Generate Tests",
      description: "Generate positive, negative, boundary, and security test scenarios from your requirements.",
      actionLabel: "Generate Tests",
      actionView: "workspace",
    };
  }
  if (!state.hasRun) {
    return {
      title: "Run Your First Execution",
      description: "Execute your test suite against your target environment with dependency-aware ordering.",
      actionLabel: "Run Tests",
      actionView: "workspace",
    };
  }
  if (state.lastRunFailed) {
    return {
      title: "Review Validation Report",
      description: "Some tests failed in the last run. Review the results to identify and fix issues.",
      actionLabel: "View Results",
      actionView: "results",
    };
  }
  return {
    title: "All Tests Passing",
    description: "Your test suite is up to date. Continue monitoring for regressions and review reports.",
    actionLabel: "View Reports",
    actionView: "results",
  };
}

export function WorkspacePage({ activeProjectId }: WorkspacePageProps) {
  const [activeRequirement, setActiveRequirement] = useState<ActiveRequirement | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [generatedCount, setGeneratedCount] = useState<number>(0);
  const [includedTestCases, setIncludedTestCases] = useState<TestCase[]>([]);
  const [_matchedCount, setMatchedCount] = useState<number>(0);
  const [confirmedMappings, setConfirmedMappings] = useState<any[]>([]);
  const [prepareResponse, setPrepareResponse] = useState<PrepareResponse | null>(null);
  const [executionKey, setExecutionKey] = useState<number>(0);
  const [lastRun, setLastRun] = useState<RunOutcome | null>(null);

  // Dashboard state — checked on mount to determine the recommended action
  const [hasCatalog, setHasCatalog] = useState<boolean>(false);
  const [hasKnowledge, setHasKnowledge] = useState<boolean>(false);
  const [servicesCount, setServicesCount] = useState<number>(0);
  const [projectStateLoading, setProjectStateLoading] = useState<boolean>(true);
  // projectStateLoading is used to track async state checks; exposed for future loading indicators
  void projectStateLoading;

  // Derive workflow state from child-component callbacks
  const hasRequirements = activeRequirement !== null && activeRequirement.requirement !== null;
  const hasTests = generatedCount > 0;
  const hasRun = lastRun !== null;
  const lastRunFailed = lastRun !== null && lastRun.failed > 0;

  // Load project name and check project state (catalog + knowledge)
  useEffect(() => {
    if (!activeProjectId) {
      setProjectName("");
      setHasCatalog(false);
      setHasKnowledge(false);
      setServicesCount(0);
      setProjectStateLoading(false);
      return;
    }

    let cancelled = false;

    // Fetch project name
    getProject(activeProjectId)
      .then((project) => {
        if (!cancelled) setProjectName(project?.name || "");
      })
      .catch(() => {
        if (!cancelled) setProjectName("");
      });

    // Check whether an API Catalog exists (services registered)
    listServices(activeProjectId)
      .then((services) => {
        if (!cancelled) {
          setHasCatalog(services.length > 0);
          setServicesCount(services.length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasCatalog(false);
          setServicesCount(0);
        }
      });

    // Check whether project knowledge exists
    getProjectKnowledge(activeProjectId)
      .then((knowledge) => {
        if (!cancelled) {
          setHasKnowledge(knowledge !== null && knowledge !== undefined);
        }
      })
      .catch(() => {
        if (!cancelled) setHasKnowledge(false);
      })
      .finally(() => {
        if (!cancelled) setProjectStateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  // Compute the contextual "Next Recommended Action"
  const recommendedAction = getRecommendedAction({
    hasCatalog,
    hasKnowledge,
    hasRequirements,
    hasTests,
    hasRun,
    lastRunFailed,
  });

  const handleActionClick = useCallback(() => {
    window.location.hash = `#${recommendedAction.actionView}`;
  }, [recommendedAction.actionView]);

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

  return (
    <div>
      {/* ─── Dashboard Header ────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 24px",
        maxWidth: "1520px",
        margin: "0 auto",
        fontSize: "13px",
        color: "var(--ink)",
        background: "var(--surface)",
        borderBottom: "1px solid var(--line)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--color-text-muted)"
            }}>
              Project Workspace
            </span>
            <h2 style={{ margin: "4px 0 0 0", color: "var(--color-text-primary)" }}>
              {projectName || activeProjectId}
            </h2>
            <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                ID: {activeProjectId}
              </span>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                Services: {servicesCount}
              </span>
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                Knowledge: {hasKnowledge ? "Configured" : "Not configured"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { window.location.hash = "#setup"; }}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: 600,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-bg-surface)",
              color: "var(--color-text-primary)",
              cursor: "pointer"
            }}
          >
            Change Project
          </button>
        </div>
      </div>

      {/* ─── Next Recommended Action ─────────────────────────────────────── */}
      <div style={{
        padding: "20px 24px",
        maxWidth: "1520px",
        margin: "0 auto"
      }}>
        <div style={{
          padding: "18px 22px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-bg-surface)",
          boxShadow: "var(--shadow-sm)"
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <span style={{
              fontSize: "20px",
              flexShrink: 0,
              marginTop: "2px"
            }}>
              💡
            </span>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "var(--color-text-primary)" }}>
                {recommendedAction.title}
              </h3>
              <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                {recommendedAction.description}
              </p>
              <button
                type="button"
                onClick={handleActionClick}
                style={{
                  padding: "8px 18px",
                  fontSize: "13px",
                  fontWeight: 700,
                  border: "1px solid var(--color-primary)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-primary)",
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                {recommendedAction.actionLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Workflow Panels ─────────────────────────────────────────────── */}
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
            onRunComplete={(outcome) => setLastRun(outcome)}
          />
        )}

        {lastRun && (
          <section className="panel span-12 panel-results-handoff" style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface)", overflow: "hidden" }}>
            <div className="panel-head" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", background: "var(--blue-soft)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="step-indicator results">R</span>
                <h2 style={{ margin: 0, fontSize: "17px", color: "var(--blue-deep)" }}>Results</h2>
              </div>
            </div>
            <div className="panel-body" style={{ padding: "18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ fontSize: "13px", color: "var(--ink)" }}>
                <strong>{lastRun.passed}</strong> passed · <strong>{lastRun.failed}</strong> failed · <strong>{lastRun.blocked}</strong> blocked
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (lastRun.runId) {
                    window.location.hash = `#results?runId=${encodeURIComponent(lastRun.runId)}`;
                  } else {
                    window.location.hash = "#results";
                  }
                }}
              >
                View Results
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
