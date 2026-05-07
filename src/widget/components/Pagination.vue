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
