<script setup lang="ts">
import { ref } from "vue";
import { useApp } from "./useApp";
import { useMarket } from "./useMarket";

const {
  currentTab,
  messages, renderedMessages, input, loading,
  apiKey, modelId, compactModelId, baseUrl, reasoningEnabled, compactReasoningEnabled, systemPrompt,
  messagesEndRef, messagesContainerRef, inputRef,
  memoState, memoContentVisible, memoRules, memos, compacting, compactProgress, compactTotal, clearing, clearingHeight,
  memoBtnRef, memoPanelRef, memoTitleRef,
  memoBtnRect, memoTitleRect,
  openMemo, closeMemo, addMemoRule, toggleMemoRule, removeMemoRule, reorderMemoRule,
  clearMessages, updateMessage,
  sendMessage, regenerate, memoryCompact,
  exportMemos, importMemos, exportRules, importRules,
} = useApp();

const {
  packs, installedIds, currentView: marketView, selectedPack, searchQuery, filterTag,
  filteredPacks, allTags,
  editPack,
  startCreate, startEdit, addRule, removeRule, addMemo, removeMemo, addTag, removeTag,
  saveCurrentPack, viewPack, goBack,
  exportPack, importPack, importFromMemoChat,
  viewMode, loadingRemote,
  channels, selectedChannelId, selectedChannel,
  publishing, publishError, publishSuccess,
  newChannelUrl, newChannelToken, addingChannel, addChannelError,
  addChannel, removeChannel, updateChannelToken, registerOnChannel,
  publishPack, openPublish, toggleInstall, deletePack,
} = useMarket();

const tagInput = ref("");
const regUsername = ref("");
const regDisplayName = ref("");

function handleAddTag() {
  if (tagInput.value.trim()) {
    addTag(tagInput.value);
    tagInput.value = "";
  }
}

function handleRegister() {
  if (regUsername.value.trim() && selectedChannelId.value) {
    registerOnChannel(selectedChannelId.value, regUsername.value.trim(), regDisplayName.value.trim() || regUsername.value.trim());
  }
}

const dragIdx = ref<number | null>(null);
const memoListRef = ref<HTMLDivElement | null>(null);

function startDrag(idx: number, e: PointerEvent) {
  e.preventDefault();
  dragIdx.value = idx;

  const onMove = (ev: PointerEvent) => {
    const listEl = memoListRef.value;
    if (dragIdx.value === null || !listEl) return;
    const items = listEl.querySelectorAll<HTMLElement>(".memo-item");
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (ev.clientY < rect.top + rect.height / 2) {
        if (i !== dragIdx.value) {
          reorderMemoRule(dragIdx.value, i);
          dragIdx.value = i;
        }
        return;
      }
    }
    const last = items.length - 1;
    if (last >= 0 && last !== dragIdx.value) {
      reorderMemoRule(dragIdx.value, last);
      dragIdx.value = last;
    }
  };

  const onUp = () => {
    dragIdx.value = null;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
  };

  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}
</script>

