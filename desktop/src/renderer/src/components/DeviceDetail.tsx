import { ArrowLeftIcon } from "lucide-react";
import { useStore } from "../store";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export function DeviceDetail() {
  const { selectedDevice, setSelectedDevice } = useStore();

  if (!selectedDevice) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-4 p-4 lg:p-6 border-b">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDevice(null)}>
          <ArrowLeftIcon className="size-5" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="text-xl font-bold">{selectedDevice.name || selectedDevice.host || selectedDevice.path}</h1>
      </div>

      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ports">Ports</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Overview content will be displayed here.</p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="ports">
            <Card>
              <CardHeader>
                <CardTitle>Ports</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Ports content will be displayed here.</p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Alerts content will be displayed here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
