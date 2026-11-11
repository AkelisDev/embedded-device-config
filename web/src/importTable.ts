import { DATA_TYPES } from '@shared/modbus.js';
import { fromModbusAddress } from './registers';
import type { Datapoint } from './types';

type Field = keyof Omit<Datapoint, 'id' | 'regSize'>;

// Register lists come from meter manuals and Excel sheets with all kinds of
// headers, so accept the common names.
const HEADERS: Record<string, Field> = {
  address: 'startAddr', addr: 'startAddr', start: 'startAddr', start_addr: 'startAddr', register: 'startAddr',
  description: 'description', descr: 'description', name: 'description', parameter: 'description',
  type: 'dataType', data_type: 'dataType', datatype: 'dataType', format: 'dataType',
  fc: 'funcCode', func_code: 'funcCode', function: 'funcCode', function_code: 'funcCode',
  byte_order: 'byteOrder', order: 'byteOrder', byteorder: 'byteOrder', endian: 'byteOrder',
  cycle: 'acqCycle', acq_cycle: 'acqCycle', interval: 'acqCycle',
  scale: 'scale', factor: 'scale', multiplier: 'scale',
  units: 'units', unit: 'units',
};

const DEFAULT_COLUMNS: Field[] = ['startAddr', 'description', 'dataType', 'funcCode', 'byteOrder', 'acqCycle', 'scale', 'units'];
const NUMERIC: Field[] = ['startAddr', 'funcCode', 'acqCycle', 'scale'];

const TYPE_ALIASES: Record<string, string> = {
  float: 'float32', real: 'float32', double: 'float64',
  int: 'int16', short: 'int16', uint: 'uint16', word: 'uint16',
  dint: 'int32', long: 'int32', udint: 'uint32', dword: 'uint32', ulong: 'uint32',
};

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/\(.*?\)/g, '').trim().replace(/[\s-]+/g, '_');

function splitLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') cell += c, i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) cells.push(cell), (cell = '');
    else cell += c;
  }
  cells.push(cell);
  return cells.map((s) => s.trim());
}

// Excel copies as tab-separated; CSV exports use ; in many locales
function detectDelimiter(firstLine: string) {
  if (firstLine.includes('\t')) return '\t';
  return (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
}

function toNumber(raw: string) {
  // "0,001" from a European Excel
  const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function toDataType(raw: string) {
  const t = raw.toLowerCase().replace(/[\s_-]/g, '');
  return t in DATA_TYPES ? t : (TYPE_ALIASES[t] ?? raw);
}

export interface ParsedTable {
  columns: (Field | null)[];
  rows: string[][];
  hasHeader: boolean;
}

export function parseTable(text: string): ParsedTable {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { columns: [], rows: [], hasHeader: false };

  const delimiter = detectDelimiter(lines[0]);
  const rows = lines.map((l) => splitLine(l, delimiter));
  const headerFields = rows[0].map((h) => HEADERS[normalizeHeader(h)] ?? null);
  const hasHeader = headerFields.some(Boolean) && Number.isNaN(toNumber(rows[0][0]));

  return {
    columns: hasHeader ? headerFields : DEFAULT_COLUMNS,
    rows: hasHeader ? rows.slice(1) : rows,
    hasHeader,
  };
}

export function looksLikeModbusNotation(table: ParsedTable) {
  const col = table.columns.indexOf('startAddr');
  if (col < 0 || !table.rows.length) return false;
  return table.rows.every((r) => fromModbusAddress(toNumber(r[col] ?? '')) !== null);
}

export interface ImportedRow {
  register: Omit<Datapoint, 'id'>;
  error?: string;
}

export function toRegisters(table: ParsedTable, base: Omit<Datapoint, 'id'>, modbusNotation: boolean): ImportedRow[] {
  return table.rows.map((cells) => {
    const register: Record<string, unknown> = { ...base, description: '', units: '' };
    table.columns.forEach((field, i) => {
      const raw = cells[i];
      if (!field || raw === undefined || raw === '') return;
      if (NUMERIC.includes(field)) register[field] = toNumber(raw);
      else if (field === 'dataType') register[field] = toDataType(raw);
      else if (field === 'byteOrder') register[field] = raw.toUpperCase();
      else register[field] = raw;
    });

    const row: ImportedRow = { register: register as Omit<Datapoint, 'id'> };
    if (modbusNotation) {
      const parsed = fromModbusAddress(register.startAddr as number);
      if (!parsed) row.error = `${cells[table.columns.indexOf('startAddr')]} is not a 3xxxx/4xxxx address`;
      else {
        row.register.startAddr = parsed.startAddr;
        // The notation already says which register type it is
        if (!table.columns.includes('funcCode')) row.register.funcCode = parsed.funcCode;
      }
    }
    return row;
  });
}
