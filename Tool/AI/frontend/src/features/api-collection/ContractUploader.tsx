import { useState, useRef, useCallback } from "react";
import type { ApiContract } from "./ApiCollectionTypes";
import { parseApiContract } from "./ApiCollectionService";
import type { ApiError } from "../../services";

// Method badge colors (same as ContractPaster)
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectDisplayType(type: string): string {
  switch (type) {
    case "openapi": return "OpenAPI";
    case "swagger": return "Swagger";
    case "postman": return "Postman";
    case "har": return "HAR";
    default: return "API Collection";
  }
}

interface ContractUploaderProps {
  onContractParsed: (contract: ApiContract | null) => void;
  activeContract: ApiContract | null;
}

export function ContractUploader({ onContractParsed, activeContract }: ContractUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload-specific independent state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadContract, setUploadContract] = useState<ApiContract | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Whether the current active contract came from upload
  const isUploadActive = activeContract && uploadContract && activeContract.importedAt === uploadContract.importedAt;

  const formatTypeLabel = (type: string, version: string): string => {
    const upperType = type === "openapi" || type === "swagger" ? "OpenAPI" : 
                     type === "postman" ? "Postman" : "HAR";
    if (version && (type === "openapi" || type === "swagger" || type === "postman")) {
      return `${upperType} ${version}`;
    }
    return upperType;
  };

  const processSelectedFile = useCallback(async (file: File) => {
    // Clear previous state
    setUploadError("");
    setUploadContract(null);

    // Read file content
    let text: string;
    try {
      text = await file.text();
    } catch {
      setUploadError("Failed to read file. Please try again.");
      return;
    }

    // Validate JSON syntax
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setUploadError("Invalid JSON file. Please select a valid API collection.");
      return;
    }

    // Store selected file info
    setSelectedFile(file);

    // Call the existing backend service
    setUploadLoading(true);
    try {
      const contract = await parseApiContract(parsed, file.name);
      setUploadContract(contract);
      onContractParsed(contract);
    } catch (err) {
      const apiErr = err as ApiError;
      setUploadError(apiErr.message || "Unable to parse API collection.");
      // Keep the file selected but contract is invalid - do not clear active contract
    } finally {
      setUploadLoading(false);
    }
  }, [onContractParsed]);

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    // Reset input value so the same file can be selected again (e.g. Replace)
    e.target.value = "";
  };

  // Drag/drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".json") || file.name.endsWith(".har"))) {
      processSelectedFile(file);
    } else if (file) {
      setUploadError("Unsupported file type. Please select a .json or .har file.");
    }
  };

  const handleReplace = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setUploadContract(null);
    setUploadError("");
    setUploadLoading(false);
    // If this upload's contract was the active one, clear it
    if (isUploadActive) {
      onContractParsed(null);
    }
  };

  // Success state to display - contract is only valid when no error
  const displayContract: ApiContract | null = uploadContract && !uploadError ? uploadContract : null;

  return (
    <div className="input-section">
      <div className="section-label">Upload API Collection</div>

      {/* File input area - show when no file selected */}
      {!selectedFile && !displayContract && (
        <div
          className="upload-area"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          style={{
            border: `2px dashed ${isDragOver ? "var(--blue)" : "var(--line-strong)"}`,
            borderRadius: "8px",
            padding: "24px",
            textAlign: "center",
            background: isDragOver ? "var(--blue-soft)" : "var(--surface-alt)",
            cursor: "pointer",
            transition: "border-color 0.2s, background 0.2s"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "24px" }}>📁</span>
            <strong style={{ fontSize: "14px" }}>Upload API Collection</strong>
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              Drag & drop a collection file here<br />or browse from your computer
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleBrowseClick(); }}
              style={{
                marginTop: "8px",
                padding: "7px 16px",
                border: "1px solid var(--blue)",
                background: "var(--blue)",
                color: "#fff",
                borderRadius: "6px",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              Browse Files
            </button>
            <span style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
              OpenAPI · Swagger · Postman · HAR
            </span>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.har"
        hidden
        onChange={handleFileChange}
      />

      {/* Loading indicator */}
      {uploadLoading && (
        <div style={{ marginTop: "12px", textAlign: "center" }}>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>Parsing collection...</span>
        </div>
      )}

      {/* Error display */}
      {uploadError && (
        <p style={{ color: "var(--red)", fontSize: "13px", margin: "8px 0 0 0" }}>
          <span style={{ marginRight: "4px" }}>⚠</span>
          {uploadError}
        </p>
      )}

      {/* File summary when selected (with or without successful parse) */}
      {selectedFile && (
        <div style={{
          marginTop: "12px",
          padding: "12px",
          border: "1px solid var(--line)",
          borderRadius: "6px",
          background: "var(--surface)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
              <span style={{ fontSize: "18px", flexShrink: 0 }}>📄</span>
              <div style={{ overflow: "hidden" }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedFile.name}
                </p>
                {displayContract && (
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    {detectDisplayType(displayContract.type)} · {formatFileSize(selectedFile.size)}
                  </p>
                )}
                {!displayContract && (
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    {formatFileSize(selectedFile.size)}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleReplace(); }}
                style={{
                  padding: "4px 10px",
                  border: "1px solid var(--line-strong)",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                style={{
                  padding: "4px 10px",
                  border: "1px solid var(--red)",
                  background: "transparent",
                  color: "var(--red)",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success message */}
      {displayContract && (
        <>
          <p style={{ color: "var(--green)", fontSize: "13px", margin: "8px 0 0 0" }}>
            <span style={{ marginRight: "4px" }}>✓</span>
            API collection parsed successfully. {displayContract.endpoints.length} endpoints detected.
          </p>

          {/* Collection summary */}
          <div style={{ marginTop: "12px", padding: "12px", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--surface-alt)" }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: "14px" }}>
              {displayContract.title}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
              {formatTypeLabel(displayContract.type, displayContract.version)} · {displayContract.endpoints.length} endpoints
            </p>
            {displayContract.baseUrl && (
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
                Base URL: {displayContract.baseUrl}
              </p>
            )}
          </div>

          {/* Endpoint preview */}
          <div style={{ marginTop: "12px" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Endpoints
            </p>
            {displayContract.endpoints.length === 0 ? (
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
                {displayContract.endpoints.map((ep) => {
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
    </div>
  );
}