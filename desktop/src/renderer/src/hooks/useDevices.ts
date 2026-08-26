import { useEffect, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import { DeviceConfig } from "../../../shared/types";

export function useDevices(projectId: string | null) {
  const [devices, setDevices] = useState<DeviceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) {
      setDevices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "projects", projectId, "devices"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          type: data.type,
          host: data.host,
          port: data.port,
          username: data.username,
          authType: data.authType,
          password: data.password,
          privateKey: data.privateKey,
          path: data.path,
          baudRate: data.baudRate,
          connectionStatus: "Offline", // Initial state
        } as DeviceConfig;
      });
      setDevices(fetched);
      setLoading(false);
      
      // Sync to main process
      // @ts-ignore
      if (window.api && window.api.syncDevices) {
        // @ts-ignore
        window.api.syncDevices(fetched);
      }
    }, (err) => {
      console.error("Error fetching devices from Firestore", err);
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

  return { devices, loading, error };
}
