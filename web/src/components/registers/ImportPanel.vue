<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { checkDatapoint, findOverlaps } from '@shared/validate.js';
import { regCount } from '@shared/modbus.js';
import { parseTable, looksLikeModbusNotation, toRegisters } from '../../importTable';
import { template, modbusAddress } from '../../registers';
import type { Datapoint } from '../../types';

const props = defineProps<{ existing: Datapoint[] }>();
const emit = defineEmits<{ apply: [registers: Omit<Datapoint, 'id'>[], mode: 'replace' | 'append']; close: [] }>();

const FIELD_LABELS: Record<string, string> = {
  startAddr: 'Address', description: 'Description', dataType: 'Type', funcCode: 'FC',
  byteOrder: 'Order', acqCycle: 'Cycle', scale: 'Scale', units: 'Units',
};

const text = ref('');
const mode = ref<'replace' | 'append'>('append');
const modbusNotation = ref(false);

const table = computed(() => parseTable(text.value));
watch(table, (t) => (modbusNotation.value = looksLikeModbusNotation(t)));

const rows = computed(() => {
  const imported = toRegisters(table.value, template(props.existing), modbusNotation.value);
  const kept = mode.value === 'append' ? props.existing : [];
  const all = [...kept, ...imported.map((r) => r.register)];

  const overlaps = new Map<number, string>();
  for (const [a, b] of findOverlaps(all)) {
    for (const [mine, other] of [[a, b], [b, a]]) {
      if (mine >= kept.length) overlaps.set(mine - kept.length, `Overlaps ${all[other].description || modbusAddress(all[other])}`);
    }
  }

  return imported.map((row, i) => ({
    ...row,
    error: row.error ?? checkDatapoint(row.register)[0]?.message ?? overlaps.get(i),
  }));
});

const errorCount = computed(() => rows.value.filter((r) => r.error).length);

async function readFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) text.value = await file.text();
}

const apply = () => emit('apply', rows.value.map((r) => r.register), mode.value);
</script>

<template>
  <form class="panel" @submit.prevent="apply">
    <h3>Import or paste</h3>
    <p class="note">
      Paste rows from Excel or load a CSV file. With a header row, columns are matched by name (address, description,
      type, fc, byte order, cycle, scale, units). Without one, that order is assumed. Missing values use the most common
      value in this map (or FC 3, float32, ABCD, 1000 ms, scale 1 when it's empty).
    </p>
    <textarea v-model="text" rows="6" placeholder="30001&#9;Phase 1 voltage&#9;float32&#9;4&#9;ABCD&#9;1000&#9;1&#9;V" />
    <div class="row">
      <input type="file" accept=".csv,.txt,.tsv" @change="readFile" />
      <label class="check"><input v-model="modbusNotation" type="checkbox" /> Addresses are in 30001/40001 notation</label>
      <label class="check"><input v-model="mode" type="radio" value="append" /> Add to map</label>
      <label class="check"><input v-model="mode" type="radio" value="replace" /> Replace map</label>
    </div>

    <template v-if="rows.length">
      <p class="note">
        {{ rows.length }} rows<template v-if="table.hasHeader">, header found</template>
        <span v-if="errorCount" class="form-error"> · {{ errorCount }} with errors, fix them in the source and paste again</span>
      </p>
      <div class="preview">
        <table class="list">
          <thead>
            <tr>
              <th>#</th>
              <th v-for="(label, f) in FIELD_LABELS" :key="f">{{ label }}</th>
              <th>Problem</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="i" :class="{ invalid: r.error }">
              <td class="muted">{{ i + 1 }}</td>
              <td class="num">{{ r.register.startAddr }} <span class="muted">{{ modbusAddress(r.register) }}</span></td>
              <td>{{ r.register.description }}</td>
              <td>{{ r.register.dataType }} <span class="muted">×{{ regCount(r.register) }}</span></td>
              <td>{{ r.register.funcCode }}</td>
              <td>{{ r.register.byteOrder }}</td>
              <td class="num">{{ r.register.acqCycle }}</td>
              <td class="num">{{ r.register.scale }}</td>
              <td>{{ r.register.units }}</td>
              <td class="form-error">{{ r.error }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div class="actions">
      <button type="button" @click="emit('close')">Cancel</button>
      <button class="primary" :disabled="!rows.length || errorCount > 0">Import {{ rows.length }} registers</button>
    </div>
  </form>
</template>

<style scoped>
textarea {
  width: 100%;
  font: 12px/1.4 var(--mono);
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
}
.preview {
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--border);
}
.preview .list {
  margin: 0;
  border: 0;
  font-size: 12px;
}
.preview tbody tr { cursor: default; }
tr.invalid { background: var(--bad-bg); }
</style>
