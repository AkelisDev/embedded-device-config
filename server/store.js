import { readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { parseConfig, serializeConfig } from '../shared/convert.js';

export class ConfigStore {
  constructor(path) {
    this.path = path;
    this.channels = [];
    this.pending = Promise.resolve();
  }

  async load() {
    this.channels = parseConfig(JSON.parse(await readFile(this.path, 'utf8')));
  }

  // Write to a temp file and rename it over the original, so a power cut in the
  // middle of saving can't leave a broken config. Previous version goes to .bak.
  save() {
    this.pending = this.pending.then(async () => {
      const tmp = this.path + '.tmp';
      await writeFile(tmp, JSON.stringify(serializeConfig(this.channels), null, 4));
      await copyFile(this.path, this.path + '.bak').catch(() => {});
      await rename(tmp, this.path);
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
