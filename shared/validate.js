import { DATA_TYPES, FUNC_CODES, BYTE_ORDERS, BAUDRATES, PARITIES, regCount } from './modbus.js';

const IPV4 = /^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)$/;

const between = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

export function checkChannel(ch) {
  const errors = [];
  const fail = (field, message) => errors.push({ field, message });

  if (!ch.name?.trim()) fail('name', 'Name is required');

  if (ch.type === 'tcp') {
    if (!IPV4.test(ch.host ?? '')) fail('host', 'Not a valid IPv4 address');
    if (!between(ch.port, 1, 65535)) fail('port', 'Port must be 1-65535');
  } else if (ch.type === 'rtu') {
    if (!ch.serialPort?.trim()) fail('serialPort', 'Serial port is required');
    if (!BAUDRATES.includes(ch.baudrate)) fail('baudrate', 'Unsupported baud rate');
    if (!PARITIES.includes(ch.parity)) fail('parity', 'Parity must be N, E or O');
    if (ch.stopbits !== 1 && ch.stopbits !== 2) fail('stopbits', 'Stop bits must be 1 or 2');
    if (ch.bytesize !== 7 && ch.bytesize !== 8) fail('bytesize', 'Byte size must be 7 or 8');
  } else {
    fail('type', 'Type must be tcp or rtu');
  }

  if (!between(ch.requestRetries, 0, 10)) fail('requestRetries', 'Retries must be 0-10');
  if (!between(ch.connectRetries, 0, 10)) fail('connectRetries', 'Retries must be 0-10');
  if (!between(ch.requestTimeout, 100, 60000)) fail('requestTimeout', 'Timeout must be 100-60000 ms');
  if (!between(ch.connectTimeout, 100, 60000)) fail('connectTimeout', 'Timeout must be 100-60000 ms');

  const used = new Map();
  ch.stations?.forEach((st, i) => {
    if (used.has(st.address)) {
      fail(`stations.${i}.address`, `Address ${st.address} is already used by ${used.get(st.address)}`);
    }
    used.set(st.address, st.name);
  });

  return errors;
}

export function checkStation(st) {
  const errors = [];
  if (!st.name?.trim()) errors.push({ field: 'name', message: 'Name is required' });
  // 0 is broadcast, 248-255 are reserved by the spec
  if (!between(st.address, 1, 247)) errors.push({ field: 'address', message: 'Address must be 1-247' });
  return errors.concat(checkDatapoints(st.datapoints ?? []));
}

export function checkDatapoint(dp) {
  const errors = [];
  const fail = (field, message) => errors.push({ field, message });

  if (!(dp.dataType in DATA_TYPES)) fail('dataType', 'Unknown data type');
  if (!(dp.funcCode in FUNC_CODES)) fail('funcCode', 'Function code must be 1-4');
  if (!BYTE_ORDERS.includes(dp.byteOrder)) fail('byteOrder', 'Unknown byte order');
  if (!between(dp.startAddr, 0, 65535)) fail('startAddr', 'Address must be 0-65535');
  if (!between(dp.acqCycle, 100, 86400000)) fail('acqCycle', 'Cycle must be at least 100 ms');
  if (!Number.isFinite(dp.scale) || dp.scale === 0) fail('scale', 'Scale must be a non-zero number');

  return errors;
}

export function checkDatapoints(list) {
  const errors = [];
  const ids = new Set();

  list.forEach((dp, i) => {
    for (const e of checkDatapoint(dp)) errors.push({ field: `datapoints.${i}.${e.field}`, message: e.message });
    if (ids.has(dp.id)) errors.push({ field: `datapoints.${i}.id`, message: `Duplicate id ${dp.id}` });
    ids.add(dp.id);
  });

  for (const [a, b] of findOverlaps(list)) {
    errors.push({
      field: `datapoints.${b}.startAddr`,
      message: `Overlaps with "${list[a].description || list[a].id}" at ${list[a].startAddr}`,
    });
  }
  return errors;
}

// Overlap only matters inside the same function code (input and holding
// registers are separate address spaces).
export function findOverlaps(list) {
  const ranges = list
    .map((dp, i) => ({ i, fc: dp.funcCode, start: dp.startAddr, end: dp.startAddr + regCount(dp) - 1 }))
    .sort((a, b) => a.fc - b.fc || a.start - b.start);

  const pairs = [];
  for (let k = 1; k < ranges.length; k++) {
    const prev = ranges[k - 1];
    const cur = ranges[k];
    if (cur.fc === prev.fc && cur.start <= prev.end) pairs.push([prev.i, cur.i]);
  }
  return pairs;
}
