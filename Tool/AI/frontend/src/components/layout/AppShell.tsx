import { type ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell" style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "250px minmax(0, 1fr)" }}>
      {children}
    </div>
  );
}