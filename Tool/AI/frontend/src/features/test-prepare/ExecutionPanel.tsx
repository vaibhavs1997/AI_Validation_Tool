/**
 * ExecutionPanel
 *
 * STEP 5.7 — Execution stage for prepared TestSpecifications.
 *
 * Flow:
 *   Prepared TestSpecifications + ExecutionPlans from TestPreparePanel
 *        ↓
 *   User selects a prepared test
 *        ↓
 *   ExecutionPlan preview shown (with dependency WHY explanation)
 *        ↓
 *   User clicks "Run Test"
 *        ↓
 *   POST /api/runs/execute-dependent
 *        ↓
 *   Results rendered inline (PASSED/FAILED/BLOCKED)
 *
 * Architecture:
 *   - Does NOT regenerate TestCases
 *   - Does NOT rematch APIs
 *   - Does NOT change confirmed mappings
 *   - Does NOT rebuild ExecutionPlan
 *   - Does NOT call AI
 *   - Does NOT call legacy /api/runs/execute
 */

import { useState, useCallback, useEffect } from "react";
import type {
  ExecutionPlan,
  ExecutionPlanStep,
  PrepareResponse,
} from "../../types";
import { executePreparedTest, type ExecuteDependentResponse } from "./ExecutionService";

interface ExecutionPanelProps {
  activeProjectId: string | null;
  prepareResponse: PrepareResponse;
  /** Called when the execution state should be invalidated (e.g. project changes) */
  onInvalidate?: () => void;
}

type ExecutionStatus = "IDLE" | "RUNNING" | "COMPLETED" | "ERROR";

interface ExecutionResult extends ExecuteDependentResponse {
  specTitle: string;
  specDescription: string;
}

/**
 * Derive human-readable WHY explanation for a step's prerequisites
 * using only deterministic binding metadata from the ExecutionPlan.
 */
function deriveDependencyExplanation(step: ExecutionPlanStep): string {
  const explanations: string[] = [];
  for (const binding of step.bindings || []) {
    const fromLocation = binding.source?.split(".").slice(-1)[0] || "input";
    const toLocation = binding.target?.split(".").slice(-1)[0] || "input";
    if (binding.type === "auth" || binding.type === "token") {
      explanations.push(`uses authentication from previous step`);
    } else if (binding.transform) {
      explanations.push(`uses "${fromLocation}" as "${toLocation}"`);
    } else {
      explanations.push(`uses "${fromLocation}" from previous step`);
    }
  }
  if (explanations.length === 0 && step.prerequisites.length > 0) {
    return `runs after previous step${step.prerequisites.length > 1 ? "s" : ""}`;
  }
  return explanations.join("; ") || "depends on previous step";
}

