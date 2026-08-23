import net from 'node:http';
import type { DeviceConfig } from '../shared/types';

export class ApiClient {
  constructor(private baseUrl: string) {}

  async fetchRemoteDevices(): Promise<DeviceConfig[]> {
    const res = await fetch(`${this.baseUrl}/api/devices`);
    if (!res.ok) throw new Error('Failed to fetch devices');
    return res.json();
  }

  async addRemoteDevice(device: DeviceConfig): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device)
    });
    if (!res.ok) throw new Error('Failed to add device to remote DB');
  }

  async removeRemoteDevice(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/devices/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete device from remote DB');
  }
}