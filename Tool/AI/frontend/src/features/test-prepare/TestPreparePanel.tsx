/**
 * TestPreparePanel
 *
 * STEP 5.5E — Preparation stage: confirmed TestCase/API mappings
 * → TestSpecification + ExecutionPlan.
 *
 * Flow:
 *   Confirm API Mappings
 *        ↓
 *   Prepare Tests button
 *        ↓
 *   Prepared specs + plans + unresolved list
 *        ↓
 *   Next workflow state (Execution)
 */

import { useState } from "react";
import type {
  TestCase,
  TestCaseApiMapping,
  TestSpecification,
  ExecutionPlan,
  PrepareResponse,
} from "../../types";
import { prepareTestSpecifications } from "./TestPrepareService";

interface TestPreparePanelProps {
  activeProjectId: string | null;
  includedTestCases: TestCase[];
  confirmedMappings: TestCaseApiMapping[];
  onPrepared?: (response: PrepareResponse) => void;
}

type PanelStatus = "NOT_PREPARED" | "PREPARING" | "PREPARED" | "ERROR";

export function TestPreparePanel({
  activeProjectId,
  includedTestCases,
  confirmedMappings,
  onPrepared,
}: TestPreparePanelProps) {
  const [status, setStatus] = useState<PanelStatus>("NOT_PREPARED");
  const [error, setError] = useState("");
  const [prepareResponse, setPrepareResponse] = useState<PrepareResponse | null>(null);

  const canPrepare = Boolean(activeProjectId) && confirmedMappings.length > 0;

  const handlePrepare = async () => {
    if (!activeProjectId || confirmedMappings.length === 0) return;

    setStatus("PREPARING");
    setError("");
    setPrepareResponse(null);

    try {
      const response = await prepareTestSpecifications(activeProjectId, includedTestCases, confirmedMappings);
      setPrepareResponse(response);
      setStatus("PREPARED");
      onPrepared?.(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to prepare test specifications.");
      setStatus("ERROR");
    }
  };

  const renderSpecRow = (spec: TestSpecification, plan?: ExecutionPlan) => {
    const opRef = spec.operationRefs?.[0];
    const isIndependent = !plan || plan.steps.length <= 1;

    return (
      <div
        key={spec.id}
        style={{
          border: "1px solid var(--line)",
          borderRadius: "6px",
          padding: "12px",
          marginBottom: "8px",
          background: "var(--surface)",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>
          ✓ {spec.title}
        </div>
        {spec.description && (
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
            {spec.description}
          </div>
        )}
        <div style={{ fontSize: "12px", color: "var(--ink)", fontFamily: "monospace" }}>
          {opRef?.method} {opRef?.path}
        </div>
        {isIndependent ? (
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
            Independent operation — ready for execution
          </div>
        ) : plan && (
          <div style={{ marginTop: "8px" }}>
            <div style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--muted)",
              marginBottom: "4px",
              textTransform: "uppercase",
            }}>
              Execution Flow ({plan.steps.length} steps)
            </div>
            {plan.steps.map((step, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: "12px",
                  padding: "4px 8px",
                  background: "var(--surface-alt)",
                  borderRadius: "4px",
                  marginBottom: "4px",
                }}
              >
                {step.operation.serviceId}::{step.operation.operationId}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderUnresolvedRow = (item: { testCaseId: string; reason: string }) => {
    const tc = includedTestCases.find((t) => t.id === item.testCaseId);
    return (
      <div
        key={item.testCaseId}
        style={{
          border: "1px dashed var(--line)",
          borderRadius: "6px",
          padding: "12px",
          marginBottom: "8px",
          background: "var(--surface)",
          opacity: 0.8,
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>
          ⚠ {tc?.title || item.testCaseId}
        </div>
        <div style={{ fontSize: "12px", color: "var(--muted)" }}>
          {item.reason}
        </div>
      </div>
    );
  };

  return (
    <section className="panel span-12 panel-test-prepare" data-view-section="workspace">
      <div className="panel-head" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        padding: "12px 16px",
        borderBottom: "1px solid var(--line)",
        background: "var(--blue-soft)",
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
            [4]
          </span>
          <h2 style={{ margin: 0, fontSize: "17px", color: "var(--blue)" }}>
            Test Preparation
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
            {status}
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
                  background: confirmedMappings.length > 0 ? "var(--green)" : "var(--line)",
                }}>
                  {confirmedMappings.length > 0 ? "✓" : "○"}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>Confirmed Mappings</span>
              </div>
              <div style={{ fontSize: "14px", color: "var(--ink)", opacity: 0.85, paddingLeft: "26px" }}>
                {confirmedMappings.length} mapping{confirmedMappings.length !== 1 ? "s" : ""} confirmed
              </div>
            </div>
          </div>
        </div>

        {/* Prepare button */}
        <div style={{ marginBottom: "18px" }}>
          <button
            type="button"
            onClick={handlePrepare}
            disabled={!canPrepare || status === "PREPARING"}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#fff",
              background: canPrepare && status !== "PREPARING" ? "var(--blue)" : "var(--line)",
              border: "none",
              borderRadius: "6px",
              cursor: canPrepare && status !== "PREPARING" ? "pointer" : "not-allowed",
              opacity: canPrepare && status !== "PREPARING" ? 1 : 0.6,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {status === "PREPARING" ? "Preparing Tests..." : "Prepare Tests"}
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

        {/* Preparation results */}
        {prepareResponse && (
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
                  Included: {prepareResponse.diagnostics.included} ·
                  Prepared: {prepareResponse.diagnostics.prepared} ·
                  Unresolved: {prepareResponse.diagnostics.unresolved}
                </span>
                {prepareResponse.diagnostics.plansBuilt > 0 && (
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {prepareResponse.diagnostics.plansBuilt} execution plan{prepareResponse.diagnostics.plansBuilt !== 1 ? "s" : ""} built
                  </span>
                )}
              </div>
            </div>

            {/* Warnings */}
            {prepareResponse.warnings && prepareResponse.warnings.length > 0 && (
              <div style={{
                marginBottom: "8px",
                padding: "10px 12px",
                background: "var(--amber-soft)",
                border: "1px solid var(--amber)",
                borderRadius: "6px",
                fontSize: "13px",
                color: "var(--amber-deep)",
              }}>
                {prepareResponse.warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            )}

            {/* Ready tests */}
            {prepareResponse.testSpecifications.length > 0 && (
              <div style={{ marginBottom: "18px" }}>
                <h3 style={{
                  margin: "0 0 12px 0",
                  fontSize: "13px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--green-deep)",
                }}>
                  Ready for Execution ({prepareResponse.testSpecifications.length})
                </h3>
                {prepareResponse.testSpecifications.map((spec) => (
                  <div key={spec.id}>
                    {renderSpecRow(spec, prepareResponse.plans[spec.id])}
                  </div>
                ))}
              </div>
            )}

            {/* Unresolved tests */}
            {prepareResponse.unresolvedTestCases.length > 0 && (
              <div style={{ marginBottom: "18px" }}>
                <h3 style={{
                  margin: "0 0 12px 0",
                  fontSize: "13px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--red-deep)",
                }}>
                  Need Attention ({prepareResponse.unresolvedTestCases.length})
                </h3>
                {prepareResponse.unresolvedTestCases.map((item) => (
                  <div key={item.testCaseId}>
                    {renderUnresolvedRow(item)}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}