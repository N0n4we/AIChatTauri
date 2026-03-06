<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { computed, inject, onMounted, onUnmounted, ref, type Ref } from "vue";

const props = defineProps<{
  messages: any[];
  renderedMessages: any[];
  input: string;
  pendingImages: { id: string; name: string; dataUrl: string; size: number }[];
  loading: boolean;
  clearing: boolean;
  clearingHeight: number;
}>();

const emit = defineEmits<{
  (e: "update:input", val: string): void;
  (e: "selectImages", files: File[]): void;
  (e: "selectNativeImages", images: { name: string; mimeType: string; dataUrl: string; size: number }[]): void;
  (e: "removePendingImage", id: string): void;
  (e: "send"): void;
  (e: "regenerate"): void;
  (e: "updateMessage", idx: number, text: string): void;
}>();

const messagesEndRef = inject<Ref<HTMLElement | null>>("messagesEndRef")!;
const messagesContainerRef = inject<Ref<HTMLElement | null>>("messagesContainerRef")!;
const inputRef = inject<Ref<HTMLTextAreaElement | null>>("inputRef")!;
const imageInputRef = ref<HTMLInputElement | null>(null);
const imagePickerAccept = ".png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.avif,.heic,.heif,image/*";
const isTauriRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const previewImage = ref<{ name: string; dataUrl: string } | null>(null);

type NativeImageAttachment = {
  name: string;
  mimeType: string;
  dataUrl: string;
  size: number;
};

const hasSendableInput = computed(() => props.input.trim().length > 0 || props.pendingImages.length > 0);
const canRegenerate = computed(() => props.messages.length > 0 && props.messages[props.messages.length - 1]?.role === "assistant");

function handleAction() {
  if (hasSendableInput.value) {
    emit("send");
    return;
  }
  emit("regenerate");
}

function openImagePreview(image: { name?: string; dataUrl: string }) {
  previewImage.value = {
    name: image.name || "Image preview",
    dataUrl: image.dataUrl,
  };
}

function closeImagePreview() {
  previewImage.value = null;
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && previewImage.value) {
    closeImagePreview();
  }
}

function emitNativeImages(images: NativeImageAttachment[]) {
  if (props.loading || images.length === 0) return false;
  emit("selectNativeImages", images);
  focusComposer();
  return true;
}

function clipboardMightContainImage(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types || []).some(type => type.startsWith("image/"));
}

async function openImagePicker() {
  if (props.loading) return;

  if (isTauriRuntime) {
    try {
      const images = await invoke<NativeImageAttachment[]>("pick_images");
      emitNativeImages(images || []);
      return;
    } catch (error) {
      console.warn("Native image picker failed, falling back to input element.", error);
    }
  }

  imageInputRef.value?.click();
}

function focusComposer() {
  requestAnimationFrame(() => {
    inputRef.value?.focus();
  });
}

function extractImageFiles(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return [];

  const itemFiles = Array.from(dataTransfer.items || [])
    .filter(item => item.kind === "file" && item.type.startsWith("image/"))
    .map(item => item.getAsFile())
    .filter((file): file is File => file !== null);

  if (itemFiles.length > 0) return itemFiles;

  return Array.from(dataTransfer.files || []).filter(file => file.type.startsWith("image/"));
}

function emitImageFiles(files: File[]) {
  if (props.loading) return false;
  const imageFiles = files.filter(file => file.type.startsWith("image/"));
  if (imageFiles.length === 0) return false;
  emit("selectImages", imageFiles);
  focusComposer();
  return true;
}

function handleImageSelection(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  emitImageFiles(files);
  input.value = "";
}

async function handlePaste(event: ClipboardEvent) {
  const files = extractImageFiles(event.clipboardData);
  const attached = emitImageFiles(files);
  const pastedText = event.clipboardData?.getData("text/plain") || "";

  if (attached && !pastedText) {
    event.preventDefault();
    return;
  }

  if (pastedText || !isTauriRuntime) {
    return;
  }

  if (!clipboardMightContainImage(event.clipboardData) && files.length > 0) {
    return;
  }

  try {
    const image = await invoke<NativeImageAttachment | null>("read_clipboard_image");
    if (image) {
      emitNativeImages([image]);
      event.preventDefault();
    }
  } catch (error) {
    console.warn("Native clipboard image read failed.", error);
  }
}

