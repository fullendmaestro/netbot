import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SessionManager } from './session-manager'
import { DeviceStore } from './device-store'
import { AgentRelayClient } from './ws-relay'
import { ApiClient } from './api-client'
import icon from '../../resources/icon.png?asset'

let sessionManager: SessionManager;
let deviceStore: DeviceStore;
let relayClient: AgentRelayClient;
let apiClient: ApiClient;

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://127.0.0.1:8000';
const AGENT_WS_URL = process.env.AGENT_WS_URL || 'ws://127.0.0.1:8000';
const CLIENT_ID = 'user_1';

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Restore Vite HMR Loading
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Initialize Managers
  sessionManager = new SessionManager(mainWindow);
  deviceStore = new DeviceStore();
  apiClient = new ApiClient(AGENT_API_URL);
  
  relayClient = new AgentRelayClient(AGENT_WS_URL, CLIENT_ID, sessionManager, deviceStore);
  relayClient.connect();

  // On startup, fetch from cloud DB and cache locally
  apiClient.fetchRemoteDevices().then(remoteDevices => {
    deviceStore.syncFromRemote(remoteDevices);
  }).catch(err => console.error("Failed to sync initial devices:", err));
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  
  createWindow()

  // IPC Handlers: HTTP to Cloud -> Cache Locally -> Return to UI
  ipcMain.handle('get-devices', () => deviceStore.getDevices());
  
  ipcMain.handle('add-device', async (_, device) => {
    await apiClient.addRemoteDevice(device);
    return deviceStore.addDevice(device);
  });

  ipcMain.handle('remove-device', async (_, id) => {
    await apiClient.removeRemoteDevice(id);
    return deviceStore.removeDevice(id);
  });

  ipcMain.handle('connect-device', async (_, device) => sessionManager.connect(device));
  ipcMain.on('disconnect-device', (_, sessionId) => sessionManager.disconnect(sessionId));
  ipcMain.on('terminal-input', (_, { sessionId, data }) => sessionManager.sendInput(sessionId, data));
  ipcMain.handle('get-serial-ports', async () => sessionManager.getSerialPorts());

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})