import { ref, computed, onMounted, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import {
  type Channel,
  fetchServerInfo, registerOnServer, loginOnServer,
  publishMemoPack as apiPublishMemoPack,
  listMemoPacks as apiListMemoPacks,
  deleteRemoteMemoPack as apiDeleteRemotePack,
} from "./api";

export interface MemoRule {
  title: string;
  updateRule: string;
}

export interface Memo {
  title: string;
  content: string;
}

export interface MemoPack {
  id: string;
  name: string;
  description: string;
  authorId: string;
  authorName: string;
  systemPrompt: string;
  rules: MemoRule[];
  memos: Memo[];
  createdAt: string;
  updatedAt: string;
}

export type MarketView = "browse" | "create" | "detail" | "publish";

function generateId() {
  return `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowISO() {
  return new Date().toISOString().slice(0, 19);
}

function toBackend(pack: MemoPack) {
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    system_prompt: pack.systemPrompt,
    rules: pack.rules.map(r => ({ title: r.title, update_rule: r.updateRule })),
    memos: pack.memos.map(m => ({ title: m.title, content: m.content })),
    created_at: pack.createdAt,
    updated_at: pack.updatedAt,
  };
}

function fromBackend(raw: any): MemoPack {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    authorId: raw.author_id || "",
    authorName: raw.author_name || "",
    systemPrompt: raw.system_prompt || "",
    rules: (raw.rules || []).map((r: any) => ({ title: r.title || r.description, updateRule: r.update_rule || r.updateRule })),
    memos: (raw.memos || []).map((m: any) => ({ title: m.title, content: m.content })),
    createdAt: raw.created_at || "",
    updatedAt: raw.updated_at || "",
  };
}

export function useMarket() {
  const packs = ref<MemoPack[]>([]);
  const currentView = ref<MarketView>("browse");
  const selectedPack = ref<MemoPack | null>(null);
  const searchQuery = ref("");

  const editPack = ref<MemoPack>({
    id: "", name: "", description: "",
    authorId: "", authorName: "",
    systemPrompt: "", rules: [], memos: [], createdAt: "", updatedAt: "",
  });

  // Channels — each channel = one backend server URL + token
  const channels = ref<Channel[]>([]);
  const selectedChannelId = ref("");
  const publishing = ref(false);
  const publishError = ref("");
  const publishSuccess = ref("");

  // New channel form
  const newChannelUrl = ref("https://n0n4w3.cn:8080");
  const newChannelUsername = ref("");
  const newChannelPassword = ref("");
  const newChannelIsLogin = ref(false);
  const addingChannel = ref(false);
  const addChannelError = ref("");

  // Local / Remote toggle
  const viewMode = ref<"local" | "remote">("local");
  const remotePacks = ref<MemoPack[]>([]);
  const loadingRemote = ref(false);

  onMounted(() => {
    loadConfig();
    loadPacks();
  });

  async function loadConfig() {
    try {
      const config = await invoke<{
        api_key: string; model_id: string; base_url: string;
        reasoning_enabled: boolean; channels_json: string;
      }>("load_config");
      if (config) {
        if (config.channels_json) {
          try {
            channels.value = JSON.parse(config.channels_json);
            if (channels.value.length > 0 && !selectedChannelId.value) {
              selectedChannelId.value = channels.value[0].id;
            }
          } catch { channels.value = []; }
        }
      }
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }

  async function saveConfig() {
    try {
      // Load existing config to preserve other fields
      const existingConfig = await invoke<{
        api_key?: string;
        model_id?: string;
        base_url?: string;
        compact_model_id?: string;
        reasoning_enabled?: boolean;
        compact_reasoning_enabled?: boolean;
      }>("load_config");

      await invoke("save_config", {
        apiKey: existingConfig?.api_key || "",
        modelId: existingConfig?.model_id || "",
        baseUrl: existingConfig?.base_url || "",
        compactModelId: existingConfig?.compact_model_id || "",
        reasoningEnabled: existingConfig?.reasoning_enabled || false,
        compactReasoningEnabled: existingConfig?.compact_reasoning_enabled || false,
        channelsJson: JSON.stringify(channels.value),
      });
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  }

  // Save channels when they change
  watch(channels, () => {
    saveConfig();
    // Refresh remote packs so stale tokens/usernames are cleared
    if (viewMode.value === "remote") fetchRemotePacks();
  }, { deep: true });

  async function loadPacks() {
    try {
      const raw = await invoke<any[]>("load_packs");
      packs.value = (raw || []).map(fromBackend);
    } catch (e) {
      console.error("Failed to load packs:", e);
    }
  }

  async function savePack(pack: MemoPack) {
    try {
      await invoke("save_pack", { pack: toBackend(pack) });
      await loadPacks();
    } catch (e) {
      console.error("Failed to save pack:", e);
    }
  }

  async function deletePack(id: string) {
    try {
      await invoke("delete_pack", { id });
      if (selectedPack.value?.id === id) {
        selectedPack.value = null;
        currentView.value = "browse";
      }
      await loadPacks();
    } catch (e) {
      console.error("Failed to delete pack:", e);
    }
  }

  async function installPack(pack: MemoPack) {
    try {
      await invoke("save_current_pack", {
        pack: {
          system_prompt: pack.systemPrompt,
          rules: pack.rules.map(r => ({ title: r.title, update_rule: r.updateRule })),
          memos: pack.memos.map(m => ({ title: m.title, content: m.content })),
        },
      });
    } catch (e) {
      console.error("Failed to install pack:", e);
    }
  }

  const filteredPacks = computed(() => {
    let result = viewMode.value === "remote" ? remotePacks.value : packs.value;
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) ||
        ((p as any)._channelName || "").toLowerCase().includes(q)
      );
    }
    return result;
  });

  function startCreate() {
    editPack.value = {
      id: generateId(), name: "", description: "",
      authorId: "", authorName: "",
      systemPrompt: "", rules: [], memos: [], createdAt: nowISO(), updatedAt: nowISO(),
    };
    currentView.value = "create";
  }

  function startEdit(pack: MemoPack) {
    editPack.value = JSON.parse(JSON.stringify(pack));
    currentView.value = "create";
  }

  function addRule() {
    editPack.value.rules.push({ title: "", updateRule: "" });
  }

  function removeRule(idx: number) {
    editPack.value.rules.splice(idx, 1);
  }

  function addMemo() {
    editPack.value.memos.push({ title: "", content: "" });
  }

  function removeMemo(idx: number) {
    editPack.value.memos.splice(idx, 1);
  }

  async function saveCurrentPack() {
    editPack.value.updatedAt = nowISO();
    await savePack(editPack.value);
    currentView.value = "browse";
  }

  function viewPack(pack: MemoPack) {
    selectedPack.value = pack;
    currentView.value = "detail";
  }

  function goBack() {
    currentView.value = "browse";
    selectedPack.value = null;
  }

  // Export pack to a directory chosen by user
  async function exportPack(pack: MemoPack) {
    try {
      const json = JSON.stringify(toBackend(pack), null, 2);
      const filename = `${pack.name.replace(/\s+/g, "-").toLowerCase() || "pack"}.memomarket.json`;
      await invoke("export_pack", { content: json, filename });
    } catch (e) {
      console.error("Failed to export pack:", e);
    }
  }

  // Import from Chat (reads current-pack.json, enters edit mode for user to fill metadata)
  async function importFromMemoChat() {
    try {
      const raw = await invoke<any>("import_from_memochat");
      const now = nowISO();
      editPack.value = {
        id: generateId(),
        name: "",
        description: "",
        authorId: "",
        authorName: "",
        systemPrompt: raw.system_prompt || "",
        rules: (raw.rules || []).map((r: any) => ({ title: r.title || r.description, updateRule: r.update_rule || r.updateRule || "" })),
        memos: (raw.memos || []).map((m: any) => ({ title: m.title, content: m.content })),
        createdAt: now,
        updatedAt: now,
      };
      currentView.value = "create";
    } catch (e) {
      console.error("Failed to import from Chat:", e);
      alert(`Failed to import from Chat: ${e}`);
    }
  }

  // Import from file
  function importPack() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Detect format: MemoChat rules or MemoMarket pack
        if (data.rules && data.systemPrompt !== undefined && !data.id) {
          // MemoChat format
          const now = nowISO();
          const pack: MemoPack = {
            id: generateId(),
            name: file.name.replace(/\.json$/, "").replace(/-/g, " "),
            description: "Imported from MemoChat",
            authorId: "",
            authorName: "",
            systemPrompt: data.systemPrompt || "",
            rules: (data.rules || []).map((r: any) => ({ title: r.title, updateRule: r.updateRule })),
            memos: [],
            createdAt: now,
            updatedAt: now,
          };
          await savePack(pack);
        } else if (data.id) {
          // MemoMarket format
          const pack = fromBackend(data);
          pack.id = generateId(); // new ID to avoid conflicts
          await savePack(pack);
        }
      } catch (e) {
        console.error("Failed to import:", e);
      }
    };
    fileInput.click();
  }

  // ---- Remote packs: fetch from all channels ----

  async function fetchRemotePacks() {
    if (channels.value.length === 0) {
      remotePacks.value = [];
      return;
    }
    loadingRemote.value = true;
    try {
      // Group channels by URL to avoid duplicate fetches
      const urlGroups = new Map<string, Channel[]>();
      for (const ch of channels.value) {
        const group = urlGroups.get(ch.url);
        if (group) group.push(ch);
        else urlGroups.set(ch.url, [ch]);
      }
      const results = await Promise.allSettled(
        Array.from(urlGroups.entries()).map(async ([url, chs]) => {
          const res = await apiListMemoPacks(url, { limit: 100 });
          return (res.items || []).map((raw: any) => {
            const pack = fromBackend(raw);
            // Match pack author to the correct channel account
            const matched = chs.find(c => c.username === pack.authorName) || chs[0];
            return {
              ...pack,
              _channelName: matched.name,
              _channelUrl: matched.url,
              _channelToken: matched.token,
              _channelUsername: matched.username,
            };
          });
        })
      );
      const all: MemoPack[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") all.push(...r.value);
      }
      remotePacks.value = all;
    } catch (e) {
      console.error("Failed to fetch remote packs:", e);
    } finally {
      loadingRemote.value = false;
    }
  }

  // Auto-fetch remote packs when switching to remote mode
  watch(viewMode, (mode) => {
    if (mode === "remote") fetchRemotePacks();
  });

  // ---- Channel management (each channel = a backend server) ----

  const selectedChannel = computed(() =>
    channels.value.find(c => c.id === selectedChannelId.value) || null
  );

  async function addChannel() {
    const url = newChannelUrl.value.trim().replace(/\/$/, "");
    if (!url) return;
    addingChannel.value = true;
    addChannelError.value = "";
    try {
      const info = await fetchServerInfo(url);
      let token = "";
      let username = "";
      const user = newChannelUsername.value.trim();
      const pass = newChannelPassword.value;
      if (user && pass) {
        const authFn = newChannelIsLogin.value ? loginOnServer : registerOnServer;
        const result = await authFn(url, user, pass);
        token = result.token || "";
        username = result.username || user;
      }
      const ch: Channel = {
        id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        url,
        token,
        username,
        name: info.name || url,
        description: info.description || "",
      };
      channels.value.push(ch);
      if (!selectedChannelId.value) {
        selectedChannelId.value = ch.id;
      }
      newChannelUrl.value = "";
      newChannelUsername.value = "";
      newChannelPassword.value = "";
    } catch (e: any) {
      addChannelError.value = e.message || "Failed to connect to server";
    } finally {
      addingChannel.value = false;
    }
  }

  function removeChannel(id: string) {
    channels.value = channels.value.filter(c => c.id !== id);
    if (selectedChannelId.value === id) {
      selectedChannelId.value = channels.value.length > 0 ? channels.value[0].id : "";
    }
  }

  function updateChannelToken(id: string, token: string) {
    const ch = channels.value.find(c => c.id === id);
    if (ch) ch.token = token;
  }

  async function registerOnChannel(channelId: string, username: string, password: string) {
    const ch = channels.value.find(c => c.id === channelId);
    if (!ch) return;
    publishError.value = "";
    try {
      const user = await registerOnServer(ch.url, username, password);
      ch.token = user.token || "";
      ch.username = user.username || username;
    } catch (e: any) {
      publishError.value = e.message || "Registration failed";
    }
  }

  async function loginOnChannel(channelId: string, username: string, password: string) {
    const ch = channels.value.find(c => c.id === channelId);
    if (!ch) return;
    publishError.value = "";
    try {
      const user = await loginOnServer(ch.url, username, password);
      ch.token = user.token || "";
      ch.username = user.username || username;
    } catch (e: any) {
      publishError.value = e.message || "Login failed";
    }
  }

  async function publishPack(pack: MemoPack) {
    const ch = selectedChannel.value;
    if (!ch) {
      publishError.value = "Select a channel first";
      return;
    }
    if (!ch.token) {
      publishError.value = "No auth token for this channel. Register or add a token first.";
      return;
    }
    publishing.value = true;
    publishError.value = "";
    publishSuccess.value = "";
    try {
      await apiPublishMemoPack(ch.url, ch.token, {
        name: pack.name,
        description: pack.description,
        system_prompt: pack.systemPrompt,
        rules: pack.rules.map(r => ({ title: r.title, update_rule: r.updateRule })),
        memos: pack.memos.map(m => ({ title: m.title, content: m.content })),
      });
      publishSuccess.value = `"${pack.name}" published to ${ch.name}!`;
    } catch (e: any) {
      publishError.value = e.message || "Publish failed";
    } finally {
      publishing.value = false;
    }
  }

  function openPublish(pack: MemoPack) {
    selectedPack.value = pack;
    publishError.value = "";
    publishSuccess.value = "";
    currentView.value = "publish";
  }

  async function deleteRemotePack(pack: MemoPack) {
    const p = pack as any;
    if (!p._channelUrl || !p._channelToken) return;
    try {
      await apiDeleteRemotePack(p._channelUrl, p._channelToken, pack.id);
      remotePacks.value = remotePacks.value.filter(rp => rp.id !== pack.id);
      if (selectedPack.value?.id === pack.id) {
        selectedPack.value = null;
        currentView.value = "browse";
      }
    } catch (e: any) {
      publishError.value = e.message || "Failed to delete remote pack";
    }
  }

  return {
    packs, currentView, selectedPack, searchQuery,
    filteredPacks,
    editPack,
    loadPacks, savePack, deletePack, installPack,
    startCreate, startEdit, addRule, removeRule, addMemo, removeMemo,
    saveCurrentPack, viewPack, goBack,
    exportPack, importPack, importFromMemoChat,
    // Local / Remote toggle
    viewMode, remotePacks, loadingRemote, fetchRemotePacks,
    // Channels (each = a backend server)
    channels, selectedChannelId, selectedChannel,
    publishing, publishError, publishSuccess,
    newChannelUrl, newChannelUsername, newChannelPassword, newChannelIsLogin, addingChannel, addChannelError,
    addChannel, removeChannel, updateChannelToken, registerOnChannel, loginOnChannel,
    publishPack, openPublish,
    deleteRemotePack,
  };
}
