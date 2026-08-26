import { Client } from 'ssh2';
import { SerialPort } from 'serialport';
import { Telnet } from 'telnet-client';
import { BrowserWindow } from 'electron';
import type { DeviceConfig } from '../shared/types';
import { randomUUID } from 'crypto';

export interface Session {
  sessionId: string;
  type: 'ssh' | 'serial' | 'telnet';
  deviceId: string;
  isHidden: boolean;
  isBusy: boolean;
  deviceConfig: DeviceConfig;
  sshClient?: Client;
  sshStream?: any;
  serialPort?: SerialPort;
  telnetClient?: Telnet;
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
  async connect(device: DeviceConfig): Promise<string> {
    if (device.type === 'serial') {
      const existing = this.getSerialSession(device.id);
      if (existing) {
        // If it was hidden, reveal it
        existing.isHidden = false;
        return existing.sessionId;
      }
    }

    const sessionId = randomUUID();
    if (device.type === 'ssh') {
      await this.connectSSH(sessionId, device, false);
    } else if (device.type === 'serial') {
      await this.connectSerial(sessionId, device, false);
    } else if (device.type === 'telnet') {
      await this.connectTelnet(sessionId, device, false);
    }
    return sessionId;
  }

  // Connects a session explicitly (can be hidden)
  private connectSSH(sessionId: string, device: DeviceConfig, isHidden: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const sshClient = new Client();
      const session: Session = {
        sessionId,
        type: 'ssh',
        deviceId: device.id,
        isHidden,
        isBusy: false,
        deviceConfig: device,
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
                // If it's an SSH session, and it's NOT hidden, we ALWAYS broadcast.
                // If it is hidden, we NEVER broadcast.
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
            this.window?.webContents.send('device-status', { id: device.id, status: 'Offline' });
          }
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

  private connectSerial(sessionId: string, device: DeviceConfig, isHidden: boolean): Promise<void> {
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
            if (!isHidden) {
              this.window?.webContents.send('terminal-data', {
                sessionId,
                data: `\r\n*** Serial Error: ${err.message} ***\r\n`,
              });
              this.window?.webContents.send('device-status', { id: device.id, status: 'Offline' });
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
        serialPort
      };
      this.sessions.set(sessionId, session);

      serialPort.on('data', (data: Buffer) => {
        // For Serial, we broadcast IF it's not hidden AND not busy with an agent command.
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
          this.window?.webContents.send('device-status', { id: device.id, status: 'Offline' });
        }
        this.sessions.delete(sessionId);
      });
    });
  }

  private connectTelnet(sessionId: string, device: DeviceConfig, isHidden: boolean): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const telnetClient = new Telnet();
      const session: Session = {
        sessionId,
        type: 'telnet',
        deviceId: device.id,
        isHidden,
        isBusy: false,
        deviceConfig: device,
        telnetClient
      };
      this.sessions.set(sessionId, session);

      const params = {
        host: device.host,
        port: device.port || 23,
        username: device.username,
        password: device.password,
        shellPrompt: /.*[>#$] $/, // Used for initial login
        timeout: 10000,
        negotiationMandatory: false
      };

      try {
        await telnetClient.connect(params);
        if (!isHidden) {
          this.window?.webContents.send('device-status', { id: device.id, status: 'Connected' });
        }
        
        telnetClient.on('data', (data: Buffer) => {
          if (!session.isHidden && !session.isBusy) {
            this.window?.webContents.send('terminal-data', {
              sessionId,
              data: data.toString('utf-8'),
            });
          }
        });

        telnetClient.on('close', () => {
          if (!session.isHidden) {
            this.window?.webContents.send('terminal-data', {
              sessionId,
              data: '\r\n*** Telnet Connection Closed ***\r\n',
            });
            this.window?.webContents.send('device-status', { id: device.id, status: 'Offline' });
          }
          this.disconnect(sessionId);
        });

        telnetClient.on('error', (err: any) => {
          if (!session.isHidden) {
            this.window?.webContents.send('terminal-data', {
              sessionId,
              data: `\r\n*** Telnet Error: ${err.message} ***\r\n`,
            });
            this.window?.webContents.send('device-status', { id: device.id, status: 'Offline' });
          }
        });
        
        resolve();
      } catch (err: any) {
        if (!isHidden) {
          this.window?.webContents.send('terminal-data', {
            sessionId,
            data: `\r\n*** Telnet Connection Failed: ${err.message} ***\r\n`,
          });
          this.window?.webContents.send('device-status', { id: device.id, status: 'Offline' });
        }
        reject(err);
      }
    });
  }

  /**
   * Retrieves an available background session for the agent, or creates a new one.
   */
  async getOrSpawnAgentSession(device: DeviceConfig): Promise<Session> {
    if (device.type === 'ssh') {
      // Find an existing hidden SSH session that is NOT busy
      const availableSession = Array.from(this.sessions.values()).find(
        (s) => s.deviceId === device.id && s.type === 'ssh' && s.isHidden && !s.isBusy
      );
      if (availableSession) {
        return availableSession;
      }
      
      // If none available, spawn a new one
      const sessionId = randomUUID();
      await this.connectSSH(sessionId, device, true);
      const newSession = this.sessions.get(sessionId)!;
      return newSession;
    } else if (device.type === 'telnet') {
      const availableSession = Array.from(this.sessions.values()).find(
        (s) => s.deviceId === device.id && s.type === 'telnet' && s.isHidden && !s.isBusy
      );
      if (availableSession) {
        return availableSession;
      }
      const sessionId = randomUUID();
      await this.connectTelnet(sessionId, device, true);
      const newSession = this.sessions.get(sessionId)!;
      return newSession;
    } else {
      // For Serial, we can only have ONE session total.
      let session = this.getSerialSession(device.id);
      if (!session) {
        // Create a hidden one if it doesn't exist
        const sessionId = randomUUID();
        await this.connectSerial(sessionId, device, true);
        session = this.sessions.get(sessionId)!;
      }
      return session;
    }
  }

  revealAgentSessionByDevice(deviceId: string): { sessionId: string, deviceConfig: DeviceConfig } | null {
    const session = Array.from(this.sessions.values()).find(
      (s) => s.deviceId === deviceId && s.isHidden
    );
    if (!session) return null;
    session.isHidden = false;
    this.window?.webContents.send('device-status', { id: session.deviceId, status: 'Connected' });
    return { sessionId: session.sessionId, deviceConfig: session.deviceConfig };
  }

  /**
   * Sends a command into the active session and collects terminal output.
   */
  async executeCommand(sessionId: string, command: string, timeoutMs = 8000): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`No active session found for session ID: ${sessionId}`);

    if ((session.type === 'serial' || session.type === 'telnet') && session.isBusy) {
      throw new Error(`Device is currently busy executing another command.`);
    }

    session.isBusy = true;

    // If it's a serial port and NOT hidden, let the user know we are locking it
    if ((session.type === 'serial' || session.type === 'telnet') && !session.isHidden) {
      this.window?.webContents.send('terminal-data', {
        sessionId,
        data: `\r\n\x1b[33m[Agent locking device to execute command...]\x1b[0m\r\n`,
      });
    }

    try {
      return await new Promise((resolve) => {
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
          } else if (session.type === 'telnet' && session.telnetClient) {
            session.telnetClient.removeListener('data', dataListener);
          }
          resolve(output.trim());
        };

        const dataListener = (data: Buffer) => {
          hasReceivedData = true;
          const chunk = data.toString('utf-8');
          output += chunk;

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
        } else if (session.type === 'telnet' && session.telnetClient) {
          session.telnetClient.on('data', dataListener);
          session.telnetClient.send(cleanCommand, { waitfor: false }).catch(() => {});
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
    } finally {
      session.isBusy = false;
      if ((session.type === 'serial' || session.type === 'telnet') && !session.isHidden) {
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
    else if (session.type === 'telnet' && session.telnetClient) session.telnetClient.send(data.replace(/\r/g, ''), { waitfor: false });
  }

  disconnect(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (!session.isHidden) {
      this.window?.webContents.send('device-status', { id: session.deviceId, status: 'Offline' });
    }
    
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