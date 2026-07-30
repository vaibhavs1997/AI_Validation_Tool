/**
 * KnowledgeSourceCard
 *
 * Reusable card component for displaying a knowledge source.
 */

import type { KnowledgeSource } from "./KnowledgeSourceService";

interface KnowledgeSourceCardProps {
  source: KnowledgeSource;
  onConfigure?: () => void;
  onUpload?: () => void;
  onEdit?: () => void;
  onSync?: () => void;
}

export function KnowledgeSourceCard({
  source,
  onConfigure,
  onUpload,
  onEdit,
  onSync,
}: KnowledgeSourceCardProps) {
  const getStatusBadge = () => {
    switch (source.status) {
      case "connected":
      case "available":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 600,
              background: "var(--color-success-soft)",
              color: "var(--color-success)",
              border: "1px solid var(--color-success-border)",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--color-success)",
              }}
            />
            {source.status === "connected" ? "Connected" : "Available"}
          </span>
        );
      case "not-connected":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 600,
              background: "var(--color-neutral-soft)",
              color: "var(--color-neutral)",
              border: "1px solid var(--color-neutral-border)",
            }}
          >
            Not Connected
          </span>
        );
      case "syncing":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 600,
              background: "var(--color-info-soft)",
              color: "var(--color-info)",
              border: "1px solid var(--color-info-border)",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--color-info)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            Syncing
          </span>
        );
      case "error":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 600,
              background: "var(--color-error-soft)",
              color: "var(--color-error)",
              border: "1px solid var(--color-error-border)",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--color-error)",
              }}
            />
            Error
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: "3px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 600,
              background: "var(--color-neutral-soft)",
              color: "var(--color-neutral)",
              border: "1px solid var(--color-neutral-border)",
            }}
          >
            {source.status}
          </span>
        );
    }
  };

  const getTypeLabel = () => {
    switch (source.type) {
      case "confluence":
        return "Confluence";
      case "local-documents":
        return "Local Upload";
      case "project-notes":
        return "Project Notes";
      default:
        return source.type;
    }
  };

  const getSyncInfo = () => {
    if (!source.lastSync || !source.lastSync.timestamp) {
      return null;
    }
    const date = new Date(source.lastSync.timestamp);
    return date.toLocaleString();
  };

  return (
    <div
      style={{
        padding: "18px",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        transition: "box-shadow 0.2s, border-color 0.2s",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
        e.currentTarget.style.borderColor = "var(--color-primary-soft)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--color-border)";
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              margin: "0 0 6px 0",
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            {source.name}
          </h4>
          {source.description && (
            <p
              style={{
                margin: "0",
                fontSize: "12px",
                color: "var(--color-text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {source.description}
            </p>
          )}
        </div>
        {getStatusBadge()}
      </div>

      {/* Metadata */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          fontSize: "11px",
          color: "var(--color-text-muted)",
        }}
      >
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-bg-subtle)",
            border: "1px solid var(--color-border)",
          }}
        >
          {getTypeLabel()}
        </span>
        {source.metadata && Object.keys(source.metadata).length > 0 && (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-bg-subtle)",
              border: "1px solid var(--color-border)",
            }}
          >
            {Object.keys(source.metadata).length} properties
          </span>
        )}
        {getSyncInfo() && (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-bg-subtle)",
              border: "1px solid var(--color-border)",
            }}
          >
            Last sync: {getSyncInfo()}
          </span>
        )}
      </div>

      {/* Sync Stats */}
      {source.lastSync && (source.status === "connected" || source.status === "available") && (
        <div
          style={{
            display: "flex",
            gap: "16px",
            fontSize: "11px",
            color: "var(--color-text-secondary)",
          }}
        >
          {source.lastSync.pagesIndexed > 0 && (
            <span>Indexed: {source.lastSync.pagesIndexed}</span>
          )}
          {source.lastSync.pagesChanged > 0 && (
            <span>Changed: {source.lastSync.pagesChanged}</span>
          )}
          {source.lastSync.errors.length > 0 && (
            <span style={{ color: "var(--color-error)" }}>
              Errors: {source.lastSync.errors.length}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "4px",
        }}
      >
        {source.type === "confluence" && onConfigure && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
            style={{
              flex: 1,
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#fff",
              background: "var(--color-primary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            Configure
          </button>
        )}
        {(source.type === "local-documents") && onUpload && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpload();
            }}
            style={{
              flex: 1,
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#fff",
              background: "var(--color-primary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            Upload
          </button>
        )}
        {source.type === "project-notes" && onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            style={{
              flex: 1,
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#fff",
              background: "var(--color-primary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            Edit
          </button>
        )}
        {source.status === "connected" && onSync && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSync();
            }}
            style={{
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-primary)",
              background: "var(--color-primary-soft)",
              border: "1px solid var(--color-primary)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            Sync Now
          </button>
        )}
      </div>
    </div>
  );
}