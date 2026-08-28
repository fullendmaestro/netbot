import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot, setDoc, collection } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useStore } from "../store";

const GNS3_SERVER_URL = import.meta.env.VITE_GNS3_SERVER_URL;

export function TopologyWorkspace({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const { selectedGns3Project, setSelectedGns3Project } = useStore();
  
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const webviewRef = useRef<any>(null);
  const hasBootstrapped = useRef(false);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) {
      hasBootstrapped.current = false;
      return;
    }

    const handleNavigate = (e: any) => {
      // GNS3 Angular UI boots at / and then redirects to /servers or /projects once authenticated/ready
      if (e.url.includes('/servers') || e.url.includes('/projects')) {
        if (!hasBootstrapped.current) {
          hasBootstrapped.current = true;
          if (selectedGns3Project) {
            const targetUrl = `${GNS3_SERVER_URL.replace(/\/$/, '')}/static/web-ui/server/1/project/${selectedGns3Project}`;
            webview.loadURL(targetUrl);
          }
        }
      }
    };

    webview.addEventListener('did-navigate', handleNavigate);
    webview.addEventListener('did-navigate-in-page', handleNavigate);

    return () => {
      webview.removeEventListener('did-navigate', handleNavigate);
      webview.removeEventListener('did-navigate-in-page', handleNavigate);
    };
  }, [selectedGns3Project]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !selectedGns3Project) return;

    if (hasBootstrapped.current) {
      const targetUrl = `${GNS3_SERVER_URL.replace(/\/$/, '')}/static/web-ui/server/1/project/${selectedGns3Project}`;
      try {
        if (webview.getURL() !== targetUrl) {
          webview.loadURL(targetUrl);
        }
      } catch (e) {
        webview.loadURL(targetUrl);
      }
    }
  }, [selectedGns3Project]);

  useEffect(() => {
    // Just a small delay to prevent layout shift while checking if anything needs loading
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "projects", projectId, "gns3_projects"), (snap) => {
      const fetched = snap.docs.map(d => d.data());
      setProjects(fetched);
    });
    return () => unsub();
  }, [projectId]);

  const handleCreateProject = async () => {
    if (!newProjectName) return;
    setIsCreating(true);
    try {
      const resp = await fetch("http://127.0.0.1:8000/api/gns3/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newProjectName,
          gns3ServerUrl: GNS3_SERVER_URL,
          netbotProjectId: projectId
        })
      });
      
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to create project");
      }
      
      const created = await resp.json();
      setSelectedGns3Project(created.id);
      setNewProjectName("");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) return <div className="p-4 text-white">Loading...</div>;

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-white overflow-hidden rounded-xl border border-zinc-800">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-lg">Topology</h2>
          <select 
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 min-w-[200px]"
            value={selectedGns3Project || ""}
            onChange={(e) => setSelectedGns3Project(e.target.value)}
          >
            <option value="">Select a Project...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <Input 
            placeholder="New project name" 
            className="w-48 bg-zinc-900 border-zinc-700 h-9" 
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <Button size="sm" className="h-9" onClick={handleCreateProject} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 relative bg-black">
        {selectedGns3Project ? (
          <webview
            ref={webviewRef}
            src={GNS3_SERVER_URL}
            className="w-full h-full border-0 absolute inset-0"
            title="GNS3 Web UI"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500">
            Select or create a project to view topology
          </div>
        )}
      </div>
    </div>
  );
}
