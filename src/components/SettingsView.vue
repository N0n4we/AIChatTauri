<script setup lang="ts">
import type { Channel } from "../api";

defineProps<{
  apiKey: string;
  modelId: string;
  compactModelId: string;
  baseUrl: string;
  reasoningEnabled: boolean;
  compactReasoningEnabled: boolean;
  channels: Channel[];
  newChannelUrl: string;
  newChannelUsername: string;
  newChannelPassword: string;
  newChannelIsLogin: boolean;
  addingChannel: boolean;
  addChannelError: string;
}>();

const emit = defineEmits<{
  (e: "update:apiKey", v: string): void;
  (e: "update:modelId", v: string): void;
  (e: "update:compactModelId", v: string): void;
  (e: "update:baseUrl", v: string): void;
  (e: "update:reasoningEnabled", v: boolean): void;
  (e: "update:compactReasoningEnabled", v: boolean): void;
  (e: "update:newChannelUrl", v: string): void;
  (e: "update:newChannelUsername", v: string): void;
  (e: "update:newChannelPassword", v: string): void;
  (e: "update:newChannelIsLogin", v: boolean): void;
  (e: "addChannel"): void;
  (e: "removeChannel", id: string): void;
}>();
</script>

<template>
  <div class="tab-content settings-content">
    <div class="settings-form">
      <h2>Settings</h2>
      <div class="form-group">
        <label>Base URL</label>
        <input type="text" :value="baseUrl"
          @input="emit('update:baseUrl', ($event.target as HTMLInputElement).value)"
          placeholder="https://openrouter.ai/api/v1" />
      </div>
      <div class="form-group">
        <label>API Key</label>
        <input type="password" :value="apiKey"
          @input="emit('update:apiKey', ($event.target as HTMLInputElement).value)"
          placeholder="sk-..." />
      </div>
      <div class="form-group">
        <div class="label-row">
          <label>Model ID</label>
          <button type="button" class="reasoning-pill" :class="{ active: reasoningEnabled }"
            @click="emit('update:reasoningEnabled', !reasoningEnabled)">Reasoning</button>
        </div>
        <input type="text" :value="modelId"
          @input="emit('update:modelId', ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="form-group">
        <div class="label-row">
          <label>Model ID for Compact</label>
          <button type="button" class="reasoning-pill" :class="{ active: compactReasoningEnabled }"
            @click="emit('update:compactReasoningEnabled', !compactReasoningEnabled)">Reasoning</button>
        </div>
        <input type="text" :value="compactModelId"
          @input="emit('update:compactModelId', ($event.target as HTMLInputElement).value)"
          placeholder="same as Model ID by default" />
      </div>

      <div class="settings-divider"></div>

      <!-- Channels -->
      <h3 class="settings-section-title">Channels</h3>
      <p class="channels-hint">Backend servers for browsing and publishing packs.</p>

      <div class="new-channel-form">
        <div class="form-group">
          <label>Server URL</label>
          <input type="text" :value="newChannelUrl"
            @input="emit('update:newChannelUrl', ($event.target as HTMLInputElement).value)"
            placeholder="https://n0n4w3.cn:8080" @keydown.enter="emit('addChannel')" />
        </div>
        <div class="auth-toggle">
          <button class="auth-toggle-btn" :class="{ active: !newChannelIsLogin }" @click="emit('update:newChannelIsLogin', false)">Register</button>
          <button class="auth-toggle-btn" :class="{ active: newChannelIsLogin }" @click="emit('update:newChannelIsLogin', true)">Login</button>
        </div>
        <div class="form-group">
          <label>Username</label>
          <input type="text" :value="newChannelUsername"
            @input="emit('update:newChannelUsername', ($event.target as HTMLInputElement).value)"
            placeholder="username" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" :value="newChannelPassword"
            @input="emit('update:newChannelPassword', ($event.target as HTMLInputElement).value)"
            placeholder="password" />
        </div>
        <div v-if="addChannelError" class="publish-msg error">{{ addChannelError }}</div>
        <button class="action-btn primary" @click="emit('addChannel')" :disabled="addingChannel || !newChannelUrl.trim()">
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
            <button class="remove-btn" @click="emit('removeChannel', ch.id)">&times;</button>
          </div>
          <p class="channel-card-url">{{ ch.url }}</p>
          <p v-if="ch.description" class="channel-card-desc">{{ ch.description }}</p>
          <div class="channel-card-token">
            <span v-if="ch.token" class="token-ok">{{ ch.username || 'Authenticated' }}</span>
            <span v-else class="token-missing">Not logged in</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-content { padding: 20px; overflow-y: auto; scrollbar-width: none; }
