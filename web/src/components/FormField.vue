<script setup lang="ts">
defineProps<{ label: string; error?: string; hint?: string }>();
</script>

<template>
  <label class="field" :class="{ invalid: error }">
    <span class="label">{{ label }}</span>
    <slot />
    <span v-if="error" class="error">{{ error }}</span>
    <span v-else-if="hint" class="hint">{{ hint }}</span>
  </label>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.hint, .error {
  font-size: 12px;
}
.hint { color: var(--muted); }
.error { color: var(--bad); }
.invalid :slotted(input), .invalid :slotted(select) {
  border-color: var(--bad);
}
</style>
