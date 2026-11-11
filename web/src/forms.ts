import type { FieldError } from './types';

export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

export const errorFor = (errors: FieldError[], field: string) => errors.find((e) => e.field === field)?.message;

// Lowest start of `count` free addresses in a row, so adding stations to a bus needs no lookup
export function nextFreeAddress(used: number[], count = 1) {
  for (let a = 1; a + count - 1 <= 247; a++) {
    if (!Array.from({ length: count }, (_, i) => a + i).some((x) => used.includes(x))) return a;
  }
  return 1;
}
