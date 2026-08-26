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

          // Optimistically mark as running to prevent duplicate executions
          try {
             await updateDoc(doc(db, 'projects', projectId, 'commands', commandId), {
               status: 'running'
             });
          } catch (e) {
             console.error("Failed to update status to running", e);
             return;
          }

          try {
            // @ts-ignore
            const output = await window.api.executeAgentCommand(data.deviceIdentifier, data.command);
            
            await updateDoc(doc(db, 'projects', projectId, 'commands', commandId), {
              status: 'completed',
              output
            });
          } catch (error: any) {
            await updateDoc(doc(db, 'projects', projectId, 'commands', commandId), {
              status: 'error',
              error: error.message || String(error)
            });
          }
        }
      });
    });

    return () => unsubscribe();
  }, [projectId]);
}
