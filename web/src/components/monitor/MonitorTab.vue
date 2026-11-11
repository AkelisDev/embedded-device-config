<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { classify } from '@shared/quantity.js';
import { valueKey } from '@shared/modbus.js';
import { live } from '../../live';
import { now, displayUnit } from '../../format';
import { fetchTracks, addSample, trim, type Track } from '../../monitorData';
import LatestValues from './LatestValues.vue';
import UnitChart, { type ChartSeries } from './UnitChart.vue';
import type { Channel, Datapoint, Station } from '../../types';

const props = defineProps<{ channel: Channel; station: Station }>();

const RANGES = [
  { seconds: 300, label: '5 min' },
  { seconds: 900, label: '15 min' },
  { seconds: 3600, label: '1 h' },
];
const MAX_SELECTED = 8;
const PALETTE = ['#1f6feb', '#e36209', '#1f9d55', '#d64545', '#8250df', '#0a7b83', '#bf8700', '#6e7781'];

const registers = computed(() => {
  const map = new Map<string, Datapoint>();
  for (const dp of props.station.datapoints) map.set(valueKey(props.channel, props.station, dp), dp);
  return map;
});

const storageKey = `gateway-monitor:${props.channel.id}/${props.station.id}`;

// The three phase voltages answer "is the meter alive and wired right?"
function defaultSelection() {
  const keys = [...registers.value.keys()];
  const voltages = keys.filter((k) => {
    const kind = classify(registers.value.get(k)!);
    return kind.quantity === 'voltage' && kind.phase;
  });
  return (voltages.length ? voltages : keys).slice(0, 3);
}

function restoreSelection(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (Array.isArray(saved)) return saved;
  } catch {
    // Fall back to the default below
  }
  return defaultSelection();
}

const selected = ref<string[]>(restoreSelection());
// Registers can be deleted on the Registers tab meanwhile
const shown = computed(() => selected.value.filter((k) => registers.value.has(k)));

watch(selected, (keys) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(keys));
  } catch {
    // Only a convenience
  }
});

function toggle(key: string) {
  selected.value = selected.value.includes(key) ? selected.value.filter((k) => k !== key) : [...selected.value, key];
}

const range = ref(900);
const rangeMs = computed(() => range.value * 1000);
const band = computed(() => range.value > 900);

const tracks = shallowRef(new Map<string, Track>());
const version = ref(0);
const loading = ref(false);
const error = ref('');
let loadToken = 0;

async function load() {
  const token = ++loadToken;
  const keys = shown.value;
  error.value = '';
  if (!keys.length) {
    tracks.value = new Map();
    return;
  }
  loading.value = true;
  try {
    const cycles = Object.fromEntries(keys.map((k) => [k, registers.value.get(k)!.acqCycle]));
    const result = await fetchTracks(keys, range.value, cycles);
    if (token !== loadToken) return;
    tracks.value = result;
    version.value++;
  } catch (e) {
    if (token === loadToken) error.value = (e as Error).message;
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

watch([range, () => shown.value.join(',')], load, { immediate: true });

// Live values go straight into the loaded tracks; history is fetched only
// when the range or the selection changes.
watch(
  () => shown.value.map((k) => live.values[k]),
  (samples) => {
    shown.value.forEach((key, i) => {
      const sample = samples[i];
      const track = tracks.value.get(key);
      if (sample && track) addSample(track, sample[0], sample[1]);
    });
  },
);

// Redraw once a second, so the chart scrolls even while a meter is silent
watch(now, () => {
  const from = now.value - rangeMs.value - 60_000;
  for (const track of tracks.value.values()) trim(track, from);
  version.value++;
});

const charts = computed(() => {
  const byUnit = new Map<string, ChartSeries[]>();
  shown.value.forEach((key, i) => {
    const dp = registers.value.get(key)!;
    const unit = displayUnit(dp.units);
    if (!byUnit.has(unit)) byUnit.set(unit, []);
    byUnit.get(unit)!.push({ key, label: dp.description || `Register ${dp.startAddr}`, color: PALETTE[i % PALETTE.length] });
  });
  return [...byUnit].map(([unit, series]) => ({ unit, series, id: `${unit}|${series.map((s) => s.key).join()}|${band.value}` }));
});
</script>

<template>
  <div class="monitor">
    <p v-if="!channel.enabled" class="empty">The channel is disabled, so this station isn't polled.</p>

    <template v-else>
      <div class="toolbar">
        <div class="ranges">
          <button v-for="r in RANGES" :key="r.seconds" type="button" :class="{ active: range === r.seconds }" @click="range = r.seconds">
            {{ r.label }}
          </button>
        </div>
        <span class="muted">
          {{ band ? 'Per minute: line is the average, band is min to max' : 'Every sample' }}
          · tick up to {{ MAX_SELECTED }} registers below to chart them
        </span>
        <span v-if="loading" class="muted">Loading...</span>
        <span v-if="error" class="form-error">{{ error }}</span>
      </div>

      <UnitChart
        v-for="c in charts"
        :key="c.id"
        :unit="c.unit"
        :series="c.series"
        :tracks="tracks"
        :version="version"
        :range-ms="rangeMs"
        :band="band"
      />
      <p v-if="!charts.length" class="empty">Tick registers below to chart them.</p>

      <LatestValues :channel="channel" :station="station" :selected="shown" :max-selected="MAX_SELECTED" @toggle="toggle" />
    </template>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 13px;
}
.ranges {
  display: inline-flex;
}
.ranges button {
  border-radius: 0;
  margin-left: -1px;
}
.ranges button:first-child { border-radius: 4px 0 0 4px; margin-left: 0; }
.ranges button:last-child { border-radius: 0 4px 4px 0; }
.ranges button.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
</style>
