import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ConfigStore } from './store.js';
import { createApi } from './api.js';
import { createMonitorApi } from './monitor-api.js';
import { createStatic } from './static.js';
import { Simulator } from './simulator.js';
import { History } from './history.js';
import { StatusTracker } from './status.js';
import { LiveHub } from './live.js';
import { json, HttpError } from './http.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT) || 8080;
const configPath = process.env.CONFIG || join(root, 'data', 'modbus_config.json');

const store = new ConfigStore(configPath);
await store.load();

const simulator = new Simulator({ outages: process.env.SIM_OUTAGES !== '0' });
const history = new History();
const status = new StatusTracker();
const live = new LiveHub(() => ({ revision: store.revision, status: status.toJSON(), values: history.latest() }));

simulator.on('poll', (result) => {
  status.record(result);
  if (!result.ok) return;
  history.add(result);
  live.addValues(result);
});
status.on('change', () => live.queue('status', status.toJSON()));

function applyConfig() {
  status.reset(store.channels);
  history.sync(store.channels);
  simulator.start(store.channels);
}

store.on('change', () => {
  applyConfig();
  live.queue('config', { revision: store.revision });
});
applyConfig();

// '/api/channels/:cid' -> regex with named groups
const routes = [...createApi(store), ...createMonitorApi({ store, status, history, live })].map(([method, path, handler]) => {
  const pattern = new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[\\w-]+)') + '$');
  return { method, pattern, handler };
});

// A browser that was offline may hold an old copy of the config; refuse its
// save instead of silently overwriting what was changed in the meantime.
function assertRevision(req) {
  const expected = req.headers['if-match'];
  if (req.method !== 'GET' && expected && expected !== `"${store.revision}"`) {
    throw new HttpError(409, 'Configuration was changed on the device. Reload before saving.');
  }
}

const serveStatic = createStatic(join(root, 'web', 'dist'));

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (!pathname.startsWith('/api/')) return await serveStatic(req, res);

    for (const route of routes) {
      const m = route.method === req.method && pathname.match(route.pattern);
      if (!m) continue;
      assertRevision(req);
      return await route.handler(req, res, ...Object.values(m.groups ?? {}));
    }
    json(res, 404, { error: 'Not found' });
  } catch (err) {
    if (!err.status) console.error(err);
    json(res, err.status || 500, { error: err.status ? err.message : 'Internal error', errors: err.details });
  }
});

server.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
