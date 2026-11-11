import { checkDatapoints } from '@shared/validate.js';
import { nextId, regCount } from '@shared/modbus.js';
import type { Datapoint } from './types';

// Leading digit of the classic Modbus notation for each function code
const NOTATION_PREFIX: Record<number, number> = { 1: 0, 2: 1, 3: 4, 4: 3 };

// 0-based 0 on FC 4 is 30001. Above 9998 the 6-digit form (300001) is used.
export function modbusAddress(dp: Pick<Datapoint, 'funcCode' | 'startAddr'>) {
  const prefix = NOTATION_PREFIX[dp.funcCode];
  if (prefix === undefined || !Number.isInteger(dp.startAddr)) return '';
  return dp.startAddr <= 9998
    ? String(prefix * 10000 + dp.startAddr + 1).padStart(5, '0')
    : String(prefix * 100000 + dp.startAddr + 1).padStart(6, '0');
}

// Only register ranges: coil numbers (0xxxx) can't be told apart from plain addresses
export function fromModbusAddress(n: number): { funcCode: number; startAddr: number } | null {
  if (n >= 30001 && n <= 39999) return { funcCode: 4, startAddr: n - 30001 };
  if (n >= 40001 && n <= 49999) return { funcCode: 3, startAddr: n - 40001 };
  if (n >= 300001 && n <= 365536) return { funcCode: 4, startAddr: n - 300001 };
  if (n >= 400001 && n <= 465536) return { funcCode: 3, startAddr: n - 400001 };
  return null;
}

export const DEFAULT_REGISTER: Omit<Datapoint, 'id'> = {
  description: '',
  startAddr: 0,
  dataType: 'float32',
  regSize: 2,
  byteOrder: 'ABCD',
  funcCode: 3,
  acqCycle: 1000,
  scale: 1,
  units: '',
};

const TEMPLATE_FIELDS = ['funcCode', 'dataType', 'byteOrder', 'acqCycle', 'scale'] as const;

function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  let best: T | undefined;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (best === undefined || n > counts.get(best)!) best = v;
  }
  return best;
}

// New rows take the most common value of each field. The last register is a
// poor guide: in a meter map it is often an hourly energy counter.
export function template(list: Datapoint[]): Omit<Datapoint, 'id'> {
  const out: Omit<Datapoint, 'id'> = { ...DEFAULT_REGISTER };
  for (const field of TEMPLATE_FIELDS) {
    const value = mostCommon(list.map((dp) => dp[field]));
    if (value !== undefined) (out as Record<string, unknown>)[field] = value;
  }
  out.regSize = regCount(out);
  return out;
}

export function nextAddress(list: Datapoint[], funcCode: number) {
  let next = 0;
  for (const dp of list) if (dp.funcCode === funcCode) next = Math.max(next, dp.startAddr + regCount(dp));
  return next;
}

export function withIds(existing: Datapoint[], added: Omit<Datapoint, 'id'>[]): Datapoint[] {
  let id = Number(nextId(existing));
  return added.map((dp) => ({ ...dp, id: String(id++), regSize: regCount(dp) }));
}

export const sortByAddress = (list: Datapoint[]) =>
  [...list].sort((a, b) => a.startAddr - b.startAddr || a.funcCode - b.funcCode);

// Shared validation reports "datapoints.<index>.<field>"; the table needs it per row
export function errorsById(list: Datapoint[]) {
  const out: Record<string, Record<string, string>> = {};
  for (const e of checkDatapoints(list)) {
    const [, index, field] = e.field.split('.');
    const id = list[Number(index)]?.id;
    if (!id) continue;
    out[id] ??= {};
    out[id][field] ??= e.message;
  }
  return out;
}

export function fillPattern(pattern: string, n: number, dp: Pick<Datapoint, 'funcCode' | 'startAddr'>) {
  return pattern
    .replaceAll('{n}', String(n))
    .replaceAll('{addr}', String(dp.startAddr))
    .replaceAll('{modbus}', modbusAddress(dp));
}
