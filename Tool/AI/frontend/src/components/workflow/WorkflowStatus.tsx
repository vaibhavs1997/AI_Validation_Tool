import type { ActiveRequirement } from "../../features/requirements/RequirementTypes";

/** Lightweight run summary for WorkflowStatus display */
interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
}

interface WorkflowStatusProps {
  activeRequirement: ActiveRequirement | null;
  testCaseCount?: number;
  includedCount?: number;
  matchedCount?: number;
  runSummary?: RunSummary;
  reportUrl?: string;
}

export function WorkflowStatus({ activeRequirement, testCaseCount = 0, includedCount = 0, matchedCount = 0, runSummary }: WorkflowStatusProps) {
  const getRequirementStatus = (): { status: string; label: string } => {
    if (!activeRequirement || !activeRequirement.requirement) {
      return { status: "empty", label: "Not configured" };
    }

    if (activeRequirement.source === "jira") {
      return { status: "loaded", label: activeRequirement.requirement.key || "Manual" };
    }

    // Manual source
    return { status: "loaded", label: "Manual" };
  };

  const reqStatus = getRequirementStatus();

  const steps = [
    { number: 1, label: "Requirement", status: reqStatus.status },
    { number: 2, label: "Test Cases", status: testCaseCount > 0 ? "loaded" : "empty" },
    { number: 3, label: "API Matching", status: matchedCount > 0 ? "loaded" : "empty" },
    { number: 4, label: "Results", status: runSummary ? "loaded" : "empty" }
  ];

  const formatStepValue = (stepNum: number): string => {
    // Step 2 shows "X test cases · Y selected"
    if (stepNum === 2) {
      if (testCaseCount > 0) {
        return `${testCaseCount} test case${testCaseCount !== 1 ? "s" : ""} · ${includedCount} selected`;
      }
      return "Not configured";
    }
    // Step 3/4 shows run summary if available
    if (stepNum === 3 && runSummary) {
      return `${runSummary.passed} passed · ${runSummary.failed} failed`;
    }
    if (stepNum === 4 && runSummary) {
      return `Total: ${runSummary.total}`;
    }
    // Step 1 shows requirement status
    if (stepNum === 1 && activeRequirement && activeRequirement.requirement) {
      return reqStatus.label;
    }
    return "Not configured";
  };

  return (
    <div className="compact-workflow" style={{
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "10px 22px",
      maxWidth: "1520px",
      margin: "0 auto",
      background: "var(--surface)",
      borderBottom: "1px solid var(--line)"
    }}>
      {steps.map(step => (
        <div key={step.number} className={`cw-step ${step.status}`} style={{
          display: "inline-flex",
          flexDirection: "column",
          gap: "2px",
          fontSize: "11px",
          fontWeight: 700,
          textAlign: "center" as const
        }}>
          <span className="cw-step-label" style={{
            color: step.status === "active" ? "var(--blue)" : step.status === "loaded" ? "var(--green)" : "var(--muted)"
          }}>
            {step.label}
          </span>
          <span className="cw-step-value" style={{
            color: step.status === "active" ? "var(--blue)" : step.status === "loaded" ? "var(--green)" : "var(--muted)"
          }}>
            {formatStepValue(step.number)}
          </span>
        </div>
      ))}
    </div>
  );
}
