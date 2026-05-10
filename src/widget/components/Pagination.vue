<!-- src/widget/components/Pagination.vue — 分页 -->
<template>
  <div class="gb-pagination">
    <button
      class="gb-page-btn"
      :disabled="current <= 1"
      @click="$emit('change', current - 1)"
    >上一页</button>

    <template v-for="p in displayPages" :key="p">
      <span v-if="p === '...'" style="color: var(--gb-text-secondary)">...</span>
      <button
        v-else
        class="gb-page-btn"
        :class="{ active: p === current }"
        @click="$emit('change', p)"
      >{{ p }}</button>
    </template>

    <button
      class="gb-page-btn"
      :disabled="current >= total"
      @click="$emit('change', current + 1)"
    >下一页</button>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
  current: number;
  total: number;
}>();

defineEmits<{
  change: [page: number];
}>();

const displayPages = computed(() => {
  const pages: (number | string)[] = [];
  const { current, total } = props;

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (current < total - 2) pages.push('...');
    pages.push(total);
  }

  return pages;
});
</script>

<style scoped>
.gb-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
  flex-wrap: wrap;
}
.gb-page-btn {
  padding: 6px 12px;
  border: 1px solid var(--gb-border, #e0e0e0);
  border-radius: var(--gb-border-radius, 8px);
  background: var(--gb-bg, #fff);
  color: var(--gb-text, #333);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  min-height: 44px;
}
.gb-page-btn:active { border-color: var(--gb-primary, #4a6cf7); color: var(--gb-primary, #4a6cf7); }
.gb-page-btn.active { background: var(--gb-primary, #4a6cf7); color: #fff; border-color: var(--gb-primary, #4a6cf7); }
.gb-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 480px) {
  .gb-page-btn {
    padding: 5px 8px;
    font-size: 12px;
  }
}

/* 桌面端 hover 效果（移动端不应用，避免双击问题） */
@media (hover: hover) {
  .gb-page-btn:hover { border-color: var(--gb-primary, #4a6cf7); color: var(--gb-primary, #4a6cf7); }
}
</style>
