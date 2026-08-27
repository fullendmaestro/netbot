import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SessionManager } from './session-manager'
import { DeviceStore } from './device-store'
import icon from '../../resources/icon.png?asset'

const GNS3_SERVER_URL = 'http://34.121.48.145:3080'

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
      sandbox: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Spoof UserAgent to avoid GNS3 Web UI's Electron detection which breaks asset paths
  const defaultUserAgent = mainWindow.webContents.userAgent;
  const spoofedUserAgent = defaultUserAgent.replace(/ electron\/[0-9\.]+/i, '').replace(/Electron\/[0-9\.]+/i, '');
  mainWindow.webContents.userAgent = spoofedUserAgent;

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

  // Strip headers that prevent iframe embedding for GNS3
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    
    // Remove both lowercase and uppercase variations just in case
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['X-Frame-Options'];
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['Content-Security-Policy'];
    
    callback({
      cancel: false,
      responseHeaders
    });
  });

  // Failsafe: if the GNS3 iframe accidentally requests JS/CSS assets relative to the project URL
  // due to a broken <base> tag, redirect them to the correct /static/web-ui/ root.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.includes('/static/web-ui/server/1/project/') && (details.url.endsWith('.js') || details.url.endsWith('.css'))) {
      const filename = details.url.split('/').pop();
      const redirectURL = `http://34.121.48.145:3080/static/web-ui/${filename}`;
      callback({ redirectURL });
      return;
    }
    callback({});
  });
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  app.on('web-contents-created', (_, contents) => {  
  if (contents.getType() === 'webview') {  
    // contents.userAgent can be undefined at creation time before first navigation  
    const currentUserAgent = contents.userAgent || session.defaultSession.getUserAgent()  
    const spoofedUserAgent = currentUserAgent  
      .replace(/ electron\/[0-9\.]+/i, '')  
      .replace(/Electron\/[0-9\.]+/i, '')  
    contents.setUserAgent(spoofedUserAgent)  
  
    const s = contents.session  
  
    s.webRequest.onHeadersReceived({ urls: [`${GNS3_SERVER_URL}/*`] }, (details, callback) => {  
      const responseHeaders = { ...details.responseHeaders }  
      delete responseHeaders['x-frame-options']  
      delete responseHeaders['X-Frame-Options']  
      delete responseHeaders['content-security-policy']  
      delete responseHeaders['Content-Security-Policy']  
      callback({ cancel: false, responseHeaders })  
    })  
  
    s.webRequest.onBeforeRequest((details, callback) => {  
      if (  
        details.url.includes('/static/web-ui/server/1/project/') &&  
        (details.url.endsWith('.js') || details.url.endsWith('.css'))  
      ) {  
        const filename = details.url.split('/').pop()  
        callback({ redirectURL: `${GNS3_SERVER_URL}/static/web-ui/${filename}` })  
        return  
      }  
      callback({})  
    })  
  }  
})
  
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