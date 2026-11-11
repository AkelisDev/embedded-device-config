import { valueKey } from '../shared/modbus.js';

const MINUTE = 60_000;
const RAW_WINDOW = 15 * MINUTE;
const RAW_MIN_STEP = 1000;
const MINUTES_KEPT = 61;

// Fixed-size ring in typed arrays: memory is allocated once and never grows,
// and there is no object per sample for the garbage collector.
class Ring {
  constructor(capacity, columns) {
    this.capacity = capacity;
    this.t = new Float64Array(capacity);
    this.columns = Object.fromEntries(columns.map((c) => [c, new Float64Array(capacity)]));
    this.next = 0;
    this.size = 0;
  }

  push(t, values) {
    this.t[this.next] = t;
    for (const c in this.columns) this.columns[c][this.next] = values[c];
    this.next = (this.next + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }

  since(from) {
    const out = { t: [] };
    for (const c in this.columns) out[c] = [];

    const oldest = (this.next - this.size + this.capacity) % this.capacity;
    for (let k = 0; k < this.size; k++) {
      const i = (oldest + k) % this.capacity;
      if (this.t[i] < from) continue;
      out.t.push(this.t[i]);
      for (const c in this.columns) out[c].push(this.columns[c][i]);
    }
    return out;
  }
}

// Recent data at full resolution (at most one sample per second), older data
// as min/max/avg per minute. One hour is enough for on-site diagnostics;
// long-term history is the cloud's job.
class Series {
  constructor(acqCycle, signature) {
    this.signature = signature;
    const step = Math.max(acqCycle, RAW_MIN_STEP);
    this.raw = new Ring(Math.ceil(RAW_WINDOW / step) + 1, ['v']);
    this.minutes = new Ring(MINUTES_KEPT, ['min', 'max', 'avg']);
    this.bucket = null;
    this.latest = null;
    this.lastRawT = 0;
  }

  add(t, v) {
    // 0.9 tolerates timer jitter, otherwise a 1 s register would skip samples
    if (t - this.lastRawT >= RAW_MIN_STEP * 0.9) {
      this.raw.push(t, { v });
      this.lastRawT = t;
    }
    this.latest = [t, v];
    this.addToMinute(t, v);
  }

  addToMinute(t, v) {
    const start = Math.floor(t / MINUTE) * MINUTE;
    if (this.bucket && this.bucket.start !== start) {
      this.minutes.push(this.bucket.start, closeBucket(this.bucket));
      this.bucket = null;
    }
    this.bucket ??= { start, min: v, max: v, sum: 0, count: 0, last: t };
    this.bucket.min = Math.min(this.bucket.min, v);
    this.bucket.max = Math.max(this.bucket.max, v);
    this.bucket.sum += v;
    this.bucket.count++;
    this.bucket.last = t;
  }

  rawSince(from) {
    return this.raw.since(from);
  }

  minutesSince(from) {
    const out = this.minutes.since(from - MINUTE + 1);
    if (this.bucket) {
      const open = closeBucket(this.bucket);
      out.t.push(this.bucket.start);
      for (const c of ['min', 'max', 'avg']) out[c].push(open[c]);
      // Lets the client keep averaging the open minute exactly from live values
      const { sum, count, last } = this.bucket;
      out.open = { sum, count, last };
    }
    return out;
  }
}

function closeBucket(b) {
  return { min: b.min, max: b.max, avg: Number((b.sum / b.count).toPrecision(7)) };
}

// Anything that changes what the register means starts a fresh series;
// renaming a station or editing another register keeps the history.
const signature = (st, dp) => [st.address, dp.funcCode, dp.startAddr, dp.dataType, dp.scale, dp.acqCycle].join('|');

export class History {
  constructor() {
    this.series = new Map();
  }

  sync(channels) {
    const next = new Map();
    for (const ch of channels) {
      if (!ch.enabled) continue;
      for (const st of ch.stations) {
        for (const dp of st.datapoints) {
          const key = valueKey(ch, st, dp);
          const sig = signature(st, dp);
          const old = this.series.get(key);
          next.set(key, old?.signature === sig ? old : new Series(dp.acqCycle, sig));
        }
      }
    }
    this.series = next;
  }

  add({ t, values }) {
    for (const [key, v] of values) this.series.get(key)?.add(t, v);
  }

  latest() {
    const out = {};
    for (const [key, s] of this.series) if (s.latest) out[key] = s.latest;
    return out;
  }

  query(keys, range, now) {
    const from = now - range;
    const resolution = range <= RAW_WINDOW ? 'raw' : '1m';
    const series = {};
    for (const key of keys) {
      const s = this.series.get(key);
      if (s) series[key] = resolution === 'raw' ? s.rawSince(from) : s.minutesSince(from);
    }
    return { from, to: now, resolution, series };
  }
}
