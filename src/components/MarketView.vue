<script setup lang="ts">
import type { MemoPack } from "../useMarket";

defineProps<{
  marketView: string;
  selectedPack: MemoPack | null;
  searchQuery: string;
  filteredPacks: MemoPack[];
  editPack: MemoPack;
  viewMode: "local" | "remote";
  loadingRemote: boolean;
  packs: MemoPack[];
  channels: any[];
  selectedChannelId: string;
  selectedChannel: any;
  publishing: boolean;
  publishError: string;
  publishSuccess: string;
  regUsername: string;
  regDisplayName: string;
}>();

const emit = defineEmits<{
  (e: "update:searchQuery", v: string): void;
  (e: "update:viewMode", v: "local" | "remote"): void;
  (e: "update:selectedChannelId", v: string): void;
  (e: "update:regUsername", v: string): void;
  (e: "update:regDisplayName", v: string): void;
  (e: "importPack"): void;
  (e: "importFromChat"): void;
  (e: "startCreate"): void;
  (e: "viewPack", pack: MemoPack): void;
  (e: "goBack"): void;
  (e: "exportPack", pack: MemoPack): void;
  (e: "openPublish", pack: MemoPack): void;
  (e: "startEdit", pack: MemoPack): void;
  (e: "installPack", pack: MemoPack): void;
  (e: "deletePack", id: string): void;
  (e: "saveCurrentPack"): void;
  (e: "addRule"): void;
  (e: "removeRule", idx: number): void;
  (e: "addMemo"): void;
  (e: "removeMemo", idx: number): void;
  (e: "publishPack", pack: MemoPack): void;
  (e: "updateChannelToken", id: string, token: string): void;
  (e: "handleRegister"): void;
}>();
</script>

