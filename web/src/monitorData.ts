import { request } from './api';

export type Resolution = 'raw' | '1m';

const MINUTE = 60_000;
// The server keeps at most one raw sample per second
const RAW_MIN_STEP = 1000;
// Missing more than this many expected samples in a row counts as an outage
const GAP_FACTOR = 2.5;

// Raw samples have min = max = avg, so both resolutions share one shape and
// one code path. null marks a gap, so the chart breaks the line there.
export interface Track {
  resolution: Resolution;
  step: number;
  t: number[];
  avg: (number | null)[];
  min: (number | null)[];
  max: (number | null)[];
  // Running totals of the open minute, so live values keep its average exact
  bucket: OpenBucket;
}

interface OpenBucket { sum: number; count: number; last: number }

interface RawSeries { t: number[]; v: number[] }
interface MinuteSeries { t: number[]; min: number[]; max: number[]; avg: number[]; open?: OpenBucket }

interface HistoryResponse {
  resolution: Resolution;
  series: Record<string, RawSeries | MinuteSeries>;
}

function push(track: Track, t: number, avg: number | null, min = avg, max = avg) {
  const last = track.t.at(-1);
  if (last !== undefined && avg !== null && t - last > track.step * GAP_FACTOR) {
    track.t.push((last + t) / 2);
    track.avg.push(null);
    track.min.push(null);
    track.max.push(null);
  }
  track.t.push(t);
  track.avg.push(avg);
  track.min.push(min);
  track.max.push(max);
}

export async function fetchTracks(keys: string[], rangeSeconds: number, cycles: Record<string, number>) {
  const res = await request<HistoryResponse>('GET', `/history?keys=${keys.map(encodeURIComponent).join(',')}&range=${rangeSeconds}`);
  const tracks = new Map<string, Track>();

  for (const key of keys) {
    const step = res.resolution === 'raw' ? Math.max(cycles[key] ?? RAW_MIN_STEP, RAW_MIN_STEP) : MINUTE;
    const track: Track = { resolution: res.resolution, step, t: [], avg: [], min: [], max: [], bucket: { sum: 0, count: 0, last: 0 } };
    const s = res.series[key];

    if (s && 'v' in s) s.t.forEach((t, i) => push(track, t, s.v[i]));
    else if (s) {
      s.t.forEach((t, i) => push(track, t, s.avg[i], s.min[i], s.max[i]));
      if (s.open) track.bucket = { ...s.open };
    }
    tracks.set(key, track);
  }
  return tracks;
}

export function addSample(track: Track, t: number, v: number) {
  const last = track.t.at(-1);
  if (last !== undefined && t <= last) return;

  if (track.resolution === 'raw') {
    // Same downsampling as the server, so live and loaded data look the same
    if (last !== undefined && t - last < RAW_MIN_STEP * 0.9) return;
    push(track, t, v);
    return;
  }

  // The server already counted samples up to this one in the open minute
  const b = track.bucket;
  if (t <= b.last) return;
  b.last = t;

  const minute = Math.floor(t / MINUTE) * MINUTE;
  const i = track.t.length - 1;
  if (i >= 0 && track.t[i] === minute && track.avg[i] !== null) {
    b.sum += v;
    b.count++;
    track.avg[i] = b.sum / b.count;
    track.min[i] = Math.min(track.min[i]!, v);
    track.max[i] = Math.max(track.max[i]!, v);
  } else {
    push(track, minute, v);
    b.sum = v;
    b.count = 1;
  }
}

export function trim(track: Track, from: number) {
  let n = 0;
  while (n < track.t.length && track.t[n] < from) n++;
  if (!n) return;
  for (const col of [track.t, track.avg, track.min, track.max]) col.splice(0, n);
}

export interface Stats {
  min: number | null;
  max: number | null;
  avg: number | null;
}

export function stats(track: Track | undefined): Stats {
  const out: Stats = { min: null, max: null, avg: null };
  if (!track) return out;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < track.t.length; i++) {
    const avg = track.avg[i];
    if (avg === null) continue;
    out.min = Math.min(out.min ?? Infinity, track.min[i]!);
    out.max = Math.max(out.max ?? -Infinity, track.max[i]!);
    sum += avg;
    count++;
  }
  out.avg = count ? sum / count : null;
  return out;
}
