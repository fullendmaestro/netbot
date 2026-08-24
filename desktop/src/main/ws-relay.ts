// desktop/src/main/ws-relay.ts
import WebSocket from 'ws';
import { SessionManager } from './session-manager';
import { DeviceStore } from './device-store';

export class AgentRelayClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private clientId: string;
  private sessionManager: SessionManager;
  private deviceStore: DeviceStore;
  private isReconnecting = false;

  constructor(serverUrl: string, clientId: string, sessionManager: SessionManager, deviceStore: DeviceStore) {
    this.serverUrl = serverUrl;
    this.clientId = clientId;
    this.sessionManager = sessionManager;
    this.deviceStore = deviceStore;
  }

  connect() {
    const wsUrl = `${this.serverUrl}/ws/bridge/${this.clientId}`;
    console.log(`[WS Relay] Connecting to ${wsUrl}...`);

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('[WS Relay] Connected to cloud agent backend.');
      this.isReconnecting = false;
    });

    this.ws.on('message', async (data: WebSocket.RawData) => {
      try {
        const text = data.toString();
        const message = JSON.parse(text);
        if (message.type === 'rpc_request' && message.action === 'execute_command') {
          await this.handleExecuteCommand(message.rpcId, message.params);
        }
      } catch (err) {
        console.error('[WS Relay] Message error:', err);
      }
    });

    this.ws.on('close', () => {
      console.warn('[WS Relay] Connection closed. Retrying in 4s...');
      this.reconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[WS Relay] Socket error:', err.message);
      this.ws?.close();
    });
  }

  private async handleExecuteCommand(rpcId: string, params: { deviceIdentifier: string; command: string; timeoutMs?: number }) {
    try {
      const { deviceIdentifier, command, timeoutMs } = params;
      const devices = this.deviceStore.getDevices();
      const target = devices.find(
        (d) => d.id === deviceIdentifier || (d.name && d.name.toLowerCase() === deviceIdentifier.toLowerCase())
      );

      if (!target) {
        throw new Error(`Device '${deviceIdentifier}' not found on local machine.`);
      }

      const agentSession = await this.sessionManager.getOrSpawnAgentSession(target);
      
      const output = await this.sessionManager.executeCommand(agentSession.sessionId, command, timeoutMs || 3500);


      this.ws?.send(
        JSON.stringify({
          type: 'rpc_response',
          rpcId,
          success: true,
          output: output || '(No output received)',
        })
      );
    } catch (err: any) {
      this.ws?.send(
        JSON.stringify({
          type: 'rpc_response',
          rpcId,
          success: false,
          error: err.message,
        })
      );
    }
  }

  private reconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    setTimeout(() => this.connect(), 4000);
  }
}