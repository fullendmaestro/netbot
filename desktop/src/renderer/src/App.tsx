"use client";

import { useEffect, useState } from "react";
import { auth, googleProvider, signInWithPopup, onAuthStateChanged, User } from "./firebase";
import { AppSidebar } from "./components/AppSidebar";
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar";
import { WorkspaceArea } from "./components/WorkspaceArea";
import { AssistantPanel } from "./components/AssistantPanel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./components/ui/resizable";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          // @ts-ignore
          window.api.setAuthToken(token);
        } catch (e) {
          console.error("Failed to get token:", e);
        }
      } else {
        // @ts-ignore
        window.api.setAuthToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      setAuthError(e.message);
    }
  };

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white flex-col gap-4">
        <h1 className="text-2xl font-bold">Welcome to NetBot Agent</h1>
        <button 
          onClick={handleSignIn}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          Sign in with Google
        </button>
        {authError && <p className="text-red-400 max-w-md text-center">{authError}</p>}
      </div>
    );
  }

  return (
    <SidebarProvider
      defaultOpen={false}
      style={{
        "--sidebar-width": "16rem",
      } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel defaultSize="75%" minSize="30%">
            <WorkspaceArea />
          </ResizablePanel>
          <ResizableHandle withHandle={false} />
          <ResizablePanel defaultSize="25%" minSize="15%" maxSize="40%">
            <AssistantPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
