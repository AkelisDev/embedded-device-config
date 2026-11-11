<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DATA_TYPES, FUNC_CODES, BYTE_ORDERS } from '@shared/modbus.js';
import type { Datapoint } from '../../types';

defineProps<{ count: number }>();
const emit = defineEmits<{ apply: [changes: Partial<Datapoint>]; remove: []; clear: [] }>();

type BulkField = 'acqCycle' | 'byteOrder' | 'funcCode' | 'dataType' | 'scale' | 'units';

const FIELDS: { id: BulkField; label: string; options?: { value: string | number; label: string }[] }[] = [
  { id: 'acqCycle', label: 'Cycle, ms' },
  { id: 'byteOrder', label: 'Byte order', options: BYTE_ORDERS.map((o) => ({ value: o, label: o })) },
  { id: 'funcCode', label: 'Function code', options: Object.entries(FUNC_CODES).map(([fc, n]) => ({ value: Number(fc), label: `${fc} ${n}` })) },
  { id: 'dataType', label: 'Data type', options: Object.keys(DATA_TYPES).map((t) => ({ value: t, label: t })) },
  { id: 'scale', label: 'Scale' },
  { id: 'units', label: 'Units' },
];

const field = ref<BulkField>('acqCycle');
const value = ref<string | number>('');
const current = computed(() => FIELDS.find((f) => f.id === field.value)!);

watch(field, () => (value.value = current.value.options?.[0].value ?? ''), { immediate: true });

function apply() {
  const isNumber = field.value === 'acqCycle' || field.value === 'scale';
  emit('apply', { [field.value]: isNumber ? Number(value.value) : value.value });
}
</script>

<template>
  <!-- Always shown, so selecting the first row doesn't push the table down -->
  <fieldset class="bulk" :class="{ idle: !count }" :disabled="!count">
    <strong>{{ count ? `${count} selected` : 'Select rows to edit them together' }}</strong>
    <span>Set</span>
    <select v-model="field">
      <option v-for="f in FIELDS" :key="f.id" :value="f.id">{{ f.label }}</option>
    </select>
    <span>to</span>
    <select v-if="current.options" v-model="value">
      <option v-for="o in current.options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <input v-else v-model="value" :type="field === 'units' ? 'text' : 'number'" step="any" @keydown.enter="apply" />
    <button class="primary" type="button" @click="apply">Apply</button>
    <span class="spacer" />
    <button class="danger" type="button" @click="emit('remove')">Delete {{ count || '' }}</button>
    <button type="button" @click="emit('clear')">Clear selection</button>
  </fieldset>
</template>

<style scoped>
.bulk {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 12px;
  margin: 0 0 8px;
  background: var(--active-bg);
  border: 1px solid var(--accent);
  border-radius: 6px;
}
.bulk.idle {
  background: var(--surface);
  border-color: var(--border);
  color: var(--muted);
}
.spacer { flex: 1; }
input { width: 120px; }
</style>
