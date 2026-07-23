import { useState } from "react";
import { Panel } from "../../components/common/Panel";
import type { ActiveRequirement } from "../requirements/RequirementTypes";
import type { ApiContract } from "../api-collection/ApiCollectionTypes";
import { WorkflowStatus } from "../../components/workflow/WorkflowStatus";
import { RequirementsPanel } from "../requirements/RequirementsPanel";
import { ApiCollectionPanel } from "../api-collection/ApiCollectionPanel";
import { ScenariosPanel } from "../scenarios/ScenariosPanel";

export function WorkspacePage() {
  const [activeRequirement, setActiveRequirement] = useState<ActiveRequirement | null>(null);
  const [activeContract, setActiveContract] = useState<ApiContract | null>(null);

  return (
    <div>
      <WorkflowStatus activeRequirement={activeRequirement} />
      <main id="workspace" className="workspace" style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gap: "18px",
        padding: "22px",
        maxWidth: "1520px",
        margin: "0 auto"
      }}>
        <RequirementsPanel 
          activeRequirement={activeRequirement}
          onActiveRequirementChange={setActiveRequirement} 
        />
        <ApiCollectionPanel 
          activeContract={activeContract}
          onContractConfirmed={setActiveContract}
        />
        <ScenariosPanel 
          activeRequirement={activeRequirement}
          activeContract={activeContract}
        />
        <Panel step={4} title="Configure & Run" />
      </main>
    </div>
  );
}
