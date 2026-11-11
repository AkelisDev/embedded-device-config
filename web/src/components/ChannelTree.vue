<script setup lang="ts">
import { computed, ref } from 'vue';
import { config, createChannel } from '../config';
import { live, channelState, stationState } from '../live';
import { draftKeys, hasDraft } from '../drafts';
import { route, links, go } from '../router';
import StateBadge from './StateBadge.vue';
import type { ChannelType } from '../types';

const GROUPS: { type: ChannelType; title: string; newName: string }[] = [
  { type: 'tcp', title: 'Modbus TCP', newName: 'Modbus TCP Client' },
  { type: 'rtu', title: 'Modbus RTU', newName: 'Modbus Serial Client' },
];

const groups = computed(() => GROUPS.map((g) => ({ ...g, channels: config.channels.filter((c) => c.type === g.type) })));
const error = ref('');

async function addChannel(type: ChannelType, newName: string, count: number) {
  error.value = '';
  try {
    const ch = await createChannel(type, `${newName} ${count + 1}`);
    go(links.channel(ch.id));
  } catch (e) {
    error.value = (e as Error).message;
  }
}

const isChannelActive = (cid: string) => route.value.name === 'channel' && route.value.cid === cid;
const isStationActive = (cid: string, sid: string) =>
  route.value.name === 'station' && route.value.cid === cid && route.value.sid === sid;
</script>

<template>
  <nav class="tree">
    <a class="item overview" :class="{ active: route.name === 'overview' }" :href="links.overview()">Overview</a>

    <section v-for="g in groups" :key="g.type">
      <div class="group">
        <span>{{ g.title }}</span>
        <button class="small" :disabled="!live.connected" title="Add channel" @click="addChannel(g.type, g.newName, g.channels.length)">
          + Add
        </button>
      </div>
      <p v-if="!g.channels.length" class="empty">No channels</p>

      <div v-for="ch in g.channels" :key="ch.id">
        <a class="item channel" :class="{ active: isChannelActive(ch.id), off: !ch.enabled }" :href="links.channel(ch.id)">
          <StateBadge :state="channelState(ch.id)" dot />
          <span class="name">{{ ch.name }}</span>
          <span v-if="hasDraft(draftKeys.channel(ch.id))" class="unsaved" title="Unsaved changes">●</span>
        </a>
        <a
          v-for="st in ch.stations"
          :key="st.id"
          class="item station"
          :class="{ active: isStationActive(ch.id, st.id), off: !ch.enabled }"
          :href="links.station(ch.id, st.id)"
        >
          <StateBadge :state="stationState(ch.id, st.id)" dot />
          <span class="name">{{ st.name }}</span>
          <span class="addr">{{ st.address }}</span>
          <span v-if="hasDraft(draftKeys.station(ch.id, st.id), draftKeys.registers(ch.id, st.id))" class="unsaved" title="Unsaved changes">●</span>
        </a>
      </div>
    </section>
    <p v-if="error" class="error">{{ error }}</p>
  </nav>
</template>

<style scoped>
.tree {
  padding: 8px 0;
  font-size: 13px;
}
.group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 12px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  color: var(--text);
  text-decoration: none;
  border-left: 3px solid transparent;
}
.item:hover { background: var(--surface-2); }
.item.active {
  background: var(--active-bg);
  border-left-color: var(--accent);
}
.overview { font-weight: 600; }
.channel { font-weight: 600; }
.station { padding-left: 28px; }
.off .name { color: var(--muted); }
.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.addr {
  font-size: 11px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.unsaved { color: var(--draft-border); font-size: 10px; }
.empty, .error {
  margin: 0;
  padding: 4px 12px;
  color: var(--muted);
}
.error { color: var(--bad); }
</style>
