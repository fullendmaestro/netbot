import { useState, useEffect } from "react";
import { useDevices } from "../hooks/useDevices";
import { SummaryCards } from "./SummaryCards";
import { DeviceTable } from "./DeviceTable";
import { TerminalPanel } from "./TerminalPanel";
import { XIcon } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/resizable";
import { Card } from "./ui/card";
import type { DeviceConfig } from "../../../shared/types";
import { cn } from "@/lib/utils";

interface TerminalTab {
  sessionId: string;
  device: DeviceConfig;
}

export function WorkspaceArea({ projectId }: { projectId: string }) {
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  
  const { devices, loading } = useDevices(projectId);

  useEffect(() => {
    const handleOpenTerminalTab = (e: Event) => {
      const customEvent = e as CustomEvent<{ sessionId: string, device: DeviceConfig }>;
      const { sessionId, device } = customEvent.detail;

      setTerminalTabs(prev => {
        if (!prev.find(t => t.sessionId === sessionId)) {
          return [...prev, { sessionId, device }];
        }
        return prev;
      });
      setActiveTabId(sessionId);
    };

    window.addEventListener('open-terminal-tab', handleOpenTerminalTab);
    return () => window.removeEventListener('open-terminal-tab', handleOpenTerminalTab);
  }, []);

  const closeTab = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Disconnect backend
    (window as any).api.disconnectDevice(sessionId);

    setTerminalTabs(prev => {
      const newTabs = prev.filter(t => t.sessionId !== sessionId);
      if (activeTabId === sessionId) {
        // If we're closing the active tab, switch to the last available one
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].sessionId : null);
      }
      return newTabs;
    });
  };

  const isTerminalOpen = terminalTabs.length > 0;

  return (
    <ResizablePanelGroup orientation="vertical" className="w-full h-full">
      <ResizablePanel defaultSize={isTerminalOpen ? 70 : 100} minSize={30}>
        <Card className="flex flex-col flex-1 h-full rounded-xl overflow-hidden bg-background border gap-0 p-0">
          <div className="flex flex-1 flex-col h-full overflow-y-auto">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 md:px-6">
              <SummaryCards devices={devices} />
              <DeviceTable projectId={projectId} devices={devices} loading={loading} />
            </div>
          </div>
        </Card>
      </ResizablePanel>
      {isTerminalOpen && (
        <>
          <ResizableHandle withHandle={false} />
          <ResizablePanel defaultSize={30} minSize={10}>
            <Card className="flex flex-col h-full rounded-xl overflow-hidden border gap-0 p-0">
              {/* Tab Bar */}
              <div className="flex items-center gap-1 px-2 pt-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {terminalTabs.map(tab => (
                  <div
                    key={tab.sessionId}
                    onClick={() => setActiveTabId(tab.sessionId)}
                    className={cn(
                      "group relative flex items-center max-w-48 h-7 px-3 rounded-md cursor-pointer select-none text-sm font-medium transition-colors",
                      activeTabId === tab.sessionId
                        ? "bg-muted/50 text-foreground border-t border-x"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span className="truncate flex-1">
                      {tab.device.name || (tab.device.type === 'ssh' || tab.device.type === 'telnet' ? tab.device.host : tab.device.path) || 'Terminal'}
                    </span>
                    <button
                      onClick={(e) => closeTab(tab.sessionId, e)}
                      className="ml-2 p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Terminal Views */}
              <div className="relative flex-1 bg-[#09090b]">
                {terminalTabs.map(tab => (
                  <div key={tab.sessionId} className={`absolute inset-0 ${activeTabId === tab.sessionId ? 'block' : 'hidden'}`}>
                    <TerminalPanel sessionId={tab.sessionId} visible={activeTabId === tab.sessionId} />
                  </div>
                ))}
              </div>
            </Card>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
