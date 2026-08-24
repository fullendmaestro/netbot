'use generative'

import { defineToolkit } from '@assistant-ui/react'
import { RunTerminalCommandUI } from './RunTerminalCommand'

export const toolkit = defineToolkit({
  run_terminal_command: {
    type: 'backend',
    render: RunTerminalCommandUI
  }
})
