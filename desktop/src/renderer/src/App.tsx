"use client";

import {
  AssistantRuntimeProvider,
  AssistantTransportConnectionMetadata,
  useAssistantTransportRuntime,
  unstable_createMessageConverter as createMessageConverter,
} from "@assistant-ui/react";
import { Thread } from "./components/assistant-ui/thread";
import { AppSidebar } from "./components/AppSidebar";
import { DeviceTable } from "./components/DeviceTable";
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar";

type Message = { role: "user" | "assistant"; parts: any[] };
type State = { messages: Message[] };

const messageConverter = createMessageConverter((message: Message) => {
  return {
    role: message.role,
    content: message.parts || [],
  };
});

const converter = (
  state: State,
  connectionMetadata: AssistantTransportConnectionMetadata,
) => {
  const optimistic = connectionMetadata.pendingCommands
    .filter((c) => c.type === "add-message")
    .map((c) => c.message as Message);

  const allMessages = [...(state.messages || []), ...optimistic];

  return {
    messages: messageConverter.toThreadMessages(allMessages),
    isRunning: connectionMetadata.isSending || false,
  };
};

const dummyDevices = [
  { id: 1, name: "core-router-01", ipAddress: "192.168.1.1", type: "Router", connection: "Connected" },
  { id: 2, name: "core-switch-01", ipAddress: "192.168.1.2", type: "Switch", connection: "Connected" },
  { id: 3, name: "edge-firewall-01", ipAddress: "10.0.0.1", type: "Firewall", connection: "Offline" },
  { id: 4, name: "access-switch-01", ipAddress: "192.168.2.10", type: "Switch", connection: "Connected" },
  { id: 5, name: "access-switch-02", ipAddress: "192.168.2.11", type: "Switch", connection: "Connected" },
];

export function App() {
  const runtime = useAssistantTransportRuntime({
    initialState: { messages: [] },
    api: "http://localhost:8010/assistant", // your assistant-transport-backend URL
    converter,
    headers: {},
    prepareSendCommandsRequest: (body) => {
      console.log("Sending request to backend", body);
      return body;
    },
    onError: (error) => {
      console.error("Assistant Transport Error:", error);
    }
  });

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "16rem",
      } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 flex-row overflow-hidden bg-background">
          
          {/* Main Workspace Area (Device Table) */}
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <DeviceTable data={dummyDevices} />
            </div>
          </div>

          {/* Auxiliary Bar (Assistant Chat) */}
          <div className="w-[340px] shrink-0 flex flex-col border-l border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center px-4 h-10 bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium tracking-wide uppercase">
              Netbot Assistant
            </div>
            <div className="flex-1 overflow-hidden [&_>_div]:h-full">
              <AssistantRuntimeProvider runtime={runtime}>
                <Thread />
              </AssistantRuntimeProvider>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
