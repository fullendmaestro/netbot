"use client";

import { useEffect } from "react";
import { AppSidebar } from "./components/AppSidebar";
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar";
import { WorkspaceArea } from "./components/WorkspaceArea";
import { AssistantPanel } from "./components/AssistantPanel";

export function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <SidebarProvider
      defaultOpen={false}
      style={{
        "--sidebar-width": "16rem",
      } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <WorkspaceArea />
      </SidebarInset>
      <AssistantPanel />
    </SidebarProvider>
  );
}

export default App;
