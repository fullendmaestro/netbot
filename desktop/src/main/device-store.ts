import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { DeviceConfig } from '../shared/types';

export class DeviceStore {
  private filePath: string;
  private devices: DeviceConfig[] = [];

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'devices.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.devices = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      }
    } catch {
      this.devices = [];
    }
  }

  private save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.devices, null, 2), 'utf-8');
  }

  getDevices(): DeviceConfig[] {
    return this.devices;
  }

  addDevice(device: DeviceConfig): DeviceConfig[] {
    this.devices = this.devices.filter((d) => d.id !== device.id);
    this.devices.push(device);
    this.save();
    return this.devices;
  }

  removeDevice(id: string): DeviceConfig[] {
    this.devices = this.devices.filter((d) => d.id !== id);
    this.save();
    return this.devices;
  }

  syncFromRemote(remoteDevices: DeviceConfig[]) {
    this.devices = remoteDevices;
    this.save();
  }
}