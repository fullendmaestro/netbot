'use client'

import { useState } from 'react'
import { X, History, MoreHorizontal } from 'lucide-react'
import { AssistantRuntimeProvider, AuiConfig, Tools } from '@assistant-ui/react'
import {
  useAdkRuntime,
  createAdkStream,
  createAdkSessionAdapter
} from '@assistant-ui/react-google-adk'
import { Thread } from './assistant-ui/thread'
import { ThreadList } from './assistant-ui/thread-list'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { CommandDialog } from './ui/command'
import { toolkit } from './tools/toolkit'
import { User } from '../firebase'
import { useStore } from '../store'

const ADK_URL = 'http://localhost:8000'

export function AssistantPanel({ user, projectId }: { user: User, projectId: string }) {
  const [historyOpen, setHistoryOpen] = useState(false)
  
  const { activeView, selectedGns3Project } = useStore();
  const currentAppName = activeView.toLowerCase() === 'topology' ? 'gns3' : 'copilot';
  
  // Initialize adapter with dynamic user
  const { adapter, load } = createAdkSessionAdapter({
    apiUrl: ADK_URL,
    appName: currentAppName,
    userId: user.uid
  });

  let injected = false;
  const baseStream = createAdkStream({
    api: ADK_URL,
    appName: currentAppName,
    userId: user.uid
  });

  const stream: typeof baseStream = (messages, config) => {
    if (!injected) {
      injected = true;
      const stateDelta: Record<string, any> = { ...config?.stateDelta, project_id: projectId };
      if (activeView.toLowerCase() === 'topology' && selectedGns3Project) {
        stateDelta.gns3_project_id = selectedGns3Project;
      }
      config = { 
        ...config, 
        stateDelta
      };
    }
    return baseStream(messages, config);
  };

  const runtime = useAdkRuntime({
    stream,
    sessionAdapter: adapter,
    load
  })

  const config = AuiConfig({ tools: Tools({ toolkit }) })

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <Card className="shrink-0 flex flex-col rounded-xl overflow-hidden border gap-0 p-0 h-full">
        <CardHeader className="flex h-12 flex-row items-center justify-between px-3 py-2 border-b bg-muted/50 rounded-t-xl rounded-b-none">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
            Netbot Assistant
          </CardTitle>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon-sm" onClick={() => setHistoryOpen(true)}>
              <History className="size-4" />
            </Button>
            <CommandDialog open={historyOpen} onOpenChange={setHistoryOpen} className="flex flex-col">
              <ThreadList />
            </CommandDialog>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm">
              <X className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden [&_>_div]:h-full rounded-b-xl">
          <Thread />
        </CardContent>
      </Card>
    </AssistantRuntimeProvider>
  )
}
