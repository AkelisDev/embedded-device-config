<script setup lang="ts">
import { computed } from 'vue';
import { checkChannel } from '@shared/validate.js';
import { BAUDRATES, SERIAL_PORTS } from '@shared/modbus.js';
import { saveChannel } from '../config';
import { useDraft, draftKeys } from '../drafts';
import { pick, errorFor } from '../forms';
import FormField from './FormField.vue';
import SaveBar from './SaveBar.vue';
import type { Channel } from '../types';

const props = defineProps<{ channel: Channel }>();

const COMMON = ['name', 'enabled', 'requestTimeout', 'requestRetries', 'connectTimeout', 'connectRetries'] as const;
const TCP = [...COMMON, 'host', 'port'] as const;
const RTU = [...COMMON, 'serialPort', 'baudrate', 'parity', 'stopbits', 'bytesize'] as const;

const LABELS: Record<string, string> = {
  name: 'Name', enabled: 'Enabled', host: 'IP address', port: 'Port', serialPort: 'Serial port',
  baudrate: 'Baud rate', parity: 'Parity', stopbits: 'Stop bits', bytesize: 'Data bits',
  requestTimeout: 'Request timeout', requestRetries: 'Request retries',
  connectTimeout: 'Connect timeout', connectRetries: 'Connect retries',
};

const PARITY_LABELS: Record<string, string> = { N: 'None', E: 'Even', O: 'Odd' };

const draft = useDraft(
  () => draftKeys.channel(props.channel.id),
  () => pick(props.channel, props.channel.type === 'tcp' ? TCP : RTU) as Partial<Channel>,
);
const { form } = draft;

const errors = computed(() => {
  if (!form.value) return [];
  // Station address clashes are shown on the station, not here
  const local = checkChannel({ ...props.channel, ...form.value }).filter((e) => !e.field.startsWith('stations.'));
  return local.length ? local : draft.serverErrors.value;
});
const err = (field: string) => errorFor(errors.value, field);

// RS-485 is one request at a time, so a silent meter stalls everyone else
const worstCaseStall = computed(() => {
  const f = form.value;
  if (!f?.requestTimeout || f.requestRetries === undefined) return '';
  return `${((f.requestTimeout * (f.requestRetries + 1)) / 1000).toFixed(1)} s`;
});

const conflictText = computed(() =>
  draft.conflicts.value.map((k) => `${LABELS[k]} (device has ${props.channel[k as keyof Channel]})`),
);

const save = () => draft.save((value) => saveChannel(props.channel.id, value));
</script>

<template>
  <form v-if="form" class="settings" @submit.prevent="save">
    <fieldset>
      <legend>General</legend>
      <div class="grid">
        <FormField label="Name" :error="err('name')">
          <input v-model.trim="form.name" />
        </FormField>
        <FormField label="Polling" hint="When disabled, the gateway doesn't talk to any station on this channel">
          <label class="check"><input v-model="form.enabled" type="checkbox" /> Enabled</label>
        </FormField>
      </div>
    </fieldset>

    <fieldset v-if="channel.type === 'tcp'">
      <legend>Connection</legend>
      <div class="grid">
        <FormField label="IP address" :error="err('host')">
          <input v-model.trim="form.host" placeholder="192.168.1.10" />
        </FormField>
        <FormField label="Port" :error="err('port')" hint="502 is the Modbus default">
          <input v-model.number="form.port" type="number" min="1" max="65535" />
        </FormField>
      </div>
    </fieldset>

    <fieldset v-else>
      <legend>Serial line</legend>
      <div class="grid">
        <FormField label="Serial port" :error="err('serialPort')">
          <input v-model.trim="form.serialPort" list="serial-ports" />
          <datalist id="serial-ports">
            <option v-for="p in SERIAL_PORTS" :key="p" :value="p" />
          </datalist>
        </FormField>
        <FormField label="Baud rate" :error="err('baudrate')">
          <select v-model.number="form.baudrate">
            <option v-for="b in BAUDRATES" :key="b" :value="b">{{ b }}</option>
          </select>
        </FormField>
        <FormField label="Parity" :error="err('parity')">
          <select v-model="form.parity">
            <option v-for="(label, p) in PARITY_LABELS" :key="p" :value="p">{{ label }}</option>
          </select>
        </FormField>
        <FormField label="Data bits" :error="err('bytesize')">
          <select v-model.number="form.bytesize">
            <option :value="8">8</option>
            <option :value="7">7</option>
          </select>
        </FormField>
        <FormField label="Stop bits" :error="err('stopbits')">
          <select v-model.number="form.stopbits">
            <option :value="1">1</option>
            <option :value="2">2</option>
          </select>
        </FormField>
      </div>
      <p class="note">Every station on this line must use the same settings.</p>
    </fieldset>

    <fieldset>
      <legend>Timing</legend>
      <div class="grid">
        <FormField label="Request timeout, ms" :error="err('requestTimeout')">
          <input v-model.number="form.requestTimeout" type="number" min="100" step="100" />
        </FormField>
        <FormField label="Request retries" :error="err('requestRetries')">
          <input v-model.number="form.requestRetries" type="number" min="0" max="10" />
        </FormField>
        <FormField label="Connect timeout, ms" :error="err('connectTimeout')">
          <input v-model.number="form.connectTimeout" type="number" min="100" step="100" />
        </FormField>
        <FormField label="Connect retries" :error="err('connectRetries')">
          <input v-model.number="form.connectRetries" type="number" min="0" max="10" />
        </FormField>
      </div>
      <p v-if="channel.type === 'rtu' && worstCaseStall" class="note">
        A station that doesn't answer holds the line for up to {{ worstCaseStall }} on every poll, delaying the other
        stations.
      </p>
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
</template>
