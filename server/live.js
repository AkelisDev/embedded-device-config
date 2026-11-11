const FLUSH_MS = 1000;
const HEARTBEAT_MS = 5000;
const MAX_BUFFERED = 256 * 1024;

const format = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// Server-Sent Events to the browsers. Values are collected and sent once a
// second as one message instead of one message per register.
export class LiveHub {
  constructor(snapshot) {
    this.snapshot = snapshot;
    this.clients = new Set();
    this.values = {};
    this.events = new Map();
    setInterval(() => this.flush(), FLUSH_MS).unref();
    // Lets both sides notice a dead connection (unplugged cable, sleeping laptop).
    // A real event, not an SSE comment, because EventSource hides comments from JS.
    setInterval(() => this.broadcast(format('ping', Date.now())), HEARTBEAT_MS).unref();
  }

  attach(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 3000\n\n');
    res.write(format('snapshot', this.snapshot()));
    this.clients.add(res);
    req.on('close', () => this.clients.delete(res));
  }

  addValues({ t, values }) {
    if (!this.clients.size) return;
    for (const [key, v] of values) this.values[key] = [t, v];
  }

  // Only the latest message of each kind matters, older ones are replaced
  queue(event, data) {
    if (this.clients.size) this.events.set(event, data);
  }

  flush() {
    if (Object.keys(this.values).length) {
      this.broadcast(format('values', this.values));
      this.values = {};
    }
    for (const [event, data] of this.events) this.broadcast(format(event, data));
    this.events.clear();
  }

  broadcast(message) {
    for (const res of this.clients) {
      // A client that stopped reading would make us buffer without limit
      if (res.writableLength > MAX_BUFFERED) {
        res.destroy();
        this.clients.delete(res);
        continue;
      }
      res.write(message);
    }
  }
}
