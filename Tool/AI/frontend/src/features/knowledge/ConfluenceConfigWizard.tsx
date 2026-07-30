/**
 * ConfluenceConfigWizard
 *
 * Multi-step configuration wizard for Confluence knowledge source.
 */

import { useState, useEffect } from "react";

export interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  spaces: string[];
  pages: string[];
  autoSync: boolean;
  syncInterval: number;
}

interface ConfluenceConfigWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (config: ConfluenceConfig) => void;
  initialConfig?: Partial<ConfluenceConfig>;
}

export function ConfluenceConfigWizard({
  isOpen,
  onClose,
  onComplete,
  initialConfig,
}: ConfluenceConfigWizardProps) {
  const [step, setStep] = useState(1);
  const [testing, setTesting] = useState(false);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [error, setError] = useState("");

  const [config, setConfig] = useState<ConfluenceConfig>({
    baseUrl: initialConfig?.baseUrl || "",
    username: initialConfig?.username || "",
    apiToken: initialConfig?.apiToken || "",
    spaces: initialConfig?.spaces || [],
    pages: initialConfig?.pages || [],
    autoSync: initialConfig?.autoSync || false,
    syncInterval: initialConfig?.syncInterval || 3600,
  });

  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "testing" | "success" | "failed"
  >("idle");

  const [availableSpaces, setAvailableSpaces] = useState<
    Array<{ id: string; name: string; key: string }>
  >([]);
  const [spaceSearch, setSpaceSearch] = useState("");

  const [availablePages, setAvailablePages] = useState<
    Array<{ id: string; title: string; parentId?: string }>
  >([]);
  const [pageSearch, setPageSearch] = useState("");
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError("");
      setConnectionStatus("idle");
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    if (!config.baseUrl || !config.username || !config.apiToken) {
      setError("Please fill in all connection fields");
      return;
    }

    setTesting(true);
    setConnectionStatus("testing");
    setError("");

    try {
      // Simulate API call to test connection
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // In real implementation, this would call the backend
      // const response = await fetch('/api/integrations/confluence/test', { ... })
      setConnectionStatus("success");
    } catch (err) {
      setConnectionStatus("failed");
      setError("Failed to connect to Confluence. Please check your credentials.");
    } finally {
      setTesting(false);
    }
  };

  const handleFetchSpaces = async () => {
    setLoadingSpaces(true);
    setError("");

    try {
      // Simulate API call to fetch spaces
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Mock data for demo
      setAvailableSpaces([
        { id: "1", name: "Engineering", key: "ENG" },
        { id: "2", name: "Product", key: "PROD" },
        { id: "3", name: "Architecture", key: "ARCH" },
      ]);
    } catch (err) {
      setError("Failed to fetch Confluence spaces");
    } finally {
      setLoadingSpaces(false);
    }
  };

  const handleFetchPages = async () => {
    if (config.spaces.length === 0) {
      setError("Please select at least one space");
      return;
    }

    setLoadingPages(true);
    setError("");

    try {
      // Simulate API call to fetch pages
      await new Promise((resolve) => setTimeout(resolve, 1200));
      // Mock data for demo
      setAvailablePages([
        { id: "p1", title: "Authentication Flow", parentId: undefined },
        { id: "p2", title: "API Gateway", parentId: undefined },
        { id: "p3", title: "Rate Limiting", parentId: "p2" },
        { id: "p4", title: "OAuth 2.0", parentId: "p1" },
        { id: "p5", title: "User Management", parentId: undefined },
      ]);
    } catch (err) {
      setError("Failed to fetch pages from selected spaces");
    } finally {
      setLoadingPages(false);
    }
  };

  const handleSpaceToggle = (spaceId: string) => {
    setConfig((prev) => ({
      ...prev,
      spaces: prev.spaces.includes(spaceId)
        ? prev.spaces.filter((id) => id !== spaceId)
        : [...prev.spaces, spaceId],
    }));
  };

  const handleSelectAllSpaces = () => {
    if (config.spaces.length === availableSpaces.length) {
      setConfig((prev) => ({ ...prev, spaces: [] }));
    } else {
      setConfig((prev) => ({
        ...prev,
        spaces: availableSpaces.map((s) => s.id),
      }));
    }
  };

  const handlePageToggle = (pageId: string) => {
    setConfig((prev) => ({
      ...prev,
      pages: prev.pages.includes(pageId)
        ? prev.pages.filter((id) => id !== pageId)
        : [...prev.pages, pageId],
    }));
  };

  const handleToggleExpand = (pageId: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  const canProceedFromStep = () => {
    switch (step) {
      case 1:
        return connectionStatus === "success";
      case 2:
        return config.spaces.length > 0;
      case 3:
        return config.pages.length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step === 2 && availableSpaces.length === 0) {
      handleFetchSpaces();
    }
    if (step === 3 && availablePages.length === 0) {
      handleFetchPages();
    }
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const handleComplete = () => {
    onComplete(config);
    onClose();
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  marginBottom: "6px",
                }}
              >
                Base URL
              </label>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))
                }
                placeholder="https://yourcompany.atlassian.net/wiki"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "13px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-bg-surface)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  marginBottom: "6px",
                }}
              >
                Username / Email
              </label>
              <input
                type="text"
                value={config.username}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="user@company.com"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "13px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-bg-surface)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  marginBottom: "6px",
                }}
              >
                API Token
              </label>
              <input
                type="password"
                value={config.apiToken}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, apiToken: e.target.value }))
                }
                placeholder="Your Confluence API token"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "13px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-bg-surface)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#fff",
                  background: testing ? "var(--color-border)" : "var(--color-primary)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: testing ? "not-allowed" : "pointer",
                }}
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>

              {connectionStatus === "success" && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--color-success)",
                    fontWeight: 600,
                  }}
                >
                  ✓ Connected successfully
                </span>
              )}
              {connectionStatus === "failed" && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--color-error)",
                    fontWeight: 600,
                  }}
                >
                  ✗ Connection failed
                </span>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                value={spaceSearch}
                onChange={(e) => setSpaceSearch(e.target.value)}
                placeholder="Search spaces..."
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: "13px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-bg-surface)",
                  color: "var(--color-text-primary)",
                }}
              />
              <button
                type="button"
                onClick={handleSelectAllSpaces}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--color-primary)",
                  background: "var(--color-primary-soft)",
                  border: "1px solid var(--color-primary)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                {config.spaces.length === availableSpaces.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              {availableSpaces.length === 0 ? (
                <div
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {loadingSpaces ? "Loading spaces..." : "No spaces found"}
                </div>
              ) : (
                availableSpaces
                  .filter(
                    (s) =>
                      s.name
                        .toLowerCase()
                        .includes(spaceSearch.toLowerCase()) ||
                      s.key.toLowerCase().includes(spaceSearch.toLowerCase())
                  )
                  .map((space) => (
                    <div
                      key={space.id}
                      onClick={() => handleSpaceToggle(space.id)}
                      style={{
                        padding: "12px 16px",
                        borderBottom:
                          space !== availableSpaces[availableSpaces.length - 1]
                            ? "1px solid var(--color-border)"
                            : "none",
                        cursor: "pointer",
                        background:
                          config.spaces.includes(space.id)
                            ? "var(--color-primary-soft)"
                            : "transparent",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={config.spaces.includes(space.id)}
                        onChange={() => {}}
                        style={{ pointerEvents: "none" }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {space.name}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {space.key}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "var(--color-text-secondary)",
              }}
            >
              {config.spaces.length} of {availableSpaces.length} spaces selected
            </div>
          </div>
        );

      case 3:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                display: "flex",
                gap: "8px",
              }}
            >
              <input
                type="text"
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                placeholder="Search pages..."
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: "13px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-bg-surface)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>

            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              {availablePages.length === 0 ? (
                <div
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {loadingPages ? "Loading pages..." : "No pages found"}
                </div>
              ) : (
                availablePages
                  .filter((p) =>
                    p.title.toLowerCase().includes(pageSearch.toLowerCase())
                  )
                  .map((page) => {
                    const hasChildren = availablePages.some(
                      (p) => p.parentId === page.id
                    );
                    const isExpanded = expandedPages.has(page.id);
                    const childPages = availablePages.filter(
                      (p) => p.parentId === page.id
                    );

                    return (
                      <div key={page.id}>
                        <div
                          onClick={() => {
                            if (hasChildren) handleToggleExpand(page.id);
                            handlePageToggle(page.id);
                          }}
                          style={{
                            padding: "10px 16px",
                            borderBottom: "1px solid var(--color-border)",
                            cursor: "pointer",
                            background: config.pages.includes(page.id)
                              ? "var(--color-primary-soft)"
                              : "transparent",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          {hasChildren && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "16px",
                                height: "16px",
                                transition: "transform 0.2s",
                                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                              }}
                            >
                              ▶
                            </span>
                          )}
                          {!hasChildren && <span style={{ width: "16px" }} />}
                          <input
                            type="checkbox"
                            checked={config.pages.includes(page.id)}
                            onChange={() => {}}
                            style={{ pointerEvents: "none" }}
                          />
                          <span
                            style={{
                              fontSize: "13px",
                              color: "var(--color-text-primary)",
                            }}
                          >
                            {page.title}
                          </span>
                        </div>
                        {isExpanded &&
                          childPages.map((child) => (
                            <div
                              key={child.id}
                              onClick={() => handlePageToggle(child.id)}
                              style={{
                                padding: "8px 16px 8px 40px",
                                borderBottom: "1px solid var(--color-border)",
                                cursor: "pointer",
                                background: config.pages.includes(child.id)
                                  ? "var(--color-primary-soft)"
                                  : "transparent",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={config.pages.includes(child.id)}
                                onChange={() => {}}
                                style={{ pointerEvents: "none" }}
                              />
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "var(--color-text-primary)",
                                }}
                              >
                                {child.title}
                              </span>
                            </div>
                          ))}
                      </div>
                    );
                  })
              )}
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "var(--color-text-secondary)",
              }}
            >
              {config.pages.length} pages selected
            </div>
          </div>
        );

      case 4:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <input
                type="checkbox"
                id="autoSync"
                checked={config.autoSync}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, autoSync: e.target.checked }))
                }
              />
              <label
                htmlFor="autoSync"
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  cursor: "pointer",
                }}
              >
                Enable Auto Sync
              </label>
            </div>

            {config.autoSync && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                    marginBottom: "6px",
                  }}
                >
                  Sync Interval (seconds)
                </label>
                <input
                  type="number"
                  value={config.syncInterval}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      syncInterval: parseInt(e.target.value, 10) || 3600,
                    }))
                  }
                  min={300}
                  step={300}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "13px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-bg-surface)",
                    color: "var(--color-text-primary)",
                  }}
                />
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--color-text-muted)",
                    marginTop: "4px",
                  }}
                >
                  Minimum interval: 300 seconds (5 minutes)
                </div>
              </div>
            )}

            <div
              style={{
                padding: "12px",
                background: "var(--color-info-bg)",
                border: "1px solid var(--color-info-border)",
                borderRadius: "var(--radius-md)",
                fontSize: "12px",
                color: "var(--color-info-text)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                Configuration Summary
              </div>
              <div>Connection: {config.baseUrl}</div>
              <div>Username: {config.username}</div>
              <div>Spaces: {config.spaces.length}</div>
              <div>Pages: {config.pages.length}</div>
              <div>Sync: {config.autoSync ? `Every ${config.syncInterval}s` : "Manual only"}</div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  const stepLabels = ["Connection", "Spaces", "Pages", "Sync"];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          width: "100%",
          maxWidth: "700px",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            Configure Confluence
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "20px",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              padding: 0,
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Step Indicators */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            gap: "8px",
          }}
        >
          {stepLabels.map((label, idx) => (
            <div
              key={label}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: 600,
                  background:
                    step > idx + 1
                      ? "var(--color-success)"
                      : step === idx + 1
                      ? "var(--color-primary)"
                      : "var(--color-border)",
                  color:
                    step > idx + 1 || step === idx + 1
                      ? "#fff"
                      : "var(--color-text-muted)",
                }}
              >
                {step > idx + 1 ? "✓" : idx + 1}
              </div>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color:
                    step === idx + 1
                      ? "var(--color-text-primary)"
                      : "var(--color-text-muted)",
                }}
              >
                {label}
              </span>
              {idx < stepLabels.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    background:
                      step > idx + 1
                        ? "var(--color-success)"
                        : "var(--color-border)",
                    marginLeft: "8px",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div
          style={{
            padding: "20px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {error && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--color-error-bg)",
                border: "1px solid var(--color-error-border)",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                color: "var(--color-error-text)",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              cursor: step === 1 ? "not-allowed" : "pointer",
              opacity: step === 1 ? 0.5 : 1,
            }}
          >
            Back
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceedFromStep()}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#fff",
                  background: !canProceedFromStep()
                    ? "var(--color-border)"
                    : "var(--color-primary)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: !canProceedFromStep() ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#fff",
                  background: "var(--color-primary)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                Complete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}