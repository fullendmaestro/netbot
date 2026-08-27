import { DevicesWorkspace } from "./DevicesWorkspace";
import { TopologyWorkspace } from "./TopologyWorkspace";

interface WorkspaceAreaProps {
  projectId: string;
  activeView: string;
}

export function WorkspaceArea({ projectId, activeView }: WorkspaceAreaProps) {
  if (activeView === "devices") {
    return <DevicesWorkspace projectId={projectId} />;
  }
  
  if (activeView === "topology") {
    return <TopologyWorkspace projectId={projectId} />;
  }

  return <div className="p-4 text-white">Unknown view: {activeView}</div>;
}