<template>
  <main class="chat-container">
    <header class="chat-header" data-tauri-drag-region>
      <h1 data-tauri-drag-region>MemoChat</h1>
      <div class="header-actions">
        <button class="clear-btn" @click="clearMessages" :disabled="messages.length === 0">
          +
        </button>
        <button
          class="compact-btn"
          @click="memoryCompact"
          :disabled="compacting || messages.length === 0"
        >
          {{ compacting ? `${compactProgress}/${compactTotal}` : 'Compact' }}
        </button>
        <button
          ref="memoBtnRef"
          class="memo-btn"
          @click="openMemo"
          :class="{ 'memo-btn-hidden': memoState !== 'closed' }"
        >
          Memo
        </button>
      </div>
    </header>

    <!-- Chat Tab Content -->
    <div v-if="currentTab === 'chat'" class="tab-content">
      <div ref="messagesContainerRef" class="messages-container">
        <div v-if="messages.length === 0 && !clearing" class="empty-state">Start a conversation!</div>
        <div
          v-for="(msg, idx) in renderedMessages"
          :key="idx"
          :class="['message', msg.role]"
        >
          <details v-if="msg.reasoning" class="reasoning-block" :open="loading && idx === renderedMessages.length - 1">
            <summary class="reasoning-summary">Reasoning</summary>
            <div class="reasoning-content">{{ msg.reasoning }}</div>
          </details>
          <div
            class="message-content"
            v-html="msg.html"
            @dblclick="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.contentEditable = 'true'; el.focus(); }"
            @blur="(e: FocusEvent) => { const el = e.target as HTMLElement; el.contentEditable = 'false'; updateMessage(idx, el.innerText); }"
            @keydown.escape="(e: KeyboardEvent) => { (e.target as HTMLElement).blur(); }"
          ></div>
        </div>
        <div v-if="loading && messages[messages.length - 1]?.content === ''" class="message assistant">
          <div class="message-content loading">Thinking...</div>
        </div>
        <div v-if="clearing" class="clearing-spacer" :style="{ height: clearingHeight + 'px' }">
          <div class="empty-state">Start a conversation!</div>
        </div>
        <div ref="messagesEndRef"></div>
      </div>

      <div class="input-container">
        <textarea
          ref="inputRef"
          v-model="input"
          placeholder="Type a message..."
          :disabled="loading"
          rows="1"
          @input="($event.target as HTMLTextAreaElement).style.height = 'auto'; ($event.target as HTMLTextAreaElement).style.height = ($event.target as HTMLTextAreaElement).scrollHeight + 'px'"
          @keydown.ctrl.enter.prevent="input.trim() ? sendMessage() : regenerate()"
        ></textarea>
        <button @click="input.trim() ? sendMessage() : regenerate()" :disabled="loading || (!input.trim() && (messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant'))">
          {{ input.trim() ? 'Send' : (messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' ? 'Regen' : 'Send') }}
        </button>
      </div>
    </div>

    <!-- Market Tab Content -->
    <div v-if="currentTab === 'market'" class="tab-content market-content">
      <!-- Market Header -->
      <div class="market-header">
        <div class="header-left">
          <div class="mode-toggle">
            <span class="mode-label" :class="{ active: viewMode === 'local' }">Local</span>
            <button class="toggle-switch" :class="{ remote: viewMode === 'remote' }" @click="viewMode = viewMode === 'local' ? 'remote' : 'local'">
              <span class="toggle-knob"></span>
            </button>
            <span class="mode-label" :class="{ active: viewMode === 'remote' }">Remote</span>
            <span v-if="loadingRemote" class="loading-dot"></span>
          </div>
        </div>
        <div class="header-actions">
          <button class="action-btn" @click="importPack">Import Pack</button>
          <button class="action-btn" @click="importFromMemoChat">Import from MemoChat</button>
          <button class="action-btn primary" @click="startCreate">+ New Pack</button>
        </div>
      </div>

      <!-- Browse View -->
      <div v-if="marketView === 'browse'" class="market-browse-view">
        <div class="search-bar">
          <input type="text" v-model="searchQuery" placeholder="Search packs..." class="search-input" />
        </div>
        <div v-if="allTags.length > 0" class="tag-filter">
          <button class="tag-pill" :class="{ active: filterTag === '' }" @click="filterTag = ''">All</button>
          <button
            v-for="tag in allTags" :key="tag"
            class="tag-pill" :class="{ active: filterTag === tag }"
            @click="filterTag = filterTag === tag ? '' : tag"
          >{{ tag }}</button>
        </div>

        <div v-if="filteredPacks.length === 0" class="empty-state">
          <p v-if="viewMode === 'remote' && channels.length === 0">No channels configured. Add a backend server first.</p>
          <p v-else-if="viewMode === 'remote' && loadingRemote">Loading remote packs...</p>
          <p v-else-if="packs.length === 0 && viewMode === 'local'">No rule packs yet. Create one or import from MemoChat!</p>
          <p v-else>No packs match your search.</p>
        </div>

        <div class="pack-grid">
          <div v-for="pack in filteredPacks" :key="pack.id" class="pack-card" @click="viewPack(pack)">
            <div class="pack-card-header">
              <span class="pack-name">{{ pack.name || 'Untitled' }}</span>
              <span v-if="viewMode === 'local'" class="install-badge" :class="{ installed: installedIds.includes(pack.id) }">
                {{ installedIds.includes(pack.id) ? '✓' : '' }}
              </span>
            </div>
            <p class="pack-desc">{{ pack.description || 'No description' }}</p>
            <div class="pack-meta">
              <span v-if="pack.author" class="pack-author">{{ pack.author }}</span>
              <span v-if="(pack as any)._channelName" class="pack-channel-badge">{{ (pack as any)._channelName }}</span>
              <span class="pack-rules-count">{{ pack.rules.length }} rules</span>
            </div>
            <div v-if="pack.tags.length > 0" class="pack-tags">
              <span v-for="tag in pack.tags.slice(0, 3)" :key="tag" class="tag-small">{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail View -->
      <div v-if="marketView === 'detail' && selectedPack" class="market-detail-view">
        <div class="detail-header">
          <button class="back-btn" @click="goBack">&larr; Back</button>
          <div class="detail-actions">
            <button class="action-btn" @click="exportPack(selectedPack!)">Export Pack</button>
            <button class="action-btn publish-btn" @click="openPublish(selectedPack!)">Publish</button>
            <button class="action-btn" @click="startEdit(selectedPack!)">Edit</button>
            <button
              class="action-btn" :class="{ primary: !installedIds.includes(selectedPack!.id) }"
              @click="toggleInstall(selectedPack!.id)"
            >{{ installedIds.includes(selectedPack!.id) ? 'Uninstall' : 'Install' }}</button>
            <button class="action-btn danger" @click="deletePack(selectedPack!.id)">Delete</button>
          </div>
        </div>
        <div class="detail-content">
          <h2>{{ selectedPack.name }}</h2>
          <p class="detail-desc">{{ selectedPack.description }}</p>
          <div class="detail-info">
            <span v-if="selectedPack.author">By {{ selectedPack.author }}</span>
            <span>v{{ selectedPack.version }}</span>
            <span>{{ selectedPack.rules.length }} rules</span>
          </div>
          <div v-if="selectedPack.tags.length > 0" class="detail-tags">
            <span v-for="tag in selectedPack.tags" :key="tag" class="tag-pill small">{{ tag }}</span>
          </div>
          <div v-if="selectedPack.systemPrompt" class="detail-section">
            <h3>System Prompt</h3>
            <div class="code-block">{{ selectedPack.systemPrompt }}</div>
          </div>
          <div class="detail-section">
            <h3>Rules ({{ selectedPack.rules.length }})</h3>
            <div v-for="(rule, idx) in selectedPack.rules" :key="idx" class="rule-card">
              <div class="rule-title">{{ rule.title || 'Untitled' }}</div>
              <div class="rule-update">{{ rule.updateRule }}</div>
            </div>
            <div v-if="selectedPack.rules.length === 0" class="empty-hint">No rules</div>
          </div>
          <div v-if="selectedPack.memos.length > 0" class="detail-section">
            <h3>Memos ({{ selectedPack.memos.length }})</h3>
            <div v-for="(memo, idx) in selectedPack.memos" :key="idx" class="memo-card">
              <div class="memo-title">{{ memo.title || 'Untitled' }}</div>
              <div class="memo-content">{{ memo.content }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create/Edit View -->
      <div v-if="marketView === 'create'" class="market-create-view">
        <div class="detail-header">
          <button class="back-btn" @click="goBack">&larr; Cancel</button>
          <button class="action-btn primary" @click="saveCurrentPack">Save Pack</button>
        </div>
        <div class="create-content">
          <div class="form-group">
            <label>Pack Name</label>
            <input type="text" v-model="editPack.name" placeholder="My Rule Pack" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <input type="text" v-model="editPack.description" placeholder="What does this pack do?" />
          </div>
          <div class="form-row">
            <div class="form-group"><label>Author</label><input type="text" v-model="editPack.author" placeholder="Your name" /></div>
            <div class="form-group"><label>Version</label><input type="text" v-model="editPack.version" placeholder="1.0.0" /></div>
          </div>
          <div class="form-group">
            <label>System Prompt</label>
            <textarea v-model="editPack.systemPrompt" placeholder="System prompt for the AI..." rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Tags</label>
            <div class="tags-editor">
              <span v-for="(tag, idx) in editPack.tags" :key="idx" class="tag-pill small editable">
                {{ tag }}<button class="tag-remove" @click="removeTag(idx)">&times;</button>
              </span>
              <input type="text" v-model="tagInput" placeholder="Add tag..." class="tag-input" @keydown.enter.prevent="handleAddTag" />
            </div>
          </div>
          <div class="rules-section">
            <div class="section-header">
              <h3>Rules ({{ editPack.rules.length }})</h3>
              <button class="action-btn" @click="addRule">+ Add Rule</button>
            </div>
            <div v-for="(rule, idx) in editPack.rules" :key="idx" class="rule-edit-card">
              <div class="rule-edit-header">
                <span class="rule-num">#{{ idx + 1 }}</span>
                <button class="remove-btn" @click="removeRule(idx)">&times;</button>
              </div>
              <div class="form-group"><label>Title</label><input type="text" v-model="rule.title" placeholder="Rule title..." /></div>
              <div class="form-group"><label>Update Rule</label><input type="text" v-model="rule.updateRule" placeholder="How to update this memo..." /></div>
            </div>
            <button v-if="editPack.rules.length === 0" class="empty-add-btn" @click="addRule">+ Add your first rule</button>
          </div>
          <div class="memos-section">
            <div class="section-header">
              <h3>Memos ({{ editPack.memos.length }})</h3>
              <button class="action-btn" @click="addMemo">+ Add Memo</button>
            </div>
            <div v-for="(memo, idx) in editPack.memos" :key="idx" class="memo-edit-card">
              <div class="memo-edit-header">
                <span class="memo-num">#{{ idx + 1 }}</span>
                <button class="remove-btn" @click="removeMemo(idx)">&times;</button>
              </div>
              <div class="form-group"><label>Title</label><input type="text" v-model="memo.title" placeholder="Memo title..." /></div>
              <div class="form-group"><label>Content</label><textarea v-model="memo.content" placeholder="Memo content..." rows="3"></textarea></div>
            </div>
            <button v-if="editPack.memos.length === 0" class="empty-add-btn" @click="addMemo">+ Add your first memo</button>
          </div>
        </div>
      </div>

      <!-- Publish View -->
      <div v-if="marketView === 'publish' && selectedPack" class="market-publish-view">
        <div class="detail-header">
          <button class="back-btn" @click="goBack">&larr; Back</button>
        </div>
        <div class="publish-content">
          <h2>Publish "{{ selectedPack.name }}"</h2>

          <!-- Channel Selection -->
          <div class="publish-section">
            <h3>Select Channel</h3>
            <div v-if="channels.length === 0" class="empty-channel">
              <p>No channels configured. Add a backend server in Settings first.</p>
            </div>
            <div v-else class="channel-select">
              <button
                v-for="ch in channels" :key="ch.id"
                class="channel-pill"
                :class="{ active: selectedChannelId === ch.id }"
                @click="selectedChannelId = ch.id"
              >
                <span class="channel-pill-name">{{ ch.name }}</span>
                <span class="channel-pill-url">{{ ch.url }}</span>
              </button>
            </div>
          </div>

          <!-- Selected channel details -->
          <div v-if="selectedChannel" class="publish-section">
            <h3>{{ selectedChannel.name }}</h3>
            <p v-if="selectedChannel.description" class="channel-desc">{{ selectedChannel.description }}</p>
            <p class="channel-url">{{ selectedChannel.url }}</p>
            <div v-if="!selectedChannel.token" class="register-section">
              <p class="hint">No token for this channel. Register or paste a token:</p>
              <div class="form-group">
                <label>Token</label>
                <input type="password" :value="selectedChannel.token" @input="updateChannelToken(selectedChannel!.id, ($event.target as HTMLInputElement).value)" placeholder="Paste auth token..." />
              </div>
              <div class="settings-divider"></div>
              <p class="hint">Or register a new account:</p>
              <div class="form-row">
                <div class="form-group"><label>Username</label><input type="text" v-model="regUsername" placeholder="username" /></div>
                <div class="form-group"><label>Display Name</label><input type="text" v-model="regDisplayName" placeholder="Your Name" /></div>
              </div>
              <button class="action-btn primary" @click="handleRegister" :disabled="!regUsername.trim()">Register</button>
            </div>
            <div v-else class="token-status">
              <span class="token-ok">Authenticated</span>
            </div>
          </div>

          <!-- Publish Action -->
          <div class="publish-action">
            <div v-if="publishError" class="publish-msg error">{{ publishError }}</div>
            <div v-if="publishSuccess" class="publish-msg success">{{ publishSuccess }}</div>
            <button
              class="action-btn primary publish-go"
              @click="publishPack(selectedPack!)"
              :disabled="publishing || !selectedChannel || !selectedChannel?.token"
            >{{ publishing ? 'Publishing...' : 'Publish' }}</button>
          </div>
        </div>
      </div>

    </div>

    <!-- Settings Tab Content -->
    <div v-if="currentTab === 'settings'" class="tab-content settings-content">
      <div class="settings-form">
        <h2>Settings</h2>
        <div class="form-group">
          <label>Base URL</label>
          <input
            type="text"
            v-model="baseUrl"
            placeholder="https://openrouter.ai/api/v1"
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
          <div class="label-row">
            <label>Model ID</label>
            <button
              type="button"
              class="reasoning-pill"
              :class="{ active: reasoningEnabled }"
              @click="reasoningEnabled = !reasoningEnabled"
            >Reasoning</button>
          </div>
          <input
            type="text"
            v-model="modelId"
            placeholder=""
          />
        </div>
        <div class="form-group">
          <div class="label-row">
            <label>Model ID for Compact</label>
            <button
              type="button"
              class="reasoning-pill"
              :class="{ active: compactReasoningEnabled }"
              @click="compactReasoningEnabled = !compactReasoningEnabled"
            >Reasoning</button>
          </div>
          <input
            type="text"
            v-model="compactModelId"
            placeholder="(same as Model ID)"
          />
        </div>

        <div class="settings-divider"></div>

        <!-- Channels -->
        <h3 class="settings-section-title">Channels</h3>
        <p class="channels-hint">Backend servers for browsing and publishing packs.</p>

        <div class="new-channel-form">
          <div class="form-group">
            <label>Server URL</label>
            <input type="text" v-model="newChannelUrl" placeholder="http://localhost:8080" @keydown.enter="addChannel" />
          </div>
          <div class="form-group">
            <label>Auth Token (optional)</label>
            <input type="password" v-model="newChannelToken" placeholder="Token if you already have one" />
          </div>
          <div v-if="addChannelError" class="publish-msg error">{{ addChannelError }}</div>
          <button class="action-btn primary" @click="addChannel" :disabled="addingChannel || !newChannelUrl.trim()">
            {{ addingChannel ? 'Connecting...' : '+ Add Channel' }}
          </button>
        </div>

        <div v-if="channels.length === 0" class="empty-state" style="padding: 12px 0; margin-top: 0;">
          <p>No channels yet. Add a server URL above.</p>
        </div>
        <div class="channel-list">
          <div v-for="ch in channels" :key="ch.id" class="channel-card">
            <div class="channel-card-header">
              <span class="channel-card-name">{{ ch.name }}</span>
              <button class="remove-btn" @click="removeChannel(ch.id)">&times;</button>
            </div>
            <p class="channel-card-url">{{ ch.url }}</p>
            <p v-if="ch.description" class="channel-card-desc">{{ ch.description }}</p>
            <div class="channel-card-token">
              <span v-if="ch.token" class="token-ok">Authenticated</span>
              <span v-else class="token-missing">No token</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Tabs -->
    <div class="bottom-tabs">
      <button
        class="tab-btn"
        :class="{ active: currentTab === 'chat' }"
        @click="currentTab = 'chat'"
      >
        Chat
      </button>
      <button
        class="tab-btn"
        :class="{ active: currentTab === 'market' }"
        @click="currentTab = 'market'"
      >
        Market
      </button>
      <button
        class="tab-btn"
        :class="{ active: currentTab === 'settings' }"
        @click="currentTab = 'settings'"
      >
        Settings
      </button>
    </div>


    <!-- Memo Panel -->
    <div
      v-if="memoState !== 'closed'"
      ref="memoPanelRef"
      class="settings-panel memo-panel"
      :class="memoState"
      :style="memoState === 'expanding' || memoState === 'collapsing' ? {
        '--btn-top': memoBtnRect.top + 'px',
        '--btn-left': memoBtnRect.left + 'px',
        '--btn-width': memoBtnRect.width + 'px',
        '--btn-height': memoBtnRect.height + 'px',
      } : {}"
    >
      <div class="settings-content" :class="{ 'content-visible': memoContentVisible }">
        <div class="settings-header">
          <h2 ref="memoTitleRef" :class="{ 'title-hidden': memoState === 'expanding' || memoState === 'collapsing' }">Memo</h2>
          <button class="close-btn" @click="closeMemo">&times;</button>
        </div>

        <div class="form-group">
          <label>System Prompt</label>
          <input type="text" v-model="systemPrompt" placeholder="Enter system prompt..." />
        </div>

        <div class="memo-section-header">
          <span class="memo-section-title">Rules</span>
          <div class="memo-section-actions">
            <button class="header-action-btn" @click="exportRules">Export</button>
            <button class="header-action-btn" @click="importRules">Import</button>
          </div>
        </div>
        <div ref="memoListRef" class="memo-list">
          <div
            v-for="(rule, idx) in memoRules"
            :key="rule.id"
            class="memo-item"
            :class="{ 'dragging': dragIdx === idx }"
          >
            <div class="memo-item-header" @click="toggleMemoRule(idx)">
              <span class="drag-handle" @pointerdown.stop="startDrag(idx, $event)">&#x2261;</span>
              <span class="memo-item-title">{{ rule.title || 'Untitled item' }}</span>
              <div class="memo-item-actions">
                <button class="memo-remove-btn" @click.stop="removeMemoRule(idx)">&times;</button>
                <span class="memo-arrow" :class="{ 'memo-arrow-open': rule.expanded }">&#x25B8;</span>
              </div>
            </div>
            <div class="memo-item-body-wrapper" :class="{ expanded: rule.expanded }">
              <div class="memo-item-body">
                <div class="form-group">
                  <label>Description</label>
                  <input type="text" v-model="rule.title" placeholder="Enter title..." />
                </div>
                <div class="form-group">
                  <label>Update Rule</label>
                  <input type="text" v-model="rule.updateRule" placeholder="Enter update rule..." />
                </div>
              </div>
            </div>
          </div>
          <button class="memo-add-btn" @click="addMemoRule">+</button>
        </div>

        <div class="memo-section-header">
          <span class="memo-section-title">Memos</span>
          <div class="memo-section-actions">
            <button class="header-action-btn" @click="exportMemos">Export</button>
            <button class="header-action-btn" @click="importMemos">Import</button>
          </div>
        </div>
        <div class="memo-list" v-if="memos.length > 0">
          <div v-for="(rule, idx) in memoRules" :key="idx" class="memo-content-item">
            <div class="memo-content-title">{{ rule.title || 'Untitled' }}</div>
            <div class="memo-content-text">{{ memos[idx]?.content || '(empty)' }}</div>
          </div>
        </div>
        <div v-else class="memo-empty-hint">No memos yet. Run Compact to generate.</div>
      </div>
    </div>

    <!-- Floating Memo text for animation -->
    <div
      v-if="memoState === 'expanding' || memoState === 'collapsing'"
      class="floating-settings-text"
      :class="memoState"
      :style="{
        '--btn-top': memoBtnRect.top + 'px',
        '--btn-left': memoBtnRect.left + 'px',
        '--btn-width': memoBtnRect.width + 'px',
        '--btn-height': memoBtnRect.height + 'px',
        '--title-top': memoTitleRect.top + 'px',
        '--title-left': memoTitleRect.left + 'px',
      }"
    >
      Memo
    </div>
  </main>
</template>
