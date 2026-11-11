<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { live } from '../../live';
import { formatValue } from '../../format';
import { stats, type Track } from '../../monitorData';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

const props = defineProps<{
  unit: string;
  series: ChartSeries[];
  tracks: Map<string, Track>;
  // Bumped by the parent on every data change; tracks themselves aren't reactive
  version: number;
  rangeMs: number;
  band: boolean;
}>();

const el = ref<HTMLDivElement>();
const cursorIdx = ref<number | null>(null);
let plot: uPlot | undefined;
let resize: ResizeObserver | undefined;

// With a band each register has three series: average line, min, max
const perRegister = computed(() => (props.band ? 3 : 1));

function data(): uPlot.AlignedData {
  const tables = props.series.map((s) => {
    const track = props.tracks.get(s.key);
    const x = (track?.t ?? []).map((t) => t / 1000);
    return (props.band ? [x, track?.avg ?? [], track?.min ?? [], track?.max ?? []] : [x, track?.avg ?? []]) as uPlot.AlignedData;
  });
  return tables.length > 1 ? uPlot.join(tables) : (tables[0] ?? [[]]);
}

function options(width: number): uPlot.Options {
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue('--text-2').trim();
  const grid = css.getPropertyValue('--surface-2').trim();
  const axis = { stroke: text, grid: { stroke: grid }, ticks: { stroke: grid } };

  const series: uPlot.Series[] = [{}];
  const bands: uPlot.Band[] = [];
  for (const s of props.series) {
    series.push({ label: s.label, stroke: s.color, width: 1.5, spanGaps: false, points: { show: false } });
    if (props.band) {
      const avgIdx = series.length - 1;
      series.push({ label: `${s.label} min`, stroke: 'transparent', points: { show: false } });
      series.push({ label: `${s.label} max`, stroke: 'transparent', points: { show: false } });
      bands.push({ series: [avgIdx + 2, avgIdx + 1], fill: `${s.color}2e` });
    }
  }

  return {
    width,
    height: 220,
    legend: { show: false },
    series,
    bands,
    scales: {
      // Fixed window ending now, so the chart scrolls instead of rescaling
      x: { time: true, range: () => [(Date.now() - props.rangeMs) / 1000, Date.now() / 1000] },
    },
    // Wider tick spacing keeps time labels from running into each other
    axes: [{ ...axis, space: 90 }, { ...axis, size: 60, label: props.unit || undefined }],
    hooks: { setCursor: [(u) => (cursorIdx.value = u.cursor.idx ?? null)] },
  };
}

onMounted(() => {
  plot = new uPlot(options(el.value!.clientWidth), data(), el.value!);
  resize = new ResizeObserver(() => plot?.setSize({ width: el.value!.clientWidth, height: 220 }));
  resize.observe(el.value!);
});

onBeforeUnmount(() => {
  resize?.disconnect();
  plot?.destroy();
});

watch(
  () => props.version,
  () => plot?.setData(data()),
);

const rows = computed(() => {
  void props.version;
  return props.series.map((s, i) => {
    const atCursor = cursorIdx.value === null ? undefined : plot?.data[1 + i * perRegister.value]?.[cursorIdx.value];
    return { ...s, ...stats(props.tracks.get(s.key)), current: live.values[s.key]?.[1], atCursor };
  });
});

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '–' : formatValue(v));
</script>

<template>
  <section class="chart">
    <div ref="el" class="plot" />
    <table class="chart-stats">
      <thead>
        <tr>
          <th>{{ unit || 'No unit' }}</th>
          <th>Now</th>
          <th>Min</th>
          <th>Max</th>
          <th>Avg</th>
          <th v-if="cursorIdx !== null">At cursor</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.key">
          <td><span class="swatch" :style="{ background: r.color }" />{{ r.label }}</td>
          <td class="num strong">{{ fmt(r.current) }}</td>
          <td class="num">{{ fmt(r.min) }}</td>
          <td class="num">{{ fmt(r.max) }}</td>
          <td class="num">{{ fmt(r.avg) }}</td>
          <td v-if="cursorIdx !== null" class="num">{{ fmt(r.atCursor) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.chart {
  margin-bottom: 16px;
  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.plot { width: 100%; min-height: 220px; }
.chart-stats {
  width: 100%;
  margin-top: 6px;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.chart-stats th {
  text-align: right;
  font-size: 12px;
  color: var(--text-2);
}
.chart-stats th:first-child, .chart-stats td:first-child { text-align: left; }
.chart-stats td {
  padding: 3px 0;
  text-align: right;
  border-top: 1px solid var(--surface-2);
}
.strong { font-weight: 700; }
.swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 2px;
  vertical-align: -1px;
}
</style>
