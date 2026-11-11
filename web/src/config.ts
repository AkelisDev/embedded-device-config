import { reactive } from 'vue';
import { request } from './api';
import type { Channel, ChannelType, Datapoint, Station } from './types';

export const config = reactive({
  channels: [] as Channel[],
  loaded: false,
  loadError: '',
});

export async function loadConfig() {
  try {
    config.channels = await request<Channel[]>('GET', '/channels');
    config.loaded = true;
    config.loadError = '';
  } catch (e) {
    config.loadError = (e as Error).message;
  }
}

export const findChannel = (cid: string) => config.channels.find((c) => c.id === cid);
export const findStation = (cid: string, sid: string) => findChannel(cid)?.stations.find((s) => s.id === sid);

// Every change is followed by a reload: the config is small, and the UI then
// shows exactly what the device saved, never an optimistic guess.
async function mutate<T>(method: string, path: string, body?: unknown) {
  const result = await request<T>(method, path, body);
  await loadConfig();
  return result;
}

export const createChannel = (type: ChannelType, name: string) =>
  mutate<Channel>('POST', '/channels', { type, name });

export const saveChannel = (cid: string, fields: Partial<Channel>) => mutate<Channel>('PUT', `/channels/${cid}`, fields);

export const deleteChannel = (cid: string) => mutate('DELETE', `/channels/${cid}`);

export interface NewStation {
  name: string;
  address: number;
  copyFrom?: { channelId: string; stationId: string };
}

export const createStation = (cid: string, station: NewStation) =>
  mutate<Station>('POST', `/channels/${cid}/stations`, station);

export const saveStation = (cid: string, sid: string, fields: Partial<Station>) =>
  mutate<Station>('PUT', `/channels/${cid}/stations/${sid}`, fields);

// The whole map in one request: bulk edits and imports are one validation and one write
export const saveRegisters = (cid: string, sid: string, datapoints: Datapoint[]) =>
  mutate<Datapoint[]>('PUT', `/channels/${cid}/stations/${sid}/datapoints`, datapoints);

export const deleteStation = (cid: string, sid: string) => mutate('DELETE', `/channels/${cid}/stations/${sid}`);
