<script setup lang="ts">
import { computed } from 'vue';
import { valueKey } from '@shared/modbus.js';
import { live, stationState, stationStatus } from '../live';
import { keyReadings } from '../readings';
import { links } from '../router';
import { now, ago, displayUnit, formatValue, isStale } from '../format';
import StateBadge from './StateBadge.vue';
import type { Channel, Station } from '../types';

const props = defineProps<{ channel: Channel; station: Station }>();

const groups = computed(() => keyReadings(props.channel, props.station));
const state = computed(() => stationState(props.channel.id, props.station.id));
const errorCount = computed(() => stationStatus(props.channel.id, props.station.id)?.errorCount ?? 0);

const lastValueAt = computed(() => {
  let last = 0;
  for (const dp of props.station.datapoints) {
    last = Math.max(last, live.values[valueKey(props.channel, props.station, dp)]?.[0] ?? 0);
  }
  return last || null;
});

function reading(key: string, acqCycle: number) {
  const sample = live.values[key];
  if (!sample) return { text: '–', stale: false };
  return { text: formatValue(sample[1]), stale: isStale(sample[0], acqCycle, now.value) };
}
</script>

<template>
  <article class="card" :class="state">
    <header>
      <a class="name" :href="links.station(channel.id, station.id)">{{ station.name }}</a>
      <StateBadge :state="state" />
    </header>
    <p class="meta">
      Address {{ station.address }}
      <template v-if="channel.enabled">
        · last value {{ ago(lastValueAt, now) }}
        <span v-if="errorCount" class="errors">· {{ errorCount }} failed reads</span>
      </template>
      <template v-else>· channel disabled</template>
    </p>

    <table v-if="channel.enabled && groups.length" class="readings">
      <tr v-for="g in groups" :key="g.title">
        <th>{{ g.title }}</th>
        <td v-for="r in g.readings" :key="r.key" :class="{ stale: reading(r.key, r.dp.acqCycle).stale }">
          <span class="phase">{{ r.label }}</span>
          <span class="value">{{ reading(r.key, r.dp.acqCycle).text }}</span>
          <span class="unit">{{ displayUnit(r.dp.units) }}</span>
        </td>
      </tr>
    </table>
    <p v-else-if="!station.datapoints.length" class="meta">No registers configured</p>
  </article>
</template>

<style scoped>
.card {
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 4px solid var(--ok);
  border-radius: 6px;
}
.card.timeout { border-left-color: var(--bad); }
.card.waiting { border-left-color: var(--info); }
.card.disabled, .card.idle, .card.unknown { border-left-color: var(--border); }
.card.disabled { opacity: 0.7; }
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.name {
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
}
.name:hover { text-decoration: underline; }
.meta {
  margin: 2px 0 8px;
  font-size: 12px;
  color: var(--muted);
}
.errors { color: var(--warn-text); }
.readings {
  width: 100%;
  border-collapse: collapse;
  /* Equal columns, so L1/L2/L3 line up from row to row */
  table-layout: fixed;
  font-variant-numeric: tabular-nums;
}
.readings th {
  width: 70px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.readings th, .readings td {
  padding: 3px 0;
  border-top: 1px solid var(--surface-2);
}
.readings td { white-space: nowrap; }
.phase {
  font-size: 11px;
  color: var(--muted);
  margin-right: 4px;
}
.value { font-weight: 600; }
.unit {
  margin-left: 2px;
  font-size: 12px;
  color: var(--text-2);
}
.stale .value, .stale .unit { color: var(--muted); }
.stale .value { text-decoration: line-through dotted; }
</style>
