<script setup lang="ts">
import { computed } from 'vue';
import { config, findChannel, findStation } from './config';
import { live } from './live';
import { route, links } from './router';
import AppHeader from './components/AppHeader.vue';
import ChannelTree from './components/ChannelTree.vue';
import OverviewView from './views/OverviewView.vue';
import ChannelView from './views/ChannelView.vue';
import StationView from './views/StationView.vue';

const channel = computed(() => (route.value.name === 'overview' ? undefined : findChannel(route.value.cid)));
const station = computed(() => (route.value.name === 'station' ? findStation(route.value.cid, route.value.sid) : undefined));
</script>

<template>
  <AppHeader />
  <div v-if="config.loaded && !live.connected" class="banner">
    Connection to the device lost, reconnecting. Unsaved changes are kept in this browser.
  </div>

  <div class="layout">
    <aside class="sidebar"><ChannelTree /></aside>

    <main class="content">
      <p v-if="!config.loaded && config.loadError" class="empty">Can't load the configuration: {{ config.loadError }}</p>
      <p v-else-if="!config.loaded" class="empty">Loading...</p>
      <OverviewView v-else-if="route.name === 'overview'" />
      <ChannelView v-else-if="route.name === 'channel' && channel" :channel="channel" />
      <StationView v-else-if="route.name === 'station' && channel && station" :channel="channel" :station="station" :tab="route.tab" />
      <p v-else class="empty">
        This item doesn't exist any more, it may have been deleted from another browser.
        <a :href="links.overview()">Back to overview</a>
      </p>
    </main>
  </div>
</template>