<template>
  <div class="tab-content market-content">
    <!-- Market Header -->
    <div class="market-header">
      <div class="header-left">
        <div class="mode-toggle">
          <span class="mode-label" :class="{ active: viewMode === 'local' }">Local</span>
          <button class="toggle-switch" :class="{ remote: viewMode === 'remote' }" @click="emit('update:viewMode', viewMode === 'local' ? 'remote' : 'local')">
            <span class="toggle-knob"></span>
          </button>
          <span class="mode-label" :class="{ active: viewMode === 'remote' }">Remote</span>
          <span v-if="loadingRemote" class="loading-dot"></span>
        </div>
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="emit('importPack')">Import Pack</button>
        <button class="action-btn" @click="emit('importFromChat')">Import from Chat</button>
        <button class="action-btn primary" @click="emit('startCreate')">+ New Pack</button>
      </div>
    </div>

    <!-- Browse View -->
    <div v-if="marketView === 'browse'" class="market-browse-view">
      <div class="search-bar">
        <input type="text" :value="searchQuery" @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)" placeholder="Search packs..." class="search-input" />
      </div>
      <div v-if="filteredPacks.length === 0" class="empty-state">
        <p v-if="viewMode === 'remote' && channels.length === 0">No channels configured. Add a backend server first.</p>
        <p v-else-if="viewMode === 'remote' && loadingRemote">Loading remote packs...</p>
        <p v-else-if="packs.length === 0 && viewMode === 'local'">No MemoPacks yet. Create one or import from Chat!</p>
        <p v-else>No packs match your search.</p>
      </div>
      <div class="pack-grid">
        <div v-for="pack in filteredPacks" :key="pack.id" class="pack-card" @click="emit('viewPack', pack)">
          <div class="pack-card-header"><span class="pack-name">{{ pack.name || 'Untitled' }}</span></div>
          <p class="pack-desc">{{ pack.description || 'No description' }}</p>
          <div class="pack-meta">
            <span v-if="(pack as any)._channelName" class="pack-channel-badge">{{ (pack as any)._channelName }}</span>
            <span class="pack-rules-count">{{ pack.rules.length }} rules</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail View -->
    <div v-if="marketView === 'detail' && selectedPack" class="market-detail-view">
      <div class="detail-header">
        <button class="back-btn" @click="emit('goBack')">&larr; Back</button>
        <div class="detail-actions">
          <button class="action-btn" @click="emit('exportPack', selectedPack!)">Export Pack</button>
          <button class="action-btn publish-btn" @click="emit('openPublish', selectedPack!)">Publish</button>
          <button class="action-btn" @click="emit('startEdit', selectedPack!)">Edit</button>
          <button class="action-btn primary" @click="emit('installPack', selectedPack!)">Install</button>
          <button class="action-btn danger" @click="emit('deletePack', selectedPack!.id)">Delete</button>
        </div>
      </div>
      <div class="detail-content">
        <h2>{{ selectedPack.name }}</h2>
        <p class="detail-desc">{{ selectedPack.description }}</p>
        <div class="detail-info">
          <span>{{ selectedPack.rules.length }} rules</span>
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
            <div class="memo-content-text">{{ memo.content }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit View -->
    <div v-if="marketView === 'create'" class="market-create-view">
      <div class="detail-header">
        <button class="back-btn" @click="emit('goBack')">&larr; Cancel</button>
        <button class="action-btn primary" @click="emit('saveCurrentPack')">Save Pack</button>
      </div>
      <div class="create-content">
        <div class="form-group"><label>Pack Name</label><input type="text" v-model="editPack.name" placeholder="My MemoPack" /></div>
        <div class="form-group"><label>Description</label><textarea v-model="editPack.description" placeholder="What does this pack do?" rows="3"></textarea></div>
        <div class="form-group"><label>System Prompt</label><textarea v-model="editPack.systemPrompt" placeholder="System prompt for the AI..." rows="3"></textarea></div>
        <div class="rules-section">
          <div class="section-header"><h3>Rules ({{ editPack.rules.length }})</h3><button class="action-btn" @click="emit('addRule')">+ Add Rule</button></div>
          <div v-for="(rule, idx) in editPack.rules" :key="idx" class="rule-edit-card">
            <div class="rule-edit-header"><span class="rule-num">#{{ idx + 1 }}</span><button class="remove-btn" @click="emit('removeRule', idx)">&times;</button></div>
            <div class="form-group"><label>Title</label><input type="text" v-model="rule.title" placeholder="Rule title..." /></div>
            <div class="form-group"><label>Update Rule</label><input type="text" v-model="rule.updateRule" placeholder="How to update this memo..." /></div>
          </div>
          <button v-if="editPack.rules.length === 0" class="empty-add-btn" @click="emit('addRule')">+ Add your first rule</button>
        </div>
        <div class="memos-section">
          <div class="section-header"><h3>Memos ({{ editPack.memos.length }})</h3><button class="action-btn" @click="emit('addMemo')">+ Add Memo</button></div>
          <div v-for="(memo, idx) in editPack.memos" :key="idx" class="memo-edit-card">
            <div class="memo-edit-header"><span class="memo-num">#{{ idx + 1 }}</span><button class="remove-btn" @click="emit('removeMemo', idx)">&times;</button></div>
            <div class="form-group"><label>Title</label><input type="text" v-model="memo.title" placeholder="Memo title..." /></div>
            <div class="form-group"><label>Content</label><textarea v-model="memo.content" placeholder="Memo content..." rows="3"></textarea></div>
          </div>
          <button v-if="editPack.memos.length === 0" class="empty-add-btn" @click="emit('addMemo')">+ Add your first memo</button>
        </div>
      </div>
    </div>

    <!-- Publish View -->
    <div v-if="marketView === 'publish' && selectedPack" class="market-publish-view">
      <div class="detail-header"><button class="back-btn" @click="emit('goBack')">&larr; Back</button></div>
      <div class="publish-content">
        <h2>Publish "{{ selectedPack.name }}"</h2>
        <div class="publish-section">
          <h3>Select Channel</h3>
          <div v-if="channels.length === 0" class="empty-channel"><p>No channels configured. Add a backend server in Settings first.</p></div>
          <div v-else class="channel-select">
            <button v-for="ch in channels" :key="ch.id" class="channel-pill" :class="{ active: selectedChannelId === ch.id }" @click="emit('update:selectedChannelId', ch.id)">
              <span class="channel-pill-name">{{ ch.name }}</span>
              <span class="channel-pill-url">{{ ch.url }}</span>
            </button>
          </div>
        </div>
        <div v-if="selectedChannel" class="publish-section">
          <h3>{{ selectedChannel.name }}</h3>
          <p v-if="selectedChannel.description" class="channel-desc">{{ selectedChannel.description }}</p>
          <p class="channel-url">{{ selectedChannel.url }}</p>
          <div v-if="!selectedChannel.token" class="register-section">
            <p class="hint">No token for this channel. Register or paste a token:</p>
            <div class="form-group">
              <label>Token</label>
              <input type="password" :value="selectedChannel.token" @input="emit('updateChannelToken', selectedChannel!.id, ($event.target as HTMLInputElement).value)" placeholder="Paste auth token..." />
            </div>
            <div class="settings-divider"></div>
            <p class="hint">Or register a new account:</p>
            <div class="form-row">
              <div class="form-group"><label>Username</label><input type="text" :value="regUsername" @input="emit('update:regUsername', ($event.target as HTMLInputElement).value)" placeholder="username" /></div>
              <div class="form-group"><label>Display Name</label><input type="text" :value="regDisplayName" @input="emit('update:regDisplayName', ($event.target as HTMLInputElement).value)" placeholder="Your Name" /></div>
            </div>
            <button class="action-btn primary" @click="emit('handleRegister')" :disabled="!regUsername.trim()">Register</button>
          </div>
          <div v-else class="token-status"><span class="token-ok">Authenticated</span></div>
        </div>
        <div class="publish-action">
          <div v-if="publishError" class="publish-msg error">{{ publishError }}</div>
          <div v-if="publishSuccess" class="publish-msg success">{{ publishSuccess }}</div>
          <button class="action-btn primary publish-go" @click="emit('publishPack', selectedPack!)" :disabled="publishing || !selectedChannel || !selectedChannel?.token">
            {{ publishing ? 'Publishing...' : 'Publish' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.market-content { display: flex; flex-direction: column; height: 100%; overflow: hidden; padding: 20px; }
.market-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); flex-shrink: 0;
}
.market-header .header-left { display: flex; align-items: center; gap: 16px; }
.market-header .header-actions { display: flex; gap: 8px; align-items: center; }
.mode-toggle { display: flex; align-items: center; gap: 8px; }
.mode-label { font-size: 0.75rem; color: #666; font-weight: 500; transition: color 150ms ease; user-select: none; }
.mode-label.active { color: #e0e0e0; }
.toggle-switch {
  position: relative; width: 36px; height: 20px; border-radius: 10px;
  border: none; background: #444; cursor: pointer; padding: 0; transition: background 200ms ease;
}
.toggle-switch.remote { background: #777aff; }
.toggle-knob {
  position: absolute; top: 3px; left: 3px; width: 14px; height: 14px;
  border-radius: 50%; background: #e0e0e0; transition: transform 200ms ease;
}
.toggle-switch.remote .toggle-knob { transform: translateX(16px); background: #fff; }
.loading-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: #777aff; animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
.market-browse-view { flex: 1; overflow-y: auto; padding: 16px; scrollbar-width: none; }
.market-browse-view::-webkit-scrollbar { display: none; }
.search-bar { margin-bottom: 12px; }
.search-input {
  width: 100%; padding: 10px 14px; border: none; border-radius: 10px;
  font-size: 0.875rem; background: rgba(255, 255, 255, 0.05);
  color: #e0e0e0; font-family: inherit; outline: none;
}
.search-input:focus { background: rgba(255, 255, 255, 0.08); }
.search-input::placeholder { color: #666; }
.pack-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.pack-card {
  background: rgba(255, 255, 255, 0.05); border-radius: 10px; padding: 14px;
  cursor: pointer; transition: background 150ms ease, transform 150ms ease;
}
.pack-card:hover { background: rgba(255, 255, 255, 0.08); transform: translateY(-1px); }
.pack-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.pack-name { font-weight: 600; font-size: 0.95rem; color: #fff; }
.pack-desc { font-size: 0.8rem; color: #999; margin-bottom: 8px; line-height: 1.4; }
.pack-meta { display: flex; gap: 12px; font-size: 0.75rem; color: #666; margin-bottom: 6px; }
.pack-channel-badge { padding: 1px 8px; background: rgba(119, 122, 255, 0.15); color: #777aff; border-radius: 8px; font-size: 0.7rem; }
.market-detail-view, .market-create-view, .market-publish-view { flex: 1; overflow-y: auto; padding: 16px; scrollbar-width: none; }
.market-detail-view::-webkit-scrollbar, .market-create-view::-webkit-scrollbar, .market-publish-view::-webkit-scrollbar { display: none; }
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 8px; }
.detail-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.back-btn { padding: 8px 16px; border: none; border-radius: 6px; background: transparent; color: #e0e0e0; cursor: pointer; font-size: 0.875rem; font-family: inherit; }
.back-btn:hover { background: rgba(255, 255, 255, 0.05); }
.action-btn {
  padding: 6px 14px; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px;
  background: rgba(255, 255, 255, 0.06); color: #ccc; font-size: 0.8rem;
  cursor: pointer; font-family: inherit; font-weight: 500; transition: all 150ms ease;
}
.action-btn:hover { background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.25); color: #fff; }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.action-btn.primary { background: #777aff; border-color: #777aff; color: white; }
.action-btn.primary:hover { background: #6670ee; border-color: #6670ee; }
.action-btn.danger { color: #ff6b6b; border-color: rgba(255, 107, 107, 0.3); }
.action-btn.danger:hover { background: rgba(255, 107, 107, 0.15); border-color: rgba(255, 107, 107, 0.5); }
.detail-content h2 { font-size: 1.5rem; font-weight: 600; margin-bottom: 8px; }
.detail-desc { color: #999; font-size: 0.875rem; margin-bottom: 12px; }
.detail-info { display: flex; gap: 16px; font-size: 0.8rem; color: #666; margin-bottom: 12px; }
.detail-section { margin-top: 20px; }
.detail-section h3 { font-size: 0.9rem; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
.code-block { background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 12px 16px; font-size: 0.85rem; color: #ccc; white-space: pre-wrap; line-height: 1.5; }
.rule-card { background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; }
.rule-title { font-weight: 600; font-size: 0.875rem; color: #fff; margin-bottom: 4px; }
.rule-update { font-size: 0.8rem; color: #999; line-height: 1.4; }
.memo-card { background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 12px; margin-bottom: 8px; }
.memo-title { font-weight: 600; color: #fff; margin-bottom: 6px; font-size: 0.9rem; }
.memo-content-text { color: #aaa; font-size: 0.85rem; line-height: 1.5; white-space: pre-wrap; }
.empty-hint { color: #666; font-size: 0.85rem; font-style: italic; padding: 8px 0; }
.empty-state { text-align: center; color: #888; margin-top: 40px; }
.create-content { max-width: 600px; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 0.8rem; color: #999; }
.form-group input, .form-group textarea {
  width: 100%; padding: 10px 14px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;
  font-size: 0.875rem; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-family: inherit; outline: none; resize: vertical;
}
.form-group input:focus, .form-group textarea:focus { background: rgba(255, 255, 255, 0.08); border-color: #777aff; }
.form-group input::placeholder, .form-group textarea::placeholder { color: #555; }
.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }
.rules-section, .memos-section { margin-top: 20px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.section-header h3 { font-size: 0.9rem; font-weight: 600; color: #999; }
.rule-edit-card, .memo-edit-card { background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 14px; margin-bottom: 8px; }
.rule-edit-header, .memo-edit-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.rule-num, .memo-num { font-size: 0.75rem; color: #666; font-weight: 600; }
.remove-btn { background: transparent; border: none; color: #666; font-size: 1.2rem; cursor: pointer; padding: 0 4px; line-height: 1; }
.remove-btn:hover { color: #ff6b6b; }
.empty-add-btn { width: 100%; padding: 16px; border: 2px dashed #444; border-radius: 8px; background: transparent; color: #666; font-size: 0.875rem; cursor: pointer; font-family: inherit; }
.empty-add-btn:hover { border-color: #666; color: #999; }
.publish-content { max-width: 600px; }
.publish-content h2 { font-size: 1.3rem; font-weight: 600; margin-bottom: 16px; }
.publish-section { background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.publish-section h3 { font-size: 0.85rem; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
.publish-btn { background: #50c878 !important; color: #1a1a1a !important; }
.publish-btn:hover { background: #45b06a !important; }
.register-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1); }
.register-section .hint { font-size: 0.8rem; color: #888; margin-bottom: 10px; }
.token-status { margin-top: 8px; }
.token-ok { display: inline-block; padding: 3px 12px; background: rgba(80, 250, 123, 0.2); color: #50fa7b; border-radius: 12px; font-size: 0.75rem; font-weight: 500; }
.channel-select { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.channel-pill { padding: 8px 14px; border: 1px solid #444; border-radius: 12px; background: transparent; color: #999; font-size: 0.8rem; cursor: pointer; font-family: inherit; transition: all 150ms ease; text-align: left; }
.channel-pill:hover { border-color: #666; color: #ccc; }
.channel-pill.active { background: #777aff; border-color: #777aff; color: white; }
.channel-pill-name { display: block; font-weight: 500; }
.channel-pill-url { display: block; font-size: 0.7rem; opacity: 0.6; margin-top: 2px; }
.empty-channel { text-align: center; padding: 16px; color: #888; font-size: 0.85rem; }
.empty-channel p { margin-bottom: 10px; }
.channel-desc { font-size: 0.85rem; color: #999; margin-bottom: 6px; }
.channel-url { font-size: 0.75rem; color: #666; font-family: "SF Mono", "Fira Code", monospace; margin-bottom: 10px; }
.hint { font-size: 0.8rem; color: #888; margin-bottom: 10px; }
.settings-divider { height: 1px; background: rgba(255, 255, 255, 0.1); margin: 20px 0; }
.publish-action { margin-top: 16px; }
.publish-go { width: 100%; padding: 12px; font-size: 0.95rem; }
.publish-msg { padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 12px; }
.publish-msg.error { background: rgba(255, 107, 107, 0.15); color: #ff6b6b; }
.publish-msg.success { background: rgba(80, 250, 123, 0.15); color: #50fa7b; }
</style>
