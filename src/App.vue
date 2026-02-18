<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted } from "vue";
import { useApp } from "./useApp";
import { useMarket } from "./useMarket";
import TabBar from "./components/TabBar.vue";
import ChatView from "./components/ChatView.vue";
import ArchivesView from "./components/ArchivesView.vue";
import MarketView from "./components/MarketView.vue";
import SettingsView from "./components/SettingsView.vue";
import MemoPanel from "./components/MemoPanel.vue";

const {
  currentTab,
  messages, renderedMessages, renderedArchiveMessages, input, loading,
  apiKey, modelId, compactModelId, baseUrl, reasoningEnabled, compactReasoningEnabled, systemPrompt,
  messagesEndRef, messagesContainerRef, inputRef,
  memoState, memoContentVisible, memoRules, memos, compacting, compactProgress, compactTotal, clearing, clearingHeight,
  sessions, currentSessionId,
  archives, selectedArchive, archiveMessages,
  memoBtnRef, memoPanelRef, memoTitleRef,
  memoBtnRect, memoTitleRect,
  openMemo, closeMemo, addMemoRule, toggleMemoRule, removeMemoRule, reorderMemoRule,
  clearMessages, updateMessage,
  sendMessage, regenerate, memoryCompact,
  newChat, switchSession, deleteSession, loadSessions,
  loadArchives, openArchive, closeArchive,
  loadMemoPack,
} = useApp();

const {
  packs, currentView: marketView, selectedPack, searchQuery,
  filteredPacks,
  editPack,
  startCreate, startEdit, addRule, removeRule, addMemo, removeMemo,
  saveCurrentPack, viewPack, goBack,
  exportPack, importPack, importFromMemoChat,
  viewMode, loadingRemote,
  channels, selectedChannelId, selectedChannel,
  publishing, publishError, publishSuccess,
  newChannelUrl, newChannelToken, addingChannel, addChannelError,
  addChannel, removeChannel, updateChannelToken, registerOnChannel,
  publishPack, openPublish, installPack, deletePack,
} = useMarket();

// Provide refs for child components to bind
provide("messagesEndRef", messagesEndRef);
provide("messagesContainerRef", messagesContainerRef);
provide("inputRef", inputRef);
provide("memoPanelRef", memoPanelRef);
provide("memoTitleRef", memoTitleRef);

const regUsername = ref("");
const regDisplayName = ref("");
const historyOpen = ref(false);
const historyDropdownRef = ref<HTMLDivElement | null>(null);

function toggleHistory() {
  if (!historyOpen.value) loadSessions();
  historyOpen.value = !historyOpen.value;
}

