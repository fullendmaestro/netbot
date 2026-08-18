import { useState, useEffect } from "react";
import { SummaryCards } from "./SummaryCards";
import { DeviceTable } from "./DeviceTable";
import { TerminalPanel } from "./TerminalPanel";
import { XIcon } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/resizable";
import type { DeviceConfig } from "../../../shared/types";

interface TerminalTab {
  sessionId: string;
  device: DeviceConfig;
}

export function WorkspaceArea() {
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

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
        <div className="flex flex-1 flex-col h-full overflow-y-auto">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 md:px-6">
            <SummaryCards />
            <DeviceTable />
          </div>
        </div>
      </ResizablePanel>
      {isTerminalOpen && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={30} minSize={10}>
            <div className="flex flex-col h-full bg-[#09090b]">
              {/* Tab Bar */}
              <div className="flex overflow-x-auto border-y border-border bg-muted/10">
                {terminalTabs.map(tab => (
                  <div
                    key={tab.sessionId}
                    onClick={() => setActiveTabId(tab.sessionId)}
                    className={`group flex items-center min-w-32 max-w-48 h-9 px-3 border-r border-border cursor-pointer select-none
                      ${activeTabId === tab.sessionId ? 'bg-[#09090b] text-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'}`}
                  >
                    <span className="truncate flex-1 text-sm font-medium">
                      {tab.device.name || (tab.device.type === 'ssh' ? tab.device.host : tab.device.path) || 'Terminal'}
                    </span>
                    <button
                      onClick={(e) => closeTab(tab.sessionId, e)}
                      className="ml-2 p-0.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted/50 hover:text-foreground transition-opacity"
                      title="Close Tab"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Terminal Views */}
              <div className="relative flex-1">
                {terminalTabs.map(tab => (
                  <div key={tab.sessionId} className={`absolute inset-0 ${activeTabId === tab.sessionId ? 'block' : 'hidden'}`}>
                    <TerminalPanel sessionId={tab.sessionId} visible={activeTabId === tab.sessionId} />
                  </div>
                ))}
              </div>
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
