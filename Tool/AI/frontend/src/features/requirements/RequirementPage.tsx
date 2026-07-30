/**
 * RequirementPage — AI Requirement Workshop
 *
 * Production-ready guided wizard for requirement analysis and test asset generation.
 *
 * Workflow Steps:
 * 1. Requirement Source (Manual, Jira, Upload, Paste)
 * 2. AI Requirement Analysis
 * 3. Generate & Review Test Cases
 * 4. API Matching
 * 5. Requirement Summary
 * 6. Generate Draft Validation Scenarios
 *
 * Each section collapses after completion.
 * Large progress indicator shows current/completed/remaining steps.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Requirement, RequirementStats } from "./RequirementService";
import {
  listRequirements,
  getRequirementStats,
  createRequirement,
  extractRequirementsFromText,
  uploadRequirementDocument,
  fetchRequirementFromJira,
  getWorkflowByRequirement,
  initializeWorkflow,
  analyzeRequirement as analyzeWorkflow,
  generateWorkflowTestCases,
  updateTestSelection,
  approveTests,
  matchApis,
  confirmMappings,
  generateDraftScenarios,
  getWorkflowSummary,
} from "./RequirementService";
import type { RequirementExtractionResult } from "./RequirementService";
import type { RequirementWorkflow, WorkflowSummary } from "./RequirementTypes";
import { RequirementCard } from "./RequirementCard";
import { RequirementToolbar } from "./RequirementToolbar";
import { RequirementExtractionPanel } from "./RequirementExtractionPanel";
import { TestCaseReviewPanel } from "./TestCaseReviewPanel";
import { ApiMatchingPanel } from "./ApiMatchingPanel";
import { WorkflowProgressBar } from "./WorkflowProgressBar";

// ─── SVG Icons ─────────────────────────────────────────────────────────────

const IconFileText = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const IconClipboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 5 17 10" />
    <line x1="12" y1="5" x2="12" y2="19" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const IconEmpty = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconList = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const IconJira = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M12 2l-4 4 4 4-4 4 4 4" />
    <path d="M12 2l4 4-4 4 4 4-4 4" />
  </svg>
);

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// ─── Interface ─────────────────────────────────────────────────────────────

interface RequirementPageProps {
  activeProjectId: string | null;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function RequirementPage({ activeProjectId }: RequirementPageProps) {
  // ─── State ───────────────────────────────────────────────────────────────
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [stats, setStats] = useState<RequirementStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Search & sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Selection
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);

  // Workflow state
  const [workflow, setWorkflow] = useState<RequirementWorkflow | null>(null);
  const [summary, setSummary] = useState<WorkflowSummary | null>(null);

  // Intake modal state
  const [showManualForm, setShowManualForm] = useState(false);
  const [showPasteForm, setShowPasteForm] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Extraction state
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extractionResult, setExtractionResult] = useState<RequirementExtractionResult | null>(null);

  // Jira state
  const [jiraTicketKey, setJiraTicketKey] = useState("");
  const [jiraLoading, setJiraLoading] = useState(false);
  const [jiraError, setJiraError] = useState("");

  // Workflow action states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [isApprovingTests, setIsApprovingTests] = useState(false);
  const [isMatchingApis, setIsMatchingApis] = useState(false);
  const [isConfirmingMappings, setIsConfirmingMappings] = useState(false);
  const [isGeneratingScenarios, setIsGeneratingScenarios] = useState(false);

  // ─── Load Data ───────────────────────────────────────────────────────────
  const loadAll = useCallback(async (projectId: string) => {
    setLoading(true);
    setError("");
    try {
      const [reqs, reqStats] = await Promise.all([
        listRequirements(projectId, { sort: sortField, order: sortOrder }),
        getRequirementStats(projectId),
      ]);
      setRequirements(reqs);
      setStats(reqStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requirements.");
    } finally {
      setLoading(false);
    }
  }, [sortField, sortOrder]);

  useEffect(() => {
    if (activeProjectId) {
      loadAll(activeProjectId);
    } else {
      setRequirements([]);
      setStats(null);
      setSelectedRequirement(null);
      setWorkflow(null);
      setSummary(null);
    }
  }, [activeProjectId, loadAll]);

  // ─── Workflow Initialization ─────────────────────────────────────────────
  const initWorkflow = useCallback(async (requirement: Requirement) => {
    if (!activeProjectId) return;
    try {
      // Check for existing workflow
      let wf = await getWorkflowByRequirement(activeProjectId, requirement.id);
      if (!wf) {
        wf = await initializeWorkflow(activeProjectId, requirement.id);
      }
      setWorkflow(wf);

      // Get summary
      try {
        const s = await getWorkflowSummary(activeProjectId, wf.workflowId);
        setSummary(s);
      } catch {
        // Non-critical
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize workflow.");
    }
  }, [activeProjectId]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleCreateManual = async () => {
    if (!activeProjectId) return;
    if (!manualTitle.trim()) {
      setCreateError("Title is required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const req = await createRequirement(activeProjectId, {
        title: manualTitle.trim(),
        description: manualDescription.trim(),
        source: "manual",
        status: "draft",
      });
      setRequirements((prev) => [req, ...prev]);
      setSelectedRequirement(req);
      setShowManualForm(false);
      setManualTitle("");
      setManualDescription("");
      await initWorkflow(req);
      const reqStats = await getRequirementStats(activeProjectId);
      setStats(reqStats);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create requirement.");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFromPaste = async () => {
    if (!activeProjectId) return;
    if (!pasteContent.trim()) {
      setCreateError("Paste content is required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const lines = pasteContent.split("\n").filter((l) => l.trim());
      const title = lines[0]?.slice(0, 100) || "Pasted Requirement";
      const req = await createRequirement(activeProjectId, {
        title,
        description: pasteContent.trim(),
        source: "paste",
        status: "draft",
      });
      setRequirements((prev) => [req, ...prev]);
      setSelectedRequirement(req);
      setShowPasteForm(false);
      setPasteContent("");
      await initWorkflow(req);
      const reqStats = await getRequirementStats(activeProjectId);
      setStats(reqStats);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create requirement.");
    } finally {
      setCreating(false);
    }
  };

  const handleAnalyzePaste = async () => {
    if (!activeProjectId) return;
    if (!pasteContent.trim()) {
      setExtractError("Paste content is required.");
      return;
    }
    setExtracting(true);
    setExtractError("");
    setExtractionResult(null);
    try {
      const result = await extractRequirementsFromText(activeProjectId, pasteContent.trim(), "pasted-content");
      setExtractionResult(result);
      setShowPasteForm(false);
      setPasteContent("");
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Failed to extract requirements.");
    } finally {
      setExtracting(false);
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeProjectId) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    setExtractError("");
    setExtractionResult(null);
    try {
      const result = await uploadRequirementDocument(activeProjectId, file);
      setExtractionResult(result);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Failed to upload document.");
    } finally {
      setExtracting(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const handleRefresh = () => {
    if (activeProjectId) loadAll(activeProjectId);
  };

  const handleClearExtraction = () => {
    setExtractionResult(null);
    setExtractError("");
  };

  const handleFetchFromJira = async () => {
    if (!activeProjectId || !jiraTicketKey.trim()) return;
    setJiraLoading(true);
    setJiraError("");
    try {
      const req = await fetchRequirementFromJira(activeProjectId, jiraTicketKey.trim());
      setRequirements((prev) => [req, ...prev]);
      setSelectedRequirement(req);
      setJiraTicketKey("");
      await initWorkflow(req);
      const reqStats = await getRequirementStats(activeProjectId);
      setStats(reqStats);
    } catch (err) {
      setJiraError(err instanceof Error ? err.message : "Failed to fetch Jira ticket.");
    } finally {
      setJiraLoading(false);
    }
  };

  // ─── Workflow Step Handlers ──────────────────────────────────────────────

  /** Step 2: Analyze requirement with AI */
  const handleAnalyzeRequirement = async () => {
    if (!workflow || !activeProjectId) return;
    setIsAnalyzing(true);
    setError("");
    try {
      const updated = await analyzeWorkflow(activeProjectId, workflow.workflowId);
      setWorkflow(updated);
      if (activeProjectId) {
        const s = await getWorkflowSummary(activeProjectId, updated.workflowId);
        setSummary(s);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze requirement.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  /** Step 3: Generate test cases */
  const handleGenerateTestCases = async () => {
    if (!workflow || !activeProjectId) return;
    setIsGeneratingTests(true);
    setError("");
    try {
      const updated = await generateWorkflowTestCases(activeProjectId, workflow.workflowId);
      setWorkflow(updated);
      if (activeProjectId) {
        const s = await getWorkflowSummary(activeProjectId, updated.workflowId);
        setSummary(s);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate test cases.");
    } finally {
      setIsGeneratingTests(false);
    }
  };

  /** Step 3: Update test selection */
  const handleTestSelectionChange = async (testCaseIds: string[]) => {
    if (!workflow || !activeProjectId) return;
    setWorkflow((prev) => prev ? {
      ...prev,
      selectedTests: { testCaseIds, selectedAt: new Date().toISOString() },
    } : null);
    try {
      await updateTestSelection(activeProjectId, workflow.workflowId, testCaseIds);
    } catch {
      // Optimistic update
    }
  };

  /** Step 3: Approve tests and move to API matching */
  const handleApproveTests = async () => {
    if (!workflow || !activeProjectId) return;
    setIsApprovingTests(true);
    setError("");
    try {
      const updated = await approveTests(activeProjectId, workflow.workflowId);
      setWorkflow(updated);
      // Auto-trigger API matching
      const matched = await matchApis(activeProjectId, updated.workflowId);
      setWorkflow(matched);
      if (activeProjectId) {
        const s = await getWorkflowSummary(activeProjectId, matched.workflowId);
        setSummary(s);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve tests.");
    } finally {
      setIsApprovingTests(false);
    }
  };

  /** Step 4: Match APIs */
  const handleMatchApis = async () => {
    if (!workflow || !activeProjectId) return;
    setIsMatchingApis(true);
    setError("");
    try {
      const updated = await matchApis(activeProjectId, workflow.workflowId);
      setWorkflow(updated);
      if (activeProjectId) {
        const s = await getWorkflowSummary(activeProjectId, updated.workflowId);
        setSummary(s);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to match APIs.");
    } finally {
      setIsMatchingApis(false);
    }
  };

  /** Step 4: Confirm mappings */
  const handleConfirmMappings = async () => {
    if (!workflow || !activeProjectId) return;
    setIsConfirmingMappings(true);
    setError("");
    try {
      const updated = await confirmMappings(activeProjectId, workflow.workflowId);
      setWorkflow(updated);
      if (activeProjectId) {
        const s = await getWorkflowSummary(activeProjectId, updated.workflowId);
        setSummary(s);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm mappings.");
    } finally {
      setIsConfirmingMappings(false);
    }
  };

  /** Step 5: Generate draft validation scenarios */
  const handleGenerateScenarios = async () => {
    if (!workflow || !activeProjectId) return;
    setIsGeneratingScenarios(true);
    setError("");
    try {
      const updated = await generateDraftScenarios(activeProjectId, workflow.workflowId);
      setWorkflow(updated);
      if (activeProjectId) {
        const s = await getWorkflowSummary(activeProjectId, updated.workflowId);
        setSummary(s);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate scenarios.");
    } finally {
      setIsGeneratingScenarios(false);
    }
  };

  /** Navigate to Validation Scenarios */
  const handleContinueToValidationScenarios = () => {
    if (workflow?.draftValidationScenarioIds && workflow.draftValidationScenarioIds.length > 0) {
      window.location.hash = "#validation-scenarios";
    }
  };

  // ─── Derived Data ────────────────────────────────────────────────────────
  const filteredRequirements = useMemo(() => {
    if (!searchQuery.trim()) return requirements;
    const q = searchQuery.toLowerCase();
    return requirements.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [requirements, searchQuery]);

  const hasRequirements = requirements.length > 0;
  const readiness = summary?.readiness ?? 0;

  const statsCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Total Requirements", value: stats.total, icon: IconList },
      { label: "Ready Requirements", value: stats.ready, icon: IconCheck },
      { label: "Draft Requirements", value: stats.draft, icon: IconFileText },
      { label: "Last Updated", value: stats.lastUpdated ? formatDateTime(stats.lastUpdated) : "—", icon: IconClock },
    ];
  }, [stats]);

  // ─── No Project State ────────────────────────────────────────────────────
  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "var(--color-text-primary)" }}>Requirements</h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
          Select a project to view its requirements.
        </p>
      </div>
    );
  }

  const showExtractionPanel = extractionResult !== null || extracting;

  // ─── Main Render ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: Page Header
          ═══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "18px" }}>
          <div>
            <h1 style={{
              margin: "0 0 6px 0",
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.01em",
            }}>
              AI Requirement Workshop
            </h1>
            <p style={{
              margin: 0,
              fontSize: "14px",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
            }}>
              Convert business requirements into validated testing assets.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: 600,
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              background: "var(--color-bg-surface)",
              cursor: "pointer",
              color: "var(--color-text-primary)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
        }}>
          {statsCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 16px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-bg-surface)",
                }}
              >
                <div style={{
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-primary-soft)",
                  color: "var(--color-primary)",
                  flexShrink: 0,
                }}>
                  <Icon />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--color-text-muted)",
                    marginBottom: "2px",
                  }}>
                    {stat.label}
                  </div>
                  <div style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {loading ? "…" : stat.value}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          WORKFLOW PROGRESS BAR
          ═══════════════════════════════════════════════════════════════════ */}
      {workflow && (
        <WorkflowProgressBar
          currentStep={workflow.currentStep}
          status={workflow.status}
          readiness={readiness}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: Requirement Source (Step 1)
          ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}>
              Section 1: Requirement Source
            </h2>
            <p style={{
              margin: "4px 0 0 0",
              fontSize: "12px",
              color: "var(--color-text-secondary)",
            }}>
              {workflow ? "Requirement captured. Edit below or add a new one." : "Choose a method to add a requirement."}
            </p>
          </div>
          {workflow && (
            <span style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              borderRadius: "var(--radius-pill)",
              background: "var(--color-success-soft)",
              color: "var(--color-success)",
            }}>
              ✓ Complete
            </span>
          )}
        </div>

        {/* Intake cards - only show when no workflow active */}
        {!workflow && (
          <div style={{ padding: "16px" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
            }}>
              {/* 1. Manual */}
              <div style={{ padding: "16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", background: "var(--color-primary-soft)", color: "var(--color-primary)", flexShrink: 0 }}>
                  <IconFileText />
                </div>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>Manual Requirement</h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>Create a requirement manually.</p>
                </div>
                <button type="button" onClick={() => { setShowManualForm(true); setShowPasteForm(false); setCreateError(""); }}
                  style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", alignSelf: "flex-start" }}>
                  Create
                </button>
              </div>

              {/* 2. Paste */}
              <div style={{ padding: "16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", background: "var(--color-primary-soft)", color: "var(--color-primary)", flexShrink: 0 }}>
                  <IconClipboard />
                </div>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>Paste User Story</h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>Paste a user story or acceptance criteria.</p>
                </div>
                <button type="button" onClick={() => { setShowPasteForm(true); setShowManualForm(false); setCreateError(""); }}
                  style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", alignSelf: "flex-start" }}>
                  Paste
                </button>
              </div>

              {/* 3. Upload */}
              <div style={{ padding: "16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", background: "var(--color-primary-soft)", color: "var(--color-primary)", flexShrink: 0 }}>
                  <IconUpload />
                </div>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>Upload Document</h3>
                  <p style={{ margin: "0 0 4px 0", fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>PDF • DOCX • Markdown • TXT</p>
                  <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>Upload a requirement document file.</p>
                </div>
                <label htmlFor="requirement-document-upload" style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: extracting ? "var(--color-border)" : "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: extracting ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start", opacity: extracting ? 0.7 : 1 }}>
                  {extracting ? "Analyzing..." : "Upload & Analyze"}
                </label>
                <input id="requirement-document-upload" type="file" accept=".pdf,.docx,.md,.markdown,.txt" hidden onChange={handleUploadDocument} disabled={extracting} />
              </div>

              {/* 4. Jira */}
              <div style={{ padding: "16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", background: "var(--color-primary-soft)", color: "var(--color-primary)", flexShrink: 0 }}>
                  <IconJira />
                </div>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>Import from Jira</h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>Fetch requirement from a Jira ticket.</p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input type="text" placeholder="PROJ-123" value={jiraTicketKey} onChange={(e) => setJiraTicketKey(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && handleFetchFromJira()}
                    style={{ flex: 1, padding: "8px 10px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", fontFamily: "inherit", boxSizing: "border-box" }} />
                  <button type="button" onClick={handleFetchFromJira} disabled={jiraLoading || !jiraTicketKey.trim()}
                    style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: jiraLoading || !jiraTicketKey.trim() ? "var(--color-border)" : "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: jiraLoading || !jiraTicketKey.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                    {jiraLoading ? "Fetching..." : "Fetch"}
                  </button>
                </div>
                {jiraError && <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "var(--color-error)" }}>{jiraError}</p>}
              </div>
            </div>

            {/* Inline forms */}
            {showManualForm && (
              <div style={{ marginTop: "16px", padding: "16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>Create Manual Requirement</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input type="text" placeholder="Requirement title" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", fontFamily: "inherit", boxSizing: "border-box" }} />
                  <textarea placeholder="Requirement description (optional)" value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} rows={3}
                    style={{ width: "100%", padding: "8px 10px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
                  {createError && <p style={{ margin: 0, fontSize: "13px", color: "var(--color-error)" }}>{createError}</p>}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="button" onClick={handleCreateManual} disabled={creating}
                      style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: creating ? "var(--color-border)" : "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: creating ? "not-allowed" : "pointer" }}>
                      {creating ? "Creating..." : "Create Requirement"}
                    </button>
                    <button type="button" onClick={() => { setShowManualForm(false); setCreateError(""); }}
                      style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showPasteForm && (
              <div style={{ marginTop: "16px", padding: "16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>Paste User Story</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <textarea placeholder="Paste your user story, acceptance criteria, or requirement description here..." value={pasteContent} onChange={(e) => setPasteContent(e.target.value)} rows={5}
                    style={{ width: "100%", padding: "8px 10px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
                  {extractError && <p style={{ margin: 0, fontSize: "13px", color: "var(--color-error)" }}>{extractError}</p>}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button type="button" onClick={handleAnalyzePaste} disabled={extracting}
                      style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: extracting ? "var(--color-border)" : "var(--color-info)", border: "none", borderRadius: "var(--radius-sm)", cursor: extracting ? "not-allowed" : "pointer" }}>
                      {extracting ? "Analyzing..." : "Analyze with AI"}
                    </button>
                    <button type="button" onClick={handleCreateFromPaste} disabled={creating}
                      style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: creating ? "var(--color-border)" : "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: creating ? "not-allowed" : "pointer" }}>
                      {creating ? "Creating..." : "Create Requirement"}
                    </button>
                    <button type="button" onClick={() => { setShowPasteForm(false); setCreateError(""); setExtractError(""); }}
                      style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show selected requirement info when workflow active */}
        {workflow && selectedRequirement && (
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>Title</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>{selectedRequirement.title}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>Source</div>
                <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", textTransform: "capitalize" }}>{selectedRequirement.source}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>Priority</div>
                <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", textTransform: "capitalize" }}>{selectedRequirement.priority}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>Status</div>
                <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", textTransform: "capitalize" }}>{selectedRequirement.status}</div>
              </div>
            </div>
            {selectedRequirement.description && (
              <div style={{ marginTop: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>Description</div>
                <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{selectedRequirement.description}</div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          WORKFLOW SECTIONS (Steps 2-6)
          ═══════════════════════════════════════════════════════════════════ */}
      {workflow && selectedRequirement && (
        <>
          {/* Step 2: AI Analysis */}
          <section style={{
            marginBottom: "24px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-bg-surface)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                  Section 2: AI Requirement Analysis
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  {workflow.analysis.completed ? "Analysis complete. Review and edit the extracted details." : "Analyze requirement to extract testable details."}
                </p>
              </div>
              {workflow.analysis.completed ? (
                <span style={{ padding: "4px 10px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", borderRadius: "var(--radius-pill)", background: "var(--color-success-soft)", color: "var(--color-success)" }}>
                  ✓ Complete
                </span>
              ) : (
                <button type="button" onClick={handleAnalyzeRequirement} disabled={isAnalyzing}
                  style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: isAnalyzing ? "var(--color-border)" : "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: isAnalyzing ? "not-allowed" : "pointer" }}>
                  {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
                </button>
              )}
            </div>
            {workflow.analysis.completed && (
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "6px" }}>
                      Acceptance Criteria ({workflow.analysis.acceptanceCriteria.length})
                    </div>
                    {workflow.analysis.acceptanceCriteria.map((ac, i) => (
                      <div key={i} style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "4px", padding: "4px 8px", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-sm)" }}>• {ac}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "6px" }}>
                      Business Rules ({workflow.analysis.businessRules.length})
                    </div>
                    {workflow.analysis.businessRules.map((br, i) => (
                      <div key={i} style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "4px", padding: "4px 8px", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-sm)" }}>• {br}</div>
                    ))}
                  </div>
                  {workflow.analysis.positivePaths.length > 0 && (
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "6px" }}>Positive Paths</div>
                      {workflow.analysis.positivePaths.map((p, i) => (
                        <div key={i} style={{ fontSize: "12px", color: "var(--color-success)", marginBottom: "4px" }}>✓ {p}</div>
                      ))}
                    </div>
                  )}
                  {workflow.analysis.negativePaths.length > 0 && (
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "6px" }}>Negative Paths</div>
                      {workflow.analysis.negativePaths.map((p, i) => (
                        <div key={i} style={{ fontSize: "12px", color: "var(--color-error)", marginBottom: "4px" }}>✗ {p}</div>
                      ))}
                    </div>
                  )}
                  {workflow.analysis.edgeCases.length > 0 && (
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "6px" }}>Edge Cases</div>
                      {workflow.analysis.edgeCases.map((e, i) => (
                        <div key={i} style={{ fontSize: "12px", color: "var(--color-warning)", marginBottom: "4px" }}>⚠ {e}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Step 3: Generate & Review Test Cases */}
          {workflow.currentStep >= 3 && (
            <section style={{ marginBottom: "24px" }}>
              {!workflow.generatedTests.completed ? (
                <div style={{ border: "1px dashed var(--color-border-strong)", borderRadius: "var(--radius-lg)", padding: "32px", textAlign: "center", background: "var(--color-bg-subtle)" }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                    Section 3: Generate Test Cases
                  </h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--color-text-primary)" }}>
                    Generate business-level test cases based on AI analysis
                  </p>
                  <button type="button" onClick={handleGenerateTestCases} disabled={isGeneratingTests}
                    style={{ padding: "10px 20px", fontSize: "14px", fontWeight: 600, color: "#fff", background: isGeneratingTests ? "var(--color-border)" : "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: isGeneratingTests ? "not-allowed" : "pointer" }}>
                    {isGeneratingTests ? "Generating..." : "Generate Test Cases"}
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ padding: "0 0 12px 0" }}>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      Section 3: Review Generated Test Cases
                    </h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      Select, review, and approve test cases for API matching.
                    </p>
                  </div>
                  <TestCaseReviewPanel
                    testCases={workflow.generatedTests.testCases as any}
                    selectedIds={workflow.selectedTests.testCaseIds}
                    onSelectionChange={handleTestSelectionChange}
                    onRegenerate={handleGenerateTestCases}
                    onApprove={handleApproveTests}
                    isGenerating={isGeneratingTests}
                    isApproving={isApprovingTests}
                  />
                </>
              )}
            </section>
          )}

          {/* Step 4: API Matching */}
          {workflow.currentStep >= 4 && (
            <section style={{ marginBottom: "24px" }}>
              {!workflow.apiMatches.completed ? (
                <div style={{ border: "1px dashed var(--color-border-strong)", borderRadius: "var(--radius-lg)", padding: "32px", textAlign: "center", background: "var(--color-bg-subtle)" }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                    Section 4: API Matching
                  </h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--color-text-primary)" }}>
                    Match test cases to API operations
                  </p>
                  <button type="button" onClick={handleMatchApis} disabled={isMatchingApis}
                    style={{ padding: "10px 20px", fontSize: "14px", fontWeight: 600, color: "#fff", background: isMatchingApis ? "var(--color-border)" : "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: isMatchingApis ? "not-allowed" : "pointer" }}>
                    {isMatchingApis ? "Matching..." : "Match APIs"}
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ padding: "0 0 12px 0" }}>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      Section 4: API Matching
                    </h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      Review API matches and confirm mappings.
                    </p>
                  </div>
                  <ApiMatchingPanel
                    matches={workflow.apiMatches.matches as any}
                    onConfirmMappings={handleConfirmMappings}
                    onReviewSuggestion={() => {}}
                    onChangeApi={() => {}}
                    isConfirming={isConfirmingMappings}
                  />
                </>
              )}
            </section>
          )}

          {/* Step 5: Requirement Summary */}
          {workflow.currentStep >= 4 && summary && (
            <section style={{
              marginBottom: "24px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-bg-surface)",
              overflow: "hidden",
            }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                  Section 5: Requirement Summary
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  Coverage and readiness overview.
                </p>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                  <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-primary)" }}>{summary.acceptanceCriteriaCount}</div>
                    <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", marginTop: "4px" }}>AC Criteria</div>
                  </div>
                  <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-primary)" }}>{summary.generatedTestCount}</div>
                    <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", marginTop: "4px" }}>Tests Generated</div>
                  </div>
                  <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-success)" }}>{summary.approvedTestCount}</div>
                    <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", marginTop: "4px" }}>Tests Approved</div>
                  </div>
                  <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-info)" }}>{summary.matchedApiCount}</div>
                    <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", marginTop: "4px" }}>APIs Matched</div>
                  </div>
                  <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: readiness >= 80 ? "var(--color-success)" : "var(--color-warning)" }}>{readiness}%</div>
                    <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", marginTop: "4px" }}>Readiness</div>
                  </div>
                  <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text-primary)" }}>{workflow.status === "ready-for-validation" ? "Ready" : workflow.status}</div>
                    <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", marginTop: "4px" }}>Status</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Step 6: Generate Draft Validation Scenarios */}
          {workflow.currentStep >= 5 && (
            <section style={{ marginBottom: "24px" }}>
              {workflow.draftValidationScenarioIds.length === 0 ? (
                <div style={{ border: "1px dashed var(--color-border-strong)", borderRadius: "var(--radius-lg)", padding: "32px", textAlign: "center", background: "var(--color-bg-subtle)" }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                    Section 6: Generate Draft Validation Scenarios
                  </h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--color-text-primary)" }}>
                    Confirm API mappings to generate draft validation scenarios
                  </p>
                  <button type="button" onClick={handleConfirmMappings} disabled={isConfirmingMappings}
                    style={{ padding: "10px 20px", fontSize: "14px", fontWeight: 600, color: "#fff", background: isConfirmingMappings ? "var(--color-border)" : "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: isConfirmingMappings ? "not-allowed" : "pointer", marginRight: "8px" }}>
                    {isConfirmingMappings ? "Confirming..." : "Confirm Mappings"}
                  </button>
                  <button type="button" onClick={handleGenerateScenarios} disabled={isGeneratingScenarios || !workflow.approvedMappings.completed}
                    style={{ padding: "10px 20px", fontSize: "14px", fontWeight: 600, color: "#fff", background: isGeneratingScenarios || !workflow.approvedMappings.completed ? "var(--color-border)" : "var(--color-success)", border: "none", borderRadius: "var(--radius-sm)", cursor: isGeneratingScenarios || !workflow.approvedMappings.completed ? "not-allowed" : "pointer" }}>
                    {isGeneratingScenarios ? "Generating..." : "Generate Draft Scenarios"}
                  </button>
                </div>
              ) : (
                <div style={{
                  border: "1px solid var(--color-success)",
                  borderRadius: "var(--radius-lg)",
                  padding: "20px 24px",
                  background: "var(--color-success-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-success)", marginBottom: "4px" }}>
                      ✓ Draft Validation Scenarios Created
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      {workflow.draftValidationScenarioIds.length} scenario{workflow.draftValidationScenarioIds.length > 1 ? "s" : ""} generated · {workflow.scenariosGeneratedAt ? formatDateTime(workflow.scenariosGeneratedAt) : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleContinueToValidationScenarios}
                    style={{
                      padding: "10px 20px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#fff",
                      background: "var(--color-success)",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    Continue to Validation Scenarios
                    <IconArrowRight />
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          EXTRACTION PANEL
          ═══════════════════════════════════════════════════════════════════ */}
      {showExtractionPanel && activeProjectId && (
        <RequirementExtractionPanel
          result={extractionResult}
          projectId={activeProjectId}
          onClear={handleClearExtraction}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          REQUIREMENT LIBRARY
          ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            Requirement Library
          </h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
            {hasRequirements ? "Select a requirement to view and edit its details." : "Add your first requirement to get started."}
          </p>
        </div>

        {hasRequirements && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)" }}>
            <RequirementToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortField={sortField}
              onSortChange={setSortField}
              sortOrder={sortOrder}
              onOrderChange={setSortOrder}
              totalCount={filteredRequirements.length}
            />
          </div>
        )}

        <div style={{ padding: "16px" }}>
          {loading && !hasRequirements ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>Loading requirements...</p>
          ) : error && !hasRequirements ? (
            <p style={{ fontSize: "13px", color: "var(--color-error)" }}>{error}</p>
          ) : !hasRequirements ? (
            <div style={{ padding: "32px 24px", border: "1px dashed var(--color-border-strong)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)", textAlign: "center" }}>
              <div style={{ width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-md)", background: "var(--color-primary-soft)", color: "var(--color-primary)", margin: "0 auto 14px" }}>
                <IconEmpty />
              </div>
              <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>No requirements yet.</p>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>Add a requirement using one of the methods above.</p>
            </div>
          ) : filteredRequirements.length === 0 ? (
            <div style={{ padding: "24px", border: "1px dashed var(--color-border-strong)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>No requirements match your search.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
              {filteredRequirements.map((req) => (
                <RequirementCard
                  key={req.id}
                  requirement={req}
                  selected={selectedRequirement?.id === req.id}
                  onSelect={(r) => {
                    setSelectedRequirement(r);
                    initWorkflow(r);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}