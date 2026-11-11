<script setup lang="ts">
import { computed } from 'vue';
import { config } from '../config';
import { live, channelState, stationState } from '../live';
import { links } from '../router';
import StateBadge from '../components/StateBadge.vue';
import StationCard from '../components/StationCard.vue';
import type { LinkState } from '../types';

const stationCount = computed(() => config.channels.reduce((n, ch) => n + ch.stations.length, 0));

// The counts answer "is everything talking?" before reading any card
const summary = computed(() => {
  const counts: Partial<Record<LinkState, number>> = {};
  for (const ch of config.channels) {
    for (const st of ch.stations) {
      const state = stationState(ch.id, st.id);
      counts[state] = (counts[state] ?? 0) + 1;
    }
  }
  const parts = [{ text: `${stationCount.value} stations`, cls: '' }];
  if (!live.connected) return parts;
  if (counts.ok) parts.push({ text: `${counts.ok} OK`, cls: 'ok' });
  if (counts.timeout) parts.push({ text: `${counts.timeout} not responding`, cls: 'bad' });
  if (counts.disabled) parts.push({ text: `${counts.disabled} disabled`, cls: '' });
  return parts;
});
</script>

<template>
  <div class="overview">
    <h1>Overview</h1>
    <p class="summary">
      <template v-for="(part, i) in summary" :key="part.text">
        <template v-if="i"> · </template><span :class="part.cls">{{ part.text }}</span>
      </template>
    </p>

    <section v-for="ch in config.channels" :key="ch.id" class="channel">
      <h2>
        <a :href="links.channel(ch.id)">{{ ch.name }}</a>
        <span class="conn">{{ ch.type === 'tcp' ? `${ch.host}:${ch.port}` : `${ch.serialPort} · ${ch.baudrate} ${ch.bytesize}${ch.parity}${ch.stopbits}` }}</span>
        <StateBadge :state="channelState(ch.id)" />
      </h2>
      <div v-if="ch.stations.length" class="cards">
        <StationCard v-for="st in ch.stations" :key="st.id" :channel="ch" :station="st" />
      </div>
      <p v-else class="empty">No stations on this channel</p>
    </section>
  </div>
</template>

<style scoped>
.summary {
  margin: -8px 0 16px;
  color: var(--text-2);
}
.summary .ok { color: var(--ok); }
.summary .bad { color: var(--bad); font-weight: 600; }
.channel { margin-bottom: 24px; }
h2 {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
}
h2 a {
  color: var(--text);
  text-decoration: none;
}
.conn {
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
  font-family: var(--mono);
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
}
.empty { color: var(--muted); }
</style>
