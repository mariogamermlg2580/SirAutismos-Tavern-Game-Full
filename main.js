const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
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
