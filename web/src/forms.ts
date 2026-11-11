import type { FieldError } from './types';

export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

export const errorFor = (errors: FieldError[], field: string) => errors.find((e) => e.field === field)?.message;

// Lowest address not used yet, so adding a station on a bus needs no lookup
export function nextFreeAddress(used: number[]) {
  for (let a = 1; a <= 247; a++) if (!used.includes(a)) return a;
  return 1;
}
