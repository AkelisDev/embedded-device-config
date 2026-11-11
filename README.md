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

- Vue 3 + Vite, no UI library, about 36 KB gzipped.
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
