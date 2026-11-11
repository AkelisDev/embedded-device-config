<script setup lang="ts">
import { computed, ref } from 'vue';
import { parseConfig } from '@shared/convert.js';
import { checkConfig } from '@shared/validate.js';
import { request, ApiError } from '../api';
import { config, loadConfig } from '../config';
import { discardAllDrafts, draftCount } from '../drafts';
import { live } from '../live';
import type { Channel, FieldError } from '../types';

const MAX_ERRORS_SHOWN = 20;

const dialog = ref<HTMLDialogElement>();
const picker = ref<HTMLInputElement>();
const fileName = ref('');
const file = ref<unknown>();
const channels = ref<Channel[]>([]);
const errors = ref<FieldError[]>([]);
const readError = ref('');
const importing = ref(false);

function summary(list: Channel[]) {
  const stations = list.flatMap((ch) => ch.stations);
  const registers = stations.reduce((n, st) => n + st.datapoints.length, 0);
  const tcp = list.filter((ch) => ch.type === 'tcp').length;
  return `${tcp} TCP and ${list.length - tcp} RTU channels, ${stations.length} stations, ${registers} registers`;
}

// "datapoints.3.startAddr" -> "register 4", so the engineer can find it in the file
function describe(e: FieldError) {
  const register = /datapoints\.(\d+)\./.exec(e.field);
  return [e.where, register && `register ${Number(register[1]) + 1}`, e.message].filter(Boolean).join(': ');
}

async function open(event: Event) {
  const input = event.target as HTMLInputElement;
  const chosen = input.files?.[0];
  input.value = '';
  if (!chosen) return;

  fileName.value = chosen.name;
  file.value = undefined;
  channels.value = [];
  errors.value = [];
  readError.value = '';
  try {
    file.value = JSON.parse(await chosen.text());
    channels.value = parseConfig(file.value);
    errors.value = checkConfig(channels.value);
  } catch (e) {
    readError.value = e instanceof SyntaxError ? 'Not a valid JSON file' : (e as Error).message;
  }
  dialog.value?.showModal();
}

const canImport = computed(() => !readError.value && !errors.value.length && live.connected && !importing.value);
const drafts = computed(draftCount);

async function confirm() {
  importing.value = true;
  readError.value = '';
  try {
    await request('POST', '/import', file.value);
    discardAllDrafts();
    await loadConfig();
    dialog.value?.close();
  } catch (e) {
    readError.value = e instanceof ApiError && e.errors.length ? describe(e.errors[0]) : (e as Error).message;
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <button type="button" class="button" :disabled="!live.connected" @click="picker?.click()">Import config</button>
  <input ref="picker" type="file" accept=".json,application/json" hidden @change="open" />

  <dialog ref="dialog" class="import">
    <h2>Import {{ fileName }}</h2>
    <template v-if="channels.length || !readError">
      <p>File: {{ summary(channels) }}.</p>
      <p class="muted">Replaces the current config ({{ summary(config.channels) }}). Download a backup first if you may need it.</p>
      <p v-if="drafts" class="warn">{{ drafts }} unsaved {{ drafts === 1 ? 'draft' : 'drafts' }} in this browser will be discarded.</p>
    </template>

    <div v-if="errors.length" class="problems">
      <p class="form-error">{{ errors.length }} {{ errors.length === 1 ? 'problem' : 'problems' }}, fix them in the file first:</p>
      <ul>
        <li v-for="(e, i) in errors.slice(0, MAX_ERRORS_SHOWN)" :key="i">{{ describe(e) }}</li>
      </ul>
      <p v-if="errors.length > MAX_ERRORS_SHOWN" class="muted">and {{ errors.length - MAX_ERRORS_SHOWN }} more</p>
    </div>
    <p v-if="readError" class="form-error">{{ readError }}</p>

    <div class="actions">
      <button type="button" @click="dialog?.close()">Cancel</button>
      <button type="button" class="primary" :disabled="!canImport" @click="confirm">
        {{ importing ? 'Importing...' : 'Replace config' }}
      </button>
    </div>
  </dialog>
</template>

<style scoped>
.import {
  width: min(560px, calc(100vw - 32px));
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
}
.import::backdrop { background: rgba(0, 0, 0, 0.35); }
h2 {
  margin: 0 0 10px;
  font-size: 16px;
  overflow-wrap: anywhere;
}
p { margin: 6px 0; }
.warn { color: var(--warn-text); }
.problems ul {
  max-height: 240px;
  margin: 4px 0;
  padding-left: 18px;
  overflow-y: auto;
  font-size: 13px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
</style>