onMounted(() => {
  window.addEventListener("paste", handlePaste);
  window.addEventListener("keydown", handleWindowKeydown);
});

onUnmounted(() => {
  window.removeEventListener("paste", handlePaste);
  window.removeEventListener("keydown", handleWindowKeydown);
});
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
        <div v-if="msg.images?.length" class="message-images">
          <img
            v-for="image in msg.images"
            :key="image.id || image.dataUrl"
            :src="image.dataUrl"
            :alt="image.name || 'Attached image'"
            class="message-image"
            @click="openImagePreview(image)"
          >
        </div>
        <div
          v-if="msg.content"
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

    <div v-if="previewImage" class="image-preview-overlay" @click.self="closeImagePreview">
      <button class="image-preview-close" @click="closeImagePreview" aria-label="Close preview">&times;</button>
      <div class="image-preview-content" @click.stop>
        <img :src="previewImage.dataUrl" :alt="previewImage.name" class="image-preview-full">
        <div class="image-preview-title">{{ previewImage.name }}</div>
      </div>
    </div>

    <div class="composer-container">
      <div v-if="pendingImages.length > 0" class="pending-images">
        <div v-for="image in pendingImages" :key="image.id" class="pending-image-card">
          <img :src="image.dataUrl" :alt="image.name" class="pending-image-preview" @click="openImagePreview(image)">
          <button class="pending-image-remove" @click="emit('removePendingImage', image.id)" :disabled="loading">&times;</button>
          <div class="pending-image-name">{{ image.name }}</div>
        </div>
      </div>

      <div class="input-container">
        <input
          ref="imageInputRef"
          class="image-input"
          type="file"
          :accept="imagePickerAccept"
          multiple
          @change="handleImageSelection"
        >
        <button class="attach-btn" @click="openImagePicker" :disabled="loading" title="Attach images">+</button>
        <textarea
          ref="inputRef"
          :value="input"
          @input="(e) => { const el = e.target as HTMLTextAreaElement; emit('update:input', el.value); el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }"
          placeholder="Type a message..."
          :disabled="loading"
          rows="1"
          @keydown.ctrl.enter.prevent="handleAction"
        ></textarea>
        <button @click="handleAction" :disabled="loading || (!hasSendableInput && !canRegenerate)">
          {{ hasSendableInput ? 'Send' : (canRegenerate ? 'Regen' : 'Send') }}
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.tab-content {
  position: relative;
}
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
.message-images {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}
.message-image {
  width: 100%;
  max-width: 320px;
  max-height: 280px;
  border-radius: 14px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.04);
  cursor: zoom-in;
}
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
.image-preview-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: rgba(8, 8, 12, 0.88);
  z-index: 1100;
}
.image-preview-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: min(92vw, 1200px);
  max-height: calc(100vh - 64px);
}
.image-preview-full {
  max-width: 100%;
  max-height: calc(100vh - 120px);
  border-radius: 18px;
  object-fit: contain;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}
.image-preview-title {
  max-width: 100%;
  color: #d6d6d6;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.image-preview-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
}
.image-preview-close:hover {
  background: rgba(255, 255, 255, 0.2);
}
.composer-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 20px 16px;
  background: #1a1a1a;
}
.pending-images {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.pending-image-card {
  position: relative;
  flex: 0 0 120px;
  width: 120px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pending-image-preview {
  width: 120px;
  height: 120px;
  border-radius: 14px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.05);
  cursor: zoom-in;
}
.pending-image-name {
  width: 100%;
  min-width: 0;
  color: #aaa;
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pending-image-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.65);
  color: white;
  cursor: pointer;
}
.pending-image-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.input-container {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}
.image-input { display: none; }
.attach-btn {
  width: 44px;
  height: 44px;
  padding: 0;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-size: 1.5rem;
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
