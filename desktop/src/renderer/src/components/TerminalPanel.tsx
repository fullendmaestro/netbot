import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#09090b', // dark background to match shadcn
      }
    });

    xtermRef.current = term;
    term.open(terminalRef.current);

    // Listen to data from main process
    (window as any).api.onTerminalData((data: string) => {
      term.write(data);
    });

    // Send input to main process
    term.onData((data) => {
      (window as any).api.sendTerminalInput(data);
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
  }, []);

  return (
    <div className="w-full h-full p-2 bg-[#09090b] text-white">
      <div className="w-full h-full overflow-hidden" ref={terminalRef}></div>
    </div>
  );
}
