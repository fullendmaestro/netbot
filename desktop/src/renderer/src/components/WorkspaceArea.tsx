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

export function WorkspaceArea() {
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  useEffect(() => {
    const handleOpenTerminal = () => setIsTerminalOpen(true);
    window.addEventListener('open-terminal', handleOpenTerminal);
    return () => window.removeEventListener('open-terminal', handleOpenTerminal);
  }, []);

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
            <div className="relative h-full">
              <button 
                className="absolute right-4 top-2 z-10 p-1 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-white rounded-md transition-colors" 
                onClick={() => setIsTerminalOpen(false)}
                title="Close Terminal"
              >
                 <XIcon className="size-4" />
              </button>
              <TerminalPanel />
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
