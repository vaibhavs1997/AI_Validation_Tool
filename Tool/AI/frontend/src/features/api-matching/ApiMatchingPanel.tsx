/**
 * ApiMatchingPanel
 *
 * STEP 5.5D — TestCase → API Endpoint Matching stage.
 *
 * Flow:
 *   Included TestCases → Match Test Cases button → Match Results
 *   → User reviews/adjusts mappings → Confirm API Mappings
 *
 * Architecture:
 *   - TestCase objects are NEVER mutated.
 *   - Mapping state is maintained separately in a Map<string, TestCaseApiMapping>.
 *   - Automatic matches come from the backend matching engine.
 *   - User can override any match or manually map unmatched test cases.
 */

import { useState, useEffect } from "react";
import type {
  TestCase,
  MatchResult,
  MatchCandidate,
  MatchTestCasesResponse,
  TestCaseApiMapping,
  MatchDiagnostics,
} from "../../types";
import { matchTestCases } from "./ApiMatchingService";

interface ApiMatchingPanelProps {
  activeProjectId: string | null;
  includedTestCases: TestCase[];
  onConfirm?: (response: {
    includedTestCases: TestCase[];
    mappings: TestCaseApiMapping[];
    diagnostics: MatchDiagnostics;
  }) => void;
  onGenerated?: (count: number) => void;
}

type PanelStatus = "NOT_MATCHED" | "MATCHING" | "MATCHED" | "ERROR";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  matched: { bg: "#e3fcef", text: "#0a7c42" },
  ambiguous: { bg: "#fff3e0", text: "#e65100" },
  unmatched: { bg: "#fce4e2", text: "#b44236" },
};

