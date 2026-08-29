import { Client } from 'ssh2';
import { SerialPort } from 'serialport';
import { Telnet } from 'telnet-client';
import { BrowserWindow } from 'electron';
import type { DeviceConfig, DeviceConnection } from '../shared/types';
import { randomUUID } from 'crypto';

// Helper to strip Telnet IAC (0xFF) negotiation bytes from raw streams
function stripTelnetIAC(buffer: Buffer): Buffer {
  const result: number[] = [];
  let i = 0;
  while (i < buffer.length) {
    if (buffer[i] === 255) {
      i++;
      if (i >= buffer.length) break;
      const cmd = buffer[i];
      i++;
      if (cmd >= 251 && cmd <= 254) {
        i++; // skip option
      } else if (cmd === 250) {
        while (i < buffer.length && buffer[i] !== 240) i++;
        if (i < buffer.length) i++; // skip SE
      }
    } else {
      result.push(buffer[i]);
      i++;
    }
  }
  return Buffer.from(result);
}

/** Get the default (or first non-serial) connection from a device */
function getDefaultConnection(device: DeviceConfig): DeviceConnection | undefined {
  const conns = device.connections ?? [];
  return conns.find(c => c.isDefault) ?? conns.find(c => c.type !== 'serial') ?? conns[0];
}

export interface Session {
  sessionId: string;
  type: 'ssh' | 'serial' | 'telnet';
  deviceId: string;
  isHidden: boolean;
  isBusy: boolean;
  deviceConfig: DeviceConfig;
  connection: DeviceConnection;
  sshClient?: Client;
  sshStream?: any;
  serialPort?: SerialPort;
  telnetClient?: Telnet;
  telnetStream?: any;
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

