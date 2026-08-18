import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { DeviceConfig } from '../shared/types'

// Custom APIs for renderer
const api = {
  getDevices: () => ipcRenderer.invoke('get-devices'),
  addDevice: (device: DeviceConfig) => ipcRenderer.send('add-device', device),
  removeDevice: (id: string) => ipcRenderer.send('remove-device', id),
  onDevicesUpdated: (callback: (devices: DeviceConfig[]) => void) => {
    ipcRenderer.on('devices-updated', (_, devices) => callback(devices));
  },
  connectDevice: (device: DeviceConfig) => ipcRenderer.invoke('connect-device', device),
  disconnectDevice: (sessionId: string) => ipcRenderer.send('disconnect-device', sessionId),
  sendTerminalInput: (sessionId: string, data: string) => ipcRenderer.send('terminal-input', { sessionId, data }),
  onTerminalData: (callback: (payload: { sessionId: string, data: string }) => void) => {
    ipcRenderer.on('terminal-data', (_, payload) => callback(payload));
  },
  onDeviceStatus: (callback: (update: { id: string, status: string }) => void) => {
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
