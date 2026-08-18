"use client";

import { useEffect } from "react";
import { AppSidebar } from "./components/AppSidebar";
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar";
import { WorkspaceArea } from "./components/WorkspaceArea";
import { AssistantPanel } from "./components/AssistantPanel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./components/ui/resizable";

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
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel defaultSize="75%" minSize="30%">
            <WorkspaceArea />
          </ResizablePanel>
          <ResizableHandle withHandle={false} />
          <ResizablePanel defaultSize="25%" minSize="15%" maxSize="40%">
            <AssistantPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
