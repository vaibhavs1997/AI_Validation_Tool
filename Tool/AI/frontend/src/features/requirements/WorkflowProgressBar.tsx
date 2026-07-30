/**
 * WorkflowProgressBar
 *
 * Large progress indicator for the AI Requirement Workshop wizard.
 * Shows current step, completed steps, remaining steps, and readiness percentage.
 */

import type { WorkflowStep, WorkflowStatus } from "./RequirementTypes";

interface WorkflowProgressBarProps {
  currentStep: WorkflowStep;
  status: WorkflowStatus;
  readiness: number;
}

const STEP_LABELS: Record<WorkflowStep, string> = {
  1: "Requirement",
  2: "Analysis",
  3: "Test Cases",
  4: "API Matching",
  5: "Validation Scenarios",
};

const STEP_ICONS: Record<WorkflowStep, string> = {
  1: "📋",
  2: "🔍",
  3: "🧪",
  4: "🔗",
  5: "✅",
};

export function WorkflowProgressBar({ currentStep, status, readiness }: WorkflowProgressBarProps) {
  const isCompleted = (step: WorkflowStep) => {
    if (status === "completed") return true;
    if (status === "ready-for-validation") return step <= 5;
    return step < currentStep;
  };

  const isCurrent = (step: WorkflowStep) => step === currentStep;

  return (
    <div style={{
      marginBottom: "24px",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-lg)",
      background: "var(--color-bg-surface)",
      overflow: "hidden",
    }}>
      {/* Progress Steps */}
      <div style={{
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: "0",
      }}>
        {([1, 2, 3, 4, 5] as WorkflowStep[]).map((step, index) => (
          <div
            key={step}
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              position: "relative",
            }}
          >
            {/* Step indicator */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              position: "relative",
              zIndex: 1,
            }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                fontWeight: 700,
                background: isCompleted(step)
                  ? "var(--color-success)"
                  : isCurrent(step)
                    ? "var(--color-primary)"
                    : "var(--color-bg-muted)",
                color: isCompleted(step) || isCurrent(step) ? "#fff" : "var(--color-text-muted)",
                border: isCurrent(step) ? "3px solid var(--color-primary-soft)" : "none",
                transition: "all 0.3s ease",
              }}>
                {isCompleted(step) ? "✓" : STEP_ICONS[step]}
              </div>
              <span style={{
                fontSize: "11px",
                fontWeight: isCurrent(step) ? 700 : 500,
                color: isCompleted(step)
                  ? "var(--color-success)"
                  : isCurrent(step)
                    ? "var(--color-primary)"
                    : "var(--color-text-muted)",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}>
                {STEP_LABELS[step]}
              </span>
            </div>

            {/* Connector line */}
            {index < 4 && (
              <div style={{
                flex: 1,
                height: "2px",
                background: isCompleted(step)
                  ? "var(--color-success)"
                  : "var(--color-border)",
                margin: "0 8px",
                marginBottom: "20px",
                transition: "background 0.3s ease",
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Readiness Bar */}
      <div style={{
        padding: "12px 24px",
        borderTop: "1px solid var(--color-border)",
        background: "var(--color-bg-subtle)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}>
        <div style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--color-text-secondary)",
          whiteSpace: "nowrap",
        }}>
          Readiness
        </div>
        <div style={{
          flex: 1,
          height: "8px",
          borderRadius: "4px",
          background: "var(--color-bg-muted)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${Math.min(100, Math.max(0, readiness))}%`,
            borderRadius: "4px",
            background: readiness >= 80
              ? "var(--color-success)"
              : readiness >= 50
                ? "var(--color-warning)"
                : "var(--color-error)",
            transition: "width 0.5s ease",
          }} />
        </div>
        <div style={{
          fontSize: "13px",
          fontWeight: 700,
          color: readiness >= 80
            ? "var(--color-success)"
            : readiness >= 50
              ? "var(--color-warning)"
              : "var(--color-error)",
          minWidth: "40px",
          textAlign: "right",
        }}>
          {readiness}%
        </div>
      </div>
    </div>
  );
}