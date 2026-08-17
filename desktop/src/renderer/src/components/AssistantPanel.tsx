"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAdkRuntime, createAdkStream, createAdkSessionAdapter } from "@assistant-ui/react-google-adk";
import { Thread } from "./assistant-ui/thread";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const ADK_URL = "http://localhost:8000";
const APP_NAME = "copilot";
const USER_ID = "user_1";

const { adapter, load } = createAdkSessionAdapter({
  apiUrl: ADK_URL,
  appName: APP_NAME,
  userId: USER_ID,
});

export function AssistantPanel() {
  const runtime = useAdkRuntime({
    stream: createAdkStream({
      api: ADK_URL,
      appName: APP_NAME,
      userId: USER_ID
    }),
    sessionAdapter: adapter,
    load,
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
