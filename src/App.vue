<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

interface Message {
  role: "user" | "assistant";
  content: string;
}

type SettingsState = "closed" | "expanding" | "expanded" | "collapsing";

const messages = ref<Message[]>([]);
const input = ref("");
const loading = ref(false);
const settingsState = ref<SettingsState>("closed");
const settingsContentVisible = ref(false);
const apiKey = ref("");
const modelId = ref("");
const baseUrl = ref("");
const messagesEndRef = ref<HTMLDivElement | null>(null);
const messagesContainerRef = ref<HTMLDivElement | null>(null);
const settingsBtnRef = ref<HTMLButtonElement | null>(null);
const settingsPanelRef = ref<HTMLDivElement | null>(null);
const settingsTitleRef = ref<HTMLHeadingElement | null>(null);
const settingsBtnRect = ref({ top: 0, left: 0, width: 0, height: 0 });
const settingsTitleRect = ref({ top: 0, left: 0, width: 0, height: 0 });

let scrollRAF: number | null = null;
let unlistenStream: UnlistenFn | null = null;
let unlistenStreamEnd: UnlistenFn | null = null;

onMounted(() => {
  loadConfig();
});

onUnmounted(() => {
  unlistenStream?.();
  unlistenStreamEnd?.();
  if (scrollRAF) cancelAnimationFrame(scrollRAF);
});

function scrollToBottom(smooth = false) {
  if (scrollRAF) return;
  scrollRAF = requestAnimationFrame(() => {
    scrollRAF = null;
    const container = messagesContainerRef.value;
    if (container) {
      if (smooth) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    }
  });
}

watch(messages, (newVal, oldVal) => {
  nextTick(() => {
    const isNewMessage = newVal.length !== oldVal?.length;
    scrollToBottom(isNewMessage && !loading.value);
  });
}, { deep: true });

async function loadConfig() {
  try {
    const config = await invoke<{ api_key: string; model_id: string; base_url: string }>("load_config");
    if (config) {
      apiKey.value = config.api_key;
      if (config.model_id) modelId.value = config.model_id;
      if (config.base_url) baseUrl.value = config.base_url;
    }
  } catch (e) {
    console.error("Failed to load config:", e);
  }
}

async function saveConfig() {
  try {
    await invoke("save_config", {
      apiKey: apiKey.value,
      modelId: modelId.value,
      baseUrl: baseUrl.value,
    });
  } catch (e) {
    console.error("Failed to save config:", e);
  }
}

// Auto-save when config values change
watch([apiKey, modelId, baseUrl], () => {
  saveConfig();
}, { deep: true });

function openSettings() {
  if (settingsBtnRef.value) {
    const rect = settingsBtnRef.value.getBoundingClientRect();
    settingsBtnRect.value = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }

  const contentMaxWidth = 400;
  const contentPaddingTop = 40;
  const contentPaddingLeft = 24;
  const contentLeft = Math.max((window.innerWidth - contentMaxWidth) / 2, 0);
  settingsTitleRect.value = {
    top: contentPaddingTop,
    left: contentLeft + contentPaddingLeft,
    width: 0,
    height: 0,
  };

  settingsState.value = "expanding";

  setTimeout(() => {
    settingsContentVisible.value = true;
  }, 150);
  setTimeout(() => {
    settingsState.value = "expanded";
  }, 400);
}

function closeSettings() {
  if (settingsBtnRef.value) {
    const rect = settingsBtnRef.value.getBoundingClientRect();
    settingsBtnRect.value = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }
  if (settingsTitleRef.value) {
    const rect = settingsTitleRef.value.getBoundingClientRect();
    settingsTitleRect.value = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }
  settingsContentVisible.value = false;
  settingsState.value = "collapsing";
  setTimeout(() => {
    settingsState.value = "closed";
  }, 400);
}

function clearMessages() {
  messages.value = [];
}

function minimizeWindow() { appWindow.minimize(); }
function toggleMaximize() { appWindow.toggleMaximize(); }
function closeWindow() { appWindow.close(); }