  getActiveSessions(): { sessionId: string; deviceId: string; type: string; isHidden: boolean }[] {
    return Array.from(this.sessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      deviceId: session.deviceId,
      type: session.type,
      isHidden: session.isHidden,
    }));
  }

  // Gets the single serial session for a device (if any)
  getSerialSession(deviceId: string): Session | undefined {
    return Array.from(this.sessions.values()).find(s => s.deviceId === deviceId && s.type === 'serial');
  }

  // Used to connect a standard FOREGROUND session (from UI)
  // The caller may pass a specific DeviceConnection to use, or we auto-select the default.
  async connect(device: DeviceConfig, preferredConnection?: DeviceConnection): Promise<string> {
    const conn = preferredConnection ?? getDefaultConnection(device);
    if (!conn) throw new Error('No connection configured for this device.');

    if (conn.type === 'serial') {
      const existing = this.getSerialSession(device.id);
      if (existing) {
        existing.isHidden = false;
        return existing.sessionId;
      }
    }

    const sessionId = randomUUID();
    if (conn.type === 'ssh') {
      await this.connectSSH(sessionId, device, conn, false);
    } else if (conn.type === 'serial') {
      await this.connectSerial(sessionId, device, conn, false);
    } else if (conn.type === 'telnet') {
      await this.connectTelnet(sessionId, device, conn, false);
    }
    return sessionId;
  }

  private connectSSH(sessionId: string, device: DeviceConfig, conn: DeviceConnection, isHidden: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const sshClient = new Client();
      const session: Session = {
        sessionId,
        type: 'ssh',
        deviceId: device.id,
        isHidden,
        isBusy: false,
        deviceConfig: device,
        connection: conn,
        sshClient
      };
      this.sessions.set(sessionId, session);

      sshClient
        .on('ready', () => {
          if (!isHidden) {
            this.window?.webContents.send('device-status', { id: device.id, status: 'Connected' });
          }
          
          sshClient.shell((err, stream) => {
            if (err) {
              if (!isHidden) {
                this.window?.webContents.send('terminal-data', {
                  sessionId,
                  data: `\r\n*** SSH Shell Error: ${err.message} ***\r\n`,
                });
              }
              return reject(err);
            }
            session.sshStream = stream;

            stream
              .on('close', () => {
                if (!session.isHidden) {
                  this.window?.webContents.send('terminal-data', {
                    sessionId,
                    data: '\r\n*** SSH Connection Closed ***\r\n',
                  });
                }
                this.disconnect(sessionId);
              })
              .on('data', (data: Buffer) => {
                if (!session.isHidden) {
                  this.window?.webContents.send('terminal-data', {
                    sessionId,
                    data: data.toString('utf-8'),
                  });
                }
              });

            resolve();
          });
        })
        .on('error', (err) => {
          if (!session.isHidden) {
            this.window?.webContents.send('terminal-data', {
              sessionId,
              data: `\r\n*** SSH Error: ${err.message} ***\r\n`,
            });
          }
          reject(err);
        })
        .connect({
          host: conn.host,
          port: conn.port || 22,
          username: conn.username,
          password: conn.password,
          privateKey: conn.privateKey,
        });
    });
  }

  private connectSerial(sessionId: string, device: DeviceConfig, conn: DeviceConnection, isHidden: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!conn.path) {
        return reject(new Error('No serial port path provided.'));
      }

      const serialPort = new SerialPort(
        {
          path: conn.path,
          baudRate: conn.baudRate || 9600,
        },
        (err) => {
          if (err) {
            if (!isHidden) {
              this.window?.webContents.send('terminal-data', {
                sessionId,
                data: `\r\n*** Serial Error: ${err.message} ***\r\n`,
              });
            }
            return reject(err);
          }
          if (!isHidden) {
            this.window?.webContents.send('device-status', { id: device.id, status: 'Connected' });
          }
          resolve();
        }
      );

      const session: Session = {
        sessionId,
        type: 'serial',
        deviceId: device.id,
        isHidden,
        isBusy: false,
        deviceConfig: device,
        connection: conn,
        serialPort
      };
      this.sessions.set(sessionId, session);

      serialPort.on('data', (data: Buffer) => {
        if (!session.isHidden && !session.isBusy) {
          this.window?.webContents.send('terminal-data', {
            sessionId,
            data: data.toString('utf-8'),
          });
        }
      });

      serialPort.on('close', () => {
        if (!session.isHidden) {
          this.window?.webContents.send('terminal-data', {
            sessionId,
            data: '\r\n*** Serial Connection Closed ***\r\n',
          });
        }
        this.sessions.delete(sessionId);
      });
    });
  }

  private connectTelnet(sessionId: string, device: DeviceConfig, conn: DeviceConnection, isHidden: boolean): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const telnetClient = new Telnet();
      const session: Session = {
        sessionId,
        type: 'telnet',
        deviceId: device.id,
        isHidden,
        isBusy: false,
        deviceConfig: device,
        connection: conn,
        telnetClient
      };
      this.sessions.set(sessionId, session);

      const params = {
        host: conn.host,
        port: conn.port || 23,
        timeout: 10000,
        disableLogon: true,
        shellPrompt: null, // Resolves immediately without waiting for prompt
        initialLFCR: true
      };

      try {
        await telnetClient.connect(params);
        if (!isHidden) {
          this.window?.webContents.send('device-status', { id: device.id, status: 'Connected' });
        }
        
        const stream = await telnetClient.shell();
        session.telnetStream = stream;

        stream.on('data', (data: Buffer) => {
          if (!session.isHidden && !session.isBusy) {
            const cleanData = stripTelnetIAC(data);
            if (cleanData.length > 0) {
              this.window?.webContents.send('terminal-data', {
                sessionId,
                data: cleanData.toString('utf-8'),
              });
            }
          }
        });

        stream.on('close', () => {
          if (!session.isHidden) {
            this.window?.webContents.send('terminal-data', {
              sessionId,
              data: '\r\n*** Telnet Connection Closed ***\r\n',
            });
          }
          this.disconnect(sessionId);
        });

        stream.on('error', (err: any) => {
          if (!session.isHidden) {
            this.window?.webContents.send('terminal-data', {
              sessionId,
              data: `\r\n*** Telnet Error: ${err.message} ***\r\n`,
            });
          }
        });
        
        resolve();
      } catch (err: any) {
        if (!isHidden) {
          this.window?.webContents.send('terminal-data', {
            sessionId,
            data: `\r\n*** Telnet Connection Failed: ${err.message} ***\r\n`,
          });
        }
        reject(err);
      }
    });
  }

  /**
   * Retrieves an available background session for the agent, or creates a new one.
   */
  async getOrSpawnAgentSession(device: DeviceConfig): Promise<Session> {
    const conn = getDefaultConnection(device);
    if (!conn) throw new Error('No network connection configured for this device.');

    let session = Array.from(this.sessions.values()).find(
      (s) => s.deviceId === device.id && s.connection.type === conn.type
    );

    if (!session) {
      const sessionId = randomUUID();
      if (conn.type === 'ssh') {
        await this.connectSSH(sessionId, device, conn, true);
      } else if (conn.type === 'telnet') {
        await this.connectTelnet(sessionId, device, conn, true);
      } else {
        await this.connectSerial(sessionId, device, conn, true);
      }
      session = this.sessions.get(sessionId)!;
    }
    
    return session;
  }

  revealAgentSessionByDevice(deviceId: string): { sessionId: string, deviceConfig: DeviceConfig } | null {
    const session = Array.from(this.sessions.values()).find(
      (s) => s.deviceId === deviceId && s.isHidden
    );
    if (!session) return null;
    session.isHidden = false;
    return { sessionId: session.sessionId, deviceConfig: session.deviceConfig };
  }

  /**
   * Sends a command into the active session and collects terminal output.
   */
  async executeCommand(sessionId: string, command: string, timeoutMs = 8000): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`No active session found for session ID: ${sessionId}`);

    if (session.isBusy) {
      throw new Error(`Device is currently busy executing another command.`);
    }

    session.isBusy = true;

    if (!session.isHidden) {
      this.window?.webContents.send('terminal-data', {
        sessionId,
        data: `\r\n\x1b[33m[Agent locking device to execute command...]\x1b[0m\r\n`,
      });
    }

    try {
      return await new Promise((resolve) => {
        let output = '';
        
        const cleanCommand = command.replace(/[\r\n]+$/, '');
        const formattedCommand = (session.type === 'serial' || session.type === 'telnet') 
            ? `\r\n${cleanCommand}\r\n` 
            : `${cleanCommand}\r\n`;

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
          } else if (session.type === 'telnet' && session.telnetStream) {
            session.telnetStream.off('data', dataListener);
          }
          resolve(output.trim());
        };

        const dataListener = (data: Buffer) => {
          hasReceivedData = true;
          const cleanBuf = session.type === 'telnet' ? stripTelnetIAC(data) : data;
          const chunk = cleanBuf.toString('utf-8');
          output += chunk;

          if (inactivityTimer) clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(finish, 600);
        };

        if (session.type === 'ssh' && session.sshStream) {
          session.sshStream.on('data', dataListener);
          session.sshStream.write(formattedCommand);
        } else if (session.type === 'serial' && session.serialPort) {
          session.serialPort.on('data', dataListener);
          session.serialPort.write(formattedCommand);
        } else if (session.type === 'telnet' && session.telnetStream) {
          session.telnetStream.on('data', dataListener);
          session.telnetStream.write(formattedCommand);
        }

        inactivityTimer = setTimeout(() => {
          if (!hasReceivedData) {
            finish();
          }
        }, 4000);

        hardTimeoutTimer = setTimeout(finish, timeoutMs);
      });
    } finally {
      session.isBusy = false;
      if (!session.isHidden) {
        this.window?.webContents.send('terminal-data', {
          sessionId,
          data: `\r\n\x1b[32m[Agent command complete. Lock released.]\x1b[0m\r\n`,
        });
      }
    }
  }

  sendInput(sessionId: string, data: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.type === 'ssh' && session.sshStream) session.sshStream.write(data);
    else if (session.type === 'serial' && session.serialPort?.isOpen) session.serialPort.write(data);
    else if (session.type === 'telnet' && session.telnetStream) session.telnetStream.write(data);
  }

  disconnect(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    if (session.sshStream) session.sshStream.end();
    if (session.sshClient) session.sshClient.end();
    if (session.serialPort?.isOpen) session.serialPort.close();
    if (session.telnetClient) session.telnetClient.end();
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