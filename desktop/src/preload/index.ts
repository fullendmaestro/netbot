import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { DeviceConfig } from '../shared/types'

const AGENT_API = 'http://localhost:8000'

// Custom APIs for renderer
const api = {
  // ── Device CRUD — served by the Python agent API ──────────────────────────
  getDevices: (): Promise<DeviceConfig[]> =>
    fetch(`${AGENT_API}/api/devices`).then((r) => r.json()),

  addDevice: (device: DeviceConfig): Promise<{ id: string }> =>
    fetch(`${AGENT_API}/api/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    }).then((r) => r.json()),

  removeDevice: (id: string): Promise<void> =>
    fetch(`${AGENT_API}/api/devices/${id}`, { method: 'DELETE' }).then(() => undefined),

  // ── Terminal / sessions — handled by Electron main process ────────────────
  connectDevice: (device: DeviceConfig) => ipcRenderer.invoke('connect-device', device),
  disconnectDevice: (sessionId: string) => ipcRenderer.send('disconnect-device', sessionId),
  sendTerminalInput: (sessionId: string, data: string) =>
    ipcRenderer.send('terminal-input', { sessionId, data }),
  onTerminalData: (callback: (payload: { sessionId: string; data: string }) => void) => {
    ipcRenderer.on('terminal-data', (_, payload) => callback(payload));
  },
  onDeviceStatus: (callback: (update: { id: string; status: string }) => void) => {
    ipcRenderer.on('device-status', (_, update) => callback(update));
  },
  getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