.settings-content::-webkit-scrollbar { display: none; }
.settings-form { max-width: 500px; margin: 0 auto; }
.settings-form h2 { font-size: 1.5rem; margin-bottom: 24px; color: #e0e0e0; }
.form-group { margin-bottom: 20px; }
.form-group label {
  display: block; font-size: 0.875rem; font-weight: 500;
  margin-bottom: 8px; color: rgba(255, 255, 255, 0.7);
}
.form-group input {
  width: 100%; padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px;
  background: rgba(255, 255, 255, 0.05); color: #e0e0e0;
  font-family: inherit; font-size: 0.9rem;
}
.form-group input:focus { outline: none; border-color: #777aff; background: rgba(255, 255, 255, 0.08); }
.settings-divider { height: 1px; background: rgba(255, 255, 255, 0.08); margin: 24px 0; }
.label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.label-row > label:first-child { margin-bottom: 0; }
.reasoning-pill {
  padding: 3px 10px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 12px;
  background: transparent; color: rgba(255, 255, 255, 0.4);
  font-size: 0.75rem; cursor: pointer; transition: all 0.2s; font-family: inherit;
}
.reasoning-pill:hover { border-color: rgba(255, 255, 255, 0.4); color: rgba(255, 255, 255, 0.7); }
.reasoning-pill.active { background: #777aff; border-color: #777aff; color: #fff; }
.settings-section-title { font-size: 0.9rem; font-weight: 600; color: #e0e0e0; margin-bottom: 8px; }
.channels-hint { font-size: 0.85rem; color: #888; margin-bottom: 16px; }
.new-channel-form {
  background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px; padding: 16px; margin-bottom: 16px;
}
.auth-toggle { display: flex; gap: 0; margin-bottom: 14px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15); }
.auth-toggle-btn { flex: 1; padding: 8px; border: none; background: transparent; color: #888; font-size: 0.8rem; cursor: pointer; font-family: inherit; font-weight: 500; transition: all 150ms ease; }
.auth-toggle-btn.active { background: #777aff; color: white; }
.channel-list { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.channel-card {
  background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px; padding: 16px; transition: all 0.2s ease;
}
.channel-card:hover { border-color: rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.08); }
.channel-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.channel-card-name { font-weight: 600; font-size: 0.95rem; color: #f5f5f5; }
.channel-card-url { font-size: 0.75rem; color: #888; margin-bottom: 6px; font-family: "SF Mono", "Fira Code", monospace; }
.channel-card-desc { font-size: 0.8rem; color: #aaa; margin-bottom: 8px; line-height: 1.4; }
.channel-card-token { margin-top: 6px; }
.token-ok {
  display: inline-block; padding: 3px 12px;
  background: rgba(80, 250, 123, 0.2); color: #50fa7b;
  border-radius: 12px; font-size: 0.75rem; font-weight: 500;
}
.token-missing {
  display: inline-block; padding: 3px 12px;
  background: rgba(255, 184, 108, 0.2); color: #ffb86c;
  border-radius: 12px; font-size: 0.75rem; font-weight: 500;
}
.action-btn {
  padding: 6px 14px; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px;
  background: rgba(255, 255, 255, 0.06); color: #ccc;
  font-size: 0.8rem; cursor: pointer; font-family: inherit; font-weight: 500; transition: all 150ms ease;
}
.action-btn:hover { background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.25); color: #fff; }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.action-btn.primary { background: #777aff; border-color: #777aff; color: white; }
.action-btn.primary:hover { background: #6670ee; border-color: #6670ee; }
.remove-btn {
  background: transparent; border: none; color: #666;
  font-size: 1.2rem; cursor: pointer; padding: 0 4px; line-height: 1;
}
.remove-btn:hover { color: #ff6b6b; }
.publish-msg { padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 12px; }
.publish-msg.error { background: rgba(255, 107, 107, 0.15); color: #ff6b6b; }
.empty-state { text-align: center; color: #888; margin-top: 40px; }
</style>
