import { json as sendJson, readBody, assertValid, HttpError } from './http.js';
import { parseConfig } from '../shared/convert.js';
import { checkChannel, checkStation, checkDatapoints } from '../shared/validate.js';
import { nextId } from '../shared/modbus.js';

const CHANNEL_FIELDS = [
  'name', 'enabled', 'host', 'port', 'serialPort', 'baudrate', 'parity', 'stopbits', 'bytesize',
  'requestRetries', 'requestTimeout', 'connectRetries', 'connectTimeout',
];

const DEFAULTS = {
  common: { enabled: false, requestRetries: 3, requestTimeout: 2000, connectRetries: 3, connectTimeout: 5000 },
  tcp: { host: '192.168.1.10', port: 502 },
  rtu: { serialPort: '/dev/ttyS0', baudrate: 9600, parity: 'N', stopbits: 1, bytesize: 8 },
};

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

export function createApi(store) {
  // ETag lets the UI send If-Match on save, so it can't overwrite changes
  // made while it was disconnected
  const json = (res, status, body) => sendJson(res, status, body, { ETag: `"${store.revision}"` });

  function getChannel(id) {
    const ch = store.channel(id);
    if (!ch) throw new HttpError(404, 'Channel not found');
    return ch;
  }

  function getStation(cid, sid) {
    const st = store.station(cid, sid);
    if (!st) throw new HttpError(404, 'Station not found');
    return st;
  }

  async function listChannels(req, res) {
    json(res, 200, store.channels);
  }

  async function createChannel(req, res) {
    const body = await readBody(req);
    const type = body.type === 'tcp' ? 'tcp' : 'rtu';
    const channelId = nextId(store.channels.filter((c) => c.type === type).map((c) => ({ id: c.channelId })));

    const ch = {
      ...DEFAULTS.common,
      ...DEFAULTS[type],
      ...pick(body, CHANNEL_FIELDS),
      id: `${type}-${channelId}`,
      channelId,
      type,
      stations: [],
    };
    assertValid(checkChannel(ch));

    store.channels.push(ch);
    await store.save();
    json(res, 201, ch);
  }

  async function updateChannel(req, res, cid) {
    const ch = getChannel(cid);
    const next = { ...ch, ...pick(await readBody(req), CHANNEL_FIELDS) };
    assertValid(checkChannel(next));

    Object.assign(ch, next);
    await store.save();
    json(res, 200, ch);
  }

  async function deleteChannel(req, res, cid) {
    getChannel(cid);
    store.channels = store.channels.filter((c) => c.id !== cid);
    await store.save();
    json(res, 204);
  }

  async function createStation(req, res, cid) {
    const ch = getChannel(cid);
    const body = await readBody(req);

    let datapoints = body.datapoints ?? [];
    if (body.copyFrom) {
      datapoints = structuredClone(getStation(body.copyFrom.channelId, body.copyFrom.stationId).datapoints);
    }

    const st = { id: nextId(ch.stations), name: body.name, address: body.address, datapoints };
    assertValid([...checkStation(st), ...checkChannel({ ...ch, stations: [...ch.stations, st] })]);

    ch.stations.push(st);
    await store.save();
    json(res, 201, st);
  }

  async function updateStation(req, res, cid, sid) {
    const ch = getChannel(cid);
    const st = getStation(cid, sid);
    const next = { ...st, ...pick(await readBody(req), ['name', 'address']) };
    const stations = ch.stations.map((s) => (s.id === sid ? next : s));
    assertValid([...checkStation(next), ...checkChannel({ ...ch, stations })]);

    Object.assign(st, next);
    await store.save();
    json(res, 200, st);
  }

  async function deleteStation(req, res, cid, sid) {
    const ch = getChannel(cid);
    getStation(cid, sid);
    ch.stations = ch.stations.filter((s) => s.id !== sid);
    await store.save();
    json(res, 204);
  }

  // The UI edits the register map locally (bulk edit, import, generate) and
  // sends the whole list once, so there's one validation and one write.
  async function replaceDatapoints(req, res, cid, sid) {
    const st = getStation(cid, sid);
    const list = await readBody(req, 5_000_000);
    if (!Array.isArray(list)) throw new HttpError(400, 'Expected an array');
    assertValid(checkDatapoints(list));

    st.datapoints = list;
    await store.save();
    json(res, 200, st.datapoints);
  }

  async function exportConfig(req, res) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      ETag: `"${store.revision}"`,
      'Content-Disposition': 'attachment; filename="modbus_config.json"',
    });
    res.end(store.serialize());
  }

  async function importConfig(req, res) {
    const channels = parseConfig(await readBody(req, 5_000_000));
    const errors = [];
    for (const ch of channels) {
      for (const e of checkChannel(ch)) errors.push({ ...e, field: `${ch.id}.${e.field}` });
      for (const st of ch.stations) {
        for (const e of checkStation(st)) errors.push({ ...e, field: `${ch.id}/${st.id}.${e.field}` });
      }
    }
    assertValid(errors);

    store.channels = channels;
    await store.save();
    json(res, 200, channels);
  }

  return [
    ['GET', '/api/channels', listChannels],
    ['POST', '/api/channels', createChannel],
    ['PUT', '/api/channels/:cid', updateChannel],
    ['DELETE', '/api/channels/:cid', deleteChannel],
    ['POST', '/api/channels/:cid/stations', createStation],
    ['PUT', '/api/channels/:cid/stations/:sid', updateStation],
    ['DELETE', '/api/channels/:cid/stations/:sid', deleteStation],
    ['PUT', '/api/channels/:cid/stations/:sid/datapoints', replaceDatapoints],
    ['GET', '/api/export', exportConfig],
    ['POST', '/api/import', importConfig],
  ];
}
