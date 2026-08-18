import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

interface TerminalPanelProps {
  sessionId: string;
  visible: boolean;
}

export function TerminalPanel({ sessionId, visible }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#18181b', // dark background to match shadcn
      }
    });

    xtermRef.current = term;
    term.open(terminalRef.current);

    // Listen to data from main process
    (window as any).api.onTerminalData((payload: { sessionId: string, data: string }) => {
      if (payload.sessionId === sessionId) {
        term.write(payload.data);
      }
    });

    // Send input to main process
    term.onData((data) => {
      (window as any).api.sendTerminalInput(sessionId, data);
    });

    // Handle resize (basic approach, better with xterm-addon-fit)
    const handleResize = () => {
      // term.resize() needs proper dimensions. Without fit addon, we let it be for now or add a basic resize
    };
    window.addEventListener('resize', handleResize);

    return () => {
      // cleanup
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [sessionId]);

  return (
    <div className={`w-full h-full p-2 bg-[#09090b] text-white ${visible ? 'block' : 'hidden'}`}>
      <div className="w-full h-full overflow-hidden" ref={terminalRef}></div>
    </div>
  );
}
