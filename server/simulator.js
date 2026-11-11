import { EventEmitter } from 'node:events';
import { createMeter, registerReader } from './meter.js';
import { valueKey } from '../shared/modbus.js';

const OUTAGE_EVERY = 15 * 60_000;
const OUTAGE_MIN = 20_000;
const OUTAGE_MAX = 60_000;

function groupByCycle(datapoints) {
  const groups = new Map();
  for (const dp of datapoints) {
    if (!groups.has(dp.acqCycle)) groups.set(dp.acqCycle, []);
    groups.get(dp.acqCycle).push(dp);
  }
  return groups;
}

// Stands in for the Modbus poller. It emits the same kind of result a real
// poller would ('poll' with ok + values), so status, history and the live
// stream don't know the values are simulated.
export class Simulator extends EventEmitter {
  constructor({ outages = true } = {}) {
    super();
    this.outages = outages;
    this.timers = [];
    // Kept across restarts so energy counters keep growing after a config save
    this.meters = new Map();
  }

  start(channels) {
    this.stop();
    this.forgetRemovedMeters(channels);
    for (const ch of channels) {
      if (!ch.enabled) continue;
      for (const st of ch.stations) this.startStation(ch, st);
    }
  }

  // Stations on a disabled channel still exist, so their counters are kept
  forgetRemovedMeters(channels) {
    const existing = new Set(channels.flatMap((ch) => ch.stations.map((st) => `${ch.id}/${st.id}`)));
    for (const key of this.meters.keys()) if (!existing.has(key)) this.meters.delete(key);
  }

  stop() {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
  }

  startStation(ch, st) {
    const stationKey = `${ch.id}/${st.id}`;
    if (!this.meters.has(stationKey)) this.meters.set(stationKey, createMeter(stationKey));
    const meter = this.meters.get(stationKey);
    const fault = { until: 0, checkedAt: Date.now() };

    // One timer per acquisition cycle, like a real poller reading one block
    // per cycle instead of one request per register.
    for (const [cycle, datapoints] of groupByCycle(st.datapoints)) {
      const readers = datapoints.map((dp) => [valueKey(ch, st, dp), registerReader(dp)]);
      const poll = () => this.poll(ch.id, st.id, meter, readers, fault);
      poll();
      this.timers.push(setInterval(poll, cycle));
    }
  }

  poll(channelId, stationId, meter, readers, fault) {
    const t = Date.now();
    if (this.isDown(fault, t)) {
      this.emit('poll', { channelId, stationId, t, ok: false });
      return;
    }
    const state = meter(t);
    const values = readers.map(([key, read]) => [key, read(state, t)]);
    this.emit('poll', { channelId, stationId, t, ok: true, values });
  }

  // A meter now and then stops answering for a while (loose wire, power cycle),
  // so the timeout and stale-value handling can be seen without hardware.
  isDown(fault, t) {
    if (!this.outages) return false;
    if (t < fault.until) return true;

    const chance = (t - fault.checkedAt) / OUTAGE_EVERY;
    fault.checkedAt = t;
    if (Math.random() >= chance) return false;

    fault.until = t + OUTAGE_MIN + Math.random() * (OUTAGE_MAX - OUTAGE_MIN);
    return true;
  }
}
