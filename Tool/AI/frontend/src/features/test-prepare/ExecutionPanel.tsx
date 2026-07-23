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
    const fromLocation = binding.source?.split(".").slice(-1)[0] || "value";
    const toLocation = binding.target?.split(".").slice(-1)[0] || "value";
    if (binding.type === "auth" || binding.type === "token") {
      explanations.push(`uses token/credentials from prerequisite`);
    } else if (binding.transform) {
      explanations.push(`transforms "${fromLocation}" → "${toLocation}"`);
    } else {
      explanations.push(`uses "${fromLocation}" from prerequisite as "${toLocation}"`);
    }
  }
  if (explanations.length === 0 && step.prerequisites.length > 0) {
    return `must run after prerequisite${step.prerequisites.length > 1 ? "s" : ""}`;
  }
  return explanations.join("; ") || "depends on prerequisite";
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

export function ExecutionPanel({
  activeProjectId,
  prepareResponse,
}: ExecutionPanelProps) {
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [execState, setExecState] = useState<ExecutionStatus>("IDLE");
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [execError, setExecError] = useState<string>("");

  // Reset state when prepareResponse changes (new preparation)
  useEffect(() => {
    setSelectedSpecId(null);
    setExecState("IDLE");
    setExecResult(null);
    setExecError("");
  }, [prepareResponse]);

  const selectedSpec = prepareResponse.testSpecifications.find(s => s.id === selectedSpecId);
  const selectedPlan = selectedSpecId ? prepareResponse.plans[selectedSpecId] : undefined;

  const canRun = Boolean(
    selectedSpec &&
    selectedPlan &&
    execState !== "RUNNING" &&
    activeProjectId
  );

  const handleRun = useCallback(async () => {
    if (!selectedSpec || !selectedPlan || !activeProjectId) return;
    if (execState === "RUNNING") return;

    setExecState("RUNNING");
    setExecResult(null);
    setExecError("");

    try {
      const response = await executePreparedTest({
        projectId: activeProjectId,
        testSpecification: selectedSpec,
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
  }, [selectedSpec, selectedPlan, activeProjectId, execState]);

  // Build list of executable specs (have a valid plan)
  const executableSpecs = prepareResponse.testSpecifications.filter(
    (s): s is typeof s => {
      const plan = prepareResponse.plans[s.id];
      return plan !== undefined && plan.isValid !== false;
    }
  );

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
            [5]
          </span>
          <h2 style={{ margin: 0, fontSize: "17px", color: "var(--amber-deep)" }}>
            Execute Tests
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
            PREREQUISITES
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
            <h3 style={{
              margin: "0 0 8px 0",
              fontSize: "13px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--muted)",
            }}>
              Select Test to Execute
            </h3>
            <div style={{ display: "grid", gap: "6px" }}>
              {executableSpecs.map(spec => {
                const plan = prepareResponse.plans[spec.id];
                const isSelected = spec.id === selectedSpecId;
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

        {/* Execute button */}
        {selectedSpec && (
          <div style={{ marginBottom: "18px" }}>
            <button
              type="button"
              onClick={handleRun}
              disabled={!canRun}
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
                    window.location.href = `#results?runId=${encodeURIComponent(runId)}`;
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