<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { checkStation } from '@shared/validate.js';
import { config, createStation } from '../config';
import { links, go } from '../router';
import { errorFor, nextFreeAddress } from '../forms';
import { live } from '../live';
import FormField from './FormField.vue';
import type { Channel } from '../types';

const props = defineProps<{ channel: Channel }>();
const emit = defineEmits<{ close: [] }>();

const usedAddresses = computed(() => props.channel.stations.map((s) => s.address));

const form = reactive({
  name: '',
  address: nextFreeAddress(usedAddresses.value),
  // "channelId/stationId" of the station whose register map to copy
  copyFrom: '',
});

// Most sites have several identical meters, so copying a map is the usual case
const templates = computed(() =>
  config.channels.flatMap((ch) =>
    ch.stations
      .filter((st) => st.datapoints.length)
      .map((st) => ({ value: `${ch.id}/${st.id}`, label: `${st.name} (${ch.name}, ${st.datapoints.length} registers)` })),
  ),
);

const errors = computed(() => {
  const list = checkStation({ name: form.name, address: form.address, datapoints: [] });
  if (usedAddresses.value.includes(form.address)) list.push({ field: 'address', message: 'Address already used on this channel' });
  return list;
});

const saving = ref(false);
const error = ref('');
const touched = ref(false);

async function submit() {
  touched.value = true;
  if (errors.value.length) return;
  saving.value = true;
  error.value = '';
  try {
    const [channelId, stationId] = form.copyFrom.split('/');
    const st = await createStation(props.channel.id, {
      name: form.name,
      address: form.address,
      copyFrom: form.copyFrom ? { channelId, stationId } : undefined,
    });
    emit('close');
    go(links.station(props.channel.id, st.id));
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="new-station" @submit.prevent="submit">
    <div class="grid">
      <FormField label="Name" :error="touched ? errorFor(errors, 'name') : undefined">
        <input v-model.trim="form.name" placeholder="Electricity Meter Ser. EM1300" autofocus />
      </FormField>
      <FormField label="Modbus address" :error="errorFor(errors, 'address')" hint="1-247, unique on this channel">
        <input v-model.number="form.address" type="number" min="1" max="247" />
      </FormField>
      <FormField label="Register map">
        <select v-model="form.copyFrom">
          <option value="">Empty, add registers later</option>
          <option v-for="t in templates" :key="t.value" :value="t.value">Copy from {{ t.label }}</option>
        </select>
      </FormField>
    </div>
    <p v-if="error" class="form-error">{{ error }}</p>
    <div class="actions">
      <button type="button" @click="emit('close')">Cancel</button>
      <button class="primary" :disabled="saving || !live.connected">{{ saving ? 'Adding...' : 'Add station' }}</button>
    </div>
  </form>
</template>

<style scoped>
.new-station {
  margin-top: 12px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
</style>
