import type { ApiContract } from "./ApiCollectionTypes";
import { EndpointPreview } from "./ContractUploader";

interface ContractPasterProps {
  jsonText: string;
  onDraftChange: (value: string) => void;
  onParse: () => void;
  onSample: () => void;
  loading: boolean;
  error: string;
  parsedContract: ApiContract | null;
}

export function ContractPaster({ 
  jsonText, 
  onDraftChange, 
  onParse, 
  onSample, 
  loading, 
  error,
  parsedContract 
}: ContractPasterProps) {
  return (
    <div>
      <div className="input-section">
        <div className="section-label">Paste API Collection JSON</div>
        <label htmlFor="paste-contract-input" style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
          API Collection JSON
        </label>
        <textarea
          id="paste-contract-input"
          placeholder="Paste your OpenAPI, Swagger, Postman Collection, or HAR JSON here..."
          value={jsonText}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onParse();
            }
          }}
          disabled={loading}
          style={{
            width: "100%",
            minHeight: "120px",
            maxHeight: "300px",
            padding: "10px 12px",
            border: "1px solid var(--line-strong)",
            borderRadius: "6px",
            background: "var(--surface)",
            color: "var(--ink)",
            fontSize: "13px",
            lineHeight: 1.5,
            fontFamily: "monospace",
            resize: "vertical",
            overflowY: "auto",
            opacity: loading ? 0.7 : 1
          }}
        />
        <span style={{ fontSize: "11px", color: "var(--muted)" }}>
          Press Ctrl+Enter to parse
        </span>
      </div>

      {/* Inline error display */}
      {error && (
        <p style={{ color: "var(--red)", fontSize: "13px", margin: "8px 0 0 0" }} role="alert" aria-live="polite">
          <span style={{ marginRight: "4px" }}>⚠</span>
          {error}
        </p>
      )}

      {/* Success message and collection summary */}
      {parsedContract && !error && (
        <>
          <p style={{ color: "var(--green)", fontSize: "13px", margin: "8px 0 0 0" }} role="status" aria-live="polite">
            <span style={{ marginRight: "4px" }}>✓</span>
            API collection parsed successfully. {parsedContract.endpoints.length} endpoints detected.
          </p>
          
          {/* Collection summary */}
          <div style={{ marginTop: "12px", padding: "12px", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--surface-alt)" }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: "14px" }}>
              {parsedContract.title}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
              {parsedContract.type} · {parsedContract.endpoints.length} endpoints
            </p>
            {parsedContract.baseUrl && (
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
                Base URL: {parsedContract.baseUrl}
              </p>
            )}
          </div>

          <EndpointPreview contract={parsedContract} />
        </>
      )}

      <div className="button-row" style={{ display: "flex", gap: "8px", justifyContent: "flex-start", marginTop: "12px" }}>
        <button
          type="button"
          className="primary-action"
          onClick={onParse}
          disabled={loading || !jsonText.trim()}
          style={{
            minHeight: "34px",
            border: "1px solid var(--blue)",
            background: loading || !jsonText.trim() ? "var(--surface-alt)" : "var(--blue)",
            color: loading || !jsonText.trim() ? "var(--muted)" : "#fff",
            borderRadius: "6px",
            padding: "7px 12px",
            cursor: loading || !jsonText.trim() ? "not-allowed" : "pointer",
            fontWeight: 700,
            opacity: loading || !jsonText.trim() ? 0.62 : 1
          }}
        >
          {loading ? "Parsing..." : "Parse Collection"}
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={onSample}
          disabled={loading}
          style={{
            minHeight: "34px",
            border: "1px solid var(--line-strong)",
            background: "var(--surface)",
            color: "var(--ink)",
            borderRadius: "6px",
            padding: "7px 12px",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700,
            opacity: loading ? 0.6 : 1
          }}
        >
          Sample
        </button>
      </div>
    </div>
  );
}
