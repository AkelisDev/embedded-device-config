import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Serves the built UI. Files are gzipped at build time, so the device never
// has to compress anything at runtime.
export function createStatic(root) {
  return async function serve(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    let file = normalize(join(root, decodeURIComponent(pathname)));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      return res.end();
    }

    const isFile = await stat(file).then((s) => s.isFile(), () => false);
    if (!isFile) file = join(root, 'index.html');

    const headers = {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    };

    let body;
    if (/\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      body = await readFile(file + '.gz').catch(() => null);
      if (body) headers['Content-Encoding'] = 'gzip';
    }
    body ??= await readFile(file).catch(() => null);

    if (!body) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, headers);
    res.end(body);
  };
}
