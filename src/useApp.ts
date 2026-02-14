import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { chatCompletion } from "./llm";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export type PanelState = "closed" | "expanding" | "expanded" | "collapsing";

export interface MemoRule {
  title: string;
  updateRule: string;
  expanded: boolean;
}

export interface Memo {
  title: string;
  content: string;
}

export function useApp() {
  const messages = ref<Message[]>([]);
  const input = ref("");
  const loading = ref(false);
  const settingsState = ref<PanelState>("closed");
  const settingsContentVisible = ref(false);
  const apiKey = ref("");
  const modelId = ref("");
  const compactModelId = ref("");
  const baseUrl = ref("");
  const messagesEndRef = ref<HTMLDivElement | null>(null);
  const messagesContainerRef = ref<HTMLDivElement | null>(null);
  const settingsBtnRef = ref<HTMLButtonElement | null>(null);
  const settingsPanelRef = ref<HTMLDivElement | null>(null);
  const settingsTitleRef = ref<HTMLHeadingElement | null>(null);
  const settingsBtnRect = ref({ top: 0, left: 0, width: 0, height: 0 });
  const settingsTitleRect = ref({ top: 0, left: 0, width: 0, height: 0 });

  const memoState = ref<PanelState>("closed");
  const memoContentVisible = ref(false);
  const memoRules = ref<MemoRule[]>([]);
  const memoBtnRef = ref<HTMLButtonElement | null>(null);
  const memoPanelRef = ref<HTMLDivElement | null>(null);
  const memoTitleRef = ref<HTMLHeadingElement | null>(null);
  const memoBtnRect = ref({ top: 0, left: 0, width: 0, height: 0 });
  const memoTitleRect = ref({ top: 0, left: 0, width: 0, height: 0 });
  const memos = ref<Memo[]>([]);
  const compacting = ref(false);

  let scrollRAF: number | null = null;

  onMounted(() => {
    loadConfig();
    loadMemoRules();
    loadMemos();
  });

  onUnmounted(() => {
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
      const config = await invoke<{ api_key: string; model_id: string; base_url: string; compact_model_id: string }>("load_config");
      if (config) {
        apiKey.value = config.api_key;
        if (config.model_id) modelId.value = config.model_id;
        if (config.base_url) baseUrl.value = config.base_url;
        if (config.compact_model_id) compactModelId.value = config.compact_model_id;
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
        compactModelId: compactModelId.value,
      });
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  }

  watch([apiKey, modelId, baseUrl, compactModelId], () => {
    saveConfig();
  }, { deep: true });

  async function loadMemoRules() {
    try {
      const rules = await invoke<{ description: string; update_rule: string }[]>("load_memo_rules");
      if (rules && rules.length > 0) {
        memoRules.value = rules.map(r => ({ title: r.description, updateRule: r.update_rule, expanded: false }));
      }
    } catch (e) {
      console.error("Failed to load memo rules:", e);
    }
  }

  async function saveMemoRules() {
    try {
      const rules = memoRules.value.map(m => ({ description: m.title, update_rule: m.updateRule }));
      await invoke("save_memo_rules", { rules });
    } catch (e) {
      console.error("Failed to save memo rules:", e);
    }
  }

  watch(memoRules, () => {
    saveMemoRules();
  }, { deep: true });

  async function loadMemos() {
    try {
      const loaded = await invoke<{ title: string; content: string }[]>("load_memos");
      if (loaded && loaded.length > 0) {
        memos.value = loaded;
      }
    } catch (e) {
      console.error("Failed to load memos:", e);
    }
  }

  async function saveMemos() {
    try {
      await invoke("save_memos", { memos: memos.value });
    } catch (e) {
      console.error("Failed to save memos:", e);
    }
  }

  watch(memos, () => {
    saveMemos();
  }, { deep: true });

  function openSettings() {
    if (settingsBtnRef.value) {
      const rect = settingsBtnRef.value.getBoundingClientRect();
      settingsBtnRect.value = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    }
    const contentMaxWidth = 400;
    const contentPaddingTop = 40;
    const contentPaddingLeft = 24;
    const contentLeft = Math.max((window.innerWidth - contentMaxWidth) / 2, 0);
    settingsTitleRect.value = { top: contentPaddingTop, left: contentLeft + contentPaddingLeft, width: 0, height: 0 };
    settingsState.value = "expanding";
    setTimeout(() => { settingsContentVisible.value = true; }, 150);
    setTimeout(() => { settingsState.value = "expanded"; }, 400);
  }

  function closeSettings() {
    if (settingsBtnRef.value) {
      const rect = settingsBtnRef.value.getBoundingClientRect();
      settingsBtnRect.value = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    }
    if (settingsTitleRef.value) {
      const rect = settingsTitleRef.value.getBoundingClientRect();
      settingsTitleRect.value = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    }
    settingsContentVisible.value = false;
    settingsState.value = "collapsing";
    setTimeout(() => { settingsState.value = "closed"; }, 400);
  }

  function openMemo() {
    if (memoBtnRef.value) {
      const rect = memoBtnRef.value.getBoundingClientRect();
      memoBtnRect.value = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    }
    const contentMaxWidth = 400;
    const contentPaddingTop = 40;
    const contentPaddingLeft = 24;
    const contentLeft = Math.max((window.innerWidth - contentMaxWidth) / 2, 0);
    memoTitleRect.value = { top: contentPaddingTop, left: contentLeft + contentPaddingLeft, width: 0, height: 0 };
    memoState.value = "expanding";
    setTimeout(() => { memoContentVisible.value = true; }, 150);
    setTimeout(() => { memoState.value = "expanded"; }, 400);
  }

  function closeMemo() {
    if (memoBtnRef.value) {
      const rect = memoBtnRef.value.getBoundingClientRect();
      memoBtnRect.value = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    }
    if (memoTitleRef.value) {
      const rect = memoTitleRef.value.getBoundingClientRect();
      memoTitleRect.value = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    }
    memoContentVisible.value = false;
    memoState.value = "collapsing";
    setTimeout(() => { memoState.value = "closed"; }, 400);
  }

  function addMemoRule() {
    memoRules.value.push({ title: "", updateRule: "", expanded: true });
  }

  function toggleMemoRule(index: number) {
    memoRules.value[index].expanded = !memoRules.value[index].expanded;
  }

  function removeMemoRule(index: number) {
    memoRules.value.splice(index, 1);
  }

  function clearMessages() { messages.value = []; }

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
    input.value = "";
    loading.value = true;

    const assistantMessage: Message = { role: "assistant", content: "" };
    messages.value.push(assistantMessage);
    const assistantIndex = messages.value.length - 1;

    try {
      const history: { role: string; content: string }[] = messages.value.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const memosWithContent = memos.value.filter(m => m.content.trim());
      if (memosWithContent.length > 0) {
        const memoText = memosWithContent.map(m => `[${m.title}]: ${m.content}`).join("\n");
        history.unshift({ role: "system", content: memoText });
      }

      const result = await chatCompletion(
        history,
        { baseUrl: baseUrl.value, apiKey: apiKey.value, modelId: modelId.value },
        {
          onContent(chunk) {
            messages.value[assistantIndex] = {
              ...messages.value[assistantIndex],
              content: messages.value[assistantIndex].content + chunk,
            };
          },
        },
      );

      messages.value[assistantIndex] = {
        ...messages.value[assistantIndex],
        content: result.content,
      };
    } catch (e) {
      messages.value[assistantIndex] = {
        ...messages.value[assistantIndex],
        content: `Error: ${e}`,
      };
    } finally {
      loading.value = false;
    }
  }

  async function regenerate() {
    if (loading.value || messages.value.length === 0) return;
    const last = messages.value[messages.value.length - 1];
    if (last.role !== "assistant") return;

    messages.value.pop();
    loading.value = true;

    const assistantMessage: Message = { role: "assistant", content: "" };
    messages.value.push(assistantMessage);
    const assistantIndex = messages.value.length - 1;

    try {
      const history: { role: string; content: string }[] = messages.value.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const memosWithContent = memos.value.filter(m => m.content.trim());
      if (memosWithContent.length > 0) {
        const memoText = memosWithContent.map(m => `[${m.title}]: ${m.content}`).join("\n");
        history.unshift({ role: "system", content: memoText });
      }

      const result = await chatCompletion(
        history,
        { baseUrl: baseUrl.value, apiKey: apiKey.value, modelId: modelId.value },
        {
          onContent(chunk) {
            messages.value[assistantIndex] = {
              ...messages.value[assistantIndex],
              content: messages.value[assistantIndex].content + chunk,
            };
          },
        },
      );

      messages.value[assistantIndex] = {
        ...messages.value[assistantIndex],
        content: result.content,
      };
    } catch (e) {
      messages.value[assistantIndex] = {
        ...messages.value[assistantIndex],
        content: `Error: ${e}`,
      };
    } finally {
      loading.value = false;
    }
  }

  async function memoryCompact() {
    if (compacting.value || messages.value.length === 0) return;
    compacting.value = true;

    try {
      const chatHistory = messages.value.map(m => `${m.role}: ${m.content}`).join("\n");
      const config = { baseUrl: baseUrl.value, apiKey: apiKey.value, modelId: compactModelId.value || modelId.value };

      const tasks = memoRules.value.map(async (rule) => {
        const existing = memos.value.find(m => m.title === rule.title);
        const currentContent = existing?.content || "(empty)";

        const prompt = `You are a memo manager. Update a single memo based on the chat history.

Memo title: ${rule.title}
Update rule: ${rule.updateRule}
Current content: ${currentContent}

Chat history:
${chatHistory}

Output ONLY the updated memo content as plain text (no JSON, no wrapping). If there is nothing relevant in the chat, return the current content as-is.`;

        try {
          const result = await chatCompletion(
            [{ role: "user", content: prompt }],
            config,
          );
          return { title: rule.title, content: result.content.trim() };
        } catch (e) {
          console.error(`Memo "${rule.title}" failed:`, e);
          return { title: rule.title, content: existing?.content || "" };
        }
      });

      memos.value = await Promise.all(tasks);
      messages.value = [];
    } catch (e) {
      console.error("Memory compact failed:", e);
    } finally {
      compacting.value = false;
    }
  }

  return {
    messages, input, loading,
    settingsState, settingsContentVisible, apiKey, modelId, compactModelId, baseUrl,
    messagesEndRef, messagesContainerRef,
    settingsBtnRef, settingsPanelRef, settingsTitleRef,
    settingsBtnRect, settingsTitleRect,
    memoState, memoContentVisible, memoRules, memos, compacting,
    memoBtnRef, memoPanelRef, memoTitleRef,
    memoBtnRect, memoTitleRect,
    openSettings, closeSettings,
    openMemo, closeMemo, addMemoRule, toggleMemoRule, removeMemoRule,
    clearMessages,
    highlightMarkdown, sendMessage, regenerate, memoryCompact,
  };
}
