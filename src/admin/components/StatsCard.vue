<!-- src/admin/components/StatsCard.vue — 统计卡片 -->
<template>
  <n-card size="small">
    <n-statistic :label="label" :value="value">
      <template #prefix v-if="prefix">
        <span style="font-size: 20px">{{ prefix }}</span>
      </template>
    </n-statistic>
  </n-card>
</template>

<script lang="ts" setup>
import { NCard, NStatistic } from 'naive-ui';

defineProps<{
  label: string;
  value: number;
  prefix?: string;
}>();
</script>
