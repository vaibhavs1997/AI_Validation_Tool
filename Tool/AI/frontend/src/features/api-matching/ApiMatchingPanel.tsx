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

  const renderEmptyState = () => {
    if (includedTestCases.length === 0) {
      return (
        <div style={{
          padding: "24px",
          borderRadius: "var(--radius)",
          background: "var(--surface-alt)",
          border: "1px dashed var(--line)",
          textAlign: "center",
          color: "var(--muted)",
          fontSize: "13px"
        }}>
          Select tests in Review Tests to connect them with APIs.
        </div>
      );
    }
    return null;
  };

  const renderSimplifiedMatchRow = (tc: TestCase) => {
    const match = getMatchForTestCase(tc.id);
    const mapping = mappings.get(tc.id);

    if (!match) return null;

    const confidenceLabel = match.status === "matched" ? "Strong match" : match.status === "ambiguous" ? "Review suggested" : "No match";
    const confidenceColor = match.status === "matched" ? "var(--green)" : match.status === "ambiguous" ? "var(--amber)" : "var(--red)";

    return (
      <div key={tc.id} style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        padding: "12px",
        marginBottom: "8px",
        background: "var(--surface)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>{tc.title}</div>
          <span className="badge" style={{ background: confidenceColor === "var(--green)" ? "var(--green-soft)" : confidenceColor === "var(--amber)" ? "var(--amber-soft)" : "var(--red-soft)", color: confidenceColor === "var(--green)" ? "var(--green-deep)" : confidenceColor === "var(--amber)" ? "var(--amber-deep)" : "var(--red-deep)", border: `1px solid ${confidenceColor}` }}>
            {confidenceLabel}
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px" }}>
          {tc.description}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", fontFamily: "monospace" }}>
            {mapping ? `${mapping.method} ${mapping.path}` : "Not mapped"}
          </div>
          {match.status !== "matched" && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById(`candidates-${tc.id}`);
                if (el) el.hidden = !el.hidden;
              }}
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                border: "1px solid var(--line)",
                borderRadius: "4px",
                background: "var(--surface)",
                color: "var(--ink)",
                cursor: "pointer"
              }}
            >
              Change API
            </button>
          )}
        </div>
        {match.status !== "matched" && (
          <div id={`candidates-${tc.id}`} hidden style={{ marginTop: "8px" }}>
            {match.candidates && match.candidates.length > 0 && (
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px", textTransform: "uppercase" }}>
                Alternatives
              </div>
            )}
            {match.candidates?.slice(0, 5).map((cand, idx) => {
              const isSelected = mapping && mapping.operationId === cand.operationId && mapping.serviceId === cand.serviceId;
              return (
                <div
                  key={`${cand.operationId}-${idx}`}
                  style={{
                    padding: "6px 8px",
                    background: isSelected ? "var(--violet-soft)" : "var(--surface-alt)",
                    border: `1px solid ${isSelected ? "var(--violet)" : "var(--line)"}`,
                    borderRadius: "4px",
                    marginBottom: "4px",
                    fontSize: "12px",
                    cursor: cand.serviceId ? "pointer" : "default",
                  }}
                  onClick={() => {
                    if (cand.serviceId) handleSelectCandidate(tc.id, cand, "manual");
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: 700, color: "var(--ink)", minWidth: "60px" }}>
                      {cand.method || "—"} {cand.path || "—"}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--muted)", background: "var(--surface)", padding: "1px 4px", borderRadius: "3px" }}>
                      {cand.confidence}%
                    </span>
                    {isSelected && (
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--violet)" }}>SELECTED</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
        borderBottomColor: "var(--blue)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="step-indicator collection">3</span>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", color: "var(--blue-deep)" }}>Connect APIs</h2>
            {includedTestCases.length > 0 && (
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {includedTestCases.length} test{includedTestCases.length !== 1 ? "s" : ""} selected
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {matchResponse && (
            <span className="status-badge loaded">{mappings.size} mapped</span>
          )}
        </div>
      </div>

      <div className="panel-body" style={{ padding: "18px" }}>
        {renderEmptyState()}

        {!matchResponse && includedTestCases.length > 0 && (
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
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {status === "MATCHING" ? "Matching..." : "Match Test Cases"}
            </button>
          </div>
        )}

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

        {matchResponse && (
          <>
            <div style={{
              marginBottom: "12px",
              padding: "10px 12px",
              background: "var(--surface-alt)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              fontSize: "13px",
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <span>
                {matchResponse.diagnostics.matched} matched · {matchResponse.diagnostics.ambiguous} need review · {matchResponse.diagnostics.unmatched} unmatched
              </span>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                {mappings.size} mapping{mappings.size !== 1 ? "s" : ""} confirmed
              </span>
            </div>

            {matchResponse.warnings && matchResponse.warnings.length > 0 && (
              <div style={{
                marginBottom: "12px",
                padding: "10px 12px",
                background: "var(--amber-soft)",
                border: "1px solid var(--amber)",
                borderRadius: "var(--radius)",
                fontSize: "13px",
                color: "var(--amber-deep)",
              }}>
                {matchResponse.warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            )}

            <div style={{ display: "grid", gap: "8px" }}>
              {includedTestCases.map(renderSimplifiedMatchRow)}
            </div>

            <div style={{ marginTop: "18px", display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {matchResponse.diagnostics.unmatched > 0 && (
                  <span>{matchResponse.diagnostics.unmatched} unmatched test case{matchResponse.diagnostics.unmatched !== 1 ? "s" : ""} still need a mapping.</span>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!onConfirm || mappings.size === 0}
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#fff",
                    background: onConfirm && mappings.size > 0 ? "var(--violet)" : "var(--line)",
                    border: "none",
                    borderRadius: "6px",
                    cursor: onConfirm && mappings.size > 0 ? "pointer" : "not-allowed",
                    opacity: onConfirm && mappings.size > 0 ? 1 : 0.6,
                  }}
                >
                  Confirm Mappings
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}