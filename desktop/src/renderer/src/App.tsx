"use client";

import {
  AssistantRuntimeProvider,
  AssistantTransportConnectionMetadata,
  useAssistantTransportRuntime,
  unstable_createMessageConverter as createMessageConverter,
} from "@assistant-ui/react";
import { Assistant } from "./components/Assistant";

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
    <main className="h-screen bg-zinc-950">
      <AssistantRuntimeProvider runtime={runtime}>
        <Assistant />
      </AssistantRuntimeProvider>
    </main>
  )
}

export default App
