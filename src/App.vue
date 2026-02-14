<script setup lang="ts">
import { useApp } from "./useApp";

const {
  messages, input, loading,
  settingsState, settingsContentVisible, apiKey, modelId, baseUrl,
  messagesEndRef, messagesContainerRef,
  settingsBtnRef, settingsPanelRef, settingsTitleRef,
  settingsBtnRect, settingsTitleRect,
  memoState, memoContentVisible, memoRules,
  memoBtnRef, memoPanelRef, memoTitleRef,
  memoBtnRect, memoTitleRect,
  openSettings, closeSettings,
  openMemo, closeMemo, addMemoRule, toggleMemoRule, removeMemoRule,
  clearMessages, minimizeWindow, toggleMaximize, closeWindow,
  highlightMarkdown, sendMessage,
} = useApp();
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
        <div class="memo-list">
          <div v-for="(rule, idx) in memoRules" :key="idx" class="memo-item">
            <div class="memo-item-header" @click="toggleMemoRule(idx)">
              <span class="memo-item-title">{{ rule.description || 'Untitled rule' }}</span>
              <div class="memo-item-actions">
                <button class="memo-remove-btn" @click.stop="removeMemoRule(idx)">&times;</button>
                <span class="memo-arrow" :class="{ 'memo-arrow-open': rule.expanded }">&#x25B8;</span>
              </div>
            </div>
            <div class="memo-item-body-wrapper" :class="{ expanded: rule.expanded }">
              <div class="memo-item-body">
                <div class="form-group">
                  <label>Description</label>
                  <input type="text" v-model="rule.description" placeholder="Enter description..." />
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
