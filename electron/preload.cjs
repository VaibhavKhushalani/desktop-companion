const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openDirectoryDialog: () => ipcRenderer.invoke("dialog:open-directory"),
  validateRepository: (folderPath) =>
    ipcRenderer.invoke("git:validate-repo", folderPath),
  getBranch: (folderPath) => ipcRenderer.invoke("git:get-branch", folderPath),
  getLatestCommit: (folderPath) =>
    ipcRenderer.invoke("git:get-latest-commit", folderPath),
  moveCompanionWindow: (bounds) =>
    ipcRenderer.invoke("window:move-companion", bounds),
  repositionCompanion: (position) =>
    ipcRenderer.invoke("window:reposition-companion", position),
  restoreCompanion: (payload) =>
    ipcRenderer.invoke("window:restore-companion", payload),
  updateCompanionMessage: (payload) =>
    ipcRenderer.invoke("companion:update-message", payload),
  onCompanionMessage: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on("companion:message", listener);
    return () => ipcRenderer.removeListener("companion:message", listener);
  },
  toggleDashboard: () => ipcRenderer.invoke("window:toggle-dashboard"),
  showDashboard: () => ipcRenderer.invoke("window:show-dashboard"),
  toggleCompanion: () => ipcRenderer.invoke("window:toggle-companion"),
  notify: (message) => ipcRenderer.invoke("app:notify", message),
  showCompanion: (payload) => ipcRenderer.invoke("window:show-companion", payload),
  platform: process.platform,
  version: process.versions.electron,
});
