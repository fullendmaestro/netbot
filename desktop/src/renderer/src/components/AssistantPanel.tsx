"use client";

import {
  AssistantRuntimeProvider,
  AssistantTransportConnectionMetadata,
  useAssistantTransportRuntime,
  unstable_createMessageConverter as createMessageConverter,
} from "@assistant-ui/react";
import { Thread } from "./assistant-ui/thread";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

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

export function AssistantPanel() {
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
    <Card className="w-[340px] shrink-0 flex flex-col my-2 mr-2 ml-0 rounded-xl overflow-hidden border gap-0 p-0 h-[calc(100svh-1rem)]">
      <CardHeader className="h-12 px-4 py-3 border-b bg-muted/50 rounded-t-xl rounded-b-none">
        <CardTitle className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
          Netbot Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden [&_>_div]:h-full rounded-b-xl">
        <AssistantRuntimeProvider runtime={runtime}>
          <Thread />
        </AssistantRuntimeProvider>
      </CardContent>
    </Card>
  );
}
