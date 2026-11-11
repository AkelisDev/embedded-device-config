<script setup lang="ts">
import { links, type StationTab } from '../router';
import { stationState } from '../live';
import StateBadge from '../components/StateBadge.vue';
import StationSettings from '../components/StationSettings.vue';
import type { Channel, Station } from '../types';

defineProps<{ channel: Channel; station: Station; tab: StationTab }>();

const TABS: { id: StationTab; label: string }[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'registers', label: 'Registers' },
  { id: 'monitor', label: 'Monitor' },
];
</script>

<template>
  <div>
    <p class="crumbs"><a :href="links.channel(channel.id)">{{ channel.name }}</a></p>
    <h1>
      {{ station.name }}
      <span class="type">Address {{ station.address }}</span>
      <StateBadge :state="stationState(channel.id, station.id)" />
    </h1>

    <nav class="tabs">
      <a v-for="t in TABS" :key="t.id" :href="links.station(channel.id, station.id, t.id)" :class="{ active: tab === t.id }">
        {{ t.label }}
      </a>
    </nav>

    <StationSettings v-if="tab === 'settings'" :key="station.id" :channel="channel" :station="station" />
    <p v-else-if="tab === 'registers'" class="empty">{{ station.datapoints.length }} registers. The register editor is not built yet.</p>
    <p v-else class="empty">The monitor view is not built yet.</p>
  </div>
</template>

<style scoped>
.crumbs {
  margin: 0 0 4px;
  font-size: 12px;
}
.crumbs a { color: var(--text-2); }
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border);
}
.tabs a {
  padding: 8px 14px;
  color: var(--text-2);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tabs a.active {
  color: var(--text);
  font-weight: 600;
  border-bottom-color: var(--accent);
}
</style>
