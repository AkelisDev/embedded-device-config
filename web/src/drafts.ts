import { computed, reactive, ref, watch, type Ref } from 'vue';
import { ApiError } from './api';
import { loadConfig } from './config';
import type { FieldError } from './types';

// Unsaved edits live here, not in the forms, so they survive switching pages,
// a browser reload and a lost connection to the device.
interface Draft {
  // What the device had when editing started; used to spot changes made meanwhile
  base: unknown;
  value: unknown;
}

const STORAGE_KEY = 'gateway-drafts';

function restore(): Record<string, Draft> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export const drafts = reactive<Record<string, Draft>>(restore());

watch(
  drafts,
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      // Private mode or full storage: drafts still work until the tab closes
    }
  },
  { deep: true },
);

export const draftKeys = {
  channel: (cid: string) => `channel:${cid}`,
  station: (cid: string, sid: string) => `station:${cid}/${sid}`,
};

export const hasDraft = (...keys: string[]) => keys.some((k) => k in drafts);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// structuredClone refuses Vue proxies
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export function useDraft<T extends object>(key: () => string, source: () => T | undefined) {
  const form = ref() as Ref<T | undefined>;
  const saving = ref(false);
  const error = ref('');
  const serverErrors = ref<FieldError[]>([]);

  function reset() {
    const draft = drafts[key()];
    form.value = clone(draft ? (draft.value as T) : source());
    if (draft) mergeDeviceChanges();
  }

  // Fields that both this browser and someone else changed, to different values
  const conflicts = computed(() => {
    const draft = drafts[key()];
    const current = source() as Record<string, unknown> | undefined;
    if (!draft || !current) return [];
    const base = draft.base as Record<string, unknown>;
    const mine = draft.value as Record<string, unknown>;
    return Object.keys(current).filter(
      (k) => !same(mine[k], base[k]) && !same(current[k], base[k]) && !same(mine[k], current[k]),
    );
  });

  // Changes made on the device to fields the user didn't touch are taken over
  // quietly; only a real clash waits for the user.
  function mergeDeviceChanges(force = false) {
    const draft = drafts[key()];
    const current = source() as Record<string, unknown> | undefined;
    const value = form.value as Record<string, unknown> | undefined;
    if (!draft || !current || !value || (conflicts.value.length && !force)) return;

    const base = draft.base as Record<string, unknown>;
    for (const k of Object.keys(current)) if (same(value[k], base[k])) value[k] = clone(current[k]);
    draft.base = clone(current);
    // Set here too: on first load this runs before the form watcher exists
    draft.value = clone(value);
    if (same(value, current)) delete drafts[key()];
  }

  watch(key, reset, { immediate: true });
  watch(source, () => (drafts[key()] ? mergeDeviceChanges() : reset()), { deep: true });

  watch(
    form,
    (value) => {
      const current = source();
      if (!value || !current) return;
      const k = key();
      if (same(value, current)) delete drafts[k];
      else if (drafts[k]) drafts[k].value = clone(value);
      else drafts[k] = { base: clone(current), value: clone(value) };
    },
    { deep: true },
  );

  const dirty = computed(() => !!drafts[key()]);
  const conflict = computed(() => conflicts.value.length > 0);

  function discard() {
    delete drafts[key()];
    reset();
    error.value = '';
    serverErrors.value = [];
  }

  // The user has seen the clash and still wants their values
  const keepMine = () => mergeDeviceChanges(true);

  async function save(write: (value: T) => Promise<unknown>) {
    if (!form.value || conflict.value) return;
    saving.value = true;
    error.value = '';
    serverErrors.value = [];
    try {
      try {
        await write(form.value);
      } catch (e) {
        // Something else was saved first. If it didn't touch this item, retry.
        if (!(e instanceof ApiError && e.status === 409)) throw e;
        await loadConfig();
        mergeDeviceChanges();
        if (conflict.value) return;
        await write(form.value);
      }
      delete drafts[key()];
      reset();
    } catch (e) {
      error.value = (e as Error).message;
      serverErrors.value = e instanceof ApiError ? e.errors : [];
    } finally {
      saving.value = false;
    }
  }

  return { form, dirty, conflict, conflicts, saving, error, serverErrors, discard, keepMine, save };
}
