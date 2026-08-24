import { useEffect, useRef } from 'react'
import type { ToolCallMessagePartComponent } from '@assistant-ui/react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { TerminalSquare, Loader2 } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'

export const RunTerminalCommandUI: ToolCallMessagePartComponent<{ device_identifier: string, command: string }, any> = ({
  args,
  status,
  result
}) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termInstance = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!terminalRef.current) return

    if (!termInstance.current) {
      termInstance.current = new Terminal({
        cols: 80,
        rows: 24,
        theme: {
          background: '#1e1e1e',
        },
        fontFamily: 'monospace',
        disableStdin: true
      })
      fitAddon.current = new FitAddon()
      termInstance.current.loadAddon(fitAddon.current)
      termInstance.current.open(terminalRef.current)
      
      termInstance.current.writeln(`\x1b[1;34m$ ${args.command}\x1b[0m\r\n`)
    }

    const fit = () => {
      try {
        fitAddon.current?.fit()
      } catch (e) {}
    }
    
    // Slight delay to ensure DOM is ready
    setTimeout(fit, 10)
    window.addEventListener('resize', fit)

    return () => {
      window.removeEventListener('resize', fit)
      termInstance.current?.dispose()
      termInstance.current = null
    }
  }, [args.command])

  useEffect(() => {
    if (termInstance.current && result) {
      let outputStr = ''
      try {
        if (typeof result === 'string') {
          const firstParse = JSON.parse(result)
          if (firstParse.result && typeof firstParse.result === 'string') {
            outputStr = firstParse.result
          } else {
            outputStr = result
          }
        } else if (result && typeof result === 'object') {
           if (result.result) {
             outputStr = result.result
           } else {
             outputStr = JSON.stringify(result, null, 2)
           }
        }
      } catch(e) {
         if (typeof result === 'string') {
           outputStr = result
         }
      }
      
      const formatted = outputStr.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
      termInstance.current.writeln(formatted)
    }
  }, [result])

  return (
    <div className="flex flex-col border rounded-md overflow-hidden my-2 bg-background w-full">
       <div className="flex items-center gap-2 px-3 py-2 bg-muted text-muted-foreground text-xs border-b">
         <TerminalSquare className="size-4" />
         <span className="font-medium font-mono">{args.device_identifier || 'Unknown Device'}</span>
         {status.type === 'running' && (
           <div className="ml-auto flex items-center gap-1.5 text-blue-500">
             <Loader2 className="size-3.5 animate-spin" />
             <span>Running</span>
           </div>
         )}
         {status.type === 'complete' && (
           <span className="ml-auto text-green-500">Completed</span>
         )}
       </div>
       <div className="bg-[#1e1e1e] p-2">
         <div ref={terminalRef} className="overflow-hidden w-full h-[250px]" />
       </div>
    </div>
  )
}
