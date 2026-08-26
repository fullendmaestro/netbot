import net from 'node:http';
import type { DeviceConfig } from '../shared/types';

export class ApiClient {
  private token: string | null = null;
  
  constructor(private baseUrl: string) {}

  setToken(token: string | null) {
    this.token = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async fetchRemoteDevices(): Promise<DeviceConfig[]> {
    const res = await fetch(`${this.baseUrl}/api/devices`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch devices');
    return res.json();
  }

  async addRemoteDevice(device: DeviceConfig): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/devices`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(device)
    });
    if (!res.ok) throw new Error('Failed to add device to remote DB');
  }

  async removeRemoteDevice(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/devices/${id}`, { 
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete device from remote DB');
  }
}