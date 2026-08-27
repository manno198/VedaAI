import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({
  children,
  sidebarExpanded = true,
  onBack,
}: {
  children: ReactNode;
  sidebarExpanded?: boolean;
  onBack?: () => void;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar expanded={sidebarExpanded} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopBar onBack={onBack} />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
