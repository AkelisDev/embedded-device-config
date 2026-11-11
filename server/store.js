import { readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { parseConfig, serializeConfig } from '../shared/convert.js';

// The revision is a hash of the saved file, not a counter: it survives a
// reboot without an extra file, and doesn't depend on the clock (many devices
// have no RTC battery).
const revisionOf = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12);

export class ConfigStore extends EventEmitter {
  constructor(path) {
    super();
    this.path = path;
    this.revision = '';
    this.channels = [];
    this.pending = Promise.resolve();
  }

  async load() {
    this.channels = parseConfig(JSON.parse(await readFile(this.path, 'utf8')));
    this.revision = revisionOf(this.serialize());
  }

  serialize() {
    return JSON.stringify(serializeConfig(this.channels), null, 4);
  }

  // Write to a temp file and rename it over the original, so a power cut in the
  // middle of saving can't leave a broken config. Previous version goes to .bak.
  save() {
    this.pending = this.pending.then(async () => {
      const tmp = this.path + '.tmp';
      const text = this.serialize();
      await writeFile(tmp, text);
      await copyFile(this.path, this.path + '.bak').catch(() => {});
      await rename(tmp, this.path);
      this.revision = revisionOf(text);
      this.emit('change');
    });
    return this.pending;
  }

  channel(id) {
    return this.channels.find((c) => c.id === id);
  }

  station(channelId, stationId) {
    return this.channel(channelId)?.stations.find((s) => s.id === stationId);
  }
}
