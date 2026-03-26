import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  loadConfig: () => ipcRenderer.invoke("load-config"),
  saveConfig: (config: Record<string, unknown>) => ipcRenderer.invoke("save-config", config),

  loadCurrentPack: () => ipcRenderer.invoke("load-current-pack"),
  saveCurrentPack: (pack: Record<string, unknown>) => ipcRenderer.invoke("save-current-pack", pack),

  loadChatHistory: () => ipcRenderer.invoke("load-chat-history"),
  saveChatHistory: (messages: unknown[]) => ipcRenderer.invoke("save-chat-history", messages),
  archiveChatHistory: (messages: unknown[]) => ipcRenderer.invoke("archive-chat-history", messages),

  listArchives: () => ipcRenderer.invoke("list-archives"),
  loadArchive: (filename: string) => ipcRenderer.invoke("load-archive", filename),

  listChatSessions: () => ipcRenderer.invoke("list-chat-sessions"),
  saveChatSession: (id: string, title: string, messages: unknown[]) =>
    ipcRenderer.invoke("save-chat-session", id, title, messages),
  loadChatSession: (id: string) => ipcRenderer.invoke("load-chat-session", id),
  deleteChatSession: (id: string) => ipcRenderer.invoke("delete-chat-session", id),

  loadPacks: () => ipcRenderer.invoke("load-packs"),
  savePack: (pack: Record<string, unknown>) => ipcRenderer.invoke("save-pack", pack),
  deletePack: (id: string) => ipcRenderer.invoke("delete-pack", id),

  pickImages: () => ipcRenderer.invoke("pick-images"),
  readClipboardImage: () => ipcRenderer.invoke("read-clipboard-image"),

  exportPack: (content: string, filename: string) =>
    ipcRenderer.invoke("export-pack", content, filename),
  importFromMemochat: () => ipcRenderer.invoke("import-from-memochat"),
});
