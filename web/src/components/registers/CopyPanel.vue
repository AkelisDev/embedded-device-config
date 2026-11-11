<script setup lang="ts">
import { computed, ref } from 'vue';
import { config } from '../../config';
import type { Datapoint } from '../../types';

const props = defineProps<{ channelId: string; stationId: string }>();
const emit = defineEmits<{ apply: [registers: Datapoint[], mode: 'replace' | 'append']; close: [] }>();

const sources = computed(() =>
  config.channels.flatMap((ch) =>
    ch.stations
      .filter((st) => st.datapoints.length && !(ch.id === props.channelId && st.id === props.stationId))
      .map((st) => ({ key: `${ch.id}/${st.id}`, label: `${st.name} (${ch.name})`, datapoints: st.datapoints })),
  ),
);

const selected = ref(sources.value[0]?.key ?? '');
const mode = ref<'replace' | 'append'>('replace');
const source = computed(() => sources.value.find((s) => s.key === selected.value));
</script>

<template>
  <form class="panel" @submit.prevent="source && emit('apply', source.datapoints, mode)">
    <h3>Copy from another station</h3>
    <p v-if="!sources.length" class="empty">No other station has registers.</p>
    <template v-else>
      <div class="row">
        <select v-model="selected">
          <option v-for="s in sources" :key="s.key" :value="s.key">{{ s.label }}, {{ s.datapoints.length }} registers</option>
        </select>
        <label class="check"><input v-model="mode" type="radio" value="replace" /> Replace this map</label>
        <label class="check"><input v-model="mode" type="radio" value="append" /> Add to this map</label>
      </div>
    </template>
    <div class="actions">
      <button type="button" @click="emit('close')">Cancel</button>
      <button class="primary" :disabled="!source">Copy {{ source?.datapoints.length ?? 0 }} registers</button>
    </div>
  </form>
</template>
