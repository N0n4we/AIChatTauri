export interface ElectronAPI {
  loadConfig(): Promise<{
    api_key: string;
    model_id: string;
    base_url: string;
    compact_model_id: string;
    reasoning_enabled: boolean;
    compact_reasoning_enabled: boolean;
    channels_json: string;
  }>;
  saveConfig(config: Record<string, unknown>): Promise<boolean>;

  loadCurrentPack(): Promise<{
    system_prompt: string;
    rules: { title: string; update_rule: string }[];
    memos: { title: string; content: string }[];
  } | null>;
  saveCurrentPack(pack: Record<string, unknown>): Promise<boolean>;

  loadChatHistory(): Promise<unknown[]>;
  saveChatHistory(messages: unknown[]): Promise<boolean>;
  archiveChatHistory(messages: unknown[]): Promise<boolean>;

  listArchives(): Promise<{ filename: string; message_count: number; created_at: string }[]>;
  loadArchive(filename: string): Promise<unknown[]>;

  listChatSessions(): Promise<{ id: string; title: string; message_count: number; created_at: string }[]>;
  saveChatSession(id: string, title: string, messages: unknown[]): Promise<boolean>;
  loadChatSession(id: string): Promise<unknown[]>;
  deleteChatSession(id: string): Promise<boolean>;

  loadPacks(): Promise<unknown[]>;
  savePack(pack: Record<string, unknown>): Promise<boolean>;
  deletePack(id: string): Promise<boolean>;

  pickImages(): Promise<{ name: string; mimeType: string; dataUrl: string; size: number }[]>;
  readClipboardImage(): Promise<{ name: string; mimeType: string; dataUrl: string; size: number } | null>;

  exportPack(content: string, filename: string): Promise<void>;
  importFromMemochat(): Promise<unknown>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
