import { reactive } from 'vue';
import { currentRevision } from './api';
import { loadConfig } from './config';
import type { ChannelStatus, LinkState, Sample } from './types';

// The server pings every 5 s. Without this the browser can sit on a dead
// connection for minutes after the cable is pulled.
const WATCHDOG_MS = 12_000;

export const live = reactive({
  connected: false,
  values: {} as Record<string, Sample>,
  status: [] as ChannelStatus[],
});

let source: EventSource | undefined;
let watchdog: ReturnType<typeof setTimeout> | undefined;

function alive() {
  live.connected = true;
  clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    live.connected = false;
    connectLive();
  }, WATCHDOG_MS);
}

// Someone else saved, or the device rebooted with another config
function checkRevision(revision: string) {
  if (revision !== currentRevision()) loadConfig();
}

function on<T>(event: string, handle: (data: T) => void) {
  source!.addEventListener(event, (e) => {
    alive();
    handle(JSON.parse((e as MessageEvent).data));
  });
}

export function connectLive() {
  source?.close();
  source = new EventSource('/api/values/stream');
  // EventSource reconnects by itself, we only need to show it
  source.onerror = () => (live.connected = false);

  on<{ revision: string; status: ChannelStatus[]; values: Record<string, Sample> }>('snapshot', (s) => {
    live.values = s.values;
    live.status = s.status;
    checkRevision(s.revision);
  });
  on<Record<string, Sample>>('values', (values) => Object.assign(live.values, values));
  on<ChannelStatus[]>('status', (status) => (live.status = status));
  on<{ revision: string }>('config', (c) => checkRevision(c.revision));
  on('ping', () => {});
}

const channelStatus = (cid: string) => live.status.find((c) => c.id === cid);
export const stationStatus = (cid: string, sid: string) => channelStatus(cid)?.stations.find((s) => s.id === sid);

// While disconnected the last known status would be a guess, so don't show it
export const channelState = (cid: string): LinkState =>
  (live.connected && channelStatus(cid)?.state) || 'unknown';

export const stationState = (cid: string, sid: string): LinkState =>
  (live.connected && stationStatus(cid, sid)?.state) || 'unknown';
