<script setup lang="ts">
import { computed } from 'vue';
import { live } from '../live';

const props = defineProps<{
  dirty: boolean;
  conflict: boolean;
  saving: boolean;
  invalid: boolean;
  error: string;
  // e.g. "Port (device has 503)"
  conflicts: string[];
}>();

defineEmits<{ save: []; discard: []; keepMine: [] }>();

const blockedReason = computed(() => {
  if (!live.connected) return 'Not connected to the device';
  if (props.invalid) return 'Fix the highlighted fields first';
  return '';
});
</script>

<template>
  <div v-if="dirty || error" class="save-bar" :class="{ conflict }">
    <template v-if="conflict">
      <span class="message">
        Also changed on the device since you started editing: {{ conflicts.join(', ') }}
      </span>
      <button @click="$emit('discard')">Use device version</button>
      <button class="primary" @click="$emit('keepMine')">Keep my changes</button>
    </template>
    <template v-else>
      <span class="message">
        <span v-if="error" class="error">{{ error }}</span>
        <span v-else>Unsaved changes</span>
        <span v-if="blockedReason" class="muted"> · {{ blockedReason }}</span>
      </span>
      <button :disabled="saving" @click="$emit('discard')">Discard</button>
      <button class="primary" :disabled="saving || !!blockedReason" @click="$emit('save')">
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.save-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
  padding: 10px 16px;
  background: var(--draft-bg);
  border: 1px solid var(--draft-border);
  border-radius: 6px;
}
.save-bar.conflict {
  background: var(--bad-bg);
  border-color: var(--bad);
}
.message {
  flex: 1;
  font-weight: 600;
}
.error { color: var(--bad); }
.muted { color: var(--muted); font-weight: 400; }
</style>
