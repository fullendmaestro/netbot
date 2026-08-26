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
    // Allow Firebase Auth and Google Sign-in URLs to open as internal popups
    if (
      details.url.includes('firebaseapp.com/__/auth') || 
      details.url.includes('accounts.google.com')
    ) {
      return { action: 'allow' }
    }

    // For all other links, open in the user's default system browser and deny the internal popup
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
  
  relayClient = new AgentRelayClient(AGENT_WS_URL, CLIENT_ID, sessionManager, deviceStore);
  // relayClient.connect(); will happen when token is provided
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  
  createWindow()

  ipcMain.on('set-auth-token', (_, token) => {
    relayClient.setToken(token);
  });

  ipcMain.on('set-project-id', (_, projectId) => {
    relayClient.setProjectId(projectId);
  });

  ipcMain.on('sync-devices', (_, devices) => {
    deviceStore.syncFromRemote(devices);
  });

  // IPC Handlers
  ipcMain.handle('get-devices', () => deviceStore.getDevices());

  ipcMain.handle('connect-device', async (_, device) => sessionManager.connect(device));
  ipcMain.on('disconnect-device', (_, sessionId) => sessionManager.disconnect(sessionId));
  ipcMain.on('terminal-input', (_, { sessionId, data }) => sessionManager.sendInput(sessionId, data));
  ipcMain.handle('get-serial-ports', async () => sessionManager.getSerialPorts());
  
  ipcMain.handle('reveal-agent-session', async (_, identifier: string) => {
    const devices = deviceStore.getDevices();
    const target = devices.find(d => d.id === identifier || (d.name && d.name.toLowerCase() === identifier.toLowerCase()));
    
    if (!target) return null;

    const revealed = sessionManager.revealAgentSessionByDevice(target.id);
    if (revealed) return revealed;

    const sessionId = await sessionManager.connect(target);
    return { sessionId, deviceConfig: target };
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})