import { SummaryCards } from "./SummaryCards";
import { DeviceTable } from "./DeviceTable";

const dummyDevices = [
  { id: 1, name: "core-router-01", ipAddress: "192.168.1.1", type: "Router", connection: "Connected" },
  { id: 2, name: "core-switch-01", ipAddress: "192.168.1.2", type: "Switch", connection: "Connected" },
  { id: 3, name: "edge-firewall-01", ipAddress: "10.0.0.1", type: "Firewall", connection: "Offline" },
  { id: 4, name: "access-switch-01", ipAddress: "192.168.2.10", type: "Switch", connection: "Connected" },
  { id: 5, name: "access-switch-02", ipAddress: "192.168.2.11", type: "Switch", connection: "Connected" },
];

export function WorkspaceArea() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 md:px-6">
        <SummaryCards />
        <DeviceTable data={dummyDevices} />
      </div>
    </div>
  );
}
