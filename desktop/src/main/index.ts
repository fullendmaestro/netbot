import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { DeviceDatabase } from './db'
import { SessionManager } from './session-manager'
import type { DeviceConfig } from '../shared/types'
import { startBridgeServer } from './bridge-server'

let db: DeviceDatabase;
let sessionManager: SessionManager;

function createWindow(): void {
  // Create the browser window.
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

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  db = new DeviceDatabase()
  
  createWindow()
  
  const mainWindow = BrowserWindow.getAllWindows()[0];
  sessionManager = new SessionManager(mainWindow);

  // Start internal API bridge for ADK Agent
  startBridgeServer(db, sessionManager, 3001);

  ipcMain.handle('get-devices', () => {
    return db.getDevices();
  });

  ipcMain.on('add-device', (_, device: DeviceConfig) => {
    db.addDevice(device);
    mainWindow.webContents.send('devices-updated', db.getDevices());
  });

  ipcMain.on('remove-device', (_, id: string) => {
    db.removeDevice(id);
    mainWindow.webContents.send('devices-updated', db.getDevices());
  });

  ipcMain.handle('connect-device', async (_, device: DeviceConfig) => {
    return await sessionManager.connect(device);
  });

  ipcMain.on('disconnect-device', (_, sessionId: string) => {
    sessionManager.disconnect(sessionId);
  });

  ipcMain.on('terminal-input', (_, { sessionId, data }: { sessionId: string, data: string }) => {
    sessionManager.sendInput(sessionId, data);
  });

  ipcMain.handle('get-serial-ports', async () => {
    return await sessionManager.getSerialPorts();
  });

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
