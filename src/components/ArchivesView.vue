<script setup lang="ts">
defineProps<{
  archives: { filename: string; message_count: number; created_at: string }[];
  selectedArchive: string | null;
  renderedArchiveMessages: any[];
}>();

const emit = defineEmits<{
  (e: "openArchive", filename: string): void;
  (e: "closeArchive"): void;
}>();

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch { return ''; }
}
</script>

<template>
  <div class="tab-content archives-content">
    <div v-if="!selectedArchive" class="archives-list-view">
      <div v-if="archives.length === 0" class="empty-state">No archived conversations</div>
      <div
        v-for="entry in archives" :key="entry.filename"
        class="archive-item"
        @click="emit('openArchive', entry.filename)"
      >
        <span class="archive-item-date">{{ formatDate(entry.created_at) }}</span>
        <span class="archive-item-count">{{ entry.message_count }} msgs</span>
      </div>
    </div>
    <div v-else class="archives-detail-view">
      <div class="archive-detail-header">
        <button class="back-btn" @click="emit('closeArchive')">&larr; Back</button>
        <span class="archive-detail-title">{{ formatDate(archives.find(a => a.filename === selectedArchive)?.created_at || '') }}</span>
      </div>
      <div class="messages-container archive-messages">
        <div
          v-for="(msg, idx) in renderedArchiveMessages"
          :key="idx"
          :class="['message', msg.role]"
        >
          <details v-if="msg.reasoning" class="reasoning-block">
            <summary class="reasoning-summary">Reasoning</summary>
            <div class="reasoning-content">{{ msg.reasoning }}</div>
          </details>
          <div class="message-content" v-html="msg.html"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.archives-content { display: flex; flex-direction: column; overflow: hidden; }
.archives-list-view { flex: 1; overflow-y: auto; padding: 8px 20px; }
.archive-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-radius: 8px; cursor: pointer; transition: background 0.15s;
}
.archive-item:hover { background: rgba(255, 255, 255, 0.06); }
.archive-item-date { color: #e0e0e0; font-size: 0.9rem; }
.archive-item-count { color: #888; font-size: 0.8rem; }
.archives-detail-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.archive-detail-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.archive-detail-title { color: #aaa; font-size: 0.85rem; }
.archive-messages { flex: 1; overflow-y: auto; }
.messages-container {
  flex: 1; overflow-y: auto; padding: 20px;
  display: flex; flex-direction: column; gap: 12px;
  scrollbar-width: none;
}
.messages-container::-webkit-scrollbar { display: none; }
.message { display: flex; flex-direction: column; max-width: 80%; }
.message.user { align-self: flex-end; }
.message.assistant { align-self: flex-start; }
.message-content {
  padding: 12px 16px; border-radius: 16px;
  word-wrap: break-word; white-space: pre-wrap;
}
.message-content:empty { display: none; }
.message.user .message-content { background: #777aff; color: white; border-bottom-right-radius: 4px; }
.message.assistant .message-content { background: #333; color: #e0e0e0; border-bottom-left-radius: 4px; }
.reasoning-block { margin-bottom: 8px; font-size: 0.85rem; color: #888; }
.reasoning-summary { cursor: pointer; user-select: none; color: #777; font-size: 0.8rem; }
.reasoning-summary:hover { color: #aaa; }
.reasoning-content {
  margin-top: 6px; padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03); border-left: 2px solid #444;
  border-radius: 0 4px 4px 0; white-space: pre-wrap;
  max-height: 300px; overflow-y: auto; line-height: 1.5;
}
.back-btn {
  padding: 8px 16px; border: none; border-radius: 6px;
  background: transparent; color: #e0e0e0; cursor: pointer;
  font-size: 0.875rem; font-family: inherit;
}
.back-btn:hover { background: rgba(255, 255, 255, 0.05); }
</style>
