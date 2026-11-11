export const DATA_TYPES = {
  int16: 1,
  uint16: 1,
  int32: 2,
  uint32: 2,
  float32: 2,
  float64: 4,
};

export const FUNC_CODES = {
  1: 'Coils',
  2: 'Discrete inputs',
  3: 'Holding registers',
  4: 'Input registers',
};

export const BYTE_ORDERS = ['ABCD', 'CDAB', 'BADC', 'DCBA'];
export const BAUDRATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];
export const PARITIES = ['N', 'E', 'O'];

export const regCount = (dp) => DATA_TYPES[dp.dataType] ?? dp.regSize ?? 1;

export function nextId(items) {
  let max = 0;
  for (const item of items) max = Math.max(max, Number(item.id) || 0);
  return String(max + 1);
}

// Identifies one register's value in the live stream and history
export const valueKey = (ch, st, dp) => `${ch.id}/${st.id}/${dp.id}`;
