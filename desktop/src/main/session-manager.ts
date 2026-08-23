import { Client } from 'ssh2';
import { SerialPort } from 'serialport';
import { BrowserWindow } from 'electron';
import type { DeviceConfig } from '../shared/types';
import { randomUUID } from 'crypto';

interface Session {
  type: 'ssh' | 'serial';
  deviceId: string;
  sshClient?: Client;
  sshStream?: any;
  serialPort?: SerialPort;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private window?: BrowserWindow;

  constructor(window?: BrowserWindow) {
    this.window = window;
  }

  setWindow(window: BrowserWindow) {
    this.window = window;
  }

  getActiveSessions(): { sessionId: string; deviceId: string; type: string }[] {
    return Array.from(this.sessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      deviceId: session.deviceId,
      type: session.type,
    }));
  }

  getSessionByDeviceId(deviceId: string): { sessionId: string; session: Session } | undefined {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.deviceId === deviceId) {
        return { sessionId, session };
      }
    }
    return undefined;
  }

  async connect(device: DeviceConfig): Promise<string> {
    const existing = this.getSessionByDeviceId(device.id);
    if (existing) return existing.sessionId;

    const sessionId = randomUUID();
    if (device.type === 'ssh') {
      await this.connectSSH(sessionId, device);
    } else if (device.type === 'serial') {
      await this.connectSerial(sessionId, device);
    }
    return sessionId;
  }

  private connectSSH(sessionId: string, device: DeviceConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const sshClient = new Client();
      this.sessions.set(sessionId, { type: 'ssh', deviceId: device.id, sshClient });

      sshClient
        .on('ready', () => {
          this.window?.webContents.send('device-status', { id: device.id, status: 'Connected' });
          sshClient.shell((err, stream) => {
            if (err) {
              this.window?.webContents.send('terminal-data', {
                sessionId,
                data: `\r\n*** SSH Shell Error: ${err.message} ***\r\n`,
              });
              return reject(err);
            }
            const session = this.sessions.get(sessionId);
            if (session) session.sshStream = stream;

            stream
              .on('close', () => {
                this.window?.webContents.send('terminal-data', {
                  sessionId,
                  data: '\r\n*** SSH Connection Closed ***\r\n',
                });
                this.disconnect(sessionId);
              })
              .on('data', (data: Buffer) => {
                this.window?.webContents.send('terminal-data', {
                  sessionId,
                  data: data.toString('utf-8'),
                });
              });

            resolve();
          });
        })
        .on('error', (err) => {
          this.window?.webContents.send('terminal-data', {
            sessionId,
            data: `\r\n*** SSH Error: ${err.message} ***\r\n`,
          });
          this.window?.webContents.send('device-status', { id: device.id, status: 'Offline' });
          reject(err);
        })
        .connect({
          host: device.host,
          port: device.port || 22,
          username: device.username,
          password: device.password,
          privateKey: device.privateKey,
        });
    });
  }

  private connectSerial(sessionId: string, device: DeviceConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!device.path) {
        return reject(new Error('No serial port path provided.'));
      }

      const serialPort = new SerialPort(
        {
          path: device.path,
          baudRate: device.baudRate || 9600,
        },
        (err) => {
          if (err) {
            this.window?.webContents.send('terminal-data', {
              sessionId,
              data: `\r\n*** Serial Error: ${err.message} ***\r\n`,
            });
            this.window?.webContents.send('device-status', { id: device.id, status: 'Offline' });
            return reject(err);
          }
          this.window?.webContents.send('device-status', { id: device.id, status: 'Connected' });
          resolve();
        }
      );

      this.sessions.set(sessionId, { type: 'serial', deviceId: device.id, serialPort });

      serialPort.on('data', (data: Buffer) => {
        this.window?.webContents.send('terminal-data', {
          sessionId,
          data: data.toString('utf-8'),
        });
      });

      serialPort.on('close', () => {
        this.window?.webContents.send('terminal-data', {
          sessionId,
          data: '\r\n*** Serial Connection Closed ***\r\n',
        });
        this.window?.webContents.send('device-status', { id: device.id, status: 'Offline' });
        this.sessions.delete(sessionId);
      });
    });
  }

  /**
   * Sends a command into the active session and collects terminal output.
   */
  async executeCommand(sessionId: string, command: string, timeoutMs = 8000): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`No active session found for session ID: ${sessionId}`);

    return new Promise((resolve) => {
      let output = '';
      
      const cleanCommand = command.replace(/[\r\n]+$/, '');
      // Use \r\n for Windows SSH & Cisco PTY compatibility
      const formattedCommand = `${cleanCommand}\r\n`;

      let inactivityTimer: NodeJS.Timeout | null = null;
      let hardTimeoutTimer: NodeJS.Timeout | null = null;
      let hasReceivedData = false;

      const finish = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        if (hardTimeoutTimer) clearTimeout(hardTimeoutTimer);

        if (session.type === 'ssh' && session.sshStream) {
          session.sshStream.off('data', dataListener);
        } else if (session.type === 'serial' && session.serialPort) {
          session.serialPort.off('data', dataListener);
        }
        resolve(output.trim());
      };

      const dataListener = (data: Buffer) => {
        hasReceivedData = true;
        output += data.toString('utf-8');
        
        // Reset inactivity debounce: 600ms of silence after data arrives means output is complete
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(finish, 600);
      };

      if (session.type === 'ssh' && session.sshStream) {
        session.sshStream.on('data', dataListener);
        session.sshStream.write(formattedCommand);
      } else if (session.type === 'serial' && session.serialPort) {
        session.serialPort.on('data', dataListener);
        session.serialPort.write(formattedCommand);
      }

      // Initial silence timer: wait up to 4s for first byte before giving up
      inactivityTimer = setTimeout(() => {
        if (!hasReceivedData) {
          finish();
        }
      }, 4000);

      // Hard safety timeout
      hardTimeoutTimer = setTimeout(finish, timeoutMs);
    });
  }

  sendInput(sessionId: string, data: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.type === 'ssh' && session.sshStream) session.sshStream.write(data);
    else if (session.type === 'serial' && session.serialPort?.isOpen) session.serialPort.write(data);
  }

  disconnect(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.window?.webContents.send('device-status', { id: session.deviceId, status: 'Offline' });
    if (session.sshStream) session.sshStream.end();
    if (session.sshClient) session.sshClient.end();
    if (session.serialPort?.isOpen) session.serialPort.close();
    this.sessions.delete(sessionId);
  }

  async getSerialPorts() {
    try {
      return await SerialPort.list();
    } catch {
      return [];
    }
  }
}