import React from 'react'
import type { AssistantRuntime } from '@assistant-ui/react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'

import { Thread } from './assistant-ui/thread'

interface AssistantProps {
  runtime: AssistantRuntime
}

export function Assistant({ runtime }: AssistantProps): React.ReactElement {

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
