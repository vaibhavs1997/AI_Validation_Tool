import { useState, useEffect } from "react";
import type { ActiveRequirement } from "../requirements/RequirementTypes";
import type { TestCase, GenerateTestCasesResponse } from "../../types";
import { generateTestCases } from "./TestCaseService";

interface TestCasesPanelProps {
  activeProjectId: string | null;
  activeRequirement: ActiveRequirement | null;
  onContinue?: (includedTestCases: TestCase[]) => void;
  onGenerated?: (count: number) => void;
  onIncludedChange?: (included: TestCase[]) => void;
}

type PanelStatus = "NOT_GENERATED" | "GENERATING" | "GENERATED" | "ERROR";

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  POSITIVE: { bg: "#e3fcef", text: "#0a7c42" },
  NEGATIVE: { bg: "#fce4e2", text: "#b44236" },
  BOUNDARY: { bg: "#fff3e0", text: "#e65100" },
  NOT_FOUND: { bg: "#fce4e2", text: "#b44236" },
  AUTHORIZATION: { bg: "#fff3e0", text: "#e65100" },
  EDGE: { bg: "#fce4e2", text: "#b44236" },
  functional: { bg: "#e3f2fd", text: "#1565c0" },
  validation: { bg: "#fce4e2", text: "#b44236" },
  security: { bg: "#fff3e0", text: "#e65100" },
};

