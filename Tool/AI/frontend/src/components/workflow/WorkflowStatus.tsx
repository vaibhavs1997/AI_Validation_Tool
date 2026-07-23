import type { ActiveRequirement } from "../../features/requirements/RequirementTypes";

interface WorkflowStatusProps {
  activeRequirement: ActiveRequirement | null;
}

export function WorkflowStatus({ activeRequirement }: WorkflowStatusProps) {
  const getRequirementStatus = (): { status: string; label: string } => {
    if (!activeRequirement || !activeRequirement.requirement) {
      return { status: "empty", label: "Not configured" };
    }
    
    if (activeRequirement.source === "jira") {
      return { status: "loaded", label: activeRequirement.requirement.key };
    }
    
    // Manual source
    return { status: "loaded", label: "Manual" };
  };

  const reqStatus = getRequirementStatus();

  const steps = [
    { number: 1, label: "Requirements", status: reqStatus.status, value: reqStatus.label },
    { number: 2, label: "API Collection", status: "empty" },
    { number: 3, label: "Test Scenarios", status: "empty" },
    { number: 4, label: "Run", status: "empty" }
  ];

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
            {step.number === 1 && activeRequirement && activeRequirement.requirement ? reqStatus.label : "Not configured"}
          </span>
        </div>
      ))}
    </div>
  );
}