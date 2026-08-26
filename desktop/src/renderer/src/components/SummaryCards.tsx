import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DeviceConfig } from "../../../shared/types";

export function SummaryCards({ devices }: { devices: DeviceConfig[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:grid-cols-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardDescription>Devices</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums md:text-3xl">
            {devices.length}
          </CardTitle>
        </CardHeader>
      </Card>
      {/* Add more <Card> components */}
    </div>
  )
}