export function TestCasesPanel({ activeProjectId, activeRequirement, onContinue, onGenerated, onIncludedChange }: TestCasesPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<GenerateTestCasesResponse | null>(null);
  const [includedTestCaseIds, setIncludedTestCaseIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);

  const hasProject = Boolean(activeProjectId);
  const hasRequirement = Boolean(activeRequirement && activeRequirement.requirement !== null);
  const canGenerate = hasProject && hasRequirement && !loading;

  const generatedCount = response?.testCases.length || 0;
  const includedCount = includedTestCaseIds.size;

  // Report generated count and included set up to parent (e.g. WorkflowStatus)
  useEffect(() => {
    if (response && onGenerated) {
      onGenerated(response.testCases.length);
    }
  }, [response, onGenerated]);

  useEffect(() => {
    if (response && onIncludedChange) {
      const included = response.testCases.filter(tc => includedTestCaseIds.has(tc.id));
      onIncludedChange(included);
    }
  }, [includedTestCaseIds, response, onIncludedChange]);

  const getStatusText = (): PanelStatus => {
    if (loading) return "GENERATING";
    if (error) return "ERROR";
    if (response && response.testCases.length > 0) return "GENERATED";
    if (response) return "GENERATED";
    return "NOT_GENERATED";
  };

  const handleGenerate = async () => {
    if (!activeProjectId || !activeRequirement || !activeRequirement.requirement) return;

    setLoading(true);
    setError("");
    setResponse(null);
    setIncludedTestCaseIds(new Set());
    setExpandedIds(new Set());
    setElapsedSeconds(0);
    setTimerStarted(true);

    try {
      const result = await generateTestCases(activeProjectId, activeRequirement);
      setResponse(result);
      const allIds = new Set(result.testCases.map(tc => tc.id));
      setIncludedTestCaseIds(allIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate test cases.");
    } finally {
      setLoading(false);
      setTimerStarted(false);
    }
  };

  useEffect(() => {
    if (!timerStarted) return;
    const id = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    return () => clearInterval(id);
  }, [timerStarted]);

  const formatElapsed = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m > 0) return `Elapsed: ${m}m ${s}s`;
    return `Elapsed: ${s}s`;
  };

  const handleToggleIncluded = (testCaseId: string) => {
    setIncludedTestCaseIds(prev => {
      const next = new Set(prev);
      if (next.has(testCaseId)) {
        next.delete(testCaseId);
      } else {
        next.add(testCaseId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!response) return;
    setIncludedTestCaseIds(new Set(response.testCases.map(tc => tc.id)));
  };

  const handleExcludeAll = () => {
    setIncludedTestCaseIds(new Set());
  };

  const handleToggleExpand = (testCaseId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(testCaseId)) {
        next.delete(testCaseId);
      } else {
        next.add(testCaseId);
      }
      return next;
    });
  };

  const handleContinue = () => {
    if (!response || includedCount === 0 || !onContinue) return;
    const included = response.testCases.filter(tc => includedTestCaseIds.has(tc.id));
    onContinue(included);
  };

  const renderProjectGuard = () => {
    if (hasProject) return null;
    return (
      <div style={{
        padding: "16px",
        border: "1px solid var(--line)",
        borderRadius: "6px",
        background: "var(--surface)",
        marginBottom: "12px"
      }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "6px" }}>
          Select a project before generating tests
        </div>
        <div style={{ fontSize: "13px", color: "var(--muted)" }}>
          Go to Setup to select or create a project. APIs registered in that project will be used automatically.
        </div>
      </div>
    );
  };

  const renderBadge = (text: string, colors: { bg: string; text: string }) => (
    <span style={{
      display: "inline-block",
      padding: "2px 6px",
      borderRadius: "4px",
      fontSize: "11px",
      fontWeight: 700,
      textTransform: "uppercase",
      background: colors.bg,
      color: colors.text
    }}>
      {text}
    </span>
  );

  const renderTestCaseRow = (tc: TestCase) => {
    const isIncluded = includedTestCaseIds.has(tc.id);
    const isExpanded = expandedIds.has(tc.id);
    const typeColors = TYPE_COLORS[tc.type] || { bg: "#f5f5f5", text: "#616161" };

    return (
      <div
        key={tc.id}
        style={{
          border: `1px solid ${isIncluded ? "var(--line)" : "var(--red)"}`,
          borderRadius: "6px",
          background: isIncluded ? "var(--surface)" : "var(--red-soft)",
          marginBottom: "8px",
          opacity: isIncluded ? 1 : 0.85,
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "10px 12px",
          cursor: "pointer"
        }} onClick={() => handleToggleIncluded(tc.id)}>
          <input
            type="checkbox"
            checked={isIncluded}
            onChange={() => handleToggleIncluded(tc.id)}
            style={{ marginTop: "2px", width: "16px", height: "16px", cursor: "pointer" }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: "2px",
              textDecoration: isIncluded ? "none" : "line-through"
            }}>
              {tc.title}
            </div>
            {tc.description && (
              <div style={{
                fontSize: "12px",
                color: "var(--muted)",
                marginBottom: "4px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}>
                {tc.description}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {renderBadge(tc.type, typeColors)}
              {tc.requirementRefs.map((ref, idx) => (
                <span key={idx} style={{
                  fontSize: "11px",
                  color: "var(--muted)",
                  fontFamily: "monospace"
                }}>
                  AC[{ref.acIndex}]{ref.acText ? `: ${ref.acText}` : ""}
                </span>
              ))}
            </div>
          </div>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            {tc.expectedBehavior && (
              <span style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--green-deep)",
                background: "var(--green-soft)",
                padding: "2px 6px",
                borderRadius: "4px",
                fontFamily: "monospace"
              }}>
                {tc.expectedBehavior.status}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleToggleExpand(tc.id); }}
              style={{
                padding: "2px 8px",
                fontSize: "11px",
                border: "1px solid var(--line)",
                borderRadius: "4px",
                background: "var(--surface)",
                color: "var(--muted)",
                cursor: "pointer"
              }}
            >
              {isExpanded ? "Hide" : "Details"}
            </button>
          </div>
        </div>
        {isExpanded && (
          <div style={{
            padding: "0 12px 12px 36px",
            borderTop: "1px solid var(--line)",
            marginTop: "4px",
            paddingTop: "10px"
          }}>
            <div style={{ display: "grid", gap: "8px", fontSize: "12px" }}>
              <div>
                <span style={{ fontWeight: 700, color: "var(--muted)" }}>Test Data: </span>
                <pre style={{
                  margin: "4px 0 0 0",
                  padding: "8px",
                  background: "var(--surface-alt)",
                  borderRadius: "4px",
                  fontSize: "11px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word"
                }}>
                  {JSON.stringify(tc.testData, null, 2)}
                </pre>
              </div>
              {tc.expectedBehavior?.responseAssertions?.length > 0 && (
                <div>
                  <span style={{ fontWeight: 700, color: "var(--muted)" }}>Expected Assertions: </span>
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    {tc.expectedBehavior.responseAssertions.map((assertion, idx) => (
                      <li key={idx}>{assertion}</li>
                    ))}
                  </ul>
                </div>
              )}
              {tc.assertions?.length > 0 && (
                <div>
                  <span style={{ fontWeight: 700, color: "var(--muted)" }}>Assertions: </span>
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    {tc.assertions.map((assertion, idx) => (
                      <li key={idx}>{assertion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSuccess = () => {
    if (!response) return null;

    if (generatedCount === 0) {
      return (
        <div style={{
          marginTop: "12px",
          padding: "10px 12px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "6px",
          fontSize: "13px",
          color: "var(--muted)"
        }}>
          No test cases could be generated from the current requirement. Try refining the requirement description.
        </div>
      );
    }

    return (
      <div style={{
        marginTop: "12px",
        padding: "10px 12px",
        background: "var(--green-soft)",
        border: "1px solid var(--green)",
        borderRadius: "6px",
        fontSize: "13px",
        color: "var(--green-deep)",
        fontWeight: 600,
        marginBottom: "8px"
      }}>
        ✓ {generatedCount} test case{generatedCount !== 1 ? "s" : ""} generated.
      </div>
    );
  };

  const renderContinuePlaceholder = () => {
    if (includedCount === 0) return null;
    return (
      <div style={{
        marginTop: "12px",
        padding: "10px 12px",
        background: "var(--blue-soft)",
        border: "1px solid var(--blue)",
        borderRadius: "6px",
        fontSize: "13px",
        color: "var(--blue-deep)",
        fontWeight: 600
      }}>
        {includedCount} test case{includedCount !== 1 ? "s" : ""} selected for API matching.
      </div>
    );
  };

  return (
    <section className="panel span-12 panel-test-cases" data-view-section="workspace">
      <div className="panel-head" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        padding: "12px 16px",
        borderBottom: "1px solid var(--line)",
        background: "var(--violet-soft)",
        cursor: "pointer"
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
            background: "var(--violet)",
            color: "#fff"
          }}>
            [2]
          </span>
          <h2 style={{ margin: 0, fontSize: "17px", color: "var(--violet)" }}>
            Test Cases
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--muted)"
          }}>
            {getStatusText()}
          </span>
        </div>
      </div>

      <div className="panel-body" style={{ padding: "18px" }}>
        {renderProjectGuard()}

        <div style={{ marginBottom: "18px" }}>
          <h3 style={{
            margin: "0 0 12px 0",
            fontSize: "13px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--muted)"
          }}>
            PREREQUISITES
          </h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "12px"
          }}>
            <div style={{
              padding: "12px 14px",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              background: "var(--surface)"
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
                  background: hasProject ? "var(--green)" : "var(--line)"
                }}>
                  {hasProject ? "✓" : "○"}
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
              background: "var(--surface)"
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
                  background: hasRequirement ? "var(--green)" : "var(--line)"
                }}>
                  {hasRequirement ? "✓" : "○"}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>Requirement</span>
              </div>
              <div style={{ fontSize: "14px", color: "var(--ink)", opacity: 0.85, paddingLeft: "26px" }}>
                {hasRequirement ? "Ready" : "Not selected"}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "18px" }}>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#fff",
              background: canGenerate ? "var(--violet)" : "var(--line)",
              border: "none",
              borderRadius: "6px",
              cursor: canGenerate ? "pointer" : "not-allowed",
              opacity: canGenerate ? 1 : 0.6,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            {loading && <span className="spinner" />}
            {loading ? "Generating Test Cases..." : "Generate Test Cases"}
          </button>
          {loading && (
            <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--muted)" }}>
              {formatElapsed(elapsedSeconds)}
            </div>
          )}
        </div>

        {error && (
          <div style={{
            marginTop: "12px",
            padding: "10px 12px",
            background: "var(--red-soft)",
            border: "1px solid var(--red)",
            borderRadius: "6px",
            fontSize: "13px",
            color: "var(--red-deep)"
          }}>
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>Test case generation failed.</div>
            <div style={{ marginBottom: "8px" }}>{error}</div>
            <button
              type="button"
              onClick={handleGenerate}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--red-deep)",
                background: "var(--surface)",
                border: "1px solid var(--red)",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Try Again
            </button>
          </div>
        )}
        {renderSuccess()}

        {response && response.warnings?.length > 0 && (
          <div style={{
            marginTop: "8px",
            marginBottom: "8px",
            padding: "10px 12px",
            background: "var(--amber-soft)",
            border: "1px solid var(--amber)",
            borderRadius: "6px",
            fontSize: "13px",
            color: "var(--amber-deep)"
          }}>
            {response.warnings.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}

        {response && generatedCount > 0 && (
          <div style={{ marginTop: "14px", marginBottom: "10px" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
              fontSize: "13px",
              color: "var(--ink)"
            }}>
              <span>
                {generatedCount} test case{generatedCount !== 1 ? "s" : ""} · {includedCount} selected to continue
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={includedCount === generatedCount}
                  style={{
                    padding: "4px 10px",
                    fontSize: "12px",
                    border: "1px solid var(--line)",
                    borderRadius: "4px",
                    background: includedCount === generatedCount ? "var(--surface-alt)" : "var(--surface)",
                    color: "var(--ink)",
                    cursor: includedCount === generatedCount ? "default" : "pointer"
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleExcludeAll}
                  disabled={includedCount === 0}
                  style={{
                    padding: "4px 10px",
                    fontSize: "12px",
                    border: "1px solid var(--line)",
                    borderRadius: "4px",
                    background: includedCount === 0 ? "var(--surface-alt)" : "var(--surface)",
                    color: "var(--ink)",
                    cursor: includedCount === 0 ? "default" : "pointer"
                  }}
                >
                  Exclude All
                </button>
              </div>
            </div>

            <div>
              {response.testCases.map(renderTestCaseRow)}
            </div>
          </div>
        )}

        {renderContinuePlaceholder()}

        {response && generatedCount > 0 && (
          <div style={{ marginTop: "18px" }}>
            <button
              type="button"
              onClick={handleContinue}
              disabled={includedCount === 0 || !onContinue}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#fff",
                background: includedCount > 0 && onContinue ? "var(--blue)" : "var(--line)",
                border: "none",
                borderRadius: "6px",
                cursor: includedCount > 0 && onContinue ? "pointer" : "not-allowed",
                opacity: includedCount > 0 && onContinue ? 1 : 0.6
              }}
            >
              Continue with Included Tests
            </button>
            {!onContinue && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--muted)" }}>
                Include/Exclude controls are ready. Next step: API Matching.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