function renderPlanPreview(plan: ExecutionPlan) {
  if (!plan || plan.steps.length <= 1) return null;

  // Build a map of "target keys explained"
  const stepExplanations = new Map<number, string>();
  for (let i = 1; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (step) {
      stepExplanations.set(i, deriveDependencyExplanation(step));
    }
  }

  return (
    <div style={{
      marginTop: "10px",
      padding: "10px 12px",
      background: "var(--surface-alt)",
      borderRadius: "6px",
      border: "1px solid var(--line)",
    }}>
      <div style={{
        fontSize: "11px",
        fontWeight: 700,
        color: "var(--muted)",
        marginBottom: "8px",
        textTransform: "uppercase",
      }}>
        Execution Plan ({plan.steps.length} steps)
      </div>
      {plan.steps.map((step, idx) => {
        const isTarget = idx === plan.steps.length - 1;
        const stepOp = step.operation;
        return (
          <div key={idx} style={{ marginBottom: idx < plan.steps.length - 1 ? "4px" : 0 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 8px",
              background: isTarget ? "var(--violet-soft)" : "var(--surface)",
              border: `1px solid ${isTarget ? "var(--violet)" : "var(--line)"}`,
              borderRadius: "4px",
              fontSize: "12px",
            }}>
              <span style={{
                width: "20px",
                height: "20px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: 700,
                color: "#fff",
                background: isTarget ? "var(--violet)" : "var(--muted)",
              }}>
                {idx + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                  {stepOp.serviceId}::{stepOp.operationId}
                </span>
                <span style={{ marginLeft: "6px", color: "var(--muted)", fontFamily: "monospace", fontSize: "11px" }}>
                  {stepOp.method} {stepOp.path}
                </span>
                {isTarget && (
                  <span style={{
                    marginLeft: "6px",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "var(--violet)",
                  }}>
                    TARGET
                  </span>
                )}
              </div>
            </div>
            {!isTarget && stepExplanations.has(idx + 1) && (
              <div style={{
                marginLeft: "28px",
                padding: "2px 0 4px 0",
                fontSize: "11px",
                color: "var(--muted)",
                fontStyle: "italic",
              }}>
                ↑ {stepExplanations.get(idx + 1)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderStepResult(
  result: ExecuteDependentResponse["results"][0],
  index: number
) {
  const isBlocked = result.status === "blocked";
  const isFailed = result.status === "failed";
  const isPassed = result.status === "passed";

  const getStatusStyle = () => {
    if (isPassed) return { bg: "var(--green-soft)", border: "var(--green)", text: "var(--green-deep)", icon: "✓" };
    if (isFailed) return { bg: "var(--red-soft)", border: "var(--red)", text: "var(--red-deep)", icon: "✕" };
    if (isBlocked) return { bg: "#f0f0f0", border: "var(--line)", text: "var(--muted)", icon: "⊘" };
    return { bg: "var(--surface)", border: "var(--line)", text: "var(--muted)", icon: "?" };
  };

  const st = getStatusStyle();

  return (
    <div key={index} style={{
      border: `1px solid ${st.border}`,
      borderRadius: "6px",
      padding: "10px 12px",
      marginBottom: "6px",
      background: st.bg,
      opacity: isBlocked ? 0.75 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span style={{
          width: "22px",
          height: "22px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: 700,
          color: "#fff",
          background: isPassed ? "var(--green)" : isFailed ? "var(--red)" : "var(--line)",
        }}>
          {st.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--ink)",
          }}>
            {result.operation.serviceId}::{result.operation.operationId}
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "monospace" }}>
            {result.operation.method} {result.operation.path}
          </div>
        </div>
        <span style={{
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          background: st.bg,
          color: st.text,
          border: `1px solid ${st.border}`,
        }}>
          {result.status.toUpperCase()}
        </span>
      </div>

      {/* Human-readable failure/blocked explanation */}
      {!isPassed && result.error && (
        <div style={{
          marginTop: "4px",
          padding: "6px 8px",
          background: "var(--surface)",
          borderRadius: "4px",
          fontSize: "12px",
          color: isFailed ? "var(--red-deep)" : "var(--muted)",
        }}>
          {result.error}
        </div>
      )}

      {/* Expandable technical details */}
      {(result.request || result.response) && (
        <details style={{ marginTop: "6px" }}>
          <summary style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--muted)",
            cursor: "pointer",
            padding: "4px 0",
          }}>
            Technical Details
          </summary>
          <div style={{ padding: "8px", background: "var(--surface)", borderRadius: "4px", marginTop: "4px" }}>
            {result.request && (
              <div style={{ marginBottom: "8px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                  Request
                </div>
                <pre style={{
                  margin: 0,
                  fontSize: "11px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "monospace",
                  color: "var(--ink)",
                }}>
                  {result.request.method} {result.request.url}
                  {"\n"}{JSON.stringify(result.request.headers, null, 2)}
                  {result.request.body ? "\n" + JSON.stringify(result.request.body, null, 2) : ""}
                </pre>
              </div>
            )}
            {result.response && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                  Response ({result.response.status})
                </div>
                <pre style={{
                  margin: 0,
                  fontSize: "11px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "monospace",
                  color: "var(--ink)",
                }}>
                  {JSON.stringify(result.response, null, 2)}
                </pre>
              </div>
            )}
            {result.validation && (
              <div style={{ marginTop: "8px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                  Validation
                </div>
                <div style={{ fontSize: "12px", color: result.validation.passed ? "var(--green-deep)" : "var(--red-deep)" }}>
                  {result.validation.passed ? "✓ All assertions passed" : "✕ Some assertions failed"}
                </div>
                {result.validation.assertions.length > 0 && (
                  <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "11px" }}>
                    {result.validation.assertions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function renderOverallResult(result: ExecutionResult) {
  const total = result.results.length;
  const passed = result.results.filter(r => r.status === "passed").length;
  const failed = result.results.filter(r => r.status === "failed").length;
  const blocked = result.results.filter(r => r.status === "blocked").length;

  const isSuccess = result.status === "passed";

  return (
    <div style={{
      padding: "14px 16px",
      border: `2px solid ${isSuccess ? "var(--green)" : "var(--red)"}`,
      borderRadius: "8px",
      background: isSuccess ? "var(--green-soft)" : "var(--red-soft)",
      marginBottom: "14px",
    }}>
      <div style={{
        fontSize: "16px",
        fontWeight: 700,
        color: isSuccess ? "var(--green-deep)" : "var(--red-deep)",
        marginBottom: "6px",
      }}>
        {result.specTitle}
      </div>
      {result.specDescription && (
        <div style={{
          fontSize: "13px",
          color: "var(--muted)",
          marginBottom: "8px",
        }}>
          {result.specDescription}
        </div>
      )}
      <div style={{
        fontSize: "24px",
        fontWeight: 800,
        color: isSuccess ? "var(--green-deep)" : "var(--red-deep)",
        marginBottom: "4px",
      }}>
        {isSuccess ? "PASSED" : "FAILED"}
      </div>
      <div style={{ fontSize: "13px", color: "var(--muted)" }}>
        {total} step{total !== 1 ? "s" : ""} · {passed} passed · {failed} failed · {blocked} blocked
      </div>
      {!isSuccess && failed === 0 && blocked > 0 && (
        <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
          {result.results.filter(r => r.status === "blocked").map(r =>
            `"${r.operation.serviceId}::${r.operation.operationId}" was not executed because an upstream step failed.`
          ).join(" ")}
        </div>
      )}
      {result.errors.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          {result.errors.map((err, i) => (
            <div key={i} style={{ fontSize: "12px", color: "var(--red-deep)", marginBottom: "2px" }}>
              {err}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getRecoveryGuidance(error: string): string | null {
  const lower = error.toLowerCase();
  if (lower.includes("base url") || lower.includes("baseurl")) {
    return "Add a valid base URL and run again.";
  }
  if (lower.includes("missing") && lower.includes("dependency")) {
    return "A required value from an earlier API response was not available. Check the dependency mapping.";
  }
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("unauthenticated")) {
    return "Authentication failed. Check credentials or the confirmed authentication dependency.";
  }
  if (lower.includes("plan") || lower.includes("executionplan")) {
    return "This test cannot run until its execution plan is valid. Re-run Prepare Tests.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "The API did not respond before the timeout. Check the service or increase the timeout.";
  }
  if (lower.includes("blocked") && lower.includes("prerequisite")) {
    return "An upstream step failed. Fix the failing prerequisite and run again.";
  }
  return null;
}

type OverrideErrors = {
  bodyJson?: string;
  status?: string;
  assertion?: string;
  paramKey?: string;
};

function parseJsonSafely(text: string): { value?: unknown; error?: string } {
  if (!text || !text.trim()) return { value: {} };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { value: undefined, error: "Invalid JSON" };
  }
}

function validateOverride(override: {
  testData: { pathParams: Record<string, string>; queryParams: Record<string, string>; headers: Record<string, string>; body: unknown };
  expectedBehavior: { status: number; responseAssertions: string[] };
}): OverrideErrors {
  const errors: OverrideErrors = {};
  const bodyText = typeof override.testData.body === "string" ? override.testData.body : JSON.stringify(override.testData.body, null, 2);
  const parsed = parseJsonSafely(bodyText);
  if (parsed.error) errors.bodyJson = parsed.error;

  const status = override.expectedBehavior.status;
  if (typeof status !== "number" || !Number.isInteger(status) || status < 100 || status >= 600) {
    errors.status = "Enter a valid HTTP status (100-599)";
  }

  for (const assertion of override.expectedBehavior.responseAssertions) {
    if (!assertion || !assertion.trim()) {
      errors.assertion = "Assertion cannot be empty";
      break;
    }
  }

  const checkParams = (params: Record<string, string>) => {
    for (const k of Object.keys(params)) {
      if (!k.trim()) {
        errors.paramKey = "Parameter name cannot be empty";
        break;
      }
    }
  };
  checkParams(override.testData.pathParams);
  checkParams(override.testData.queryParams);
  checkParams(override.testData.headers);

  return errors;
}

export function ExecutionPanel({
  activeProjectId,
  prepareResponse,
}: ExecutionPanelProps) {
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [selectedSpecIds, setSelectedSpecIds] = useState<Set<string>>(new Set());
  const [execState, setExecState] = useState<ExecutionStatus>("IDLE");
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [execError, setExecError] = useState<string>("");
  const [override, setOverride] = useState<{
    testData: { pathParams: Record<string, string>; queryParams: Record<string, string>; headers: Record<string, string>; body: string };
    expectedBehavior: { status: number; responseAssertions: string[] };
  } | null>(null);
  const [overrideErrors, setOverrideErrors] = useState<OverrideErrors>({});

  // Batch execution state
  const [batchResults, setBatchResults] = useState<ExecutionResult[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchCompleted, setBatchCompleted] = useState(false);

  // Reset state when prepareResponse changes (new preparation)
  useEffect(() => {
    setSelectedSpecId(null);
    setSelectedSpecIds(new Set());
    setExecState("IDLE");
    setExecResult(null);
    setExecError("");
    setOverride(null);
    setOverrideErrors({});
    setBatchResults([]);
    setBatchRunning(false);
    setBatchCompleted(false);
  }, [prepareResponse]);

  const initOverride = (specId: string) => {
    const spec = prepareResponse.testSpecifications.find(s => s.id === specId);
    if (!spec) return;
    setOverride({
      testData: {
        pathParams: { ...(spec.testData?.pathParams || {}) } as Record<string, string>,
        queryParams: { ...(spec.testData?.queryParams || {}) } as Record<string, string>,
        headers: { ...(spec.testData?.headers || {}) } as Record<string, string>,
        body: spec.testData?.body ? JSON.stringify(spec.testData.body, null, 2) : "{}",
      },
      expectedBehavior: {
        status: spec.expectedBehavior?.status ?? 200,
        responseAssertions: [...(spec.expectedBehavior?.responseAssertions || [])],
      },
    });
    setOverrideErrors({});
  };

  useEffect(() => {
    if (selectedSpecId) initOverride(selectedSpecId);
  }, [selectedSpecId]);

  const selectedSpec = prepareResponse.testSpecifications.find(s => s.id === selectedSpecId);
  const selectedPlan = selectedSpecId ? prepareResponse.plans[selectedSpecId] : undefined;

  const canRun = Boolean(
    selectedSpec &&
    selectedPlan &&
    execState !== "RUNNING" &&
    activeProjectId
  );

  // Build list of executable specs (have a valid plan)
  const executableSpecs = prepareResponse.testSpecifications.filter(
    (s): s is typeof s => {
      const plan = prepareResponse.plans[s.id];
      return plan !== undefined && plan.isValid !== false;
    }
  );

  const buildExecutionSpec = (spec: PrepareResponse["testSpecifications"][0], plan: ExecutionPlan) => {
    if (!spec || !plan || !override) return null;
    const errors = validateOverride(override);
    if (Object.keys(errors).length > 0) return null;

    const parseBody = (text: string): unknown => {
      try {
        return JSON.parse(text);
      } catch {
        return spec.testData?.body || {};
      }
    };

    return {
      ...spec,
      testData: {
        ...(spec.testData || {}),
        pathParams: { ...(spec.testData?.pathParams || {}), ...(override.testData.pathParams || {}) },
        queryParams: { ...(spec.testData?.queryParams || {}), ...(override.testData.queryParams || {}) },
        headers: { ...(spec.testData?.headers || {}), ...(override.testData.headers || {}) },
        body: parseBody(override.testData.body as string),
      },
      expectedBehavior: {
        ...(spec.expectedBehavior || {}),
        status: override.expectedBehavior.status,
        responseAssertions: override.expectedBehavior.responseAssertions.filter(a => a.trim()),
      },
      assertions: override.expectedBehavior.responseAssertions.filter(a => a.trim()),
    };
  };

  const handleRun = useCallback(async () => {
    if (!selectedSpec || !selectedPlan || !activeProjectId) return;
    if (execState === "RUNNING") return;
    if (!override) return;

    const errors = validateOverride(override);
    setOverrideErrors(errors);
    if (Object.keys(errors).length > 0) {
      setExecError("Fix the highlighted issues before running.");
      return;
    }

    const executionSpec = buildExecutionSpec(selectedSpec, selectedPlan);
    if (!executionSpec) return;

    setExecState("RUNNING");
    setExecResult(null);
    setExecError("");

    try {
      const response = await executePreparedTest({
        projectId: activeProjectId,
        testSpecification: executionSpec,
        executionPlan: selectedPlan,
        environment: {},
      });

      const result: ExecutionResult = {
        ...response,
        specTitle: selectedSpec.title,
        specDescription: selectedSpec.description,
      };

      setExecResult(result);
      setExecState("COMPLETED");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      setExecError(msg);
      setExecState("ERROR");
    }
  }, [selectedSpec, selectedPlan, activeProjectId, execState, override]);

  const runBatch = useCallback(async () => {
    if (!activeProjectId || batchRunning) return;
    setBatchRunning(true);
    setBatchCompleted(false);
    setBatchResults([]);

    const uniqueIds = Array.from(selectedSpecIds);
    const results: ExecutionResult[] = [];

    for (const specId of uniqueIds) {
      const spec = executableSpecs.find(s => s.id === specId);
      const plan = prepareResponse.plans[specId];
      if (!spec || !plan) continue;

      const executionSpec = buildExecutionSpec(spec, plan);
      if (!executionSpec) continue;

      try {
        const response = await executePreparedTest({
          projectId: activeProjectId,
          testSpecification: executionSpec,
          executionPlan: plan,
          environment: {},
        });
        results.push({
          ...response,
          specId: spec.id,
          specTitle: spec.title,
          specDescription: spec.description,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Execution failed";
        results.push({
          specId: spec.id,
          spec: { title: spec.title, description: spec.description },
          status: "failed",
          results: [],
          errors: [msg],
          success: false,
          specTitle: spec.title,
          specDescription: spec.description,
        });
      }
      setBatchResults([...results]);
    }

    setBatchRunning(false);
    setBatchCompleted(true);
  }, [activeProjectId, batchRunning, selectedSpecIds, executableSpecs, prepareResponse.plans, override]);

  const toggleSelectedSpecId = useCallback((specId: string) => {
    if (batchRunning) return;
    setSelectedSpecIds(prev => {
      const next = new Set(prev);
      if (next.has(specId)) next.delete(specId);
      else next.add(specId);
      return next;
    });
  }, [batchRunning]);

  const selectAllReady = useCallback(() => {
    if (batchRunning) return;
    const ids = new Set(executableSpecs.map(s => s.id));
    setSelectedSpecIds(ids);
  }, [batchRunning, executableSpecs]);

  const clearSelection = useCallback(() => {
    if (batchRunning) return;
    setSelectedSpecIds(new Set());
  }, [batchRunning]);

  const rerunFailed = useCallback(() => {
    if (batchRunning) return;
    const failedIds = new Set(
      batchResults
        .filter(r => r.status === "failed")
        .map(r => r.specId)
    );
    setSelectedSpecIds(failedIds);
  }, [batchRunning, batchResults]);

  const runAgain = useCallback(() => {
    if (batchRunning || selectedSpecIds.size === 0) return;
    runBatch();
  }, [batchRunning, selectedSpecIds, runBatch]);

  // Derive batch progress for live UI
  const selectedIdsArray = Array.from(selectedSpecIds);
  const batchCompletedCount = batchResults.length;
  const batchTotalCount = selectedIdsArray.length;

  // Compute summary stats from completed batch results
  const batchPassedCount = batchResults.filter(r => r.status === "passed").length;
  const batchFailedCount = batchResults.filter(r => r.status === "failed").length;
  const batchBlockedCount = batchResults.filter(r => r.results.some(step => step.status === "blocked")).length;

  return (
    <section className="panel span-12 panel-execution" data-view-section="workspace">
      <div className="panel-head" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        padding: "12px 16px",
        borderBottom: "1px solid var(--line)",
        background: "var(--amber-soft)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="step" style={{
            width: "30px",
            height: "30px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "8px",
            fontWeight: 800,
            background: "var(--amber)",
            color: "#fff",
          }}>
            4
          </span>
          <h2 style={{ margin: 0, fontSize: "17px", color: "var(--amber-deep)" }}>
            Run Tests
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--muted)",
          }}>
            {execState}
          </span>
        </div>
      </div>

      <div className="panel-body" style={{ padding: "18px" }}>
        {/* Prerequisites */}
        <div style={{ marginBottom: "18px" }}>
          <h3 style={{
            margin: "0 0 12px 0",
            fontSize: "13px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--muted)",
          }}>
            BEFORE YOU RUN
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
            <div style={{
              padding: "12px 14px",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              background: "var(--surface)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{
                  width: "18px",
                  height: "18px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#fff",
                  background: activeProjectId ? "var(--green)" : "var(--line)",
                }}>
                  {activeProjectId ? "✓" : "○"}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>Project</span>
              </div>
              <div style={{ fontSize: "14px", color: "var(--ink)", opacity: 0.85, paddingLeft: "26px" }}>
                {activeProjectId || "Not selected"}
              </div>
            </div>

            <div style={{
              padding: "12px 14px",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              background: "var(--surface)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{
                  width: "18px",
                  height: "18px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#fff",
                  background: executableSpecs.length > 0 ? "var(--green)" : "var(--line)",
                }}>
                  {executableSpecs.length > 0 ? "✓" : "○"}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>Prepared Tests</span>
              </div>
              <div style={{ fontSize: "14px", color: "var(--ink)", opacity: 0.85, paddingLeft: "26px" }}>
                {executableSpecs.length} executable · {prepareResponse.unresolvedTestCases.length} unresolved
              </div>
            </div>
          </div>
        </div>

        {/* Spec selection */}
        {executableSpecs.length > 0 && (
          <div style={{ marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <h3 style={{
                margin: 0,
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--muted)",
              }}>
                Select Tests to Execute
              </h3>
              {executableSpecs.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--muted)" }}>
                  <span>{selectedSpecIds.size} of {executableSpecs.length} selected</span>
                  <button
                    type="button"
                    onClick={selectAllReady}
                    disabled={batchRunning}
                    style={{ padding: "4px 10px", fontSize: "11px", fontWeight: 600, border: "1px solid var(--line)", borderRadius: "4px", background: "var(--surface)", color: "var(--ink)", cursor: batchRunning ? "not-allowed" : "pointer" }}
                  >
                    Select All Ready
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={batchRunning || selectedSpecIds.size === 0}
                    style={{ padding: "4px 10px", fontSize: "11px", fontWeight: 600, border: "1px solid var(--line)", borderRadius: "4px", background: "var(--surface)", color: "var(--ink)", cursor: (batchRunning || selectedSpecIds.size === 0) ? "not-allowed" : "pointer", opacity: (batchRunning || selectedSpecIds.size === 0) ? 0.5 : 1 }}
                  >
                    Clear Selection
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              {executableSpecs.map(spec => {
                const plan = prepareResponse.plans[spec.id];
                const isSelected = spec.id === selectedSpecId;
                const isBatchSelected = selectedSpecIds.has(spec.id);
                const opRef = spec.operationRefs?.[0];
                const isIndependent = !plan || plan.steps.length <= 1;

                return (
                  <div
                    key={spec.id}
                    onClick={() => {
                      setSelectedSpecId(spec.id);
                      setExecState("IDLE");
                      setExecResult(null);
                      setExecError("");
                    }}
                    style={{
                      padding: "10px 12px",
                      border: `1px solid ${isSelected ? "var(--amber)" : "var(--line)"}`,
                      borderRadius: "6px",
                      background: isSelected ? "var(--amber-soft)" : "var(--surface)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        checked={isBatchSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelectedSpecId(spec.id);
                        }}
                        disabled={batchRunning}
                        style={{ cursor: batchRunning ? "not-allowed" : "pointer" }}
                      />
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedSpecId(spec.id);
                          setExecState("IDLE");
                          setExecResult(null);
                          setExecError("");
                        }}
                        style={{ cursor: "pointer" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                          {spec.title}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                          {opRef?.method} {opRef?.path}
                          {isIndependent ? " · Independent" : ` · ${(plan?.steps?.length) || 1} steps`}
                        </div>
                      </div>
                      {spec.expectedBehavior?.status && (
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "var(--green-deep)",
                          background: "var(--green-soft)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontFamily: "monospace",
                        }}>
                          {spec.expectedBehavior.status}
                        </span>
                      )}
                    </div>

                    {/* Plan preview when selected */}
                    {isSelected && plan && renderPlanPreview(plan)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Unresolved tests */}
        {prepareResponse.unresolvedTestCases.length > 0 && (
          <div style={{ marginBottom: "18px" }}>
            <h3 style={{
              margin: "0 0 8px 0",
              fontSize: "13px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--red-deep)",
            }}>
              Not Executable ({prepareResponse.unresolvedTestCases.length})
            </h3>
            {prepareResponse.unresolvedTestCases.map(item => (
              <div key={item.testCaseId} style={{
                padding: "8px 12px",
                border: "1px dashed var(--line)",
                borderRadius: "6px",
                marginBottom: "4px",
                background: "var(--surface)",
                opacity: 0.7,
                fontSize: "12px",
                color: "var(--muted)",
              }}>
                {item.reason}
              </div>
            ))}
          </div>
        )}

        {/* Batch actions + progress + completion — single consolidated section */}
        {executableSpecs.length > 1 && (
          <div style={{ marginBottom: "18px" }}>
            {/* Run / progress header */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
              <button
                type="button"
                onClick={runBatch}
                disabled={!activeProjectId || batchRunning || selectedSpecIds.size === 0}
                style={{
                  padding: "10px 18px",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#fff",
                  background: (activeProjectId && !batchRunning && selectedSpecIds.size > 0) ? "var(--blue)" : "var(--line)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: (activeProjectId && !batchRunning && selectedSpecIds.size > 0) ? "pointer" : "not-allowed",
                  opacity: (activeProjectId && !batchRunning && selectedSpecIds.size > 0) ? 1 : 0.6,
                }}
              >
                {batchRunning ? "Running Tests..." : `Run Selected Tests (${selectedSpecIds.size})`}
              </button>
              {batchRunning && (
                <span style={{ fontSize: "13px", color: "var(--muted)" }}>Running tests...</span>
              )}
            </div>

            {/* Live progress while running */}
            {batchRunning && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
                  Running Tests
                </div>
                <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px" }}>
                  {batchCompletedCount} of {batchTotalCount} completed
                </div>
                <div style={{ display: "grid", gap: "4px" }}>
                  {selectedIdsArray.map((specId, idx) => {
                    const spec = executableSpecs.find(s => s.id === specId);
                    const title = spec?.title || specId;
                    if (idx < batchCompletedCount) {
                      const r = batchResults[idx];
                      const isPassed = r?.status === "passed";
                      const isFailed = r?.status === "failed";
                      return (
                        <div key={specId} style={{
                          padding: "6px 10px",
                          borderRadius: "4px",
                          background: "var(--surface)",
                          fontSize: "12px",
                          color: isPassed ? "var(--green-deep)" : isFailed ? "var(--red-deep)" : "var(--muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}>
                          <span>{isPassed ? "✓" : isFailed ? "✕" : "⊘"}</span>
                          <span>{title}</span>
                        </div>
                      );
                    }
                    if (idx === batchCompletedCount) {
                      return (
                        <div key={specId} style={{
                          padding: "6px 10px",
                          borderRadius: "4px",
                          background: "var(--surface)",
                          fontSize: "12px",
                          color: "var(--ink)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}>
                          <span>●</span>
                          <span>{title} — Running</span>
                        </div>
                      );
                    }
                    return (
                      <div key={specId} style={{
                        padding: "6px 10px",
                        borderRadius: "4px",
                        background: "var(--surface)",
                        fontSize: "12px",
                        color: "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        opacity: 0.6,
                      }}>
                        <span>○</span>
                        <span>{title} — Waiting</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completion summary */}
            {batchCompleted && batchResults.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
                  Batch Complete
                </div>
                <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px" }}>
                  {batchResults.length} test{batchResults.length !== 1 ? "s" : ""} completed · {batchPassedCount} passed · {batchFailedCount} failed · {batchBlockedCount} blocked
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {batchFailedCount > 0 && (
                    <button
                      type="button"
                      onClick={rerunFailed}
                      disabled={batchRunning}
                      style={{
                        padding: "8px 16px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--red-deep)",
                        background: "var(--red-soft)",
                        border: "1px solid var(--red)",
                        borderRadius: "6px",
                        cursor: batchRunning ? "not-allowed" : "pointer",
                      }}
                    >
                      Rerun Failed ({batchFailedCount})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={runAgain}
                    disabled={batchRunning || selectedSpecIds.size === 0}
                    style={{
                      padding: "8px 16px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--ink)",
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      cursor: (batchRunning || selectedSpecIds.size === 0) ? "not-allowed" : "pointer",
                      opacity: (batchRunning || selectedSpecIds.size === 0) ? 0.5 : 1,
                    }}
                  >
                    Run Again
                  </button>
                </div>
              </div>
            )}

            {/* Batch results detail list */}
            {batchResults.length > 0 && (
              <div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>Batch Results</h3>
                {batchResults.map((r, idx) => (
                  <div key={idx} style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--surface)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: r.status === "passed" ? "var(--green-deep)" : r.status === "failed" ? "var(--red-deep)" : "var(--muted)" }}>{r.status.toUpperCase()}</span>
                    <span style={{ fontSize: "13px", color: "var(--ink)" }}>{r.specTitle}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Test Data & Expected Result editor */}
        {selectedSpec && override && (
          <div style={{ marginBottom: "18px" }}>
            <details open>
              <summary style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--ink)",
                cursor: "pointer",
                padding: "8px 0",
              }}>
                Test Data & Expected Result
              </summary>
              <div style={{ marginTop: "10px", padding: "12px", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--surface)" }}>
                <div style={{ display: "grid", gap: "14px" }}>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px" }}>Path Parameters</div>
                    {Object.entries(override.testData.pathParams).map(([key, value]) => (
                      <div key={key} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                        <input value={key} disabled style={{ flex: 1, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: "4px", background: "var(--surface-alt)" }} />
                        <input value={value} onChange={(e) => setOverride(prev => prev ? { ...prev, testData: { ...prev.testData, pathParams: { ...prev.testData.pathParams, [key]: e.target.value } } } : prev)} style={{ flex: 2, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: "4px" }} />
                      </div>
                    ))}
                    {overrideErrors.paramKey && <div style={{ fontSize: "12px", color: "var(--red-deep)" }}>{overrideErrors.paramKey}</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px" }}>Query Parameters</div>
                    {Object.entries(override.testData.queryParams).map(([key, value]) => (
                      <div key={key} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                        <input value={key} disabled style={{ flex: 1, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: "4px", background: "var(--surface-alt)" }} />
                        <input value={value} onChange={(e) => setOverride(prev => prev ? { ...prev, testData: { ...prev.testData, queryParams: { ...prev.testData.queryParams, [key]: e.target.value } } } : prev)} style={{ flex: 2, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: "4px" }} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px" }}>Headers</div>
                    {Object.entries(override.testData.headers).map(([key, value]) => (
                      <div key={key} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                        <input value={key} disabled style={{ flex: 1, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: "4px", background: "var(--surface-alt)" }} />
                        <input value={value} onChange={(e) => setOverride(prev => prev ? { ...prev, testData: { ...prev.testData, headers: { ...prev.testData.headers, [key]: e.target.value } } } : prev)} style={{ flex: 2, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: "4px" }} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px" }}>Request Body</div>
                    <textarea
                      value={typeof override.testData.body === "string" ? override.testData.body : JSON.stringify(override.testData.body, null, 2)}
                      onChange={(e) => setOverride(prev => prev ? { ...prev, testData: { ...prev.testData, body: e.target.value } } : prev)}
                      style={{ width: "100%", minHeight: "120px", padding: "8px", border: "1px solid var(--line)", borderRadius: "4px", fontFamily: "monospace", fontSize: "12px" }}
                    />
                    {overrideErrors.bodyJson && <div style={{ fontSize: "12px", color: "var(--red-deep)", marginTop: "4px" }}>{overrideErrors.bodyJson}</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px" }}>Expected Status</div>
                    <input
                      type="number"
                      value={override.expectedBehavior.status}
                      onChange={(e) => setOverride(prev => prev ? { ...prev, expectedBehavior: { ...prev.expectedBehavior, status: parseInt(e.target.value || "200", 10) } } : prev)}
                      style={{ width: "120px", padding: "6px 8px", border: "1px solid var(--line)", borderRadius: "4px" }}
                    />
                    {overrideErrors.status && <div style={{ fontSize: "12px", color: "var(--red-deep)", marginTop: "4px" }}>{overrideErrors.status}</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px" }}>Assertions</div>
                    {override.expectedBehavior.responseAssertions.map((assertion, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "6px", alignItems: "center" }}>
                        <input value={assertion} onChange={(e) => setOverride(prev => { if (!prev) return null; const next = [...prev.expectedBehavior.responseAssertions]; next[idx] = e.target.value; return { ...prev, expectedBehavior: { ...prev.expectedBehavior, responseAssertions: next } }; })} style={{ flex: 1, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: "4px" }} />
                        <button type="button" onClick={() => setOverride(prev => prev ? { ...prev, expectedBehavior: { ...prev.expectedBehavior, responseAssertions: prev.expectedBehavior.responseAssertions.filter((_, i) => i !== idx) } } : null)} style={{ padding: "4px 8px", border: "1px solid var(--red)", borderRadius: "4px", background: "var(--surface)", color: "var(--red-deep)", cursor: "pointer" }}>Remove</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setOverride(prev => prev ? { ...prev, expectedBehavior: { ...prev.expectedBehavior, responseAssertions: [...prev.expectedBehavior.responseAssertions, ""] } } : null)} style={{ padding: "6px 12px", border: "1px dashed var(--line)", borderRadius: "4px", background: "var(--surface)", color: "var(--ink)", cursor: "pointer" }}>+ Add Assertion</button>
                    {overrideErrors.assertion && <div style={{ fontSize: "12px", color: "var(--red-deep)", marginTop: "4px" }}>{overrideErrors.assertion}</div>}
                  </div>
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Execute button (single test) */}
        {selectedSpec && (
          <div style={{ marginBottom: "18px" }}>
            <button
              type="button"
              onClick={handleRun}
              disabled={!canRun || !override}
              style={{
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#fff",
                background: canRun ? "var(--amber)" : "var(--line)",
                border: "none",
                borderRadius: "6px",
                cursor: canRun ? "pointer" : "not-allowed",
                opacity: canRun ? 1 : 0.6,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {execState === "RUNNING" && <span className="spinner" />}
              {execState === "RUNNING" ? "Running Test..." : "Run Test"}
            </button>
            {!selectedPlan && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--muted)" }}>
                This test has no valid execution plan. Re-run Prepare Tests.
              </div>
            )}
          </div>
        )}

        {/* Execution error with recovery guidance */}
        {execError && (
          <div style={{
            marginBottom: "14px",
            padding: "12px",
            border: "1px solid var(--red)",
            borderRadius: "6px",
            background: "var(--red-soft)",
          }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--red-deep)", marginBottom: "4px" }}>
              Execution Failed
            </div>
            <div style={{ fontSize: "12px", color: "var(--red-deep)", marginBottom: "6px" }}>
              {execError}
            </div>
            {(() => {
              const guidance = getRecoveryGuidance(execError);
              return guidance ? (
                <div style={{
                  fontSize: "12px",
                  color: "var(--ink)",
                  padding: "6px 8px",
                  background: "var(--surface)",
                  borderRadius: "4px",
                }}>
                  {guidance}
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* Results */}
        {execResult && (
          <>
            {renderOverallResult(execResult)}

            {/* View Full Results link */}
            {execResult.runId && (
              <div style={{ marginBottom: "12px" }}>
                <button
                  type="button"
                  onClick={() => {
                    const runId = execResult.runId as string;
                    window.location.hash = `#results?runId=${encodeURIComponent(runId)}`;
                  }}
                  style={{
                    padding: "8px 20px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--blue-deep)",
                    background: "var(--surface)",
                    border: "1px solid var(--blue)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  View Full Results
                </button>
              </div>
            )}

            {/* Step-by-step results */}
            <div style={{ marginBottom: "12px" }}>
              <h3 style={{
                margin: "0 0 8px 0",
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--muted)",
              }}>
                Step Details
              </h3>
              {execResult.results.map((r, idx) => renderStepResult(r, idx))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
