import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SessionManager } from './session-manager'
import { DeviceStore } from './device-store'
import icon from '../../resources/icon.png?asset'

let sessionManager: SessionManager;
let deviceStore: DeviceStore;

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
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  
  createWindow()



  ipcMain.on('sync-devices', (_, devices) => {
    deviceStore.syncFromRemote(devices);
  });

  // IPC Handlers
  ipcMain.handle('get-devices', () => deviceStore.getDevices());

  ipcMain.handle('connect-device', async (_, device) => sessionManager.connect(device));
  ipcMain.on('disconnect-device', (_, sessionId) => sessionManager.disconnect(sessionId));
  ipcMain.on('terminal-input', (_, { sessionId, data }) => sessionManager.sendInput(sessionId, data));
  ipcMain.handle('get-serial-ports', async () => sessionManager.getSerialPorts());
  
  ipcMain.handle('execute-agent-command', async (_, deviceIdentifier: string, command: string) => {
    const devices = deviceStore.getDevices();
    const target = devices.find(d => d.id === deviceIdentifier || (d.name && d.name.toLowerCase() === deviceIdentifier.toLowerCase()));
    
    if (!target) throw new Error(`Device ${deviceIdentifier} not found in desktop device store.`);

    const session = await sessionManager.getOrSpawnAgentSession(target);
    return await sessionManager.executeCommand(session.sessionId, command);
  });
  
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