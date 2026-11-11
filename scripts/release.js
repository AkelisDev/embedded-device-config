import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const NAME = 'embedded-device-config';
const out = join(root, 'release');
const stage = join(out, NAME);

// The server has no dependencies, so node_modules stays on the build PC
const FILES = ['server', 'shared', 'web/dist', 'data/modbus_config.json', 'deploy'];

if (!existsSync(join(root, 'web/dist/index.html.gz'))) {
  console.error('Run npm run build first');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
for (const path of FILES) cpSync(join(root, path), join(stage, path), { recursive: true });

// Only what running needs; "type": "module" is what makes Node load the ES modules
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const runtime = { name: pkg.name, private: true, type: pkg.type, engines: pkg.engines, scripts: { start: pkg.scripts.start } };
writeFileSync(join(stage, 'package.json'), JSON.stringify(runtime, null, 2) + '\n');

// Relative paths: GNU tar would read "C:\..." as a remote host
const archive = `${NAME}.tar.gz`;
const tar = spawnSync('tar', ['-czf', archive, NAME], { cwd: out, stdio: 'inherit' });
if (tar.status !== 0) process.exit(tar.status ?? 1);
rmSync(stage, { recursive: true });
console.log(join(out, archive));
