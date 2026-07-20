import { useState } from "react";
import { parseApiContract } from "./ApiCollectionService";
import type { ApiContract } from "./ApiCollectionTypes";
import type { ApiError } from "../../services";
import { ContractUploader } from "./ContractUploader";
import { ContractPaster } from "./ContractPaster";

interface ApiCollectionPanelProps {
  activeContract: ApiContract | null;
  onContractConfirmed: (contract: ApiContract | null) => void;
}

type InputMode = "upload" | "paste";

export function ApiCollectionPanel({ activeContract, onContractConfirmed }: ApiCollectionPanelProps) {
  // Local state for input mode selection
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  
  // Paste JSON draft state - persists across tab switches
  const [pastedJsonDraft, setPastedJsonDraft] = useState<string>("");
  
  // Loading state
  const [loading, setLoading] = useState(false);
  
  // Error state
  const [error, setError] = useState<string>("");

  // Clear error when user types
  const handleDraftChange = (value: string) => {
    setPastedJsonDraft(value);
    if (error) setError("");
  };

  const handleParse = async () => {
    // Clear previous error
    setError("");
    
    // Trim for validation only
    const trimmedDraft = pastedJsonDraft.trim();
    
    // Validate empty input
    if (!trimmedDraft) {
      setError("Enter or paste an API collection before parsing.");
      return;
    }
    
    // Validate JSON syntax
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmedDraft);
    } catch {
      setError("Invalid JSON. Check the collection syntax and try again.");
      return;
    }
    
    // Call backend service
    setLoading(true);
    try {
      const contract = await parseApiContract(parsed, "pasted-contract");
      // Only update shared activeContract on success
      onContractConfirmed(contract);
    } catch (err) {
      // Extract actual error message from ApiError or use generic message
      const apiErr = err as ApiError;
      // Show the actual error message from the server so users know what's wrong
      setError(apiErr.message || "Unable to parse API collection.");
      // Failed parse does NOT clear activeContract — it stays as-is
    } finally {
      setLoading(false);
    }
  };

  // Sample remains non-functional per task
  const handleSample = () => {
    // Intentionally empty - to be implemented in later step
  };

  // Header status based on activeContract from shared state
  const hasConfiguredContract = activeContract !== null;
  const statusText = hasConfiguredContract ? "Configured" : "Not configured";
  const statusColor = hasConfiguredContract ? "var(--green)" : "var(--muted)";

  return (
    <section className="panel span-12 panel-collection" data-view-section="workspace">
      <div className="panel-head" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        padding: "12px 16px",
        borderBottom: "1px solid var(--line)",
        background: "var(--blue-soft)",
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
            background: "var(--blue)",
            color: "#fff"
          }}>
            [2]
          </span>
          <h2 style={{ margin: 0, fontSize: "17px", color: "var(--blue-deep)" }}>
            API Collection
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="step-status" style={{
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: statusColor
          }}>
            {statusText}
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
        {/* Source selector similar to Jira/Manual tabs */}
        <div className="source-selector" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
          <label style={{ fontSize: "12px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
            Source
          </label>
          <div className="source-options" style={{ display: "flex", gap: "4px", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden" }}>
            <span
              className={`source-chip ${inputMode === "upload" ? "active" : ""}`}
              onClick={() => setInputMode("upload")}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                color: inputMode === "upload" ? "#fff" : "var(--muted)",
                background: inputMode === "upload" ? "var(--blue)" : "var(--surface)"
              }}
            >
              Upload File
            </span>
            <span
              className={`source-chip ${inputMode === "paste" ? "active" : ""}`}
              onClick={() => setInputMode("paste")}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                color: inputMode === "paste" ? "#fff" : "var(--muted)",
                background: inputMode === "paste" ? "var(--blue)" : "var(--surface)"
              }}
            >
              Paste JSON
            </span>
          </div>
        </div>

        {/* Input mode content */}
        <div style={{ display: inputMode === "upload" ? "block" : "none" }}>
          <ContractUploader 
            onContractParsed={onContractConfirmed}
            activeContract={activeContract}
          />
        </div>
        <div style={{ display: inputMode === "paste" ? "block" : "none" }}>
          <ContractPaster 
            jsonText={pastedJsonDraft}
            onDraftChange={handleDraftChange}
            onParse={handleParse} 
            onSample={handleSample}
            loading={loading}
            error={error}
            parsedContract={activeContract}
          />
        </div>
      </div>
    </section>
  );
}