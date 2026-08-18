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

  // Helper function to extract and format live CSS variables
  const getThemeColors = () => {
    if (typeof window === "undefined") return { bg: "#18181b", fg: "#f4f4f5" };

    const rootStyles = getComputedStyle(document.documentElement);
    // Grab the live shadcn sidebar colors (automatically converted to rgb/rgba by the browser)
    const bg = rootStyles.getPropertyValue("--sidebar").trim();
    const fg = rootStyles.getPropertyValue("--sidebar-foreground").trim();
    const cursor = rootStyles.getPropertyValue("--sidebar-foreground").trim();

    return { bg, fg, cursor };
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    const initialColors = getThemeColors();

    // 1. Initialize xterm with live shadcn sidebar variables
    const term = new Terminal({
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: initialColors.bg,
        foreground: initialColors.fg,
        cursor: initialColors.cursor,
      }
    });

    xtermRef.current = term;
    term.open(terminalRef.current);

    // 2. Watch for theme changes (.dark class added/removed on html tag)
    const observer = new MutationObserver(() => {
      const updatedColors = getThemeColors();
      term.options.theme = {
        background: updatedColors.bg,
        foreground: updatedColors.fg,
        cursor: updatedColors.cursor,
      };
      term.refresh(0, term.rows - 1);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // 3. Setup core logic stream
    const removeListener = (window as any).api.onTerminalData((payload: { sessionId: string, data: string }) => {
      if (payload.sessionId === sessionId) {
        term.write(payload.data);
      }
    });

    const dataDisposable = term.onData((data) => {
      (window as any).api.sendTerminalInput(sessionId, data);
    });

    // Render cleanup on layout shifts
    setTimeout(() => term.refresh(0, term.rows - 1), 50);

    return () => {
      observer.disconnect();
      dataDisposable.dispose();
      if (typeof removeListener === "function") removeListener();
      term.dispose();
    };
  }, [sessionId]);

  // Clean redraw when panel toggles visibility
  useEffect(() => {
    if (visible && xtermRef.current) {
      xtermRef.current.refresh(0, xtermRef.current.rows - 1);
    }
  }, [visible]);

  return (
    <div
      className={`w-full h-full p-2 bg-sidebar text-sidebar-foreground ${visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none absolute"
        }`}
    >
      <div className="w-full h-full overflow-hidden" ref={terminalRef}></div>
    </div>
  );
}
