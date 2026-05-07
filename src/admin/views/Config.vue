<!-- src/admin/views/Config.vue — 系统配置 -->
<template>
  <div>
    <n-h2>系统配置</n-h2>
    <n-card>
      <n-form label-placement="left" label-width="140">
        <n-form-item label="站点名称">
          <n-input v-model:value="config.siteName" />
        </n-form-item>
        <n-form-item label="留言最大长度">
          <n-input-number v-model:value="config.maxMessageLength" :min="100" :max="5000" />
        </n-form-item>
        <n-form-item label="验证码">
          <n-switch v-model:value="config.requireCaptcha" />
          <span style="margin-left: 8px; color: #999">{{ config.requireCaptcha ? '开启' : '关闭' }}</span>
        </n-form-item>
        <n-form-item label="审核模式">
          <n-switch v-model:value="config.moderationEnabled" />
          <span style="margin-left: 8px; color: #999">{{ config.moderationEnabled ? '先审后发' : '先发后审' }}</span>
        </n-form-item>
        <n-form-item label="每日秘密留言额度">
          <n-input-number v-model:value="config.dailySecretLimit" :min="1" :max="100" />
        </n-form-item>
        <n-form-item label="注册开关">
          <n-switch v-model:value="config.allowRegistration" />
          <span style="margin-left: 8px; color: #999">{{ config.allowRegistration ? '开放注册' : '关闭注册' }}</span>
        </n-form-item>
        <n-form-item>
          <n-button type="primary" :loading="saving" @click="handleSave">保存配置</n-button>
        </n-form-item>
      </n-form>
    </n-card>
  </div>
</template>

<script lang="ts" setup>
import { reactive, ref, onMounted } from 'vue';
import { NH2, NCard, NForm, NFormItem, NInput, NInputNumber, NSwitch, NButton, useMessage } from 'naive-ui';
import { useAuthStore } from '../stores/auth';
import type { AdminConfig } from '../../shared/types';

const authStore = useAuthStore();
const message = useMessage();
const saving = ref(false);

const config = reactive<AdminConfig>({
  siteName: '留言板',
  maxMessageLength: 500,
  requireCaptcha: true,
  moderationEnabled: false,
  dailySecretLimit: 5,
  allowRegistration: true,
  updatedAt: '',
});

async function fetchConfig() {
  const resp = await fetch('/api/v1/admin/config', {
    headers: { 'Authorization': `Bearer ${authStore.token}` },
    credentials: 'include',
  });
  const data = await resp.json();
  if (data.success && data.data) {
    Object.assign(config, data.data);
  }
}

async function handleSave() {
  saving.value = true;
  try {
    const resp = await fetch('/api/v1/admin/config', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authStore.token}`, 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config),
    });
    const data = await resp.json();
    if (data.success) {
      message.success('配置已保存');
    } else {
      message.error(data.error?.message || '保存失败');
    }
  } finally {
    saving.value = false;
  }
}

onMounted(fetchConfig);
</script>
