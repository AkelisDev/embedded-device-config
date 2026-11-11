<script setup lang="ts">
import { computed } from 'vue';
import { classify } from '@shared/quantity.js';
import { valueKey } from '@shared/modbus.js';
import { live } from '../../live';
import { now, ago, displayUnit, formatValue, isStale } from '../../format';
import type { Channel, Datapoint, Station } from '../../types';

const props = defineProps<{ channel: Channel; station: Station; selected: string[]; maxSelected: number }>();
const emit = defineEmits<{ toggle: [key: string] }>();

const GROUPS: { title: string; quantities: string[] }[] = [
  { title: 'Voltage', quantities: ['voltage'] },
  { title: 'Current', quantities: ['current'] },
  { title: 'Power', quantities: ['power', 'apparent', 'reactive', 'pf'] },
  { title: 'Energy', quantities: ['energy', 'reactiveEnergy'] },
  { title: 'Other', quantities: [] },
];

const groups = computed(() => {
  const rows = props.station.datapoints.map((dp) => ({ dp, key: valueKey(props.channel, props.station, dp), quantity: classify(dp).quantity }));
  return GROUPS.map((g) => ({
    title: g.title,
    rows: rows.filter((r) => (g.quantities.length ? g.quantities.includes(r.quantity) : !GROUPS.some((o) => o.quantities.includes(r.quantity)))),
  })).filter((g) => g.rows.length);
});

function reading(key: string, dp: Datapoint) {
  const sample = live.values[key];
  if (!sample) return { text: '–', stale: false, age: 'no value yet' };
  const stale = isStale(sample[0], dp.acqCycle, now.value);
  return { text: formatValue(sample[1]), stale, age: ago(sample[0], now.value) };
}

const full = computed(() => props.selected.length >= props.maxSelected);
</script>

<template>
  <div class="latest">
    <section v-for="g in groups" :key="g.title" class="group">
      <h3>{{ g.title }}</h3>
      <label
        v-for="r in g.rows"
        :key="r.key"
        class="value"
        :class="{ stale: reading(r.key, r.dp).stale, on: selected.includes(r.key) }"
        :title="reading(r.key, r.dp).stale ? `Stale: last value ${reading(r.key, r.dp).age}` : reading(r.key, r.dp).age"
      >
        <input
          type="checkbox"
          :checked="selected.includes(r.key)"
          :disabled="full && !selected.includes(r.key)"
          @change="emit('toggle', r.key)"
        />
        <span class="name">{{ r.dp.description || `Register ${r.dp.startAddr}` }}</span>
        <span class="reading">{{ reading(r.key, r.dp).text }}</span>
        <span class="unit">{{ displayUnit(r.dp.units) }}</span>
        <span v-if="reading(r.key, r.dp).stale" class="flag">stale</span>
      </label>
    </section>
  </div>
</template>

<style scoped>
.latest {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.group {
  padding: 8px 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}
h3 {
  margin: 0 0 4px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 2px;
  border-top: 1px solid var(--surface-2);
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.value.on .name { font-weight: 600; }
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.reading { font-weight: 700; }
.unit {
  width: 40px;
  font-size: 12px;
  color: var(--text-2);
}
.flag {
  font-size: 11px;
  font-weight: 600;
  color: var(--warn-text);
}
.stale .reading, .stale .unit { color: var(--muted); }
.stale .reading { text-decoration: line-through dotted; }
</style>
