## Monitoring

Monitoring. There’s no real Modbus communication, so a simulator takes the poller’s place. It reads each station’s registers in groups by acquisition cycle, like a real gateway, and produces believable values: voltage around 230 V, a changing load, power that matches voltage and current, and energy counters that only go up. Scale, units and data type are applied the same way as for a real register. Now and then a meter stops answering, so the timeout handling can be seen: that station is marked as timed out, its values go stale, and the other meters keep working.

The browser gets the latest values over Server-Sent Events, once per second in a single message. Recent history is kept in a fixed-size RAM buffer: the last 15 minutes at full resolution and the last hour as per-minute min/max/avg. That’s roughly 16 KB for a register read every second and less for slower ones, and memory doesn’t grow while running. History is lost on reboot, which is fine for a short diagnostic view: long-term history belongs in the cloud, and constant writes would wear out the flash.

Every config response carries a revision. The UI sends it back when saving, and if the config changed in the meantime (from another laptop, or while the browser was disconnected), the save is refused instead of overwriting the newer version.
