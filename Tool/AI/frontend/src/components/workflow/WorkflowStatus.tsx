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
      return { status: "upcoming", label: "Not configured" };
    }

    if (activeRequirement.source === "jira") {
      return { status: "completed", label: activeRequirement.requirement.key || "Manual" };
    }

    return { status: "completed", label: "Manual" };
  };

  const reqStatus = getRequirementStatus();

  const hasRequirement = reqStatus.status === "completed";
  const hasTests = testCaseCount > 0;
  const hasConnections = matchedCount > 0;
  const hasRun = Boolean(runSummary);

  const runSummaryValue = hasRun && runSummary ? `${runSummary.passed} passed` : hasConnections && hasTests ? "Ready" : "Not ready";

  const steps = [
    { number: 1, label: "Requirement", status: hasRequirement ? "completed" : "current", value: reqStatus.label },
    { number: 2, label: "Review Tests", status: hasTests ? "completed" : hasRequirement ? "current" : "upcoming", value: hasTests ? `${testCaseCount} generated · ${includedCount} selected` : "Generate from requirement" },
    { number: 3, label: "Connect APIs", status: hasConnections ? "completed" : hasTests ? "current" : "upcoming", value: hasConnections ? `${matchedCount} matched` : "Not configured" },
    { number: 4, label: "Run Tests", status: hasRun ? "completed" : hasConnections ? "current" : "upcoming", value: runSummaryValue },
    { number: 5, label: "Results", status: hasRun ? "completed" : "upcoming", value: hasRun ? "Available" : "Not available" }
  ];

  return (
    <div className="compact-workflow">
      {steps.map((step, index) => (
        <>
          {index > 0 && <span key={`sep-${index}`} className="cw-sep">→</span>}
          <div key={step.number} className={`cw-step ${step.status}`}>
            <span className="cw-step-label">{step.label}</span>
            <span className="cw-step-value">{step.value}</span>
          </div>
        </>
      ))}
    </div>
  );
}
