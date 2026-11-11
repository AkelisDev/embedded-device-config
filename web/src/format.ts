import { ref } from 'vue';

// One shared clock for "5 s ago" and stale checks instead of a timer per card
export const now = ref(Date.now());
setInterval(() => (now.value = Date.now()), 1000);

const UNIT_LABELS: Record<string, string> = { volts: 'V', amps: 'A', none: '' };

export const displayUnit = (units: string) => UNIT_LABELS[units.trim().toLowerCase()] ?? units;

export function formatValue(v: number) {
  const abs = Math.abs(v);
  const digits = abs < 10 ? 3 : abs < 1000 ? 2 : 1;
  return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function ago(t: number | null | undefined, current: number) {
  if (!t) return 'never';
  const s = Math.max(0, Math.round((current - t) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return new Date(t).toLocaleTimeString();
}

// Older than three cycles means at least two reads in a row were missed
export const isStale = (t: number, acqCycle: number, current: number) => current - t > 3 * acqCycle;