function highlightMarkdown(text: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const highlightInline = (s: string) => {
    let r = escape(s);
    r = r.replace(/\*\*([^*\n]+)\*\*/g, '<span class="md-bold">**$1**</span>');
    r = r.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<span class="md-italic">*$1*</span>');
    r = r.replace(/`([^`\n]+)`/g, '<span class="md-inline-code">`$1`</span>');
    return r;
  };

  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];
  const tables: string[] = [];

  let result = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<span class="md-code-block"><span class="md-code-fence">\`\`\`${escape(lang)}</span>\n<span class="md-code-content">${escape(code)}</span><span class="md-code-fence">\`\`\`</span></span>`
    );
    return `\x00CODEBLOCK${idx}\x00`;
  });

  result = result.replace(
    /(\|[^\n]+\|(?:\n\|[^\n]+\|)+)/g,
    (tableMatch) => {
      const lines = tableMatch.trim().split('\n');
      if (lines.length < 2) return tableMatch;

      const parseRow = (row: string) =>
        row.split('|').slice(1, -1).map(cell => cell.trim());

      const headerCells = parseRow(lines[0]);
      const separatorLine = lines[1];

      if (!/^\|[\s|:\-]+\|$/.test(separatorLine)) {
        return tableMatch;
      }

      const sepCells = parseRow(separatorLine);
      if (sepCells.length !== headerCells.length) return tableMatch;
      if (!sepCells.every(cell => /^:?-+:?$/.test(cell))) return tableMatch;

      let html = '<table class="md-table"><thead><tr>';
      headerCells.forEach(cell => {
        html += `<th>${highlightInline(cell)}</th>`;
      });
      html += '</tr></thead><tbody>';

      for (let i = 2; i < lines.length; i++) {
        const cells = parseRow(lines[i]);
        html += '<tr>';
        cells.forEach(cell => {
          html += `<td>${highlightInline(cell)}</td>`;
        });
        html += '</tr>';
      }
      html += '</tbody></table>';

      const idx = tables.length;
      tables.push(html);
      return `\x00TABLE${idx}\x00`;
    }
  );

  result = result.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(
      `<span class="md-inline-code">\`${escape(code)}\`</span>`
    );
    return `\x00INLINECODE${idx}\x00`;
  });

  result = escape(result);

  result = result.replace(
    /^(#{1,6})\s+(.+)$/gm,
    '<span class="md-header"><span class="md-header-mark">$1</span> $2</span>'
  );

  result = result.replace(
    /\*\*([^*\n]+)\*\*/g,
    '<span class="md-bold">**$1**</span>'
  );

  result = result.replace(
    /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
    '<span class="md-italic">*$1*</span>'
  );

  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<span class="md-link"><span class="md-link-bracket">[</span><span class="md-link-text">$1</span><span class="md-link-bracket">]</span><span class="md-link-paren">(</span><span class="md-link-url">$2</span><span class="md-link-paren">)</span></span>'
  );

  result = result.replace(
    /^(&gt;)\s*(.*)$/gm,
    '<span class="md-blockquote"><span class="md-blockquote-mark">$1</span> $2</span>'
  );

  result = result.replace(
    /^(\s*)([-*])\s+(.+)$/gm,
    '$1<span class="md-list"><span class="md-list-mark">$2</span> $3</span>'
  );

  result = result.replace(
    /^(\s*)(\d+\.)\s+(.+)$/gm,
    '$1<span class="md-list"><span class="md-list-mark">$2</span> $3</span>'
  );

  result = result.replace(
    /^([-*]{3,})$/gm,
    '<span class="md-hr">$1</span>'
  );

  result = result.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, idx) => codeBlocks[parseInt(idx)]);
  result = result.replace(/\x00INLINECODE(\d+)\x00/g, (_, idx) => inlineCodes[parseInt(idx)]);
  result = result.replace(/\x00TABLE(\d+)\x00/g, (_, idx) => tables[parseInt(idx)]);

  return result;
}

