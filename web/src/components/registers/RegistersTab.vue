<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { DATA_TYPES, FUNC_CODES, regCount } from '@shared/modbus.js';
import { saveRegisters } from '../../config';
import { useDraft, draftKeys } from '../../drafts';
import { errorsById, modbusAddress, nextAddress, sortByAddress, template, withIds } from '../../registers';
import SaveBar from '../SaveBar.vue';
import RegisterRow from './RegisterRow.vue';
import BulkEditBar from './BulkEditBar.vue';
import GeneratePanel from './GeneratePanel.vue';
import CopyPanel from './CopyPanel.vue';
import ImportPanel from './ImportPanel.vue';
import type { Channel, Datapoint, Station } from '../../types';

const props = defineProps<{ channel: Channel; station: Station }>();

const draft = useDraft(
  () => draftKeys.registers(props.channel.id, props.station.id),
  () => ({ datapoints: props.station.datapoints }),
);

const list = computed(() => draft.form.value?.datapoints ?? []);
const setList = (next: Datapoint[]) => (draft.form.value!.datapoints = next);

const errors = computed(() => errorsById(list.value));
const problems = computed(() =>
  sortByAddress(list.value)
    .filter((dp) => errors.value[dp.id])
    .map((dp) => ({ dp, message: Object.values(errors.value[dp.id])[0] })),
);

const search = ref('');
const funcCode = ref<number | ''>('');
const dataType = ref('');
const onlyProblems = ref(false);

const visible = computed(() => {
  const q = search.value.trim().toLowerCase();
  const matches = (dp: Datapoint) =>
    !q ||
    dp.description.toLowerCase().includes(q) ||
    dp.units.toLowerCase().includes(q) ||
    String(dp.startAddr).startsWith(q) ||
    modbusAddress(dp).startsWith(q);

  return sortByAddress(list.value).filter(
    (dp) =>
      (funcCode.value === '' || dp.funcCode === funcCode.value) &&
      (!dataType.value || dp.dataType === dataType.value) &&
      (!onlyProblems.value || errors.value[dp.id]) &&
      matches(dp),
  );
});

const selected = reactive(new Set<string>());
const selectedRows = computed(() => list.value.filter((dp) => selected.has(dp.id)));
let lastClicked = -1;

// Shift-click selects a range, the quick way to pick 50 rows
function toggle(index: number, range: boolean) {
  const rows = visible.value;
  if (range && lastClicked >= 0) {
    const [from, to] = [Math.min(lastClicked, index), Math.max(lastClicked, index)];
    for (let i = from; i <= to; i++) selected.add(rows[i].id);
  } else if (selected.has(rows[index].id)) selected.delete(rows[index].id);
  else selected.add(rows[index].id);
  lastClicked = index;
}

const allVisibleSelected = computed(() => visible.value.length > 0 && visible.value.every((dp) => selected.has(dp.id)));

function toggleAll() {
  const select = !allVisibleSelected.value;
  for (const dp of visible.value) select ? selected.add(dp.id) : selected.delete(dp.id);
}

function bulkApply(changes: Partial<Datapoint>) {
  for (const dp of selectedRows.value) Object.assign(dp, changes);
}

function removeSelected() {
  setList(list.value.filter((dp) => !selected.has(dp.id)));
  selected.clear();
}

const removeRow = (dp: Datapoint) => setList(list.value.filter((d) => d !== dp));

function addRow() {
  const base = template(list.value);
  setList([...list.value, ...withIds(list.value, [{ ...base, startAddr: nextAddress(list.value, base.funcCode) }])]);
  search.value = '';
}

type Panel = 'generate' | 'copy' | 'import';
const panel = ref<Panel | null>(null);
const openPanel = (p: Panel) => (panel.value = panel.value === p ? null : p);

function addRegisters(registers: Omit<Datapoint, 'id'>[], mode: 'append' | 'replace' = 'append') {
  const kept = mode === 'replace' ? [] : list.value;
  setList([...kept, ...withIds(kept, registers)]);
  if (mode === 'replace') selected.clear();
  panel.value = null;
}

const conflictText = computed(() => [`Register map (device has ${props.station.datapoints.length} registers)`]);

const save = () =>
  draft.save((value) =>
    saveRegisters(props.channel.id, props.station.id, value.datapoints.map((dp) => ({ ...dp, regSize: regCount(dp) }))),
  );
</script>

