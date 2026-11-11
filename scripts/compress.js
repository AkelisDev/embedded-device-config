import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync, constants } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json']);
const dist = fileURLToPath(new URL('../web/dist', import.meta.url));

// Compressed once here at maximum level, so the device only reads files
function compress(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) compress(file);
    else if (COMPRESSIBLE.has(extname(file))) {
      const data = readFileSync(file);
      const gz = gzipSync(data, { level: constants.Z_BEST_COMPRESSION });
      if (gz.length < data.length) writeFileSync(file + '.gz', gz);
    }
  }
}

compress(dist);
