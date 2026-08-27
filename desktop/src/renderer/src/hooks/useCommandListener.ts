import { useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export function useCommandListener(projectId: string | null) {
  useEffect(() => {
    if (!projectId) return;

    const commandsRef = collection(db, 'projects', projectId, 'commands');
    const q = query(commandsRef, where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const commandDoc = change.doc;
          const data = commandDoc.data();
          const commandId = commandDoc.id;
          console.log(`[CommandListener] Picked up pending command ${commandId}:`, data);

          // Optimistically mark as running to prevent duplicate executions
          try {
             await updateDoc(doc(db, 'projects', projectId, 'commands', commandId), {
               status: 'running'
             });
          } catch (e: any) {
             console.error("Failed to update status to running", e);
             alert("Failed to update status to running: " + e.message);
             return;
          }

          try {
            console.log(`[CommandListener] Executing command ${commandId} on ${data.deviceIdentifier}`);
            // @ts-ignore
            const output = await window.api.executeAgentCommand(data.deviceIdentifier, data.command);
            
            console.log(`[CommandListener] Command ${commandId} completed, updating status`);
            await updateDoc(doc(db, 'projects', projectId, 'commands', commandId), {
              status: 'completed',
              output
            });
          } catch (error: any) {
            console.error(`[CommandListener] Command ${commandId} failed:`, error);
            try {
              await updateDoc(doc(db, 'projects', projectId, 'commands', commandId), {
                status: 'error',
                error: error.message || String(error)
              });
            } catch (err: any) {
              alert("Failed to write error status to DB: " + err.message);
            }
          }
        }
      });
    }, (error) => {
      console.error("onSnapshot error:", error);
      alert("Firestore listener error: " + error.message);
    });

    return () => unsubscribe();
  }, [projectId]);
}
