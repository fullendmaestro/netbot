import { Client } from 'ssh2';
import { SerialPort } from 'serialport';
import { BrowserWindow } from 'electron';
import type { DeviceConfig } from '../shared/types';

export class SessionManager {
  private activeSSH: Client | null = null;
  private activeSSHStream: any = null;
  private activeSerial: SerialPort | null = null;
  private currentDeviceId: string | null = null;
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  async connect(device: DeviceConfig) {
    this.disconnect();
    this.currentDeviceId = device.id;

    if (device.type === 'ssh') {
      this.connectSSH(device);
    } else if (device.type === 'serial') {
      this.connectSerial(device);
    }
  }

  private connectSSH(device: DeviceConfig) {
    this.activeSSH = new Client();
    this.activeSSH.on('ready', () => {
      this.window.webContents.send('device-status', { id: device.id, status: 'Connected' });
      this.activeSSH?.shell((err, stream) => {
        if (err) {
          this.window.webContents.send('terminal-data', `\r\n*** SSH Shell Error: ${err.message} ***\r\n`);
          return;
        }
        this.activeSSHStream = stream;
        stream.on('close', () => {
          this.window.webContents.send('terminal-data', '\r\n*** SSH Connection Closed ***\r\n');
          this.disconnect();
        }).on('data', (data: any) => {
          this.window.webContents.send('terminal-data', data.toString('utf-8'));
        });
      });
    }).on('error', (err) => {
      this.window.webContents.send('terminal-data', `\r\n*** SSH Error: ${err.message} ***\r\n`);
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

  private connectSerial(device: DeviceConfig) {
    if (!device.path) {
      this.window.webContents.send('terminal-data', '\r\n*** Serial Error: No path provided ***\r\n');
      return;
    }

    this.activeSerial = new SerialPort({
      path: device.path,
      baudRate: device.baudRate || 9600,
    }, (err) => {
      if (err) {
        this.window.webContents.send('terminal-data', `\r\n*** Serial Error: ${err.message} ***\r\n`);
        this.window.webContents.send('device-status', { id: device.id, status: 'Offline' });
      } else {
        this.window.webContents.send('device-status', { id: device.id, status: 'Connected' });
      }
    });

    this.activeSerial.on('data', (data: any) => {
      this.window.webContents.send('terminal-data', data.toString('utf-8'));
    });

    this.activeSerial.on('close', () => {
      this.window.webContents.send('terminal-data', '\r\n*** Serial Connection Closed ***\r\n');
      this.window.webContents.send('device-status', { id: device.id, status: 'Offline' });
      this.activeSerial = null;
    });
  }

  sendInput(data: string) {
    if (this.activeSSHStream) {
      this.activeSSHStream.write(data);
    } else if (this.activeSerial && this.activeSerial.isOpen) {
      this.activeSerial.write(data);
    }
  }

  disconnect() {
    if (this.currentDeviceId) {
      this.window.webContents.send('device-status', { id: this.currentDeviceId, status: 'Offline' });
      this.currentDeviceId = null;
    }
    if (this.activeSSHStream) {
      this.activeSSHStream.end();
      this.activeSSHStream = null;
    }
    if (this.activeSSH) {
      this.activeSSH.end();
      this.activeSSH = null;
    }
    if (this.activeSerial) {
      if (this.activeSerial.isOpen) {
        this.activeSerial.close();
      }
      this.activeSerial = null;
    }
  }

  async getSerialPorts() {
    try {
      return await SerialPort.list();
    } catch (e) {
      return [];
    }
  }
}
