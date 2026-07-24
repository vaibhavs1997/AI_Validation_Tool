// SVG icon components
const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconFlask = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3h6v5l4 8-2 3H7l-2-3 4-8V3z" />
    <path d="M9 3v5H7m10 0h2" />
  </svg>
);

const IconServer = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <path d="M6 6h.01M6 18h.01" />
  </svg>
);

const IconGitBranch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3v12" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 01-9 9" />
  </svg>
);

const IconBarChart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20V10" />
    <path d="M18 20V4" />
    <path d="M6 20v-4" />
  </svg>
);

const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

interface SidebarProps {
  currentView: "setup" | "workspace" | "results" | "history";
  onViewChange: (view: "setup" | "workspace" | "results" | "history") => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const navItems = [
    {
      group: "Platform",
      items: [
        { id: "setup" as const, label: "Overview", icon: IconHome },
      ],
    },
    {
      group: "Testing",
      items: [
        { id: "workspace" as const, label: "Test Workspace", icon: IconFlask },
      ],
    },
    {
      group: "APIs",
      items: [
        { id: "workspace" as const, label: "API Services", icon: IconServer },
        { id: "workspace" as const, label: "Dependencies", icon: IconGitBranch },
      ],
    },
    {
      group: "Results",
      items: [
        { id: "results" as const, label: "Results", icon: IconBarChart },
        { id: "history" as const, label: "History", icon: IconClock },
      ],
    },
    {
      group: "System",
      items: [
        { id: "workspace" as const, label: "Settings", icon: IconSettings },
      ],
    },
  ];

  return (
    <aside id="testforge-sidebar" className="app-sidebar">
      {/* Brand */}
      <div id="testforge-brand" className="sidebar-brand">
        <div className="testforge-logo">TF</div>
        <div className="brand-copy">
          <div className="brand-name">TestForge</div>
          <div className="brand-subtitle">API Testing Platform</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {navItems.map((group) => (
          <div key={group.group} className="nav-group">
            <span className="nav-group-label">{group.group}</span>
            {group.items.map((item) => {
              const isActive = currentView === item.id;
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={`#${item.id}`}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    onViewChange(item.id);
                  }}
                >
                  <span className="nav-item-icon"><Icon /></span>
                  {item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}