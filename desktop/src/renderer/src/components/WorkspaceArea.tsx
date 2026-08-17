import { SummaryCards } from "./SummaryCards";
import { DeviceTable } from "./DeviceTable";
import { TerminalPanel } from "./TerminalPanel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/resizable";

export function WorkspaceArea() {
  return (
    <ResizablePanelGroup direction="vertical" className="w-full h-full">
      <ResizablePanel defaultSize={70} minSize={30}>
        <div className="flex flex-1 flex-col h-full overflow-y-auto">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 md:px-6">
            <SummaryCards />
            <DeviceTable />
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={30} minSize={10}>
        <TerminalPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
