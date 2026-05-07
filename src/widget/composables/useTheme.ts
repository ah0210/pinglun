// src/widget/composables/useTheme.ts — 主题自动跟随（prefers-color-scheme）

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

export function useTheme(theme: 'light' | 'dark' | 'auto' = 'auto') {
  const themeRef = ref(theme);
  const systemDark = ref(false);
  let mediaQuery: MediaQueryList | null = null;
  let handler: ((e: MediaQueryListEvent) => void) | null = null;

  const effectiveTheme = computed(() => {
    if (themeRef.value !== 'auto') return themeRef.value;
    return systemDark.value ? 'dark' : 'light';
  });

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemDark.value = mediaQuery.matches;

    handler = (e: MediaQueryListEvent) => {
      systemDark.value = e.matches;
    };

    mediaQuery.addEventListener('change', handler);
  });

  onUnmounted(() => {
    if (mediaQuery && handler) {
      mediaQuery.removeEventListener('change', handler);
    }
  });

  function setTheme(t: 'light' | 'dark' | 'auto') {
    themeRef.value = t;
  }

  return {
    theme: themeRef,
    effectiveTheme,
    setTheme,
    isDark: computed(() => effectiveTheme.value === 'dark'),
  };
}
