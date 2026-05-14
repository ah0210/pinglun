<!-- src/widget/components/UserDropdown.vue — 用户下拉菜单（留言板内 + 导航栏共用） -->
<template>
  <div class="gb-dropdown" ref="dropdownRef">
    <div class="gb-dropdown-trigger" @click="toggle">
      <slot name="trigger">
        <img :src="user.avatar" class="gb-dropdown-avatar" :alt="user.displayName" />
        <span class="gb-dropdown-name">{{ user.displayName }}</span>
        <span class="gb-dropdown-arrow" :class="{ open: isOpen }">▼</span>
      </slot>
    </div>
    <div v-if="isOpen" class="gb-dropdown-menu" :style="menuStyle">
      <div class="gb-dropdown-header">
        <div class="gb-dropdown-username">{{ user.displayName }}</div>
        <div class="gb-dropdown-email">{{ user.email }}</div>
        <div class="gb-dropdown-verified">
          <span v-if="user.emailVerified" class="gb-badge gb-badge-success">邮箱已验证</span>
          <span v-else class="gb-badge gb-badge-warning">邮箱未验证</span>
        </div>
      </div>
      <div class="gb-dropdown-divider"></div>
      <button class="gb-dropdown-item" @click="handleChangeDisplayName">
        <span class="gb-dropdown-icon">👤</span> 修改显示名称
      </button>
      <button class="gb-dropdown-item" @click="handleChangePassword">
        <span class="gb-dropdown-icon">🔒</span> 修改密码
      </button>
      <button class="gb-dropdown-item" @click="handleChangeEmail">
        <span class="gb-dropdown-icon">📧</span> 修改邮箱
      </button>
      <div class="gb-dropdown-divider"></div>
      <button class="gb-dropdown-item gb-dropdown-item-danger" @click="handleLogout">
        <span class="gb-dropdown-icon">🚪</span> 退出登录
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useAuth } from '../composables/useAuth';
import type { PublicUser } from '../../shared/types';

const props = defineProps<{
  user: PublicUser;
}>();

const emit = defineEmits<{
  (e: 'change-display-name'): void;
  (e: 'change-password'): void;
  (e: 'change-email'): void;
  (e: 'logout'): void;
}>();

const auth = useAuth();
const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({});

function toggle() {
  if (isOpen.value) {
    close();
  } else {
    isOpen.value = true;
    updateMenuPosition();
  }
}

function close() {
  isOpen.value = false;
}

/** 使用 fixed 定位，动态计算下拉菜单位置，避免被祖先 overflow:hidden 裁剪 */
function updateMenuPosition() {
  requestAnimationFrame(() => {
    const trigger = dropdownRef.value?.querySelector('.gb-dropdown-trigger') as HTMLElement;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 200;
    const margin = 6;
    // 右对齐：菜单右边缘与触发器右边缘对齐
    const right = window.innerWidth - rect.right;
    // 确保不超出视口左侧
    const adjustedRight = right + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 8 : right;
    menuStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + margin}px`,
      right: `${Math.max(0, adjustedRight)}px`,
      left: 'auto',
    };
  });
}

function handleChangeDisplayName() {
  close();
  emit('change-display-name');
}

function handleChangePassword() {
  close();
  emit('change-password');
}

function handleChangeEmail() {
  close();
  emit('change-email');
}

async function handleLogout() {
  close();
  await auth.logout();
  emit('logout');
}

// 点击外部关闭（兼容移动端 touch 事件）
function onClickOutside(e: Event) {
  // Shadow DOM 中 e.target 会被重定向为宿主元素，
  // 使用 composedPath() 获取完整事件路径来正确判断点击来源
  if (dropdownRef.value) {
    const path = e.composedPath();
    if (!path.includes(dropdownRef.value)) {
      close();
    }
  }
}

function onScroll() {
  if (isOpen.value) updateMenuPosition();
}

onMounted(() => {
  document.addEventListener('click', onClickOutside);
  document.addEventListener('touchend', onClickOutside, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
});

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside);
  document.removeEventListener('touchend', onClickOutside);
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onScroll);
});
</script>

<style scoped>
.gb-dropdown {
  position: relative;
  display: inline-block;
}

.gb-dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 20px;
  transition: background 0.2s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  min-height: 44px;
}
.gb-dropdown-trigger:hover {
  background: var(--gb-bg-secondary, #f7f8fa);
}

.gb-dropdown-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.gb-dropdown-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--gb-text, #333);
}

.gb-dropdown-arrow {
  font-size: 10px;
  color: var(--gb-text-secondary, #999);
  transition: transform 0.2s;
}
.gb-dropdown-arrow.open {
  transform: rotate(180deg);
}

.gb-dropdown-menu {
  position: fixed;
  background: var(--gb-bg, #fff);
  border: 1px solid var(--gb-border, #e0e0e0);
  border-radius: var(--gb-border-radius, 8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  min-width: 200px;
  z-index: 10001;
  padding: 4px 0;
  animation: gb-dropdown-in 0.15s ease-out;
}

@keyframes gb-dropdown-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.gb-dropdown-header {
  padding: 8px 14px;
}

.gb-dropdown-username {
  font-weight: 600;
  font-size: 14px;
  color: var(--gb-text, #333);
  line-height: 1.3;
}

.gb-dropdown-email {
  font-size: 12px;
  color: var(--gb-text-secondary, #666);
  margin-top: 1px;
  word-break: break-all;
  line-height: 1.3;
}

.gb-dropdown-verified {
  margin-top: 2px;
}

.gb-badge {
  display: inline-block;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
}
.gb-badge-success {
  background: rgba(39, 174, 96, 0.1);
  color: var(--gb-success, #27ae60);
}
.gb-badge-warning {
  background: rgba(243, 156, 18, 0.1);
  color: var(--gb-warning, #f39c12);
}

.gb-dropdown-divider {
  height: 1px;
  background: var(--gb-border, #e0e0e0);
  margin: 4px 0;
}

.gb-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--gb-text, #333);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  min-height: 44px;
}
.gb-dropdown-item:active {
  background: var(--gb-bg-secondary, #f7f8fa);
}
.gb-dropdown-item:active {
  background: var(--gb-bg-secondary, #f7f8fa);
}
.gb-dropdown-item-danger {
  color: var(--gb-danger, #e74c3c);
}

.gb-dropdown-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .gb-dropdown-menu {
    min-width: 180px;
  }
  .gb-dropdown-name {
    display: none;
  }
}

/* 桌面端 hover 效果（移动端不应用，避免双击问题） */
@media (hover: hover) {
  .gb-dropdown-trigger:hover {
    background: var(--gb-bg-secondary, #f7f8fa);
  }
  .gb-dropdown-item:hover {
    background: var(--gb-bg-secondary, #f7f8fa);
  }
}
</style>
