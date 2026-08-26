import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { DeviceConfig } from '../shared/types'

const api = {
  setAuthToken: (token: string | null) => ipcRenderer.send('set-auth-token', token),
  setProjectId: (projectId: string) => ipcRenderer.send('set-project-id', projectId),
  syncDevices: (devices: DeviceConfig[]) => ipcRenderer.send('sync-devices', devices),
  getDevices: (): Promise<DeviceConfig[]> => ipcRenderer.invoke('get-devices'),
  connectDevice: (device: DeviceConfig) => ipcRenderer.invoke('connect-device', device),
  disconnectDevice: (sessionId?: string) => ipcRenderer.send('disconnect-device', sessionId),
  sendTerminalInput: (sessionId: string, data: string) => ipcRenderer.send('terminal-input', { sessionId, data }),
  onTerminalData: (callback: (payload: { sessionId: string; data: string }) => void) => {
    ipcRenderer.on('terminal-data', (_, payload) => callback(payload));
  },
  onDeviceStatus: (callback: (update: { id: string; status: string }) => void) => {
    ipcRenderer.on('device-status', (_, update) => callback(update));
  },
  getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
  revealAgentSession: (deviceId: string) => ipcRenderer.invoke('reveal-agent-session', deviceId),
}

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