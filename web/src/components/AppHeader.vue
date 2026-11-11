<script setup lang="ts">
import { live } from '../live';
import { config } from '../config';
import ConfigImport from './ConfigImport.vue';
</script>

<template>
  <header class="app-header">
    <a class="title" href="#/">Modbus gateway</a>
    <span class="link" :class="{ offline: !live.connected }">
      {{ live.connected ? 'Connected' : 'Not connected' }}
    </span>
    <span class="spacer" />
    <!-- Worth having before changing anything on site -->
    <template v-if="config.loaded">
      <ConfigImport />
      <a class="button" href="/api/export" download>Download config backup</a>
    </template>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  height: 48px;
  background: var(--header-bg);
  color: var(--header-text);
}
.title {
  font-weight: 700;
  color: inherit;
  text-decoration: none;
}
.link {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--ok);
  color: #fff;
}
.link.offline { background: var(--bad); }
.spacer { flex: 1; }
/* :deep so the import button in ConfigImport gets the same look */
.app-header :deep(.button) {
  color: inherit;
  border-color: rgba(255, 255, 255, 0.4);
  background: transparent;
}
</style>
