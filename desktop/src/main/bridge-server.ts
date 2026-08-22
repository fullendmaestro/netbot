import http from 'node:http';
import { DeviceDatabase } from './db';
import { SessionManager } from './session-manager';

export function startBridgeServer(db: DeviceDatabase, sessionManager: SessionManager, port = 3001) {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${port}`);

    // GET /api/devices
    if (req.method === 'GET' && url.pathname === '/api/devices') {
      const devices = db.getDevices();
      const activeSessions = sessionManager.getActiveSessions();
      const payload = devices.map((dev) => ({
        ...dev,
        connected: activeSessions.some((s) => s.deviceId === dev.id),
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }

    // POST helper
    const readJsonBody = async (): Promise<any> => {
      return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            reject(e);
          }
        });
      });
    };

    // POST /api/execute-command
    if (req.method === 'POST' && url.pathname === '/api/execute-command') {
      try {
        const { deviceId, deviceName, command, timeoutMs } = await readJsonBody();
        const devices = db.getDevices();

        const target = devices.find(
          (d) => d.id === deviceId || (deviceName && d.name.toLowerCase() === deviceName.toLowerCase())
        );

        if (!target) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Device not found: ${deviceId || deviceName}` }));
          return;
        }

        // Auto-connect if not connected
        let active = sessionManager.getSessionByDeviceId(target.id);
        let sessionId = active?.sessionId;
        if (!sessionId) {
          sessionId = await sessionManager.connect(target);
        }

        const output = await sessionManager.executeCommand(sessionId, command, timeoutMs || 3000);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, device: target.name, output }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[Bridge Server] Listening on http://127.0.0.1:${port}`);
  });

  return server;
}