export function ApiMatchingPanel({
  activeProjectId,
  includedTestCases,
  onConfirm,
  onGenerated,
}: ApiMatchingPanelProps) {
  const [status, setStatus] = useState<PanelStatus>("NOT_MATCHED");
  const [error, setError] = useState("");
  const [matchResponse, setMatchResponse] = useState<MatchTestCasesResponse | null>(null);
  // Mapping state is separate from TestCase objects — never mutates them
  const [mappings, setMappings] = useState<Map<string, TestCaseApiMapping>>(new Map());

  const canMatch = Boolean(activeProjectId) && includedTestCases.length > 0;

  const getStatusText = (): PanelStatus => status;

  // Report match count to parent (e.g. WorkflowStatus)
  useEffect(() => {
    if (matchResponse && onGenerated) {
      onGenerated(matchResponse.matches.length);
    }
  }, [matchResponse, onGenerated]);

  const handleMatch = async () => {
    if (!activeProjectId || includedTestCases.length === 0) return;

    setStatus("MATCHING");
    setError("");
    setMatchResponse(null);
    setMappings(new Map());

    try {
      const response = await matchTestCases(activeProjectId, includedTestCases);
      setMatchResponse(response);
      setStatus("MATCHED");

      // Initialize mappings with automatic matches
      const initialMappings = new Map<string, TestCaseApiMapping>();
      for (const match of response.matches) {
        if (match.status === "matched" && match.selectedMatch) {
          const sm = match.selectedMatch;
          if (sm.serviceId && sm.method && sm.path) {
            initialMappings.set(match.testCaseId, {
              testCaseId: match.testCaseId,
              serviceId: sm.serviceId,
              operationId: sm.operationId,
              method: sm.method,
              path: sm.path,
              source: "automatic",
            });
          }
        }
      }
      setMappings(initialMappings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to match test cases.");
      setStatus("ERROR");
    }
  };

  const handleSelectCandidate = (
    testCaseId: string,
    candidate: MatchCandidate,
    source: "automatic" | "manual"
  ) => {
    if (!candidate.serviceId || !candidate.method || !candidate.path) return;
    // Extract to locals so TypeScript narrows string | null → string
    const serviceId = candidate.serviceId;
    const method = candidate.method;
    const path = candidate.path;
    const operationId = candidate.operationId;
    setMappings((prev) => {
      const next = new Map(prev);
      next.set(testCaseId, {
        testCaseId,
        serviceId,
        operationId,
        method,
        path,
        source,
      });
      return next;
    });
  };

  const handleClearMapping = (testCaseId: string) => {
    setMappings((prev) => {
      const next = new Map(prev);
      next.delete(testCaseId);
      return next;
    });
  };

  const handleConfirm = () => {
    if (!onConfirm || !matchResponse) return;
    const mappingsArray = Array.from(mappings.values());
    onConfirm({
      includedTestCases,
      mappings: mappingsArray,
      diagnostics: matchResponse.diagnostics,
    });
  };

  const getMatchForTestCase = (tcId: string): MatchResult | undefined => {
    return matchResponse?.matches.find((m) => m.testCaseId === tcId);
  };

  const renderBadge = (status: string) => {
    const colors = STATUS_COLORS[status] || { bg: "#f5f5f5", text: "#616161" };
    return (
      <span style={{
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        background: colors.bg,
        color: colors.text,
      }}>
        {status}
      </span>
    );
  };

  const renderMatchRow = (tc: TestCase) => {
    const match = getMatchForTestCase(tc.id);
    const mapping = mappings.get(tc.id);
    const colors = STATUS_COLORS[match?.status || "unmatched"] || { bg: "#f5f5f5", text: "#616161" };

    if (!match) {
      return (
        <div key={tc.id} style={{
          border: "1px solid var(--line)",
          borderRadius: "6px",
          padding: "12px",
          marginBottom: "8px",
          background: "var(--surface)",
        }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>{tc.title}</div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>{tc.description}</div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>No match result available</div>
        </div>
      );
    }

    return (
      <div
        key={tc.id}
        style={{
          border: `1px solid ${colors.text}`,
          borderRadius: "6px",
          padding: "12px",
          marginBottom: "8px",
          background: colors.bg,
          opacity: 1,
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          marginBottom: "8px",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: "2px",
            }}>
              {tc.title}
            </div>
            {tc.description && (
              <div style={{
                fontSize: "12px",
                color: "var(--muted)",
                marginBottom: "4px",
              }}>
                {tc.description}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {renderBadge(match.status)}
              {match.status === "matched" && (
                <span style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--green-deep)",
                  background: "var(--green-soft)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                }}>
                  {match.selectedMatch ? `${match.selectedMatch.confidence}%` : "N/A"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Selected match display */}
        {mapping ? (
          <div style={{
            padding: "8px 10px",
            background: "var(--surface-alt)",
            borderRadius: "4px",
            marginBottom: "8px",
            fontSize: "12px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                Mapped: {mapping.method} {mapping.path}
              </span>
              <span style={{
                fontSize: "10px",
                color: mapping.source === "automatic" ? "var(--muted)" : "var(--blue-deep)",
                background: mapping.source === "automatic" ? "var(--surface)" : "var(--blue-soft)",
                padding: "1px 4px",
                borderRadius: "3px",
              }}>
                {mapping.source}
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--muted)" }}>
              Service: {mapping.serviceId} · Operation: {mapping.operationId}
            </div>
          </div>
        ) : (
          <div style={{
            padding: "8px 10px",
            background: "var(--surface)",
            border: "1px dashed var(--line)",
            borderRadius: "4px",
            marginBottom: "8px",
            fontSize: "12px",
            color: "var(--muted)",
          }}>
            No API mapping selected
          </div>
        )}

        {/* Candidate selection */}
        {match.candidates && match.candidates.length > 0 && (
          <div style={{ marginBottom: "8px" }}>
            <div style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--muted)",
              marginBottom: "4px",
              textTransform: "uppercase",
            }}>
              Candidates ({match.candidates.length})
            </div>
            {match.candidates.slice(0, 5).map((cand, idx) => {
              const isSelected = mapping &&
                mapping.operationId === cand.operationId &&
                mapping.serviceId === cand.serviceId;
              return (
                <div
                  key={`${cand.operationId}-${idx}`}
                  style={{
                    padding: "6px 8px",
                    background: isSelected ? "var(--violet-soft)" : "var(--surface)",
                    border: `1px solid ${isSelected ? "var(--violet)" : "var(--line)"}`,
                    borderRadius: "4px",
                    marginBottom: "4px",
                    fontSize: "12px",
                    cursor: cand.serviceId ? "pointer" : "default",
                  }}
                  onClick={() => {
                    if (cand.serviceId) {
                      handleSelectCandidate(tc.id, cand, "manual");
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--ink)",
                      minWidth: "60px",
                    }}>
                      {cand.method || "—"} {cand.path || "—"}
                    </span>
                    <span style={{
                      fontSize: "10px",
                      color: "var(--muted)",
                      background: "var(--surface-alt)",
                      padding: "1px 4px",
                      borderRadius: "3px",
                    }}>
                      {cand.confidence}%
                    </span>
                    {isSelected && (
                      <span style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "var(--violet)",
                      }}>
                        SELECTED
                      </span>
                    )}
                  </div>
                  {cand.reasons && cand.reasons.length > 0 && (
                    <div style={{
                      fontSize: "10px",
                      color: "var(--muted)",
                      marginTop: "2px",
                      opacity: 0.8,
                    }}>
                      {cand.reasons.slice(0, 2).join("; ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Clear mapping button */}
        {mapping && (
          <button
            type="button"
            onClick={() => handleClearMapping(tc.id)}
            style={{
              padding: "4px 8px",
              fontSize: "11px",
              border: "1px solid var(--line)",
              borderRadius: "4px",
              background: "var(--surface)",
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            Clear Mapping
          </button>
        )}
      </div>
    );
  };

  return (
    <section className="panel span-12 panel-api-matching" data-view-section="workspace">
      <div className="panel-head" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        padding: "12px 16px",
        borderBottom: "1px solid var(--line)",
        background: "var(--blue-soft)",
        cursor: "pointer",
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
            background: "var(--blue)",
            color: "#fff",
          }}>
            3
          </span>
          <h2 style={{ margin: 0, fontSize: "17px", color: "var(--blue)" }}>
            Connect Tests to APIs
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
            {getStatusText()}
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
              BEFORE YOU CONTINUE
            </h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "12px",
          }}>
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
                  background: includedTestCases.length > 0 ? "var(--green)" : "var(--line)",
                }}>
                  {includedTestCases.length > 0 ? "✓" : "○"}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>Included Test Cases</span>
              </div>
              <div style={{ fontSize: "14px", color: "var(--ink)", opacity: 0.85, paddingLeft: "26px" }}>
                {includedTestCases.length} test case{includedTestCases.length !== 1 ? "s" : ""} ready for matching
              </div>
            </div>
          </div>
        </div>

        {/* Match button */}
        <div style={{ marginBottom: "18px" }}>
          <button
            type="button"
            onClick={handleMatch}
            disabled={!canMatch || status === "MATCHING"}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#fff",
              background: canMatch && status !== "MATCHING" ? "var(--blue)" : "var(--line)",
              border: "none",
              borderRadius: "6px",
              cursor: canMatch && status !== "MATCHING" ? "pointer" : "not-allowed",
              opacity: canMatch && status !== "MATCHING" ? 1 : 0.6,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {status === "MATCHING" ? "Matching Test Cases..." : "Match Test Cases"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: "12px",
            padding: "10px 12px",
            background: "var(--red-soft)",
            border: "1px solid var(--red)",
            borderRadius: "6px",
            fontSize: "13px",
            color: "var(--red-deep)",
          }}>
            {error}
          </div>
        )}

        {/* Match results */}
        {matchResponse && (
          <>
            {/* Summary */}
            <div style={{
              marginTop: "14px",
              marginBottom: "10px",
              padding: "10px 12px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "6px",
              fontSize: "13px",
              color: "var(--ink)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>
                  Total: {matchResponse.diagnostics.total} ·
                  Matched: {matchResponse.diagnostics.matched} ·
                  Ambiguous: {matchResponse.diagnostics.ambiguous} ·
                  Unmatched: {matchResponse.diagnostics.unmatched}
                </span>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {mappings.size} mapping{mappings.size !== 1 ? "s" : ""} confirmed
                </span>
              </div>
            </div>

            {/* Warnings */}
            {matchResponse.warnings && matchResponse.warnings.length > 0 && (
              <div style={{
                marginBottom: "8px",
                padding: "10px 12px",
                background: "var(--amber-soft)",
                border: "1px solid var(--amber)",
                borderRadius: "6px",
                fontSize: "13px",
                color: "var(--amber-deep)",
              }}>
                {matchResponse.warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            )}

            {/* Test case rows */}
            <div>
              {includedTestCases.map(renderMatchRow)}
            </div>

            {/* Confirm placeholder */}
            {mappings.size > 0 && (
              <div style={{
                marginTop: "12px",
                padding: "10px 12px",
                background: "var(--blue-soft)",
                border: "1px solid var(--blue)",
                borderRadius: "6px",
                fontSize: "13px",
                color: "var(--blue-deep)",
                fontWeight: 600,
              }}>
                {mappings.size} test case{mappings.size !== 1 ? "s" : ""} mapped for next step.
              </div>
            )}

            {/* Confirm button */}
            <div style={{ marginTop: "18px" }}>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!onConfirm}
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#fff",
                  background: onConfirm ? "var(--violet)" : "var(--line)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: onConfirm ? "pointer" : "not-allowed",
                  opacity: onConfirm ? 1 : 0.6,
                }}
              >
                Confirm API Mappings
              </button>
              {matchResponse.diagnostics.unmatched > 0 && (
                <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--muted)" }}>
                  {matchResponse.diagnostics.unmatched} unmatched test case{matchResponse.diagnostics.unmatched !== 1 ? "s" : ""} remain visible. Review them before confirming.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
