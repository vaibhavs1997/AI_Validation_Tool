import { useState, useEffect } from "react";
import type { ActiveRequirement } from "../requirements/RequirementTypes";
import type { TestCase } from "../../types";
import { RequirementsPanel } from "../requirements/RequirementsPanel";
import { TestCasesPanel } from "./TestCasesPanel";
import { ApiMatchingPanel } from "../api-matching/ApiMatchingPanel";

interface TestCasesPageProps {
  activeProjectId: string | null;
}

export function TestCasesPage({ activeProjectId }: TestCasesPageProps) {
  const [activeRequirement, setActiveRequirement] = useState<ActiveRequirement | null>(null);
  const [_generatedCount, setGeneratedCount] = useState<number>(0);
  const [_matchedCount, setMatchedCount] = useState<number>(0);
  const [confirmedMappings, setConfirmedMappings] = useState<any[]>([]);

  const [includedTestCases, setIncludedTestCases] = useState<TestCase[]>(() => {
    try {
      const saved = sessionStorage.getItem("testforge:includedTestCases");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Persist included test cases
  useEffect(() => {
    try {
      if (includedTestCases.length > 0) {
        sessionStorage.setItem("testforge:includedTestCases", JSON.stringify(includedTestCases));
      } else {
        sessionStorage.removeItem("testforge:includedTestCases");
      }
    } catch {
      // Ignore storage errors
    }
  }, [includedTestCases]);

  // Load active requirement from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("testforge:activeRequirement");
      if (saved) {
        setActiveRequirement(JSON.parse(saved));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Persist active requirement changes
  useEffect(() => {
    try {
      if (activeRequirement) {
        sessionStorage.setItem("testforge:activeRequirement", JSON.stringify(activeRequirement));
      } else {
        sessionStorage.removeItem("testforge:activeRequirement");
      }
    } catch {
      // Ignore storage errors
    }
  }, [activeRequirement]);

  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "var(--color-text-primary)" }}>Test Cases</h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Select a project to view test cases.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
      {/* Page Header */}
      <section style={{ marginBottom: "24px" }}>
        <h1 style={{
          margin: "0 0 6px 0",
          fontSize: "24px",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          letterSpacing: "-0.01em",
        }}>
          Test Cases
        </h1>
        <p style={{
          margin: 0,
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          lineHeight: 1.5,
        }}>
          Generate and manage test cases from your requirements.
        </p>
      </section>

      {/* Section 1: Requirement Selection */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}>
              Section 1: Select Requirement
            </h2>
            <p style={{
              margin: "4px 0 0 0",
              fontSize: "12px",
              color: "var(--color-text-secondary)",
            }}>
              {activeRequirement ? "Requirement selected. Generate tests below." : "Choose a requirement to generate test cases."}
            </p>
          </div>
          {activeRequirement && (
            <span style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              borderRadius: "var(--radius-pill)",
              background: "var(--color-success-soft)",
              color: "var(--color-success)",
            }}>
              ✓ Ready
            </span>
          )}
        </div>
        <div style={{ padding: "16px" }}>
          <RequirementsPanel
            activeRequirement={activeRequirement}
            onActiveRequirementChange={setActiveRequirement}
          />
        </div>
      </section>

      {/* Section 2: Generate & Review Test Cases */}
      <section style={{ marginBottom: "24px" }}>
        <TestCasesPanel
          activeProjectId={activeProjectId}
          activeRequirement={activeRequirement}
          onGenerated={setGeneratedCount}
          onIncludedChange={setIncludedTestCases}
          onContinue={(included) => {
            setIncludedTestCases(included);
          }}
        />
      </section>

      {/* Section 3: Connect APIs */}
      {includedTestCases.length > 0 && (
        <section style={{
          marginBottom: "24px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-bg-surface)",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}>
                Section 3: Connect APIs
              </h2>
              <p style={{
                margin: "4px 0 0 0",
                fontSize: "12px",
                color: "var(--color-text-secondary)",
              }}>
                Match selected test cases to API operations.
              </p>
            </div>
            {confirmedMappings.length > 0 && (
              <span style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                borderRadius: "var(--radius-pill)",
                background: "var(--color-success-soft)",
                color: "var(--color-success)",
              }}>
                ✓ Connected
              </span>
            )}
          </div>
          <div style={{ padding: "16px" }}>
            <ApiMatchingPanel
              activeProjectId={activeProjectId}
              includedTestCases={includedTestCases}
              onGenerated={setMatchedCount}
              onConfirm={(response) => {
                setConfirmedMappings(response.mappings);
              }}
            />
          </div>
        </section>
      )}

      {/* Confirmed Mappings Summary */}
      {confirmedMappings.length > 0 && (
        <section style={{
          marginBottom: "24px",
          border: "1px solid var(--color-success)",
          borderRadius: "var(--radius-lg)",
          padding: "20px 24px",
          background: "var(--color-success-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-success)", marginBottom: "4px" }}>
              ✓ API Mappings Confirmed
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              {confirmedMappings.length} mapping{confirmedMappings.length > 1 ? "s" : ""} confirmed · Proceed to Implementation Mappings
            </div>
          </div>
          <button
            type="button"
            onClick={() => { window.location.hash = "#implementation-mappings"; }}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#fff",
              background: "var(--color-success)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            Continue to Implementation Mappings
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </section>
      )}
    </div>
  );
}