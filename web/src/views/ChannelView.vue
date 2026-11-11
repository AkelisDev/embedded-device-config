<script setup lang="ts">
import { ref } from 'vue';
import { deleteChannel } from '../config';
import { drafts, draftKeys } from '../drafts';
import { live, stationState, channelState } from '../live';
import { links, go } from '../router';
import StateBadge from '../components/StateBadge.vue';
import ChannelSettings from '../components/ChannelSettings.vue';
import NewStationForm from '../components/NewStationForm.vue';
import type { Channel } from '../types';

const props = defineProps<{ channel: Channel }>();

const adding = ref(false);
const error = ref('');

async function remove() {
  const ch = props.channel;
  const what = ch.stations.length ? ` and its ${ch.stations.length} station(s)` : '';
  if (!confirm(`Delete "${ch.name}"${what}? This can't be undone.`)) return;
  try {
    await deleteChannel(ch.id);
    delete drafts[draftKeys.channel(ch.id)];
    for (const st of ch.stations) delete drafts[draftKeys.station(ch.id, st.id)];
    go(links.overview());
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>

<template>
  <div>
    <h1>
      {{ channel.name }}
      <span class="type">{{ channel.type === 'tcp' ? 'Modbus TCP' : 'Modbus RTU' }}</span>
      <StateBadge :state="channelState(channel.id)" />
    </h1>

    <ChannelSettings :key="channel.id" :channel="channel" />

    <section>
      <h2>Stations</h2>
      <table v-if="channel.stations.length" class="list">
        <thead>
          <tr><th>Name</th><th>Address</th><th>Registers</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr v-for="st in channel.stations" :key="st.id" @click="go(links.station(channel.id, st.id))">
            <td><a :href="links.station(channel.id, st.id)">{{ st.name }}</a></td>
            <td class="num">{{ st.address }}</td>
            <td class="num">{{ st.datapoints.length }}</td>
            <td><StateBadge :state="stationState(channel.id, st.id)" /></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No stations yet.</p>

      <NewStationForm v-if="adding" :channel="channel" @close="adding = false" />
      <button v-else :disabled="!live.connected" @click="adding = true">+ Add station</button>
    </section>

    <section class="danger">
      <h2>Delete channel</h2>
      <p>Removes the channel and all its stations and register maps.</p>
      <button class="danger" :disabled="!live.connected" @click="remove">Delete channel</button>
      <p v-if="error" class="form-error">{{ error }}</p>
    </section>
  </div>
</template>
