<script setup lang="ts">
import { ref, inject, type Ref } from "vue";

defineProps<{
  memoState: string;
  memoContentVisible: boolean;
  memoRules: any[];
  memos: any[];
  systemPrompt: string;
  memoBtnRect: { top: number; left: number; width: number; height: number };
  memoTitleRect: { top: number; left: number };
}>();

const emit = defineEmits<{
  (e: "update:systemPrompt", v: string): void;
  (e: "closeMemo"): void;
  (e: "addMemoRule"): void;
  (e: "toggleMemoRule", idx: number): void;
  (e: "removeMemoRule", idx: number): void;
  (e: "reorderMemoRule", from: number, to: number): void;
}>();

const dragIdx = ref<number | null>(null);
const memoListRef = ref<HTMLDivElement | null>(null);
const memoPanelRef = inject<Ref<HTMLDivElement | null>>("memoPanelRef")!;
const memoTitleRef = inject<Ref<HTMLElement | null>>("memoTitleRef")!;

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
          emit("reorderMemoRule", dragIdx.value, i);
          dragIdx.value = i;
        }
        return;
      }
    }
    const last = items.length - 1;
    if (last >= 0 && last !== dragIdx.value) {
      emit("reorderMemoRule", dragIdx.value, last);
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
        <button class="close-btn" @click="emit('closeMemo')">&times;</button>
      </div>

      <div class="form-group">
        <label>System Prompt</label>
        <input type="text" :value="systemPrompt" @input="emit('update:systemPrompt', ($event.target as HTMLInputElement).value)" placeholder="Enter system prompt..." />
      </div>

      <div class="memo-section-header">
        <span class="memo-section-title">Rules</span>
      </div>
      <div ref="memoListRef" class="memo-list">
        <div
          v-for="(rule, idx) in memoRules"
          :key="rule.id"
          class="memo-item"
          :class="{ 'dragging': dragIdx === idx }"
        >
          <div class="memo-item-header" @click="emit('toggleMemoRule', idx)">
            <span class="drag-handle" @pointerdown.stop="startDrag(idx, $event)">&#x2261;</span>
            <span class="memo-item-title">{{ rule.title || 'Untitled item' }}</span>
            <div class="memo-item-actions">
              <button class="memo-remove-btn" @click.stop="emit('removeMemoRule', idx)">&times;</button>
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
        <button class="memo-add-btn" @click="emit('addMemoRule')">+</button>
      </div>

      <div class="memo-section-header">
        <span class="memo-section-title">Memos</span>
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
</template>

<style scoped>
.settings-panel {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: #777aff; z-index: 1000; overflow: hidden;
  transform-origin: var(--origin-x) var(--origin-y); will-change: transform, border-radius;
}
.settings-panel.expanding { animation: expandToFullscreen 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards; }
.settings-panel.expanded { transform: none; border-radius: 0; }
.settings-panel.collapsing { animation: collapseToButton 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards; }
@keyframes expandToFullscreen {
  0% { transform: translate(calc(var(--btn-left) + var(--btn-width) / 2 - 50vw), calc(var(--btn-top) + var(--btn-height) / 2 - 50vh)) scale(calc(var(--btn-width) / 100vw), calc(var(--btn-height) / 100vh)); border-radius: 48px; }
  60% { border-radius: 12px; }
  100% { transform: translate(0, 0) scale(1, 1); border-radius: 0; }
}
@keyframes collapseToButton {
  0% { transform: translate(0, 0) scale(1, 1); border-radius: 0px; }
  40% { border-radius: 12px; }
  100% { transform: translate(calc(var(--btn-left) + var(--btn-width) / 2 - 50vw), calc(var(--btn-top) + var(--btn-height) / 2 - 50vh)) scale(calc(var(--btn-width) / 100vw), calc(var(--btn-height) / 100vh)); border-radius: 48px; }
}
.settings-panel .settings-content {
  max-width: 400px; margin: 0 auto; padding: 40px 24px;
  opacity: 0; transform: translateY(10px) scale(0.98);
  transition: opacity 250ms ease-out, transform 250ms ease-out;
  height: 100%; overflow-y: auto; scrollbar-width: none;
}
.settings-panel .settings-content::-webkit-scrollbar { display: none; }
.settings-panel .settings-content.content-visible { opacity: 1; transform: translateY(0) scale(1); }
.settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.settings-header h2 { font-size: 1.5rem; font-weight: bold; font-family: inherit; color: white; margin: 0; }
.settings-header h2.title-hidden { opacity: 0; }
.close-btn { background: transparent; border: none; color: white; font-size: 2rem; cursor: pointer; padding: 0; line-height: 1; opacity: 0.8; }
.close-btn:hover { opacity: 1; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 0.875rem; color: rgba(255, 255, 255, 0.9); }
.form-group input { width: 100%; padding: 12px 14px; border: none; border-radius: 8px; font-size: 1rem; background: rgba(255, 255, 255, 0.15); color: white; }
.form-group input::placeholder { color: rgba(255, 255, 255, 0.5); }
.form-group input:focus { outline: none; background: rgba(255, 255, 255, 0.2); }
.memo-section-header { display: flex; justify-content: space-between; align-items: center; margin: 16px 0 8px; }
.memo-section-title { font-size: 0.85rem; font-weight: 600; color: rgba(255, 255, 255, 0.7); text-transform: uppercase; letter-spacing: 0.5px; }
.memo-list { display: flex; flex-direction: column; gap: 8px; }
.memo-item { background: rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden; transition: opacity 150ms ease; }
.memo-item.dragging { opacity: 0.5; }
.drag-handle { cursor: grab; font-size: 1.1rem; color: rgba(255, 255, 255, 0.4); padding: 0 4px; user-select: none; touch-action: none; }
.drag-handle:hover { color: rgba(255, 255, 255, 0.7); }
.drag-handle:active { cursor: grabbing; }
.memo-item-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; cursor: pointer; user-select: none; }
.memo-item-header:hover { background: rgba(255, 255, 255, 0.05); }
.memo-item-title { color: white; font-size: 0.875rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px; }
.memo-item-actions { display: flex; align-items: center; gap: 8px; }
.memo-remove-btn { background: transparent; border: none; color: rgba(255, 255, 255, 0.5); font-size: 1.1rem; cursor: pointer; padding: 0 4px; line-height: 1; }
.memo-remove-btn:hover { color: #ff6b6b; }
.memo-arrow { color: rgba(255, 255, 255, 0.6); font-size: 0.75rem; transition: transform 200ms ease; display: inline-block; }
.memo-arrow-open { transform: rotate(90deg); }
.memo-item-body-wrapper { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 250ms ease; }
.memo-item-body-wrapper.expanded { grid-template-rows: 1fr; }
.memo-item-body { overflow: hidden; padding: 0 14px; border-top: 1px solid transparent; transition: padding 250ms ease, border-color 250ms ease; }
.memo-item-body-wrapper.expanded .memo-item-body { padding: 8px 14px 14px; border-top-color: rgba(255, 255, 255, 0.08); }
.memo-item-body .form-group { margin-bottom: 10px; }
.memo-item-body .form-group:last-child { margin-bottom: 0; }
.memo-item-body .form-group label { font-size: 0.75rem; margin-bottom: 4px; color: rgba(255, 255, 255, 0.6); }
.memo-item-body .form-group input { padding: 8px 12px; font-size: 0.875rem; }
.memo-add-btn {
  width: 100%; padding: 10px; border: 2px dashed rgba(255, 255, 255, 0.25); border-radius: 8px;
  background: transparent; color: rgba(255, 255, 255, 0.6); font-size: 1.25rem; cursor: pointer; font-family: inherit;
}
.memo-add-btn:hover { border-color: rgba(255, 255, 255, 0.5); color: white; background: rgba(255, 255, 255, 0.05); }
.memo-content-item { background: rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 10px 14px; }
.memo-content-title { font-size: 0.8rem; font-weight: 600; color: rgba(255, 255, 255, 0.7); margin-bottom: 4px; }
.memo-content-text { font-size: 0.825rem; color: rgba(255, 255, 255, 0.55); white-space: pre-wrap; line-height: 1.4; }
.memo-empty-hint { font-size: 0.8rem; color: rgba(255, 255, 255, 0.35); padding: 8px 0; }
.floating-settings-text { position: fixed; z-index: 1001; color: white; font-weight: bold; font-family: inherit; pointer-events: none; }
.floating-settings-text.expanding { font-size: 0.875rem; animation: textExpandToTitle 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards; }
.floating-settings-text.collapsing { font-size: 1.5rem; animation: textCollapseToButton 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards; }
@keyframes textExpandToTitle {
  0% { top: calc(var(--btn-top) + 6px); left: calc(var(--btn-left) + 16px); font-size: 0.875rem; }
  100% { top: calc(var(--title-top) + 1px); left: var(--title-left); font-size: 1.5rem; }
}
@keyframes textCollapseToButton {
  0% { top: calc(var(--title-top) + 1px); left: var(--title-left); font-size: 1.5rem; }
  100% { top: calc(var(--btn-top) + 6px); left: calc(var(--btn-left) + 16px); font-size: 0.875rem; }
}
</style>
