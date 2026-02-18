<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{
  (e: "update:modelValue", tab: string): void;
  (e: "tabChange", tab: string): void;
}>();

const tabs = ["chat", "archives", "market", "settings"];
const tabsRef = ref<HTMLDivElement | null>(null);
const indicatorStyle = ref({ left: "0px", width: "0px" });

function updateIndicator() {
  if (!tabsRef.value) return;
  const activeBtn = tabsRef.value.querySelector(".tab-btn.active") as HTMLElement | null;
  if (!activeBtn) return;
  const containerRect = tabsRef.value.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();
  const indicatorWidth = 40;
  indicatorStyle.value = {
    left: `${btnRect.left - containerRect.left + (btnRect.width - indicatorWidth) / 2}px`,
    width: `${indicatorWidth}px`,
  };
}

function selectTab(tab: string) {
  emit("update:modelValue", tab);
  emit("tabChange", tab);
}

watch(() => props.modelValue, () => nextTick(updateIndicator));
onMounted(() => {
  nextTick(updateIndicator);
  window.addEventListener("resize", updateIndicator);
});
onUnmounted(() => {
  window.removeEventListener("resize", updateIndicator);
});
</script>

<template>
  <div class="bottom-tabs" ref="tabsRef">
    <button
      v-for="tab in tabs"
      :key="tab"
      class="tab-btn"
      :class="{ active: modelValue === tab }"
      @click="selectTab(tab)"
    >
      {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
    </button>
    <div class="tab-indicator" :style="indicatorStyle"></div>
  </div>
</template>

<style scoped>
.bottom-tabs {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: #1a1a1a;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 0;
  position: sticky;
  bottom: 0;
  z-index: 10;
}
.tab-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 500;
  transition: color 0.25s ease, font-weight 0.25s ease;
  position: relative;
}
.tab-btn:hover { color: rgba(255, 255, 255, 0.8); }
.tab-btn.active { color: #777aff; font-weight: 600; }
.tab-indicator {
  position: absolute;
  bottom: 0;
  height: 3px;
  background: #777aff;
  border-radius: 2px 2px 0 0;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
