import { json, HttpError } from './http.js';

const MAX_KEYS = 20;
const MIN_RANGE = 60;
const MAX_RANGE = 3600;

export function createMonitorApi({ store, status, history, live }) {
  async function getStatus(req, res) {
    json(res, 200, {
      revision: store.revision,
      uptime: Math.round(process.uptime()),
      memory: process.memoryUsage().rss,
      channels: status.toJSON(),
    });
  }

  async function getHistory(req, res) {
    const query = new URL(req.url, 'http://localhost').searchParams;
    const keys = (query.get('keys') ?? '').split(',').filter(Boolean);
    const range = Number(query.get('range') ?? 900);

    if (!keys.length) throw new HttpError(400, 'keys is required');
    if (keys.length > MAX_KEYS) throw new HttpError(400, `At most ${MAX_KEYS} keys`);
    if (!(range >= MIN_RANGE && range <= MAX_RANGE)) {
      throw new HttpError(400, `range must be ${MIN_RANGE}-${MAX_RANGE} seconds`);
    }
    json(res, 200, history.query(keys, range * 1000, Date.now()));
  }

  async function stream(req, res) {
    live.attach(req, res);
  }

  return [
    ['GET', '/api/status', getStatus],
    ['GET', '/api/history', getHistory],
    ['GET', '/api/values/stream', stream],
  ];
}
