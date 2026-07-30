/**
 * MappingToolbar
 *
 * Search and filter toolbar for the Implementation Mappings library.
 */

interface MappingToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortField: string;
  onSortChange: (value: string) => void;
  sortOrder: "asc" | "desc";
  onOrderChange: (value: "asc" | "desc") => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  totalCount: number;
  onAnalyze?: () => void;
}

export function MappingToolbar({
  searchQuery,
  onSearchChange,
  sortField,
  onSortChange,
  sortOrder,
  onOrderChange,
  statusFilter,
  onStatusFilterChange,
  totalCount,
  onAnalyze,
}: MappingToolbarProps) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search mappings..."
        style={{
          padding: "8px 10px",
          fontSize: "13px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-bg-surface)",
          color: "var(--color-text-primary)",
          fontFamily: "inherit",
          minWidth: "200px",
        }}
      />

      <select
        value={sortField}
        onChange={(e) => onSortChange(e.target.value)}
        style={{
          padding: "8px 10px",
          fontSize: "13px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-bg-surface)",
          color: "var(--color-text-primary)",
          fontFamily: "inherit",
        }}
      >
        <option value="updatedAt">Last Updated</option>
        <option value="createdAt">Created</option>
        <option value="title">Title</option>
        <option value="confidence">Confidence</option>
      </select>

      <button
        type="button"
        onClick={() => onOrderChange(sortOrder === "asc" ? "desc" : "asc")}
        style={{
          padding: "8px 12px",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
        }}
        aria-label={`Sort order: ${sortOrder === "asc" ? "ascending" : "descending"}`}
      >
        {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
      </button>

      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        style={{
          padding: "8px 10px",
          fontSize: "13px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-bg-surface)",
          color: "var(--color-text-primary)",
          fontFamily: "inherit",
        }}
      >
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="ready">Ready</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>

      <div style={{ marginLeft: "auto", fontSize: "12px", color: "var(--color-text-muted)" }}>
        {totalCount} mapping{totalCount !== 1 ? "s" : ""}
      </div>

      {onAnalyze && (
        <button
          type="button"
          onClick={onAnalyze}
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
          Analyze Mappings
        </button>
      )}
    </div>
  );
}