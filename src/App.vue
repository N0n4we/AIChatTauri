<script setup lang="ts">
import { ref } from "vue";
import { useApp } from "./useApp";

const {
  messages, renderedMessages, input, loading,
  settingsState, settingsContentVisible, apiKey, modelId, compactModelId, baseUrl, reasoningEnabled, systemPrompt,
  messagesEndRef, messagesContainerRef, inputRef,
  settingsBtnRef, settingsPanelRef, settingsTitleRef,
  settingsBtnRect, settingsTitleRect,
  memoState, memoContentVisible, memoRules, memos, compacting, compactProgress, compactTotal, clearing, clearingHeight,
  memoBtnRef, memoPanelRef, memoTitleRef,
  memoBtnRect, memoTitleRect,
  openSettings, closeSettings,
  openMemo, closeMemo, addMemoRule, toggleMemoRule, removeMemoRule, reorderMemoRule,
  clearMessages, updateMessage,
  sendMessage, regenerate, memoryCompact,
  exportMemos, importMemos, exportRules, importRules,
} = useApp();

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
      <h1 data-tauri-drag-region>AIChat</h1>
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
          ref="settingsBtnRef"
          class="settings-btn"
          @click="openSettings"
          :class="{ 'settings-btn-hidden': settingsState !== 'closed' }"
        >
          Settings
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
          <label>Model ID for Compact</label>
          <input
            type="text"
            v-model="compactModelId"
            placeholder="(same as Model ID)"
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
