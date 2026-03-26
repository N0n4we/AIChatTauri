import { ipcMain, app, dialog, clipboard, nativeImage } from "electron";
import fs from "fs";
import path from "path";

function getConfigDir(): string {
  const dir = path.join(app.getPath("userData"));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

function getSessionsDir(): string {
  const dir = path.join(getConfigDir(), "sessions");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getChatHistoryPath(): string {
  return path.join(getConfigDir(), "chat-history.json");
}

function getArchivesDir(): string {
  const dir = path.join(getConfigDir(), "archives");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getCurrentPackPath(): string {
  return path.join(getConfigDir(), "current-pack.json");
}

function getPacksDir(): string {
  const dir = path.join(getConfigDir(), "packs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {}
  return fallback;
}

function writeJsonFile(filePath: string, data: unknown): boolean {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

function mimeTypeFromExt(ext: string): string {
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    avif: "image/avif",
    heic: "image/heic",
    heif: "image/heif",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

function readImageAttachment(filePath: string) {
  const bytes = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1);
  const mimeType = mimeTypeFromExt(ext);
  const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
  return {
    name: path.basename(filePath),
    mimeType,
    dataUrl,
    size: bytes.length,
  };
}

function formatDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

const defaultConfig = {
  api_key: "",
  model_id: "",
  base_url: "",
  compact_model_id: "",
  reasoning_enabled: false,
  compact_reasoning_enabled: false,
  channels_json: "",
};

export function registerIpcHandlers() {
  // Config
  ipcMain.handle("load-config", () => {
    return readJsonFile(getConfigPath(), defaultConfig);
  });

  ipcMain.handle("save-config", (_e, config) => {
    return writeJsonFile(getConfigPath(), config);
  });

  // Current pack
  ipcMain.handle("load-current-pack", () => {
    const p = getCurrentPackPath();
    if (fs.existsSync(p)) {
      return readJsonFile(p, null);
    }
    return null;
  });

  ipcMain.handle("save-current-pack", (_e, pack) => {
    return writeJsonFile(getCurrentPackPath(), pack);
  });

  // Chat history
  ipcMain.handle("load-chat-history", () => {
    return readJsonFile(getChatHistoryPath(), []);
  });

  ipcMain.handle("save-chat-history", (_e, messages) => {
    return writeJsonFile(getChatHistoryPath(), messages);
  });

  ipcMain.handle("archive-chat-history", (_e, messages) => {
    const dir = getArchivesDir();
    const timestamp = formatDate();
    const filePath = path.join(dir, `${timestamp}.json`);
    return writeJsonFile(filePath, messages);
  });

  // Archives
  ipcMain.handle("list-archives", () => {
    const dir = getArchivesDir();
    const entries: { filename: string; message_count: number; created_at: string }[] = [];
    try {
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith(".json")) continue;
        const filename = path.basename(file, ".json");
        const data = readJsonFile<unknown[]>(path.join(dir, file), []);
        const created_at =
          filename.length >= 15
            ? `${filename.slice(0, 4)}-${filename.slice(4, 6)}-${filename.slice(6, 8)}T${filename.slice(9, 11)}:${filename.slice(11, 13)}:${filename.slice(13, 15)}`
            : filename;
        entries.push({ filename, message_count: data.length, created_at });
      }
    } catch {}
    entries.sort((a, b) => b.filename.localeCompare(a.filename));
    return entries;
  });

  ipcMain.handle("load-archive", (_e, filename: string) => {
    const filePath = path.join(getArchivesDir(), `${filename}.json`);
    return readJsonFile(filePath, []);
  });

  // Sessions
  ipcMain.handle("list-chat-sessions", () => {
    const dir = getSessionsDir();
    const sessions: { id: string; title: string; message_count: number; created_at: string }[] = [];
    try {
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith(".json")) continue;
        const data = readJsonFile<{ meta?: { id: string; title: string; message_count: number; created_at: string } }>(
          path.join(dir, file),
          {}
        );
        if (data.meta) sessions.push(data.meta);
      }
    } catch {}
    sessions.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return sessions;
  });

  ipcMain.handle("save-chat-session", (_e, id: string, title: string, messages: unknown[]) => {
    const dir = getSessionsDir();
    const filePath = path.join(dir, `${id}.json`);
    let created_at = new Date().toISOString();
    try {
      const existing = readJsonFile<{ meta?: { created_at?: string } }>(filePath, {});
      if (existing.meta?.created_at) created_at = existing.meta.created_at;
    } catch {}
    const data = {
      meta: { id, title, message_count: messages.length, created_at },
      messages,
    };
    return writeJsonFile(filePath, data);
  });

  ipcMain.handle("load-chat-session", (_e, id: string) => {
    const filePath = path.join(getSessionsDir(), `${id}.json`);
    const data = readJsonFile<{ messages?: unknown[] }>(filePath, {});
    return data.messages || [];
  });

  ipcMain.handle("delete-chat-session", (_e, id: string) => {
    const filePath = path.join(getSessionsDir(), `${id}.json`);
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  });

  // Packs
  ipcMain.handle("load-packs", () => {
    const dir = getPacksDir();
    const packs: unknown[] = [];
    try {
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith(".json")) continue;
        const pack = readJsonFile(path.join(dir, file), null);
        if (pack) packs.push(pack);
      }
    } catch {}
    return packs;
  });

  ipcMain.handle("save-pack", (_e, pack: { id: string }) => {
    const dir = getPacksDir();
    return writeJsonFile(path.join(dir, `${pack.id}.json`), pack);
  });

  ipcMain.handle("delete-pack", (_e, id: string) => {
    const filePath = path.join(getPacksDir(), `${id}.json`);
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  });

  // Images
  ipcMain.handle("pick-images", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "heic", "heif"] },
      ],
    });
    if (result.canceled) return [];
    return result.filePaths.map(readImageAttachment);
  });

  ipcMain.handle("read-clipboard-image", () => {
    const img = clipboard.readImage();
    if (img.isEmpty()) return null;
    const pngBuffer = img.toPNG();
    const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    return {
      name: "clipboard-image.png",
      mimeType: "image/png",
      dataUrl,
      size: pngBuffer.length,
    };
  });

  // Export / Import
  ipcMain.handle("export-pack", async (_e, content: string, filename: string) => {
    const result = await dialog.showSaveDialog({ defaultPath: filename });
    if (result.canceled || !result.filePath) throw new Error("User cancelled");
    fs.writeFileSync(result.filePath, content, "utf-8");
  });

  ipcMain.handle("import-from-memochat", () => {
    const p = getCurrentPackPath();
    if (!fs.existsSync(p)) throw new Error("No current pack found");
    return readJsonFile(p, null);
  });
}
