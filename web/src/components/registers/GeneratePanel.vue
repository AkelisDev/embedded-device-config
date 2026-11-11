<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { DATA_TYPES, FUNC_CODES, BYTE_ORDERS, regCount } from '@shared/modbus.js';
import { findOverlaps } from '@shared/validate.js';
import { template, nextAddress, fillPattern, modbusAddress } from '../../registers';
import FormField from '../FormField.vue';
import type { Datapoint } from '../../types';

const props = defineProps<{ existing: Datapoint[] }>();
const emit = defineEmits<{ apply: [registers: Omit<Datapoint, 'id'>[]]; close: [] }>();

const base = template(props.existing);
const form = reactive({
  ...base,
  startAddr: nextAddress(props.existing, base.funcCode),
  count: 10,
  pattern: 'Register {n}',
});

// Follow the function code: input and holding registers are separate address spaces
watch(
  () => form.funcCode,
  (fc) => (form.startAddr = nextAddress(props.existing, fc)),
);

const generated = computed(() => {
  const { count, pattern, ...settings } = form;
  const size = regCount(settings);
  const n = Math.min(Math.max(Math.floor(count) || 0, 0), 1000);
  return Array.from({ length: n }, (_, i) => {
    const dp = { ...settings, startAddr: settings.startAddr + i * size, regSize: size };
    return { ...dp, description: fillPattern(pattern, i + 1, dp) };
  });
});

const overlapCount = computed(() => {
  const all = [...props.existing, ...generated.value];
  const firstNew = props.existing.length;
  return findOverlaps(all).filter(([a, b]) => (a < firstNew) !== (b < firstNew)).length;
});

const range = computed(() => {
  const list = generated.value;
  if (!list.length) return '';
  const first = list[0];
  const last = list.at(-1)!;
  const end = { ...last, startAddr: last.startAddr + regCount(last) - 1 };
  return `${first.startAddr}-${end.startAddr} (${modbusAddress(first)}-${modbusAddress(end)})`;
});
</script>

<template>
  <form class="panel" @submit.prevent="emit('apply', generated)">
    <h3>Generate range</h3>
    <div class="grid">
      <FormField label="Start address">
        <input v-model.number="form.startAddr" type="number" min="0" />
      </FormField>
      <FormField label="Count" hint="Up to 1000">
        <input v-model.number="form.count" type="number" min="1" max="1000" />
      </FormField>
      <FormField label="Data type">
        <select v-model="form.dataType">
          <option v-for="(_, t) in DATA_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </FormField>
      <FormField label="Function code">
        <select v-model.number="form.funcCode">
          <option v-for="(name, fc) in FUNC_CODES" :key="fc" :value="Number(fc)">{{ fc }} {{ name }}</option>
        </select>
      </FormField>
      <FormField label="Byte order">
        <select v-model="form.byteOrder">
          <option v-for="o in BYTE_ORDERS" :key="o" :value="o">{{ o }}</option>
        </select>
      </FormField>
      <FormField label="Cycle, ms">
        <input v-model.number="form.acqCycle" type="number" min="100" step="100" />
      </FormField>
      <FormField label="Scale">
        <input v-model.number="form.scale" type="number" step="any" />
      </FormField>
      <FormField label="Units">
        <input v-model.trim="form.units" />
      </FormField>
      <FormField label="Description" hint="{n} = 1, 2, 3...  {addr} = address  {modbus} = 30001 style">
        <input v-model="form.pattern" />
      </FormField>
    </div>
    <p class="note">
      {{ generated.length }} registers, addresses {{ range }}
      <span v-if="overlapCount" class="form-error">· overlaps {{ overlapCount }} existing</span>
    </p>
    <div class="actions">
      <button type="button" @click="emit('close')">Cancel</button>
      <button class="primary" :disabled="!generated.length">Add {{ generated.length }} registers</button>
    </div>
  </form>
</template>
