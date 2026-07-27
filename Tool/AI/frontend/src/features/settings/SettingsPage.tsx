/**
 * Settings Page
 *
 * Provides user-configurable settings for the application.
 */

const IconSun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const IconMoon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

interface SettingsPageProps {
  activeProjectId: string | null;
}

export function SettingsPage({ activeProjectId }: SettingsPageProps) {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";

  const setTheme = (theme: "light" | "dark") => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("testforge-theme", theme);
  };

  return (
    <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "20px" }}>Settings</h2>

      {/* Theme Section */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        background: "var(--color-bg-surface)",
        overflow: "hidden"
      }}>
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--blue-soft)"
        }}>
          <h3 style={{ margin: 0, fontSize: "17px", color: "var(--blue-deep)" }}>
            Appearance
          </h3>
        </div>
        <div style={{ padding: "18px" }}>
          <label style={{
            display: "block", fontSize: "12px", fontWeight: 600,
            color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "10px"
          }}>
            Theme
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setTheme("light")}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 16px", fontSize: "14px", fontWeight: 600,
                border: currentTheme === "light" ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                borderRadius: "6px",
                background: currentTheme === "light" ? "var(--color-bg-subtle)" : "var(--color-bg-surface)",
                color: "var(--color-text-primary)", cursor: "pointer"
              }}
            >
              <IconSun /> Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 16px", fontSize: "14px", fontWeight: 600,
                border: currentTheme === "dark" ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                borderRadius: "6px",
                background: currentTheme === "dark" ? "var(--color-bg-subtle)" : "var(--color-bg-surface)",
                color: "var(--color-text-primary)", cursor: "pointer"
              }}
            >
              <IconMoon /> Dark
            </button>
          </div>
        </div>
      </section>

      {/* Project Info Section */}
      <section style={{
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        background: "var(--color-bg-surface)",
        overflow: "hidden"
      }}>
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--purple-soft)"
        }}>
          <h3 style={{ margin: 0, fontSize: "17px", color: "var(--purple-deep)" }}>
            About
          </h3>
        </div>
        <div style={{ padding: "18px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
          <div style={{ marginBottom: "8px" }}>
            <strong>TestForge</strong> — API Testing Platform
          </div>
          {activeProjectId && (
            <div style={{ marginBottom: "8px" }}>
              Active Project: <code style={{
                padding: "2px 6px", borderRadius: "4px",
                background: "var(--color-bg-subtle)", fontSize: "12px"
              }}>{activeProjectId}</code>
            </div>
          )}
          <div>
            Version: <code style={{
              padding: "2px 6px", borderRadius: "4px",
              background: "var(--color-bg-subtle)", fontSize: "12px"
            }}>1.0.0</code>
          </div>
        </div>
      </section>
    </div>
  );
}