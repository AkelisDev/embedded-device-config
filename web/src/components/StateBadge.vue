<script setup lang="ts">
import type { LinkState } from '../types';

defineProps<{ state: LinkState; dot?: boolean }>();

const LABELS: Record<LinkState, string> = {
  ok: 'OK',
  timeout: 'Timeout',
  partial: 'Partly down',
  waiting: 'Waiting',
  idle: 'No registers',
  disabled: 'Disabled',
  unknown: 'Unknown',
};
</script>

<template>
  <span v-if="dot" class="dot" :class="state" :title="LABELS[state]" />
  <span v-else class="badge" :class="state"><span class="dot" :class="state" />{{ LABELS[state] }}</span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  background: var(--surface-2);
  white-space: nowrap;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);
  flex: none;
}
.dot.ok { background: var(--ok); }
.dot.timeout { background: var(--bad); }
.dot.partial { background: var(--warn); }
.dot.waiting { background: var(--info); }
.badge.timeout { color: var(--bad); }
.badge.partial { color: var(--warn-text); }
.badge.disabled, .badge.idle, .badge.unknown { color: var(--muted); }
</style>
