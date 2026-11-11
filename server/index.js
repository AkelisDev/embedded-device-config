import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ConfigStore } from './store.js';
import { createApi } from './api.js';
import { createStatic } from './static.js';
import { json } from './http.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT) || 8080;
const configPath = process.env.CONFIG || join(root, 'data', 'modbus_config.json');

const store = new ConfigStore(configPath);
await store.load();

// '/api/channels/:cid' -> regex with named groups
const routes = createApi(store).map(([method, path, handler]) => {
  const pattern = new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[\\w-]+)') + '$');
  return { method, pattern, handler };
});

const serveStatic = createStatic(join(root, 'web', 'dist'));

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (!pathname.startsWith('/api/')) return await serveStatic(req, res);

    for (const route of routes) {
      const m = route.method === req.method && pathname.match(route.pattern);
      if (m) return await route.handler(req, res, ...Object.values(m.groups ?? {}));
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