async function sendMessage() {
  if (!input.value.trim() || loading.value) return;

  const userMessage: Message = { role: "user", content: input.value };
  messages.value.push(userMessage);
  const currentInput = input.value;
  input.value = "";
  loading.value = true;

  const assistantMessage: Message = { role: "assistant", content: "" };
  messages.value.push(assistantMessage);
  const assistantIndex = messages.value.length - 1;

  // Cleanup previous listeners
  unlistenStream?.();
  unlistenStreamEnd?.();

  try {
    const history = messages.value.slice(0, -2).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Setup stream listeners BEFORE calling chat
    unlistenStream = await listen<string>("chat-stream", (event) => {
      messages.value[assistantIndex] = {
        ...messages.value[assistantIndex],
        content: messages.value[assistantIndex].content + event.payload,
      };
    });

    unlistenStreamEnd = await listen("chat-stream-end", () => {
      loading.value = false;
      unlistenStream?.();
      unlistenStreamEnd?.();
      unlistenStream = null;
      unlistenStreamEnd = null;
    });

    await invoke("chat", { message: currentInput, history });
  } catch (e) {
    messages.value[assistantIndex] = {
      ...messages.value[assistantIndex],
      content: `Error: ${e}`,
    };
    loading.value = false;
    unlistenStream?.();
    unlistenStreamEnd?.();
    unlistenStream = null;
    unlistenStreamEnd = null;
  }
}
</script>

<template>
  <main class="chat-container">
    <header class="chat-header" data-tauri-drag-region>
      <h1 data-tauri-drag-region>AIChatTauri</h1>
      <div class="header-actions">
        <button class="clear-btn" @click="clearMessages" :disabled="messages.length === 0">
          +
        </button>
        <button
          ref="settingsBtnRef"
          class="settings-btn"
          @click="openSettings"
          :class="{ 'settings-btn-hidden': settingsState !== 'closed' }"
        >
          Settings
        </button>
        <div class="window-controls">
          <button class="win-btn" @click="minimizeWindow">&#x2013;</button>
          <button class="win-btn" @click="toggleMaximize">&#x25A1;</button>
          <button class="win-btn win-close" @click="closeWindow">&#x2715;</button>
        </div>
      </div>
    </header>

    <div ref="messagesContainerRef" class="messages-container">
      <div v-if="messages.length === 0" class="empty-state">Start a conversation!</div>
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['message', msg.role]"
      >
        <div class="message-content" v-html="highlightMarkdown(msg.content)"></div>
      </div>
      <div v-if="loading && messages[messages.length - 1]?.content === ''" class="message assistant">
        <div class="message-content loading">Thinking...</div>
      </div>
      <div ref="messagesEndRef"></div>
    </div>

    <form class="input-container" @submit.prevent="sendMessage">
      <input
        type="text"
        v-model="input"
        placeholder="Type a message..."
        :disabled="loading"
      />
      <button type="submit" :disabled="loading || !input.trim()">
        Send
      </button>
    </form>

    <div
      v-if="settingsState !== 'closed'"
      ref="settingsPanelRef"
      class="settings-panel"
      :class="settingsState"
      :style="settingsState === 'expanding' || settingsState === 'collapsing' ? {
        '--btn-top': settingsBtnRect.top + 'px',
        '--btn-left': settingsBtnRect.left + 'px',
        '--btn-width': settingsBtnRect.width + 'px',
        '--btn-height': settingsBtnRect.height + 'px',
      } : {}"
    >
      <div class="settings-content" :class="{ 'content-visible': settingsContentVisible }">
        <div class="settings-header">
          <h2 ref="settingsTitleRef" :class="{ 'title-hidden': settingsState === 'expanding' || settingsState === 'collapsing' }">Settings</h2>
          <button class="close-btn" @click="closeSettings">&times;</button>
        </div>
        <div class="form-group">
          <label>Base URL</label>
          <input
            type="text"
            v-model="baseUrl"
            placeholder="https://api.openai.com/v1"
          />
        </div>
        <div class="form-group">
          <label>API Key</label>
          <input
            type="password"
            v-model="apiKey"
            placeholder="sk-..."
          />
        </div>
        <div class="form-group">
          <label>Model ID</label>
          <input
            type="text"
            v-model="modelId"
            placeholder=""
          />
        </div>
      </div>
    </div>

    <!-- Floating Settings text for animation -->
    <div
      v-if="settingsState === 'expanding' || settingsState === 'collapsing'"
      class="floating-settings-text"
      :class="settingsState"
      :style="{
        '--btn-top': settingsBtnRect.top + 'px',
        '--btn-left': settingsBtnRect.left + 'px',
        '--btn-width': settingsBtnRect.width + 'px',
        '--btn-height': settingsBtnRect.height + 'px',
        '--title-top': settingsTitleRect.top + 'px',
        '--title-left': settingsTitleRect.left + 'px',
      }"
    >
      Settings
    </div>
  </main>
</template>
