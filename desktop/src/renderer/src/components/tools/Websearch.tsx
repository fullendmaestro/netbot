import type { ToolCallMessagePartComponent } from '@assistant-ui/react'
import { Loader, SearchIcon } from 'lucide-react'

export type SearchResult = {
  title: string
  url: string
  snippet: string
}

export const WebSearchToolUI: ToolCallMessagePartComponent<{ query: string }, any> = ({
  args,
  status,
  result
}) => {
  let searchResults: SearchResult[] | undefined

  // Safely unwrap the ADK's nested JSON structure
  try {
    if (typeof result === 'string') {
      const firstParse = JSON.parse(result)

      // Check if the inner result is also a string (double-stringified)
      if (firstParse.result && typeof firstParse.result === 'string') {
        const secondParse = JSON.parse(firstParse.result)
        searchResults = secondParse.results
      } else {
        searchResults = firstParse.results
      }
    } else if (result && typeof result === 'object') {
      // Handle case where the outer layer is an object but inner is a string
      if (result.result && typeof result.result === 'string') {
        const innerParse = JSON.parse(result.result)
        searchResults = innerParse.results
      } else {
        searchResults = result.results || result.result?.results
      }
    }
  } catch (e) {
    console.error('Failed to parse nested result payload:', e)
  }

  return (
    <div className="search-container">
      <div className="mb-3 flex items-center gap-2">
        <SearchIcon />
        <span>Search results for: "{args.query}"</span>
      </div>

      {status.type === 'running' && <Loader className="animate-spin" />}

      {searchResults && Array.isArray(searchResults) && (
        <div className="space-y-2">
          {searchResults.map((item, index) => (
            <div key={index} className="rounded border p-3">
              <a href={item.url} className="font-medium text-blue-600">
                {item.title}
              </a>
              <p className="text-sm text-gray-600">{item.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