function onHistoryClickOutside(e: MouseEvent) {
  if (historyDropdownRef.value && !historyDropdownRef.value.contains(e.target as Node)) {
    historyOpen.value = false;
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch { return ''; }
}

function handleRegister() {
  if (regUsername.value.trim() && selectedChannelId.value) {
    registerOnChannel(selectedChannelId.value, regUsername.value.trim(), regDisplayName.value.trim() || regUsername.value.trim());
  }
}

function onTabChange(tab: string) {
  if (tab === "archives") loadArchives();
}

function onInstallPack(pack: any) {
  installPack(pack).then(() => loadMemoPack());
}

onMounted(() => document.addEventListener("mousedown", onHistoryClickOutside));
onUnmounted(() => document.removeEventListener("mousedown", onHistoryClickOutside));
</script>

<template>
  <main class="chat-container">
    <header class="chat-header" data-tauri-drag-region>
      <h1 data-tauri-drag-region>MemoChat</h1>
      <div class="header-actions">
        <button class="clear-btn" @click="newChat" :disabled="messages.length === 0 && !currentSessionId">+</button>
        <div ref="historyDropdownRef" class="history-dropdown-wrapper">
          <button class="history-btn" @click="toggleHistory">&#x25BE;</button>
          <div v-if="historyOpen" class="history-dropdown">
            <div v-if="sessions.length === 0" class="history-empty">No saved chats</div>
            <div
              v-for="s in sessions" :key="s.id"
              class="history-item"
              :class="{ active: s.id === currentSessionId }"
              @click="switchSession(s.id); historyOpen = false"
            >
              <div class="history-item-info">
                <span class="history-item-title">{{ s.title || 'Untitled' }}</span>
                <span class="history-item-meta">{{ formatDate(s.created_at) }} · {{ s.message_count }} msgs</span>
              </div>
              <button class="history-item-delete" @click.stop="deleteSession(s.id)">&times;</button>
            </div>
          </div>
        </div>
        <button class="compact-btn" @click="memoryCompact" :disabled="compacting || messages.length === 0">
          {{ compacting ? `${compactProgress}/${compactTotal}` : 'Compact' }}
        </button>
        <button ref="memoBtnRef" class="memo-btn" @click="openMemo" :class="{ 'memo-btn-hidden': memoState !== 'closed' }">Memo</button>
      </div>
    </header>

    <ChatView
      v-if="currentTab === 'chat'"
      :messages="messages"
      :renderedMessages="renderedMessages"
      :input="input"
      :loading="loading"
      :clearing="clearing"
      :clearingHeight="clearingHeight"
      @update:input="input = $event"
      @send="sendMessage"
      @regenerate="regenerate"
      @updateMessage="updateMessage"
    />

    <ArchivesView
      v-if="currentTab === 'archives'"
      :archives="archives"
      :selectedArchive="selectedArchive"
      :renderedArchiveMessages="renderedArchiveMessages"
      @openArchive="openArchive"
      @closeArchive="closeArchive"
    />

    <MarketView
      v-if="currentTab === 'market'"
      :marketView="marketView"
      :selectedPack="selectedPack"
      :searchQuery="searchQuery"
      :filteredPacks="filteredPacks"
      :editPack="editPack"
      :viewMode="viewMode"
      :loadingRemote="loadingRemote"
      :packs="packs"
      :channels="channels"
      :selectedChannelId="selectedChannelId"
      :selectedChannel="selectedChannel"
      :publishing="publishing"
      :publishError="publishError"
      :publishSuccess="publishSuccess"
      :regUsername="regUsername"
      :regDisplayName="regDisplayName"
      @update:searchQuery="searchQuery = $event"
      @update:viewMode="viewMode = $event"
      @update:selectedChannelId="selectedChannelId = $event"
      @update:regUsername="regUsername = $event"
      @update:regDisplayName="regDisplayName = $event"
      @importPack="importPack"
      @importFromChat="importFromMemoChat"
      @startCreate="startCreate"
      @viewPack="viewPack"
      @goBack="goBack"
      @exportPack="exportPack"
      @openPublish="openPublish"
      @startEdit="startEdit"
      @installPack="onInstallPack"
      @deletePack="deletePack"
      @saveCurrentPack="saveCurrentPack"
      @addRule="addRule"
      @removeRule="removeRule"
      @addMemo="addMemo"
      @removeMemo="removeMemo"
      @publishPack="publishPack"
      @updateChannelToken="updateChannelToken"
      @handleRegister="handleRegister"
    />

    <SettingsView
      v-if="currentTab === 'settings'"
      :apiKey="apiKey"
      :modelId="modelId"
      :compactModelId="compactModelId"
      :baseUrl="baseUrl"
      :reasoningEnabled="reasoningEnabled"
      :compactReasoningEnabled="compactReasoningEnabled"
      :channels="channels"
      :newChannelUrl="newChannelUrl"
      :newChannelToken="newChannelToken"
      :addingChannel="addingChannel"
      :addChannelError="addChannelError"
      @update:apiKey="apiKey = $event"
      @update:modelId="modelId = $event"
      @update:compactModelId="compactModelId = $event"
      @update:baseUrl="baseUrl = $event"
      @update:reasoningEnabled="reasoningEnabled = $event"
      @update:compactReasoningEnabled="compactReasoningEnabled = $event"
      @update:newChannelUrl="newChannelUrl = $event"
      @update:newChannelToken="newChannelToken = $event"
      @addChannel="addChannel"
      @removeChannel="removeChannel"
    />

    <TabBar v-model="currentTab" @tabChange="onTabChange" />

    <MemoPanel
      :memoState="memoState"
      :memoContentVisible="memoContentVisible"
      :memoRules="memoRules"
      :memos="memos"
      :systemPrompt="systemPrompt"
      :memoBtnRect="memoBtnRect"
      :memoTitleRect="memoTitleRect"
      @update:systemPrompt="systemPrompt = $event"
      @closeMemo="closeMemo"
      @addMemoRule="addMemoRule"
      @toggleMemoRule="toggleMemoRule"
      @removeMemoRule="removeMemoRule"
      @reorderMemoRule="reorderMemoRule"
    />
  </main>
</template>
