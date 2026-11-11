import { EventEmitter } from 'node:events';

function channelState(ch) {
  if (!ch.enabled) return 'disabled';
  const states = new Set(ch.stations.map((s) => s.state).filter((s) => s !== 'idle'));
  if (!states.size) return 'idle';
  if (states.has('timeout')) return states.has('ok') ? 'partial' : 'timeout';
  return states.has('waiting') ? 'waiting' : 'ok';
}

// Communication status per station, built from poll results. Emits 'change'
// only when a state flips, not on every poll; the UI gets value times from the
// values themselves.
export class StatusTracker extends EventEmitter {
  constructor() {
    super();
    this.channels = [];
    this.stations = new Map();
  }

  reset(channels) {
    const previous = this.stations;
    this.stations = new Map();

    this.channels = channels.map((ch) => ({
      id: ch.id,
      enabled: ch.enabled,
      stations: ch.stations.map((st) => {
        const key = `${ch.id}/${st.id}`;
        const status = {
          id: st.id,
          state: !ch.enabled ? 'disabled' : st.datapoints.length ? 'waiting' : 'idle',
          lastValueAt: null,
          lastErrorAt: null,
          errorCount: 0,
        };
        // Saving config shouldn't wipe the error counter of a meter that's still there
        if (ch.enabled && previous.has(key)) {
          const { lastValueAt, lastErrorAt, errorCount } = previous.get(key);
          Object.assign(status, { lastValueAt, lastErrorAt, errorCount });
        }
        this.stations.set(key, status);
        return status;
      }),
    }));
    this.emit('change');
  }

  record({ channelId, stationId, t, ok }) {
    const status = this.stations.get(`${channelId}/${stationId}`);
    if (!status) return;

    const before = status.state;
    if (ok) {
      status.state = 'ok';
      status.lastValueAt = t;
    } else {
      status.state = 'timeout';
      status.lastErrorAt = t;
      status.errorCount++;
    }
    if (status.state !== before) this.emit('change');
  }

  toJSON() {
    return this.channels.map((ch) => ({ id: ch.id, state: channelState(ch), stations: ch.stations }));
  }
}
