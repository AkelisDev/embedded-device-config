# embedded-device-config

Configuration and monitoring UI for a Modbus RTU/TCP gateway.

## Run

```
npm install
npm run build
npm start            # http://localhost:8080
```

- Development: `npm start` and `npm run dev` (Vite, proxies `/api` to 8080).
- Env: `PORT`, `CONFIG` (config file path), `SIM_OUTAGES=0` (no simulated outages).
- Build needs Node 20.19+ or 22.12+ (Vite 8), running needs Node 18+.

## Architecture

```
 browser (Vue 3, drafts in localStorage)
    |  REST /api/* (ETag / If-Match)        SSE /api/values/stream
 node:http server
    api.js, monitor-api.js, static.js (web/dist, .gz)
    store.js <- shared/convert.js, shared/validate.js
    simulator.js -> status.js, history.js, live.js
    |
 data/modbus_config.json (device format, written atomically)
```

- One Node process without dependencies: REST API, SSE, built UI.
- The file keeps the device's format (all values strings, device key order); `shared/convert.js` converts at the API.
- `shared/validate.js` runs on the server and in the UI, so forms, imports and saves give the same errors.
- `simulator.js` stands in for the poller (3-phase meter model, random outages) and emits what a real poller would.
- Config revision (hash of the file) is the ETag; a save with a stale `If-Match` gets 409.

## Register mapping workflow

1. Add stations, one or many: count, first free address block, name pattern `Meter {n}`, map copied from another station. The range is checked (1-247, no clashes) and created in one request.
2. Generate a register range: start, count, type, FC, cycle.
3. Paste from Excel or load CSV: headers matched by name, delimiter, decimal comma and 30001/40001 notation detected, preview with row errors.
4. Bulk edit: shift-click a range, set cycle, byte order, FC, type, scale or units, or delete.
5. Overlaps per FC and bad values show per cell. One PUT on save, blocked while there are errors.

## Industrial usability

- For an engineer on a short site visit, often without internet. No CDN.
- Overview first: which meters talk, last value time, failed reads, V / I per phase, power, energy.
- Status per channel and station (OK, timeout, partial, disabled). Values older than 3 cycles are marked stale.
- Addresses shown 0-based and in 30001/40001 notation, as in meter manuals.
- Fixed values are dropdowns: serial port, baud rate, parity, data bits, stop bits, type, FC, byte order.
- RS-485 is one request at a time: channel settings show how long a silent meter holds the bus (timeout × (retries + 1), 8 s in the example).
- Monitor: values grouped by quantity, one chart per unit, 1 h as min-max band, min / max / avg next to the chart.
- Drafts survive a reload and a lost connection. Device changes are merged per field, only a clash on the same field asks.
- Config backup download and import (summary and errors shown before replacing anything).

## Embedded resource constraints

- Server has no runtime dependencies, the release is about 175 KB.
- UI 47 KB gzipped; uPlot and the Monitor tab are a 26 KB chunk loaded on first use. Gzipped at build time, hashed assets cached for a year.
- History in fixed ring buffers: 15 min raw, 60 min as 1-min min/max/avg, about 16 KB per 1 s register.
- One SSE message per second plus a 5 s ping. History is fetched only when the chart range or selection changes.
- Config written only on save, atomically, so flash is rarely written.
- RSS about 55 MB, most of it Node itself. The API is small enough to port to Go or C (likely a few MB) without changing the UI.

## Edge cases

- Power cut during save: temp file + rename, previous version in `.bak`, never a half-written file.
- Power cut and history: RAM history is lost. Keeping it means writing to flash (wear); ride-through is a hardware question.
- Internet / cloud down: not needed by the device or the local UI.
- Browser loses the connection: banner within 12 s, saving blocked, drafts kept, revision checked on reconnect.
- Meter not answering: station goes to timeout, values go stale, the chart shows a gap; other stations keep working.

## Assumptions and not done

- Assumed: firmware reads `modbus_config.json` as is and picks up changes; one engineer at a time (the revision check covers a second one).
- No real Modbus, values are simulated.
- No authentication or TLS: fine on an isolated site LAN, needed before remote access.
- No undo/redo or fill-down; drafts and Discard cover most mistakes.
- No long-term history on the device, the cloud keeps it.
- SSE sends the latest value per second, so registers faster than 1 s are sampled in the live chart.

## Build and deploy

- `npm run build`: type check, Vite build, then `scripts/compress.js` writes `.gz` next to each html/js/css.
- `npm run release`: `release/embedded-device-config.tar.gz` with `server/`, `shared/`, `web/dist/`, `data/`, `deploy/` and a minimal `package.json`. No `node_modules`. Needs `tar`.
- On the device:

```
scp release/embedded-device-config.tar.gz root@device:/tmp/
ssh root@device
tar -xzf /tmp/embedded-device-config.tar.gz -C /opt
cp /opt/embedded-device-config/deploy/embedded-device-config.service /etc/systemd/system/
systemctl enable --now embedded-device-config
```

- The unit starts on boot and restarts on crash. Config in `/var/lib/embedded-device-config/`, copied from `data/` on first start, so upgrades keep it. Check the `node` path.
- Upgrade: `rm -rf /opt/embedded-device-config`, extract, `systemctl restart embedded-device-config`.
- Measured on Windows x64, Node 24, example config: RSS 54-55 MB, flat over 5 min; about 50 MB with `--max-old-space-size=32 --max-semi-space-size=1`.
