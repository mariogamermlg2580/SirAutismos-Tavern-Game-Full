const { app, BrowserWindow, ipcMain, screen, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow;

function displayWindowOptions() {
  const display = screen.getPrimaryDisplay();
  const bounds = display.bounds || display.workArea || { width: 1280, height: 820 };
  const workArea = display.workAreaSize || bounds;
  return {
    width: Math.max(1024, bounds.width || workArea.width || 1280),
    height: Math.max(720, bounds.height || workArea.height || 820),
    minWidth: Math.min(980, Math.max(760, workArea.width || 980)),
    minHeight: Math.min(680, Math.max(560, workArea.height || 680))
  };
}

function createWindow() {
  const displayOptions = displayWindowOptions();
  mainWindow = new BrowserWindow({
    width: displayOptions.width,
    height: displayOptions.height,
    minWidth: displayOptions.minWidth,
    minHeight: displayOptions.minHeight,
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#160d16",
    title: "Sir Autismos Tavern Cards and Stuff",
    icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.setFullScreen(true);
    mainWindow.focus();
  });
}

function musicDirectory() {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  return portableDir ? path.join(portableDir, "music") : path.join(__dirname, "music");
}

ipcMain.handle("list-music", () => {
  const dir = musicDirectory();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return fs.readdirSync(dir)
    .filter(file => /\.(mp3|wav|ogg|m4a)$/i.test(file))
    .map(file => ({
      name: file,
      url: `file://${path.join(dir, file).replace(/\\/g, "/")}`
    }));
});

ipcMain.handle("open-music-folder", async () => {
  const dir = musicDirectory();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
  return dir;
});

ipcMain.handle("quit-game", () => {
  app.quit();
});

if (gotTheLock) {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.setFullScreen(true);
    mainWindow.focus();
  });

  app.whenReady().then(createWindow);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
