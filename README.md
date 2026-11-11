# embedded-device-config

Configuration and monitoring UI for a Modbus RTU/TCP gateway.

## Run

```
npm install
npm run build
npm start            # http://localhost:8080
```

Development: `npm start` and `npm run dev` (Vite, proxies `/api` to 8080).

Env: `PORT`, `CONFIG` (config file path), `SIM_OUTAGES=0` (no simulated meter outages).

## Monitoring

- Simulated poller: one timer per station and acquisition cycle. Values come from a 3-phase meter model, with scale, units and data type applied. Meters drop out at random to exercise timeouts.
- Live values over SSE (`/api/values/stream`), batched once per second.
- History in fixed-size RAM ring buffers: 15 min raw, 60 min as 1-min min/max/avg. About 16 KB per 1 s register. Lost on reboot, long-term history is the cloud's job.
- Config revision is sent as ETag. A save with an outdated `If-Match` gets 409.

## Web UI

- Vue 3 + Vite, no UI library. Main bundle about 45 KB gzipped, the Monitor tab with uPlot is a separate 26 KB chunk loaded on first use.
- Overview: per station status, last value time, failed reads, V and I per phase, total power, energy. Registers are matched by units and description. A value older than 3 cycles is marked stale.
- Forms use the same validation as the server (`shared/`).
- Edits are drafts in localStorage until saved. Changes made on the device are merged per field, a clash on the same field asks the user.
- When the connection is lost: banner, status Unknown, saving blocked.

## Registers

- Table sorted by address, showing the 0-based address and 30001/40001 notation. Search by description, units or address. Filter by function code and data type.
- Inline editing. Register size follows from the data type.
- Multi-select (shift-click for a range). Bulk set cycle, byte order, function code, data type, scale or units. Bulk delete.
- Generate range: start, count, type, FC, cycle. Addresses are calculated, description from a pattern (`Register {n}`, `{addr}`, `{modbus}`).
- Copy the map from another station, replacing or appending.
- Import: paste from Excel or load CSV. Columns are matched by header name or taken in a fixed order. Delimiter (tab, `;` or `,`), decimal comma, type aliases and 30001/40001 notation are detected. Preview with row errors; import is blocked until they're fixed.
- Validation from `shared/validate.js`: overlaps within one function code, bad values. Shown per cell and in a list. Save is blocked while there are errors.
- The whole map is one draft and saved with one PUT. About 90 ms per keystroke at 1000 registers.

## Monitor

- Latest values of the station grouped by voltage, current, power, energy and other, with units and the stale marker.
- Charts with uPlot: one chart per unit, so different units never share an axis. Up to 8 registers; the three phase voltages are selected by default, and the choice is remembered per station.
- Ranges 5 min / 15 min / 1 h from `/api/history`. Up to 15 min: raw samples. 1 h: per-minute average line with a min-max band.
- After loading, the chart is updated from the SSE stream; history is fetched again only when the range or selection changes.
- 1 h: `/api/history` also returns `open: {sum, count, last}` for the minute still filling; the client continues it from live values, skipping samples up to `last`. Exact for cycles of 1 s and up; SSE sends one value per register per second, so faster registers are averaged over those.
- A gap longer than 2.5 sample steps is drawn as a gap, both in history and live.
- Min / max / avg for the visible range, the current value and the value at the cursor are shown under each chart.

## Build and deploy

- `npm run build`: type check, Vite build to `web/dist`, then `scripts/compress.js` writes a `.gz` next to each html/js/css file (zlib level 9). The server sends the `.gz` when the browser accepts gzip, so nothing is compressed on the device.
- `npm run release`: build, then `release/embedded-device-config.tar.gz` with `server/`, `shared/`, `web/dist/`, `data/modbus_config.json`, `deploy/` and a minimal `package.json` (`"type": "module"` is required). No `node_modules`: the server has no dependencies. Needs `tar` (Linux, Windows 10+).
- Runtime: Node 18 or newer only. `npm start` or `node server/index.js`, configured with `PORT` and `CONFIG`.
- Install on the device:

```
scp release/embedded-device-config.tar.gz root@device:/tmp/
ssh root@device
tar -xzf /tmp/embedded-device-config.tar.gz -C /opt
cp /opt/embedded-device-config/deploy/embedded-device-config.service /etc/systemd/system/
systemctl enable --now embedded-device-config
```

- `deploy/embedded-device-config.service`: starts on boot, `Restart=always`. Config lives in `/var/lib/embedded-device-config/` (`StateDirectory`), copied from `data/` on first start only, so a new release doesn't overwrite it. Runs as `DynamicUser` in group `dialout` for the serial ports. Adjust the `node` path if it isn't `/usr/bin/node`.
- Upgrade: `rm -rf /opt/embedded-device-config`, extract the new archive, `systemctl restart embedded-device-config`. The config in `/var/lib` stays.
- Size: archive 170 KB, unpacked 356 KB (UI: 75 KB gzipped plus 202 KB uncompressed fallback; config 39 KB).
- Memory with the example config (2 stations, 38 registers polled), one SSE client, measured on Windows x64 with Node 24: RSS 54-55 MB, flat over 5 min since the history buffers are allocated up front. With `node --max-old-space-size=32 --max-semi-space-size=1` about 50 MB. Most of it is the Node runtime itself.
