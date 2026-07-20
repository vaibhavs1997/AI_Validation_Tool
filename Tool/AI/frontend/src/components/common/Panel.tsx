interface PanelProps {
  step: number;
  title: string;
}

const panelColors = {
  requirements: { bg: "var(--violet-soft)", border: "var(--violet)", stepBg: "var(--violet)" },
  collection: { bg: "var(--blue-soft)", border: "var(--blue)", stepBg: "var(--blue)" },
  scenarios: { bg: "var(--green-soft)", border: "var(--green)", stepBg: "var(--green)" },
  execution: { bg: "var(--amber-soft)", border: "var(--amber)", stepBg: "var(--amber)" },
  results: { bg: "var(--cyan-soft)", border: "#176075", stepBg: "#176075" },
  history: { bg: "var(--blue-soft)", border: "var(--blue)", stepBg: "var(--blue)" }
};

export function Panel({ step, title }: PanelProps) {
  const colorKey = title.toLowerCase().includes("require") ? "requirements" :
                   title.toLowerCase().includes("collection") ? "collection" :
                   title.toLowerCase().includes("scenario") ? "scenarios" :
                   (title.toLowerCase().includes("configure") || title.toLowerCase().includes("run")) ? "execution" :
                   title.toLowerCase().includes("result") ? "results" : "history";

  const colors = panelColors[colorKey as keyof typeof panelColors];

  return (
    <section className="panel span-12" data-view-section="workspace" style={{
      minWidth: 0,
      border: "1px solid var(--line)",
      borderRadius: "8px",
      background: "var(--surface)",
      boxShadow: "var(--shadow)",
      overflow: "hidden"
    }}>
      <div className="panel-head" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        padding: "12px 16px",
        borderBottom: "1px solid var(--line)",
        background: colors.bg,
        borderColor: colors.border
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <span className="step" style={{
            width: "30px",
            height: "30px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
            borderRadius: "8px",
            fontWeight: 800,
            background: colors.stepBg,
            color: "#fff"
          }}>
            [{step}]
          </span>
          <h2 style={{ margin: 0, fontSize: "17px", color: colors.stepBg.replace("soft", "").replace("var(", "").replace(")", "") }}>
            {title}
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span className="step-status" style={{
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--muted)"
          }}>
            Not configured
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
        <p>Feature migration pending</p>
      </div>
    </section>
  );
}