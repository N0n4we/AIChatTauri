<script setup lang="ts">
import { inject, type Ref } from "vue";

defineProps<{
  messages: any[];
  renderedMessages: any[];
  input: string;
  loading: boolean;
  clearing: boolean;
  clearingHeight: number;
}>();

const emit = defineEmits<{
  (e: "update:input", val: string): void;
  (e: "send"): void;
  (e: "regenerate"): void;
  (e: "updateMessage", idx: number, text: string): void;
}>();

const messagesEndRef = inject<Ref<HTMLElement | null>>("messagesEndRef")!;
const messagesContainerRef = inject<Ref<HTMLElement | null>>("messagesContainerRef")!;
const inputRef = inject<Ref<HTMLTextAreaElement | null>>("inputRef")!;

function handleAction() {
  emit("send");
}
</script>

<template>
  <div class="tab-content">
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
          @blur="(e: FocusEvent) => { const el = e.target as HTMLElement; el.contentEditable = 'false'; emit('updateMessage', idx, el.innerText); }"
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
        :value="input"
        @input="(e) => { const el = e.target as HTMLTextAreaElement; emit('update:input', el.value); el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }"
        placeholder="Type a message..."
        :disabled="loading"
        rows="1"
        @keydown.ctrl.enter.prevent="input.trim() ? emit('send') : emit('regenerate')"
      ></textarea>
      <button @click="input.trim() ? emit('send') : emit('regenerate')" :disabled="loading || (!input.trim() && (messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant'))">
        {{ input.trim() ? 'Send' : (messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' ? 'Regen' : 'Send') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.messages-container::-webkit-scrollbar { display: none; }
.clearing-spacer { flex-shrink: 0; padding-top: 20px; }
.message { display: flex; flex-direction: column; max-width: 80%; }
.message.user { align-self: flex-end; }
.message.assistant { align-self: flex-start; }
.message-content {
  padding: 12px 16px;
  border-radius: 16px;
  word-wrap: break-word;
  white-space: pre-wrap;
}
.message-content:empty { display: none; }
.message.user .message-content {
  background: #777aff;
  color: white;
  border-bottom-right-radius: 4px;
}
.message.assistant .message-content {
  background: #333;
  color: #e0e0e0;
  border-bottom-left-radius: 4px;
}
.message-content.loading { color: #888; font-style: italic; }
.message-content[contenteditable="true"] {
  outline: 1px solid #444;
  border-radius: 6px;
  cursor: text;
}
.reasoning-block { margin-bottom: 8px; font-size: 0.85rem; color: #888; }
.reasoning-summary { cursor: pointer; user-select: none; color: #777; font-size: 0.8rem; }
.reasoning-summary:hover { color: #aaa; }
.reasoning-content {
  margin-top: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-left: 2px solid #444;
  border-radius: 0 4px 4px 0;
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
  line-height: 1.5;
}
.input-container {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  background: #1a1a1a;
  align-items: flex-end;
}
.input-container textarea {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 24px;
  font-size: 1rem;
  outline: none;
  background: #1a1a1a;
  color: #e0e0e0;
  font-family: inherit;
  resize: none;
  overflow-y: hidden;
  max-height: 150px;
  line-height: 1.4;
}
.input-container textarea:focus { background: #1a1a1a; }
.input-container button {
  padding: 12px 24px;
  border: none;
  border-radius: 24px;
  background: transparent;
  color: white;
  font-size: 1rem;
  cursor: pointer;
}
.input-container button:disabled { color: #555; cursor: not-allowed; }
.input-container button:not(:disabled):hover { background: rgba(255, 255, 255, 0.1); }
</style>
