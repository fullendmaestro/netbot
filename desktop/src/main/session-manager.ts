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
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  async connect(device: DeviceConfig): Promise<string> {
    const sessionId = randomUUID();
    
    if (device.type === 'ssh') {
      this.connectSSH(sessionId, device);
    } else if (device.type === 'serial') {
      this.connectSerial(sessionId, device);
    }
    return sessionId;
  }

  private connectSSH(sessionId: string, device: DeviceConfig) {
    const sshClient = new Client();
    this.sessions.set(sessionId, { type: 'ssh', deviceId: device.id, sshClient });

    sshClient.on('ready', () => {
      this.window.webContents.send('device-status', { id: device.id, status: 'Connected' });
      sshClient.shell((err, stream) => {
        if (err) {
          this.window.webContents.send('terminal-data', { sessionId, data: `\r\n*** SSH Shell Error: ${err.message} ***\r\n` });
          return;
        }
        const session = this.sessions.get(sessionId);
        if (session) {
          session.sshStream = stream;
        }
        
        stream.on('close', () => {
          this.window.webContents.send('terminal-data', { sessionId, data: '\r\n*** SSH Connection Closed ***\r\n' });
          this.disconnect(sessionId);
        }).on('data', (data: any) => {
          this.window.webContents.send('terminal-data', { sessionId, data: data.toString('utf-8') });
        });
      });
    }).on('error', (err) => {
      this.window.webContents.send('terminal-data', { sessionId, data: `\r\n*** SSH Error: ${err.message} ***\r\n` });
      this.window.webContents.send('device-status', { id: device.id, status: 'Offline' });
    }).on('end', () => {
      this.window.webContents.send('device-status', { id: device.id, status: 'Offline' });
    }).connect({
      host: device.host,
      port: device.port || 22,
      username: device.username,
      password: device.password,
      privateKey: device.privateKey,
    });
  }

  private connectSerial(sessionId: string, device: DeviceConfig) {
    if (!device.path) {
      this.window.webContents.send('terminal-data', { sessionId, data: '\r\n*** Serial Error: No path provided ***\r\n' });
      return;
    }

    const serialPort = new SerialPort({
      path: device.path,
      baudRate: device.baudRate || 9600,
    }, (err) => {
      if (err) {
        this.window.webContents.send('terminal-data', { sessionId, data: `\r\n*** Serial Error: ${err.message} ***\r\n` });
        this.window.webContents.send('device-status', { id: device.id, status: 'Offline' });
      } else {
        this.window.webContents.send('device-status', { id: device.id, status: 'Connected' });
      }
    });

    this.sessions.set(sessionId, { type: 'serial', deviceId: device.id, serialPort });

    serialPort.on('data', (data: any) => {
      this.window.webContents.send('terminal-data', { sessionId, data: data.toString('utf-8') });
    });

    serialPort.on('close', () => {
      this.window.webContents.send('terminal-data', { sessionId, data: '\r\n*** Serial Connection Closed ***\r\n' });
      this.window.webContents.send('device-status', { id: device.id, status: 'Offline' });
      this.sessions.delete(sessionId);
    });
  }

  sendInput(sessionId: string, data: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.type === 'ssh' && session.sshStream) {
      session.sshStream.write(data);
    } else if (session.type === 'serial' && session.serialPort && session.serialPort.isOpen) {
      session.serialPort.write(data);
    }
  }

  disconnect(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.window.webContents.send('device-status', { id: session.deviceId, status: 'Offline' });
    
    if (session.sshStream) {
      session.sshStream.end();
    }
    if (session.sshClient) {
      session.sshClient.end();
    }
    if (session.serialPort && session.serialPort.isOpen) {
      session.serialPort.close();
    }
    this.sessions.delete(sessionId);
  }

  async getSerialPorts() {
    try {
      return await SerialPort.list();
    } catch (e) {
      return [];
    }
  }
}
