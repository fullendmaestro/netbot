'use client'

import { PanelRightClose, History, SquarePen, MoreHorizontal } from 'lucide-react'
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
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { toolkit } from './tools/toolkit'

const ADK_URL = 'http://localhost:8000'
const APP_NAME = 'copilot'
const USER_ID = 'user_1'

const { adapter, load } = createAdkSessionAdapter({
  apiUrl: ADK_URL,
  appName: APP_NAME,
  userId: USER_ID
})

export function AssistantPanel() {
  const runtime = useAdkRuntime({
    stream: createAdkStream({
      api: ADK_URL,
      appName: APP_NAME,
      userId: USER_ID
    }),
    sessionAdapter: adapter,
    load
  })

  const config = AuiConfig({ tools: Tools({ toolkit }) })

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <Card className="shrink-0 flex flex-col rounded-xl overflow-hidden border gap-0 p-0 h-[calc(100svh-1rem)]">
        <CardHeader className="flex h-12 flex-row items-center justify-between px-3 py-2 border-b bg-muted/50 rounded-t-xl rounded-b-none">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
            Netbot Assistant
          </CardTitle>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon-sm">
              <SquarePen className="size-4" />
            </Button>
            <Popover>
              <PopoverTrigger>
                <Button variant="ghost" size="icon-sm">
                  <History className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0 h-[500px] flex flex-col overflow-hidden">
                <ThreadList />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm">
              <PanelRightClose className="size-4" />
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
