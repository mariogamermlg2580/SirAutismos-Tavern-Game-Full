const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tavernAPI", {
  listMusic: () => ipcRenderer.invoke("list-music"),
  openMusicFolder: () => ipcRenderer.invoke("open-music-folder"),
  quit: () => ipcRenderer.invoke("quit-game")
});
