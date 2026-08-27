import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, collection } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const GNS3_SERVER_URL = "http://34.121.48.145:3080";

export function TopologyWorkspace({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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
      setSelectedProjectId(created.id);
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
            value={selectedProjectId || ""}
            onChange={(e) => setSelectedProjectId(e.target.value)}
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
        {selectedProjectId ? (
          <iframe 
            src={`${GNS3_SERVER_URL.replace(/\/$/, '')}/static/web-ui/server/1/project/${selectedProjectId}`}
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
