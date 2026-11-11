<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { checkStation } from '@shared/validate.js';
import { ApiError } from '../api';
import { config, createStations, type NewStation } from '../config';
import { links, go } from '../router';
import { errorFor, nextFreeAddress } from '../forms';
import { live } from '../live';
import FormField from './FormField.vue';
import type { Channel, FieldError } from '../types';

const props = defineProps<{ channel: Channel }>();
const emit = defineEmits<{ close: [] }>();

const MAX_ADDRESS = 247;
const usedAddresses = computed(() => props.channel.stations.map((s) => s.address));

const form = reactive({
  count: 1,
  name: '',
  address: nextFreeAddress(usedAddresses.value),
  // "channelId/stationId" of the station whose register map to copy
  copyFrom: '',
});

// Follow the count with the first free block until the user picks an address
const addressTouched = ref(false);
watch(
  () => form.count,
  (count) => {
    if (!addressTouched.value && Number.isInteger(count) && count > 0) form.address = nextFreeAddress(usedAddresses.value, count);
  },
);

// Most sites have several identical meters, so copying a map is the usual case
const templates = computed(() =>
  config.channels.flatMap((ch) =>
    ch.stations
      .filter((st) => st.datapoints.length)
      .map((st) => ({ value: `${ch.id}/${st.id}`, label: `${st.name} (${ch.name}, ${st.datapoints.length} registers)` })),
  ),
);

const several = computed(() => form.count > 1);
const nameFor = (n: number, address: number) => form.name.replaceAll('{n}', String(n)).replaceAll('{addr}', String(address));

const stations = computed<NewStation[]>(() => {
  const [channelId, stationId] = form.copyFrom.split('/');
  const copyFrom = form.copyFrom ? { channelId, stationId } : undefined;
  const count = Number.isInteger(form.count) ? Math.min(Math.max(form.count, 0), MAX_ADDRESS) : 0;
  return Array.from({ length: count }, (_, i) => ({
    name: nameFor(i + 1, form.address + i),
    address: form.address + i,
    copyFrom,
  }));
});

const errors = computed(() => {
  const list: FieldError[] = [];
  const fail = (field: string, message: string) => list.push({ field, message });

  if (!Number.isInteger(form.count) || form.count < 1 || form.count > MAX_ADDRESS) fail('count', `Count must be 1-${MAX_ADDRESS}`);
  if (!form.name.trim()) fail('name', 'Name is required');
  else if (several.value && !/\{n\}|\{addr\}/.test(form.name)) fail('name', 'Use {n} or {addr} so the names differ');

  const address = checkStation({ name: 'x', address: form.address, datapoints: [] })[0];
  if (address) fail('address', address.message);
  else if (list.every((e) => e.field !== 'count')) {
    const last = form.address + form.count - 1;
    const clashes = stations.value.map((s) => s.address).filter((a) => usedAddresses.value.includes(a));
    if (last > MAX_ADDRESS) fail('address', `The last address would be ${last}, the limit is ${MAX_ADDRESS}`);
    else if (clashes.length) fail('address', `Already used on this channel: ${clashes.join(', ')}`);
  }
  return list;
});

const preview = computed(() => {
  const list = stations.value;
  if (!several.value || errors.value.length) return '';
  const item = (s: NewStation) => `${s.name} (address ${s.address})`;
  return list.length > 2 ? `${item(list[0])}, ..., ${item(list.at(-1)!)}` : list.map(item).join(', ');
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
    const created = await createStations(props.channel.id, stations.value);
    emit('close');
    if (created.length === 1) go(links.station(props.channel.id, created[0].id));
  } catch (e) {
    error.value = e instanceof ApiError && e.errors.length ? e.errors[0].message : (e as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="new-station" @submit.prevent="submit">
    <div class="grid">
      <FormField label="Count" :error="errorFor(errors, 'count')">
        <input v-model.number="form.count" type="number" min="1" :max="MAX_ADDRESS" />
      </FormField>
      <FormField
        label="Name"
        :error="touched ? errorFor(errors, 'name') : undefined"
        :hint="several ? '{n} becomes 1, 2, 3..., {addr} the Modbus address' : undefined"
      >
        <input v-model.trim="form.name" :placeholder="several ? 'Meter {n}' : 'Electricity Meter Ser. EM1300'" autofocus />
      </FormField>
      <FormField
        :label="several ? 'First Modbus address' : 'Modbus address'"
        :error="errorFor(errors, 'address')"
        :hint="several ? 'Following stations take the next addresses' : '1-247, unique on this channel'"
      >
        <input v-model.number="form.address" type="number" min="1" :max="MAX_ADDRESS" @input="addressTouched = true" />
      </FormField>
      <FormField label="Register map">
        <select v-model="form.copyFrom">
          <option value="">Empty, add registers later</option>
          <option v-for="t in templates" :key="t.value" :value="t.value">Copy from {{ t.label }}</option>
        </select>
      </FormField>
    </div>
    <p v-if="preview" class="note">Creates {{ form.count }} stations: {{ preview }}</p>
    <p v-if="error" class="form-error">{{ error }}</p>
    <div class="actions">
      <button type="button" @click="emit('close')">Cancel</button>
      <button class="primary" :disabled="saving || !live.connected">
        {{ saving ? 'Adding...' : several ? `Add ${form.count} stations` : 'Add station' }}
      </button>
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
