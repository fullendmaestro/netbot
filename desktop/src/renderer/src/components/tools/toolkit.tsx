'use generative'

import { defineToolkit } from '@assistant-ui/react'
import { ExecuteCommandUI } from './ExecuteCommand'

export const toolkit = defineToolkit({
  execute_command: {
    type: 'backend',
    render: ExecuteCommandUI
  }
})
