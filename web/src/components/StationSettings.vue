<script setup lang="ts">
import { computed, ref } from 'vue';
import { checkStation } from '@shared/validate.js';
import { saveStation, deleteStation } from '../config';
import { useDraft, draftKeys, drafts } from '../drafts';
import { pick, errorFor } from '../forms';
import { live } from '../live';
import { links, go } from '../router';
import FormField from './FormField.vue';
import SaveBar from './SaveBar.vue';
import type { Channel, Station } from '../types';

const props = defineProps<{ channel: Channel; station: Station }>();

const draft = useDraft(
  () => draftKeys.station(props.channel.id, props.station.id),
  () => pick(props.station, ['name', 'address'] as const),
);
const { form } = draft;

const errors = computed(() => {
  if (!form.value) return [];
  const list = checkStation({ ...form.value, datapoints: [] });
  const clash = props.channel.stations.find((s) => s.id !== props.station.id && s.address === form.value!.address);
  if (clash) list.push({ field: 'address', message: `Address already used by ${clash.name}` });
  return list.length ? list : draft.serverErrors.value;
});
const err = (field: string) => errorFor(errors.value, field);

const LABELS: Record<string, string> = { name: 'Name', address: 'Modbus address' };
const conflictText = computed(() =>
  draft.conflicts.value.map((k) => `${LABELS[k]} (device has ${props.station[k as keyof Station]})`),
);

const save = () => draft.save((value) => saveStation(props.channel.id, props.station.id, value));

const deleteError = ref('');

async function remove() {
  const { channel, station } = props;
  if (!confirm(`Delete "${station.name}" and its ${station.datapoints.length} registers? This can't be undone.`)) return;
  try {
    await deleteStation(channel.id, station.id);
    delete drafts[draftKeys.station(channel.id, station.id)];
    go(links.channel(channel.id));
  } catch (e) {
    deleteError.value = (e as Error).message;
  }
}
</script>

<template>
  <form v-if="form" class="settings" @submit.prevent="save">
    <fieldset>
      <legend>Station</legend>
      <div class="grid">
        <FormField label="Name" :error="err('name')">
          <input v-model.trim="form.name" />
        </FormField>
        <FormField label="Modbus address" :error="err('address')" hint="1-247. Must match the address set on the meter.">
          <input v-model.number="form.address" type="number" min="1" max="247" />
        </FormField>
      </div>
    </fieldset>

    <SaveBar
      :dirty="draft.dirty.value"
      :conflict="draft.conflict.value"
      :saving="draft.saving.value"
      :invalid="errors.length > 0"
      :error="draft.error.value"
      :conflicts="conflictText"
      @save="save"
      @discard="draft.discard"
      @keep-mine="draft.keepMine"
    />
  </form>

  <section class="danger">
    <h2>Delete station</h2>
    <p>Removes the station and its register map from {{ channel.name }}.</p>
    <button class="danger" type="button" :disabled="!live.connected" @click="remove">Delete station</button>
    <p v-if="deleteError" class="form-error">{{ deleteError }}</p>
  </section>
</template>
