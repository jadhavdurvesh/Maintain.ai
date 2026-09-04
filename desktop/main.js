const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let backendProcess = null
let mainWindow = null

const isDev = !app.isPackaged

function backendBinaryPath() {
  const exeName = process.platform === 'win32' ? 'maintain-ai-backend.exe' : 'maintain-ai-backend'
  return path.join(process.resourcesPath, 'backend', exeName)
}

function waitForServer(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      http.get(url, () => resolve())
        .on('error', () => {
          if (Date.now() - start > timeoutMs) reject(new Error('Backend did not respond in time'))
          else setTimeout(check, 300)
        })
    }
    check()
  })
}

function startBackend() {
  if (isDev) {
    // In dev, run the backend yourself (see desktop/README.md) — Electron
    // just points at it, same as it points at the Vite dev server.
    return Promise.resolve()
  }

  // Per-user, per-OS app-data folder — survives app updates/reinstalls,
  // unlike anything stored inside the install directory itself.
  const dbPath = path.join(app.getPath('userData'), 'maintain_ai.db')

  backendProcess = spawn(backendBinaryPath(), [], {
    env: {
      ...process.env,
      DATABASE_URL: `sqlite:///${dbPath.replace(/\\/g, '/')}`,
      PORT: '8000',
    },
  })
  backendProcess.stdout.on('data', (d) => console.log(`[backend] ${d}`))
  backendProcess.stderr.on('data', (d) => console.error(`[backend] ${d}`))
  backendProcess.on('error', (err) => console.error('Failed to start backend:', err))

  return waitForServer('http://127.0.0.1:8000/')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'MAINTAIN AI',
    backgroundColor: '#12161c',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, 'frontend', 'index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
  try {
    await startBackend()
  } catch (err) {
    console.error('Backend failed to become ready:', err)
    // Still open the window — it'll show the app's own "couldn't reach backend" screen
    // instead of a blank Electron window, which is more useful for debugging.
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill()
})
