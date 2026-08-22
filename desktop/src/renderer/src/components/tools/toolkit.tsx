'use generative'

import { defineToolkit } from '@assistant-ui/react'
import { WebSearchToolUI } from './Websearch'

export const toolkit = defineToolkit({
  web_search: {
    type: 'backend',
    render: WebSearchToolUI
  }
})
