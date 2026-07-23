import type { ApiContract } from "./ApiCollectionTypes";

// Method badge colors for visual distinction
const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET:    { bg: "#e3fcef", text: "#0a7c42" },
  POST:   { bg: "#e3f2fd", text: "#1565c0" },
  PUT:    { bg: "#fff3e0", text: "#e65100" },
  PATCH:  { bg: "#f3e5f5", text: "#7b1fa2" },
  DELETE: { bg: "#fce4ec", text: "#c62828" },
  HEAD:   { bg: "#f5f5f5", text: "#616161" },
  OPTIONS:{ bg: "#f5f5f5", text: "#616161" },
};

function getMethodColor(method: string) {
  return METHOD_COLORS[method.toUpperCase()] || { bg: "#f5f5f5", text: "#616161" };
}

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
  // Format type label for display
  const formatTypeLabel = (type: string, version: string): string => {
    const upperType = type === "openapi" || type === "swagger" ? "OpenAPI" : 
                     type === "postman" ? "Postman" : "HAR";
    if (version && (type === "openapi" || type === "swagger" || type === "postman")) {
      return `${upperType} ${version}`;
    }
    return upperType;
  };

  return (
    <div>
      <div className="input-section">
        <div className="section-label">Paste API Collection JSON</div>
        <label>
          <textarea
            placeholder="Paste your OpenAPI, Swagger, Postman Collection, or HAR JSON here..."
            value={jsonText}
            onChange={(e) => onDraftChange(e.target.value)}
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
              overflowY: "auto"
            }}
          />
        </label>
      </div>

      {/* Inline error display */}
      {error && (
        <p style={{ color: "var(--red)", fontSize: "13px", margin: "8px 0 0 0" }}>
          <span style={{ marginRight: "4px" }}>⚠</span>
          {error}
        </p>
      )}

      {/* Success message and collection summary */}
      {parsedContract && !error && (
        <>
          <p style={{ color: "var(--green)", fontSize: "13px", margin: "8px 0 0 0" }}>
            <span style={{ marginRight: "4px" }}>✓</span>
            API collection parsed successfully. {parsedContract.endpoints.length} endpoints detected.
          </p>
          
          {/* Collection summary */}
          <div style={{ marginTop: "12px", padding: "12px", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--surface-alt)" }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: "14px" }}>
              {parsedContract.title}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
              {formatTypeLabel(parsedContract.type, parsedContract.version)} · {parsedContract.endpoints.length} endpoints
            </p>
            {parsedContract.baseUrl && (
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
                Base URL: {parsedContract.baseUrl}
              </p>
            )}
          </div>

          {/* Endpoint preview */}
          <div style={{ marginTop: "12px" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Endpoints
            </p>
            {parsedContract.endpoints.length === 0 ? (
              <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "var(--muted)", fontStyle: "italic" }}>
                No endpoints detected in this collection.
              </p>
            ) : (
              <div style={{
                marginTop: "8px",
                maxHeight: "240px",
                overflowY: "auto",
                border: "1px solid var(--line)",
                borderRadius: "6px",
                background: "var(--surface)"
              }}>
                {parsedContract.endpoints.map((ep) => {
                  const mc = getMethodColor(ep.method);
                  return (
                    <div key={ep.id} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "7px 12px",
                      borderBottom: "1px solid var(--line)",
                      fontSize: "13px",
                      lineHeight: 1.4
                    }}>
                      <span style={{
                        display: "inline-block",
                        minWidth: "60px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontWeight: 700,
                        fontSize: "11px",
                        textAlign: "center",
                        textTransform: "uppercase",
                        fontFamily: "monospace",
                        background: mc.bg,
                        color: mc.text
                      }}>
                        {ep.method}
                      </span>
                      <span style={{
                        fontFamily: "monospace",
                        fontSize: "12px",
                        color: "var(--ink)",
                        flexShrink: 0
                      }}>
                        {ep.path}
                      </span>
                      <span style={{
                        color: "var(--muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0
                      }}>
                        {ep.summary || ep.operationId || ep.path}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <div className="button-row" style={{ display: "flex", gap: "8px", justifyContent: "flex-start", marginTop: "12px" }}>
        <button
          type="button"
          className="primary-action"
          onClick={onParse}
          disabled={loading}
          style={{
            minHeight: "34px",
            border: "1px solid var(--blue)",
            background: loading ? "var(--surface-alt)" : "var(--blue)",
            color: loading ? "var(--muted)" : "#fff",
            borderRadius: "6px",
            padding: "7px 12px",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700,
            opacity: loading ? 0.62 : 1
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
            cursor: "pointer",
            fontWeight: 700
          }}
        >
          Sample
        </button>
      </div>
    </div>
  );
}