import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { chatCompletion, type ChatMessage, type ContentPart } from "./llm";

const api = window.electronAPI;

export interface Message {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  images?: ImageAttachment[];
}

export interface ImageAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  size: number;
}

export interface NativeImageAttachment {
  name: string;
  mimeType: string;
  dataUrl: string;
  size: number;
}

export type PanelState = "closed" | "expanding" | "expanded" | "collapsing";

export interface MemoRule {
  id: string;
  title: string;
  updateRule: string;
  expanded: boolean;
}

let _ruleId = 0;
function nextRuleId() {
  return `rule_${Date.now()}_${_ruleId++}`;
}

let _imageId = 0;
function nextImageId() {
  return `image_${Date.now()}_${_imageId++}`;
}

export interface Memo {
  title: string;
  content: string;
}

export type TabType = "chat" | "archives" | "market" | "settings";

export interface ChatSession {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
}

export interface ArchiveEntry {
  filename: string;
  message_count: number;
  created_at: string;
}

export function useApp() {
  const currentTab = ref<TabType>("chat");
  const messages = ref<Message[]>([]);
  const input = ref("");
  const pendingImages = ref<ImageAttachment[]>([]);
  const loading = ref(false);
  const apiKey = ref("");
  const modelId = ref("");
  const compactModelId = ref("");
  const baseUrl = ref("");
  const reasoningEnabled = ref(false);
  const compactReasoningEnabled = ref(false);
  const systemPrompt = ref("");
  const messagesEndRef = ref<HTMLDivElement | null>(null);
  const messagesContainerRef = ref<HTMLDivElement | null>(null);
  const inputRef = ref<HTMLTextAreaElement | null>(null);

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
  const compactProgress = ref(0);
  const compactTotal = ref(0);
  const clearing = ref(false);
  const clearingHeight = ref(0);
  const sessions = ref<ChatSession[]>([]);
  const currentSessionId = ref<string | null>(null);
  const archives = ref<ArchiveEntry[]>([]);
  const selectedArchive = ref<string | null>(null);
  const archiveMessages = ref<Message[]>([]);

  let scrollRAF: number | null = null;
  let resizeRAF: number | null = null;

  function forceRepaint() {
    if (resizeRAF) return;
    resizeRAF = requestAnimationFrame(() => {
      resizeRAF = null;
      document.body.style.opacity = "0.999";
      requestAnimationFrame(() => {
        document.body.style.opacity = "";
      });
    });
  }

  onMounted(() => {
    loadConfig();
    loadMemoPack();
    loadChatHistory();
    loadSessions();
    window.addEventListener("resize", forceRepaint);
  });

  onUnmounted(() => {
    if (scrollRAF) cancelAnimationFrame(scrollRAF);
    if (resizeRAF) cancelAnimationFrame(resizeRAF);
    window.removeEventListener("resize", forceRepaint);
  });

  function resetInputHeight() {
    if (inputRef.value) inputRef.value.style.height = "auto";
  }

  function resetComposer() {
    input.value = "";
    pendingImages.value = [];
    resetInputHeight();
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error(`Failed to read image: ${file.name}`));
      };
      reader.onerror = () => reject(reader.error || new Error(`Failed to read image: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  async function addPendingImages(files: File[]) {
    const imageFiles = files.filter(file => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const loaded = await Promise.allSettled(
      imageFiles.map(async (file) => ({
        id: nextImageId(),
        name: file.name || "image",
        mimeType: file.type || "application/octet-stream",
        dataUrl: await readFileAsDataUrl(file),
        size: file.size,
      }))
    );

    pendingImages.value.push(
      ...loaded
        .filter((result): result is PromiseFulfilledResult<ImageAttachment> => result.status === "fulfilled")
        .map(result => result.value)
    );

    loaded
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .forEach(result => console.error("Failed to load image:", result.reason));
  }

  function addPendingImageAttachments(images: NativeImageAttachment[]) {
    if (images.length === 0) return;

    pendingImages.value.push(
      ...images.map((image) => ({
        id: nextImageId(),
        name: image.name,
        mimeType: image.mimeType,
        dataUrl: image.dataUrl,
        size: image.size,
      }))
    );
  }

  function removePendingImage(id: string) {
    pendingImages.value = pendingImages.value.filter(image => image.id !== id);
  }

  function summarizeImages(images?: ImageAttachment[]) {
    if (!images?.length) return "";
    const names = images.map(image => image.name || "image").join(", ");
    return `[images: ${names}]`;
  }

  function summarizeMessage(message: Message) {
    const text = message.content.trim();
    const imageSummary = summarizeImages(message.images);
    if (text && imageSummary) return `${text} ${imageSummary}`;
    return text || imageSummary;
  }

  function toChatMessage(message: Message): ChatMessage {
    if (!message.images?.length) {
      return { role: message.role, content: message.content };
    }

    const contentParts: ContentPart[] = [];
    if (message.content.trim()) {
      contentParts.push({ type: "text", text: message.content });
    }
    contentParts.push(
      ...message.images.map(image => ({
        type: "image_url" as const,
        image_url: { url: image.dataUrl },
      }))
    );

    return { role: message.role, content: contentParts };
  }

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

  watch(() => ({ len: messages.value.length, loading: loading.value }), (newVal, oldVal) => {
    if (newVal.len !== oldVal?.len || newVal.loading) {
      nextTick(() => {
        const isNewMessage = newVal.len !== oldVal?.len;
        scrollToBottom(isNewMessage && !newVal.loading);
      });
    }
  });

  let saveChatTimeout: ReturnType<typeof setTimeout> | null = null;

  watch(() => messages.value.length, triggerSaveChat);

  async function loadConfig() {
    try {
      const config = await api.loadConfig();
      if (config) {
        apiKey.value = config.api_key;
        if (config.model_id) modelId.value = config.model_id;
        if (config.base_url) baseUrl.value = config.base_url;
        if (config.compact_model_id) compactModelId.value = config.compact_model_id;
        reasoningEnabled.value = config.reasoning_enabled;
        compactReasoningEnabled.value = config.compact_reasoning_enabled;
      }
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }

  async function saveConfig() {
    try {
      const existingConfig = await api.loadConfig();

      await api.saveConfig({
        api_key: apiKey.value,
        model_id: modelId.value,
        base_url: baseUrl.value,
        compact_model_id: compactModelId.value,
        reasoning_enabled: reasoningEnabled.value,
        compact_reasoning_enabled: compactReasoningEnabled.value,
        channels_json: existingConfig?.channels_json || "",
      });
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  }

  watch([apiKey, modelId, baseUrl, compactModelId, reasoningEnabled, compactReasoningEnabled], () => {
    saveConfig();
  }, { deep: true });

  async function loadChatHistory() {
    try {
      const history = await api.loadChatHistory() as Message[];
      if (history && history.length > 0) {
        messages.value = history;
      }
    } catch (e) {
      console.error("Failed to load chat history:", e);
    }
  }

  async function loadMemoPack() {
    try {
      const pack = await api.loadCurrentPack();

      if (pack) {
        if (pack.rules && pack.rules.length > 0) {
          memoRules.value = pack.rules.map(r => ({ id: nextRuleId(), title: r.title, updateRule: r.update_rule, expanded: false }));
        }
        if (pack.memos && pack.memos.length > 0) {
          memos.value = pack.memos;
        }
        if (pack.system_prompt) {
          systemPrompt.value = pack.system_prompt;
        }
      }
    } catch (e) {
      console.error("Failed to load memo pack:", e);
    }
  }

  async function saveMemoPack() {
    try {
      await api.saveCurrentPack({
        system_prompt: systemPrompt.value,
        rules: memoRules.value.map(m => ({ title: m.title, update_rule: m.updateRule })),
        memos: memos.value,
      });
    } catch (e) {
      console.error("Failed to save memo pack:", e);
    }
  }

  watch([memoRules, memos, systemPrompt], () => {
    saveMemoPack();
  }, { deep: true });

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
    memoRules.value.push({ id: nextRuleId(), title: "", updateRule: "", expanded: true });
  }

  function toggleMemoRule(index: number) {
    memoRules.value[index].expanded = !memoRules.value[index].expanded;
  }

  function removeMemoRule(index: number) {
    memoRules.value.splice(index, 1);
    if (index < memos.value.length) {
      memos.value.splice(index, 1);
    }
  }

  function reorderMemoRule(from: number, to: number) {
    if (from === to) return;
    const [rule] = memoRules.value.splice(from, 1);
    memoRules.value.splice(to, 0, rule);
    if (memos.value.length > 0) {
      const [memo] = memos.value.splice(from, 1);
      memos.value.splice(to, 0, memo);
    }
  }

  function clearMessages() {
    if (messages.value.length === 0 || clearing.value) return;
    const container = messagesContainerRef.value;
    if (!container) {
      messages.value = [];
      resetComposer();
      return;
    }
    clearingHeight.value = container.clientHeight;
    clearing.value = true;
    nextTick(() => {
      const spacer = container.querySelector(".clearing-spacer") as HTMLElement | null;
      if (spacer) {
        const containerRect = container.getBoundingClientRect();
        const spacerRect = spacer.getBoundingClientRect();
        const targetScroll = container.scrollTop + (spacerRect.top - containerRect.top);
        container.scrollTo({ top: targetScroll, behavior: "smooth" });
      }
    });
    setTimeout(() => {
      messages.value = [];
      clearing.value = false;
      resetComposer();
    }, 600);
  }

  function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getSessionTitle(): string {
    const firstUser = messages.value.find(m => m.role === "user");
    if (firstUser) return summarizeMessage(firstUser).slice(0, 30) || "[Image]";
    return "New Chat";
  }

  async function loadSessions() {
    try {
      sessions.value = await api.listChatSessions() as ChatSession[];
    } catch (e) {
      console.error("Failed to load sessions:", e);
    }
  }

  async function saveCurrentSession() {
    if (messages.value.length === 0) return;
    if (!currentSessionId.value) currentSessionId.value = generateSessionId();
    try {
      await api.saveChatSession(currentSessionId.value, getSessionTitle(), messages.value);
      await loadSessions();
    } catch (e) {
      console.error("Failed to save session:", e);
    }
  }

  async function switchSession(id: string) {
    if (id === currentSessionId.value) return;
    await saveCurrentSession();
    try {
      const loaded = await api.loadChatSession(id) as Message[];
      messages.value = loaded;
      currentSessionId.value = id;
      resetComposer();
    } catch (e) {
      console.error("Failed to load session:", e);
    }
  }

  async function deleteSession(id: string) {
    try {
      await api.deleteChatSession(id);
      if (currentSessionId.value === id) {
        currentSessionId.value = null;
        messages.value = [];
      }
      await loadSessions();
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  }

  async function newChat() {
    if (messages.value.length === 0 && !currentSessionId.value) return;
    await saveCurrentSession();
    const container = messagesContainerRef.value;
    if (!container || messages.value.length === 0) {
      messages.value = [];
      currentSessionId.value = generateSessionId();
      resetComposer();
      return;
    }
    clearingHeight.value = container.clientHeight;
    clearing.value = true;
    nextTick(() => {
      const spacer = container.querySelector(".clearing-spacer") as HTMLElement | null;
      if (spacer) {
        const containerRect = container.getBoundingClientRect();
        const spacerRect = spacer.getBoundingClientRect();
        const targetScroll = container.scrollTop + (spacerRect.top - containerRect.top);
        container.scrollTo({ top: targetScroll, behavior: "smooth" });
      }
    });
    setTimeout(() => {
      messages.value = [];
      clearing.value = false;
      currentSessionId.value = generateSessionId();
      resetComposer();
    }, 600);
  }

  async function loadArchives() {
    try {
      archives.value = await api.listArchives() as ArchiveEntry[];
    } catch (e) {
      console.error("Failed to load archives:", e);
    }
  }

  async function openArchive(filename: string) {
    try {
      archiveMessages.value = await api.loadArchive(filename) as Message[];
      selectedArchive.value = filename;
    } catch (e) {
      console.error("Failed to load archive:", e);
    }
  }

  function closeArchive() {
    selectedArchive.value = null;
    archiveMessages.value = [];
  }

  function buildSystemMessage(history: ChatMessage[]) {
    const parts: string[] = [];
    const memosWithContent = memos.value.filter(m => m.content.trim());
    if (memosWithContent.length > 0) {
      parts.push(memosWithContent.map(m => `[${m.title}]: ${m.content}`).join("\n"));
    }
    if (systemPrompt.value.trim()) {
      parts.push(systemPrompt.value.trim());
    }
    if (parts.length > 0) {
      history.unshift({ role: "system", content: parts.join("\n") });
    }
  }

  function triggerSaveChat() {
    if (saveChatTimeout) clearTimeout(saveChatTimeout);
    saveChatTimeout = setTimeout(() => {
      api.saveChatHistory(messages.value).catch(e =>
        console.error("Failed to save chat history:", e)
      );
    }, 500);
  }

  function updateMessage(idx: number, content: string) {
    if (idx >= 0 && idx < messages.value.length) {
      messages.value[idx] = { ...messages.value[idx], content };
      triggerSaveChat();
    }
  }

  const highlightCache = new Map<string, string>();

  function highlightMarkdown(text: string): string {
    const cached = highlightCache.get(text);
    if (cached !== undefined) return cached;
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

    highlightCache.set(text, result);
    return result;
  }

  const renderedMessages = computed(() =>
    messages.value.map(m => ({
      role: m.role,
      html: highlightMarkdown(m.content),
      content: m.content,
      reasoning: m.reasoning || "",
      images: m.images || [],
    }))
  );

  const renderedArchiveMessages = computed(() =>
    archiveMessages.value.map(m => ({
      role: m.role,
      html: highlightMarkdown(m.content),
      content: m.content,
      reasoning: m.reasoning || "",
      images: m.images || [],
    }))
  );

  async function sendMessage() {
    if ((!input.value.trim() && pendingImages.value.length === 0) || loading.value) return;

    const userMessage: Message = {
      role: "user",
      content: input.value,
      images: pendingImages.value.length > 0 ? [...pendingImages.value] : undefined,
    };
    messages.value.push(userMessage);
    resetComposer();
    loading.value = true;

    const assistantMessage: Message = { role: "assistant", content: "", reasoning: "" };
    messages.value.push(assistantMessage);
    const assistantIndex = messages.value.length - 1;

    try {
      const history = messages.value.slice(0, -1).map(toChatMessage);

      buildSystemMessage(history);

      const result = await chatCompletion(
        history,
        { baseUrl: baseUrl.value, apiKey: apiKey.value, modelId: modelId.value, reasoningEnabled: reasoningEnabled.value },
        {
          onContent(chunk) {
            messages.value[assistantIndex] = {
              ...messages.value[assistantIndex],
              content: messages.value[assistantIndex].content + chunk,
            };
          },
          onReasoning(chunk) {
            messages.value[assistantIndex] = {
              ...messages.value[assistantIndex],
              reasoning: (messages.value[assistantIndex].reasoning || "") + chunk,
            };
          },
        },
      );

      messages.value[assistantIndex] = {
        ...messages.value[assistantIndex],
        content: result.content,
        reasoning: result.reasoning,
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

    const assistantMessage: Message = { role: "assistant", content: "", reasoning: "" };
    messages.value.push(assistantMessage);
    const assistantIndex = messages.value.length - 1;

    try {
      const history = messages.value.slice(0, -1).map(toChatMessage);

      buildSystemMessage(history);

      const result = await chatCompletion(
        history,
        { baseUrl: baseUrl.value, apiKey: apiKey.value, modelId: modelId.value, reasoningEnabled: reasoningEnabled.value },
        {
          onContent(chunk) {
            messages.value[assistantIndex] = {
              ...messages.value[assistantIndex],
              content: messages.value[assistantIndex].content + chunk,
            };
          },
          onReasoning(chunk) {
            messages.value[assistantIndex] = {
              ...messages.value[assistantIndex],
              reasoning: (messages.value[assistantIndex].reasoning || "") + chunk,
            };
          },
        },
      );

      messages.value[assistantIndex] = {
        ...messages.value[assistantIndex],
        content: result.content,
        reasoning: result.reasoning,
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
    compactProgress.value = 0;
    compactTotal.value = memoRules.value.length;

    try {
      const chatHistory = messages.value.map(m => `${m.role}: ${summarizeMessage(m)}`).join("\n");
      const config = { baseUrl: baseUrl.value, apiKey: apiKey.value, modelId: compactModelId.value || modelId.value, reasoningEnabled: compactReasoningEnabled.value };

      const tasks = memoRules.value.map(async (rule, idx) => {
        const currentContent = memos.value[idx]?.content || "(empty)";

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
          compactProgress.value++;
          return { title: rule.title, content: result.content.trim() };
        } catch (e) {
          console.error(`Memo "${rule.title}" failed:`, e);
          compactProgress.value++;
          return { title: rule.title, content: memos.value[idx]?.content || "" };
        }
      });

      memos.value = await Promise.all(tasks);

      await api.archiveChatHistory(messages.value).catch(e =>
        console.error("Failed to archive chat history:", e)
      );

      const container = messagesContainerRef.value;
      if (container) {
        clearingHeight.value = container.clientHeight;
        clearing.value = true;
        await nextTick();
        const spacer = container.querySelector(".clearing-spacer") as HTMLElement | null;
        if (spacer) {
          const containerRect = container.getBoundingClientRect();
          const spacerRect = spacer.getBoundingClientRect();
          const targetScroll = container.scrollTop + (spacerRect.top - containerRect.top);
          container.scrollTo({ top: targetScroll, behavior: "smooth" });
        }
        await new Promise(r => setTimeout(r, 600));
      }
      messages.value = [];
      clearing.value = false;
      resetComposer();
    } catch (e) {
      console.error("Memory compact failed:", e);
    } finally {
      compacting.value = false;
    }
  }


  return {
    currentTab,
    messages, renderedMessages, renderedArchiveMessages, input, pendingImages, loading,
    apiKey, modelId, compactModelId, baseUrl, reasoningEnabled, compactReasoningEnabled, systemPrompt,
    messagesEndRef, messagesContainerRef, inputRef,
    memoState, memoContentVisible, memoRules, memos, compacting, compactProgress, compactTotal, clearing, clearingHeight,
    sessions, currentSessionId,
    archives, selectedArchive, archiveMessages,
    memoBtnRef, memoPanelRef, memoTitleRef,
    memoBtnRect, memoTitleRect,
    openMemo, closeMemo, addMemoRule, toggleMemoRule, removeMemoRule, reorderMemoRule,
    clearMessages, updateMessage, addPendingImages, removePendingImage,
    addPendingImageAttachments,
    sendMessage, regenerate, memoryCompact,
    newChat, saveCurrentSession, switchSession, deleteSession, loadSessions,
    loadArchives, openArchive, closeArchive,
    loadMemoPack,
  };
}