<template>
  <div class="registers">
    <div class="toolbar">
      <input v-model="search" class="search" type="search" placeholder="Search description, units or address" />
      <select v-model="funcCode">
        <option value="">All function codes</option>
        <option v-for="(name, fc) in FUNC_CODES" :key="fc" :value="Number(fc)">{{ fc }} {{ name }}</option>
      </select>
      <select v-model="dataType">
        <option value="">All types</option>
        <option v-for="(_, t) in DATA_TYPES" :key="t" :value="t">{{ t }}</option>
      </select>
      <span class="spacer" />
      <button type="button" @click="addRow">+ Register</button>
      <button type="button" :class="{ active: panel === 'generate' }" @click="openPanel('generate')">Generate range</button>
      <button type="button" :class="{ active: panel === 'copy' }" @click="openPanel('copy')">Copy from station</button>
      <button type="button" :class="{ active: panel === 'import' }" @click="openPanel('import')">Import / paste</button>
    </div>

    <GeneratePanel v-if="panel === 'generate'" :existing="list" @apply="addRegisters" @close="panel = null" />
    <CopyPanel v-if="panel === 'copy'" :channel-id="channel.id" :station-id="station.id" @apply="addRegisters" @close="panel = null" />
    <ImportPanel v-if="panel === 'import'" :existing="list" @apply="addRegisters" @close="panel = null" />

    <div v-if="problems.length" class="problems">
      <strong>{{ problems.length }} {{ problems.length === 1 ? 'register has' : 'registers have' }} problems</strong>
      <label class="check"><input v-model="onlyProblems" type="checkbox" /> Show only these</label>
      <ul>
        <li v-for="p in problems.slice(0, 5)" :key="p.dp.id">
          <span class="num">{{ p.dp.startAddr }} ({{ modbusAddress(p.dp) }})</span> {{ p.dp.description }}: {{ p.message }}
        </li>
        <li v-if="problems.length > 5" class="muted">and {{ problems.length - 5 }} more</li>
      </ul>
    </div>

    <BulkEditBar v-if="list.length" :count="selectedRows.length" @apply="bulkApply" @remove="removeSelected" @clear="selected.clear()" />

    <p class="count muted">
      {{ visible.length === list.length ? `${list.length} registers` : `Showing ${visible.length} of ${list.length}` }}
      · shift-click to select a range
    </p>

    <table v-if="list.length" class="reg-table">
      <thead>
        <tr>
          <th><input type="checkbox" :checked="allVisibleSelected" title="Select all shown" @change="toggleAll" /></th>
          <th>Address</th>
          <th>Modbus</th>
          <th>Description</th>
          <th>Type</th>
          <th title="Registers used, follows from the data type">Regs</th>
          <th>Function</th>
          <th>Byte order</th>
          <th>Cycle, ms</th>
          <th>Scale</th>
          <th>Units</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <RegisterRow
          v-for="(dp, i) in visible"
          :key="dp.id"
          :dp="dp"
          :errors="errors[dp.id]"
          :selected="selected.has(dp.id)"
          @toggle="(range) => toggle(i, range)"
          @remove="removeRow(dp)"
        />
      </tbody>
    </table>
    <p v-else class="empty">No registers yet. Generate a range, copy them from another station or paste from Excel.</p>
    <p v-if="list.length && !visible.length" class="empty">No register matches the filters.</p>

    <SaveBar
      :dirty="draft.dirty.value"
      :conflict="draft.conflict.value"
      :saving="draft.saving.value"
      :invalid="problems.length > 0"
      :error="draft.error.value"
      :conflicts="conflictText"
      @save="save"
      @discard="draft.discard"
      @keep-mine="draft.keepMine"
    />
  </div>
</template>

<style>
.registers .toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.registers .search { width: 280px; }
.registers .spacer { flex: 1; }
.registers .toolbar button.active { background: var(--active-bg); border-color: var(--accent); }
.registers .count { margin: 0 0 6px; font-size: 12px; }

.problems {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--bad-bg);
  border: 1px solid var(--bad);
  border-radius: 6px;
}
.problems .check { display: inline-flex; height: auto; margin-left: 12px; }
.problems ul { margin: 4px 0 0; padding-left: 18px; font-size: 13px; }

.reg-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 13px;
}
.reg-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px 4px;
  text-align: left;
  font-size: 12px;
  color: var(--text-2);
  background: var(--surface-2);
  white-space: nowrap;
}
.reg-table td {
  padding: 1px 2px;
  border-top: 1px solid var(--surface-2);
}
.reg-table td:first-child, .reg-table th:first-child { padding-left: 8px; width: 28px; }
.reg-table tr.selected { background: var(--active-bg); }
.reg-table tr.invalid { box-shadow: inset 3px 0 var(--bad); }
.reg-table input:not([type='checkbox']), .reg-table select {
  width: 100%;
  height: 26px;
  padding: 0 4px;
  border-color: transparent;
  background: transparent;
}
.reg-table tr:hover input:not([type='checkbox']), .reg-table tr:hover select { border-color: var(--border); }
.reg-table input:focus, .reg-table select:focus { background: var(--surface); }
.reg-table .bad { border-color: var(--bad) !important; background: var(--bad-bg) !important; }
.reg-table .addr { width: 70px; }
.reg-table .descr { min-width: 180px; }
.reg-table .type { width: 82px; }
.reg-table .fc { width: 92px; }
.reg-table .order { width: 68px; }
.reg-table .cycle { width: 82px; }
.reg-table .scale { width: 72px; }
.reg-table .units { width: 60px; }
.reg-table .modbus { font-family: var(--mono); font-size: 12px; color: var(--text-2); padding: 0 6px; }
.reg-table .remove {
  height: 24px;
  padding: 0 8px;
  border-color: transparent;
  background: transparent;
  color: var(--muted);
}
.reg-table .remove:hover { color: var(--bad); }
</style>
