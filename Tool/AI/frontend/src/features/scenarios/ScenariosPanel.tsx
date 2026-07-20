import { useState } from "react";
import type { ActiveRequirement } from "../requirements/RequirementTypes";
import type { ApiContract, ApiEndpoint } from "../api-collection/ApiCollectionTypes";
import type { Scenario } from "./ScenarioTypes";
import { isJiraRequirement } from "../requirements/RequirementTypes";
import { generateTestScenarios } from "./ScenarioService";
import type { ApiError } from "../../services";

interface ScenariosPanelProps {
  activeRequirement: ActiveRequirement | null;
  activeContract: ApiContract | null;
}

type PanelStatus = "NOT_GENERATED" | "GENERATING" | "GENERATED";

interface GenerationResponse {
  scenarios: Scenario[];
  unusedEndpoints: ApiEndpoint[];
  mode: "local";
  warnings?: string[];
}

// Type/Risk badge colors
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  positive: { bg: "#e3fcef", text: "#0a7c42" },
  negative: { bg: "#fce4e2", text: "#b44236" },
  auth: { bg: "#fff3e0", text: "#e65100" },
};

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: "#fce4e2", text: "#b44236" },
  medium: { bg: "#fff3e0", text: "#e65100" },
  low: { bg: "#e3f2fd", text: "#1565c0" },
};

