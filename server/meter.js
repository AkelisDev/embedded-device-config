// Physical model of a three-phase electricity meter, and how a register from
// the config maps onto it. Values are physically consistent (P = V * I * pf,
// energy is the integral of power) so the monitor looks like a real meter.

const MINUTE = 60_000;

const wave = (t, period, phase = 0) => Math.sin((2 * Math.PI * t) / period + phase);
const noise = (amp) => (Math.random() * 2 - 1) * amp;
const sum = (a) => a[0] + a[1] + a[2];
const avg = (a) => sum(a) / 3;

// Units in the field are inconsistent ("Volts" vs "V"), so match loosely.
// The factor converts from the model's base unit to the register's unit.
const UNITS = {
  v: ['voltage', 1], volts: ['voltage', 1],
  a: ['current', 1], amps: ['current', 1],
  w: ['power', 1], kw: ['power', 1e-3],
  va: ['apparent', 1], kva: ['apparent', 1e-3],
  var: ['reactive', 1], kvar: ['reactive', 1e-3],
  wh: ['energy', 1], kwh: ['energy', 1e-3],
  varh: ['reactiveEnergy', 1], kvarh: ['reactiveEnergy', 1e-3],
  hz: ['frequency', 1],
};

const INT_RANGES = {
  int16: [-32768, 32767],
  uint16: [0, 65535],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
};

function hashSeed(text) {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h % 1000) / 10;
}

export function createMeter(key) {
  const seed = hashSeed(key);
  const energy = { import: 4e6 + seed * 1e5, export: 1e4 + seed * 100, reactiveImport: 8e5 + seed * 1e4, reactiveExport: 2e3 };
  let lastT = Date.now();

  return function read(t) {
    const load = 0.55 + 0.25 * wave(t, 17 * MINUTE, seed) + 0.1 * wave(t, 3 * MINUTE, seed * 2) + noise(0.03);
    const pf = 0.93 + 0.03 * wave(t, 11 * MINUTE, seed) + noise(0.005);

    const voltage = [0, 1, 2].map((i) => 230 + 2 * wave(t, 7 * MINUTE, seed + i) + noise(0.4));
    // A fixed imbalance per phase, because real loads are never perfectly spread
    const current = [0, 1, 2].map((i) => Math.max(0, 32 * load * (1 + 0.12 * Math.sin(seed * 3 + i * 2)) + noise(0.3)));
    const apparent = voltage.map((v, i) => v * current[i]);
    const power = apparent.map((s) => s * pf);
    const reactive = apparent.map((s, i) => Math.sqrt(s * s - power[i] * power[i]));

    const hours = Math.max(0, t - lastT) / 3_600_000;
    energy.import += sum(power) * hours;
    energy.reactiveImport += sum(reactive) * hours;
    lastT = t;

    return { voltage, current, power, apparent, reactive, pf, energy, frequency: 50 + noise(0.02), seed };
  };
}

export function classify(dp) {
  const descr = dp.description.toLowerCase();
  const [quantity, factor] = descr.includes('power factor')
    ? ['pf', 1]
    : UNITS[dp.units.trim().toLowerCase()] ?? ['generic', 1];
  const phase = Number(descr.match(/\b(?:phase|l)\s*([123])\b/)?.[1]) || 0;
  return { quantity, factor, phase, isExport: descr.includes('export'), isAverage: descr.includes('average') };
}

function physicalValue(m, kind, t, startAddr) {
  const perPhase = (list, total) => (kind.phase ? list[kind.phase - 1] : total(list));

  switch (kind.quantity) {
    case 'voltage': return perPhase(m.voltage, avg);
    case 'current': return perPhase(m.current, kind.isAverage ? avg : sum);
    case 'power': return perPhase(m.power, sum);
    case 'apparent': return perPhase(m.apparent, sum);
    case 'reactive': return perPhase(m.reactive, sum);
    case 'pf': return sum(m.power) / sum(m.apparent);
    case 'energy': return kind.isExport ? m.energy.export : m.energy.import;
    case 'reactiveEnergy': return kind.isExport ? m.energy.reactiveExport : m.energy.reactiveImport;
    case 'frequency': return m.frequency;
    default: return 50 + 25 * wave(t, 5 * MINUTE, m.seed + startAddr);
  }
}

// What the device would get after reading the register and applying scale:
// integer types lose the fraction, float32 loses precision.
function encode(value, dp) {
  let raw = value / dp.scale;
  const range = INT_RANGES[dp.dataType];
  if (range) raw = Math.min(range[1], Math.max(range[0], Math.round(raw)));
  else if (dp.dataType === 'float32') raw = Math.fround(raw);
  return Number((raw * dp.scale).toPrecision(7));
}

export function registerReader(dp) {
  const kind = classify(dp);
  return (meterState, t) => encode(physicalValue(meterState, kind, t, dp.startAddr) * kind.factor, dp);
}
