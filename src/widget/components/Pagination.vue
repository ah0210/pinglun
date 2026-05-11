<!-- src/widget/components/Pagination.vue — 加载更多按钮（替代传统页码） -->
<template>
  <div v-if="hasMore" class="gb-pagination">
    <button
      class="gb-load-more-btn"
      :disabled="loading"
      @click="$emit('loadMore')"
    >
      <span v-if="loading" class="gb-spinner"></span>
      {{ loading ? '加载中...' : '加载更多' }}
    </button>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  hasMore: boolean;
  loading: boolean;
}>();

defineEmits<{
  loadMore: [];
}>();
</script>

<style scoped>
.gb-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
}

.gb-load-more-btn {
  padding: 8px 24px;
  border: 1px solid var(--gb-border, #e0e0e0);
  border-radius: var(--gb-border-radius, 8px);
  background: var(--gb-bg, #fff);
  color: var(--gb-text, #333);
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: border-color 0.2s, color 0.2s;
}

.gb-load-more-btn:active {
  border-color: var(--gb-primary, #4a6cf7);
  color: var(--gb-primary, #4a6cf7);
}

.gb-load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gb-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--gb-border, #e0e0e0);
  border-top-color: var(--gb-primary, #4a6cf7);
  border-radius: 50%;
  animation: gb-spin 0.6s linear infinite;
}

@keyframes gb-spin {
  to { transform: rotate(360deg); }
}

@media (hover: hover) {
  .gb-load-more-btn:hover {
    border-color: var(--gb-primary, #4a6cf7);
    color: var(--gb-primary, #4a6cf7);
  }
}
</style>
