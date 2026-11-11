import { computed, ref } from 'vue';

// A hash router is enough for four kinds of page and saves a dependency
export type StationTab = 'settings' | 'registers' | 'monitor';

export type Route =
  | { name: 'overview' }
  | { name: 'channel'; cid: string }
  | { name: 'station'; cid: string; sid: string; tab: StationTab };

const TABS: StationTab[] = ['settings', 'registers', 'monitor'];

const hash = ref(location.hash);
addEventListener('hashchange', () => (hash.value = location.hash));

function parse(h: string): Route {
  const [kind, cid, sid, tab] = h.replace(/^#\/?/, '').split('/');
  if (kind === 'channel' && cid) return { name: 'channel', cid };
  if (kind === 'station' && cid && sid) {
    return { name: 'station', cid, sid, tab: TABS.includes(tab as StationTab) ? (tab as StationTab) : 'settings' };
  }
  return { name: 'overview' };
}

export const route = computed(() => parse(hash.value));

export const links = {
  overview: () => '#/',
  channel: (cid: string) => `#/channel/${cid}`,
  station: (cid: string, sid: string, tab: StationTab = 'settings') => `#/station/${cid}/${sid}/${tab}`,
};

export function go(href: string) {
  location.hash = href;
}
