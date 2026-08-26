import { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db, User } from "../firebase";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function ProjectSelection({ user, onProjectSelect }: { user: User, onProjectSelect: (id: string) => void }) {
  const [projects, setProjects] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const q = query(collection(db, "projects"), where("ownerUid", "==", user.uid));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
        setProjects(fetched);
      } catch (e) {
        console.error("Error fetching projects", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [user]);

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      const docRef = await addDoc(collection(db, "projects"), {
        name: newProjectName.trim(),
        ownerUid: user.uid,
        createdAt: serverTimestamp()
      });
      setProjects([...projects, { id: docRef.id, name: newProjectName.trim() }]);
      setNewProjectName("");
      onProjectSelect(docRef.id);
    } catch (e) {
      console.error("Error creating project", e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h1 className="text-3xl font-bold mb-6">Select a Project</h1>
          {loading ? (
            <p>Loading projects...</p>
          ) : projects.length === 0 ? (
            <p className="text-zinc-400">No projects found. Create one to get started.</p>
          ) : (
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2">
              {projects.map(p => (
                <Card key={p.id} className="cursor-pointer hover:border-zinc-500 transition-colors bg-zinc-900 border-zinc-800 text-white" onClick={() => onProjectSelect(p.id)}>
                  <CardHeader>
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    <CardDescription className="text-zinc-400">Project ID: {p.id}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex flex-col justify-center">
          <Card className="bg-zinc-900 border-zinc-800 text-white">
            <CardHeader>
              <CardTitle>Create New Project</CardTitle>
              <CardDescription className="text-zinc-400">Start managing a new infrastructure environment.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Label htmlFor="projectName">Project Name</Label>
                <Input 
                  id="projectName"
                  value={newProjectName} 
                  onChange={(e) => setNewProjectName(e.target.value)} 
                  placeholder="e.g. Acme Corp Network" 
                  className="bg-zinc-950 border-zinc-800 text-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleCreate} disabled={!newProjectName.trim() || creating} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                {creating ? "Creating..." : "Create Project"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