export function ScenariosPanel({ activeRequirement, activeContract }: ScenariosPanelProps) {
  // Loading/error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Previous successful generation - preserved through regeneration failures
  const [previousResponse, setPreviousResponse] = useState<GenerationResponse | null>(null);

  // Selected scenario IDs
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<Set<string>>(new Set());

  // Requirement prerequisite state
  const hasRequirement = activeRequirement?.requirement !== null;
  const requirementReady = hasRequirement;

  // API Collection prerequisite state
  const hasContract = activeContract !== null;
  const contractReady = hasContract;

  // Generate button state - enabled only when both prerequisites are ready
  const canGenerate = requirementReady && contractReady && !loading;

  // Panel status based on state
  const getPanelStatus = (): PanelStatus => {
    if (loading) return "GENERATING";
    if (previousResponse !== null) return "GENERATED";
    return "NOT_GENERATED";
  };

  // Requirement display text
  const getRequirementDisplay = (): string => {
    if (!activeRequirement?.requirement) {
      return "Not configured";
    }
    if (isJiraRequirement(activeRequirement.requirement)) {
      return activeRequirement.requirement.key || "Jira Requirement";
    }
    return "Manual Requirement";
  };

  // API Collection display text
  const getContractDisplay = (): string => {
    if (!activeContract) {
      return "Not configured";
    }
    return `${activeContract.title || "API Collection"} · ${activeContract.endpoints?.length || 0} endpoints`;
  };

  // Handle generate click
  const handleGenerateClick = async () => {
    if (!activeRequirement?.requirement || !activeContract) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await generateTestScenarios(activeRequirement, activeContract, false);

      const newScenarios = response.scenarios;
      const newSelectedIds = new Set(newScenarios.map(s => s.id));

      setPreviousResponse({
        scenarios: newScenarios,
        unusedEndpoints: response.unusedEndpoints,
        mode: response.mode,
        warnings: response.warnings,
      });
      setSelectedScenarioIds(newSelectedIds);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Unable to generate test scenarios.");
    } finally {
      setLoading(false);
    }
  };

  // Select all scenarios
  const handleSelectAll = () => {
    if (!previousResponse) return;
    const allIds = new Set(previousResponse.scenarios.map(s => s.id));
    setSelectedScenarioIds(allIds);
  };

  // Deselect all scenarios
  const handleDeselectAll = () => {
    setSelectedScenarioIds(new Set());
  };

  // Toggle individual scenario selection
  const handleToggleScenario = (scenarioId: string) => {
    const newSelected = new Set(selectedScenarioIds);
    if (newSelected.has(scenarioId)) {
      newSelected.delete(scenarioId);
    } else {
      newSelected.add(scenarioId);
    }
    setSelectedScenarioIds(newSelected);
  };

  // Show error if present
  const renderError = () => {
    if (!error) return null;

    return (
      <div style={{
        marginTop: "12px",
        padding: "10px 12px",
        background: "var(--red-soft)",
        border: "1px solid var(--red)",
        borderRadius: "6px",
        fontSize: "13px",
        color: "var(--red-deep)"
      }}>
        {error}
      </div>
    );
  };

  // Badge component
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

  // Scenario row component
  const renderScenarioRow = (scenario: Scenario) => {
    const isSelected = selectedScenarioIds.has(scenario.id);
    const targetApi = scenario.endpointId ? `${scenario.method} ${scenario.path}` : "Unlinked";

    return (
      <tr key={scenario.id} style={{
        borderBottom: "1px solid var(--line)"
      }}>
        <td style={{ padding: "8px 12px", width: "40px" }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => handleToggleScenario(scenario.id)}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
          />
        </td>
        <td style={{ padding: "8px 12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink)", marginBottom: "2px" }}>
            {scenario.title}
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)" }}>
            {scenario.id}
          </div>
        </td>
        <td style={{ padding: "8px 12px", width: "80px" }}>
          {renderBadge(scenario.type, TYPE_COLORS[scenario.type] || { bg: "#f5f5f5", text: "#616161" })}
        </td>
        <td style={{ padding: "8px 12px", width: "80px" }}>
          {renderBadge(scenario.risk, RISK_COLORS[scenario.risk] || { bg: "#f5f5f5", text: "#616161" })}
        </td>
        <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: "12px", color: "var(--ink)", width: "160px" }}>
          {targetApi}
        </td>
        <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: "12px", color: "var(--ink)", width: "100px" }}>
          {scenario.expectedStatus}
        </td>
      </tr>
    );
  };

  // Render scenario table
  const renderScenarioTable = () => {
    if (!previousResponse || previousResponse.scenarios.length === 0) return null;

    const totalScenarios = previousResponse.scenarios.length;
    const selectedCount = selectedScenarioIds.size;

    return (
      <div style={{ marginTop: "12px" }}>
        {/* Selection summary */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
          fontSize: "13px",
          color: "var(--ink)"
        }}>
          <span>
            {totalScenarios} scenario{totalScenarios !== 1 ? "s" : ""} · {selectedCount} selected
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={selectedCount === totalScenarios}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                border: "1px solid var(--line)",
                borderRadius: "4px",
                background: selectedCount === totalScenarios ? "var(--surface-alt)" : "var(--surface)",
                color: "var(--ink)",
                cursor: selectedCount === totalScenarios ? "default" : "pointer"
              }}
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={selectedCount === 0}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                border: "1px solid var(--line)",
                borderRadius: "4px",
                background: selectedCount === 0 ? "var(--surface-alt)" : "var(--surface)",
                color: "var(--ink)",
                cursor: selectedCount === 0 ? "default" : "pointer"
              }}
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Scrollable table container */}
        <div style={{
          maxHeight: "360px",
          overflowY: "auto",
          border: "1px solid var(--line)",
          borderRadius: "6px",
          background: "var(--surface)"
        }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed"
          }}>
            <thead>
              <tr style={{
                borderBottom: "1px solid var(--line)",
                background: "var(--surface-alt)"
              }}>
                <th style={{ padding: "8px 12px", width: "40px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  ✓
                </th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  Test Scenario
                </th>
                <th style={{ padding: "8px 12px", width: "80px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  Type
                </th>
                <th style={{ padding: "8px 12px", width: "80px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  Risk
                </th>
                <th style={{ padding: "8px 12px", width: "160px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  Target API
                </th>
                <th style={{ padding: "8px 12px", width: "100px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  Expected Status
                </th>
              </tr>
            </thead>
            <tbody>
              {previousResponse.scenarios.map(renderScenarioRow)}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Show success message when scenarios generated
  const renderSuccess = () => {
    if (!previousResponse) return null;

    const count = previousResponse.scenarios.length;

    if (count === 0) {
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
          No test scenarios could be generated from the current requirement and API collection.
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
        ✓ {count} test scenarios generated successfully.
      </div>
    );
  };

  // Empty state before first generation
  const renderEmptyState = () => {
    if (previousResponse !== null) return null;

    return (
      <div style={{
        textAlign: "center",
        padding: "24px 0",
        color: "var(--muted)"
      }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>🧪</div>
        <div style={{ fontSize: "14px" }}>
          No test scenarios generated yet.
        </div>
        <div style={{ fontSize: "13px", marginTop: "4px", opacity: 0.85 }}>
          Generate test scenarios from your active requirement and API collection.
        </div>
      </div>
    );
  };

  // Format status text
  const getStatusText = () => {
    const status = getPanelStatus();
    switch (status) {
      case "GENERATING":
        return "GENERATING";
      case "GENERATED":
        return "GENERATED";
      default:
        return "NOT GENERATED";
    }
  };

  return (
    <section className="panel span-12 panel-scenarios" data-view-section="workspace">
      <div className="panel-head" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        padding: "12px 16px",
        borderBottom: "1px solid var(--line)",
        background: "var(--green-soft)",
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
            background: "var(--green)",
            color: "#fff"
          }}>
            [3]
          </span>
          <h2 style={{ margin: 0, fontSize: "17px", color: "var(--green-deep)" }}>
            Test Scenarios
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="step-status" style={{
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--muted)"
          }}>
            {getStatusText()}
          </span>
          <button
            type="button"
            className="expand-toggle"
            aria-label="Toggle section"
            title="Collapse/Expand"
            style={{
              width: "28px",
              height: "28px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--line)",
              borderRadius: "50%",
              background: "var(--surface)",
              color: "var(--muted)",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            −
          </button>
        </div>
      </div>
      <div className="panel-body" style={{ padding: "18px" }}>
        {/* Prerequisites Section */}
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
            {/* Requirement Prerequisite */}
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
                  background: requirementReady ? "var(--green)" : "var(--line)"
                }}>
                  {requirementReady ? "✓" : "○"}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                  Requirement
                </span>
              </div>
              <div style={{
                fontSize: "14px",
                color: "var(--ink)",
                opacity: 0.85,
                paddingLeft: "26px"
              }}>
                {getRequirementDisplay()}
              </div>
            </div>

            {/* API Collection Prerequisite */}
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
                  background: contractReady ? "var(--green)" : "var(--line)"
                }}>
                  {contractReady ? "✓" : "○"}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                  API Collection
                </span>
              </div>
              <div style={{
                fontSize: "14px",
                color: "var(--ink)",
                opacity: 0.85,
                paddingLeft: "26px"
              }}>
                {getContractDisplay()}
              </div>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div style={{ marginBottom: "18px" }}>
          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={!canGenerate}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#fff",
              background: canGenerate ? "var(--green)" : "var(--line)",
              border: "none",
              borderRadius: "6px",
              cursor: canGenerate ? "pointer" : "not-allowed",
              opacity: canGenerate ? 1 : 0.6,
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            {loading && (
              <span className="spinner" />
            )}
            {loading ? "Generating Scenarios..." : "Generate Test Scenarios"}
          </button>
        </div>

        {/* Error State */}
        {renderError()}

        {/* Success State */}
        {renderSuccess()}

        {/* Warnings */}
        {previousResponse && previousResponse.warnings?.length && (
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
            {previousResponse.warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
        )}

        {/* Scenario Table */}
        {renderScenarioTable()}

        {/* Empty State (before first generation) */}
        {renderEmptyState()}
      </div>
    </section>
  );
}