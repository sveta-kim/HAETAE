import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
for (const dir of ['src', 'scripts', 'tests']) {
  for (const file of await readdir(new URL(`../${dir}/`, import.meta.url))) {
    if (!/\.(m?js)$/.test(file)) continue;
    const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(`../${dir}/${file}`, import.meta.url))], { encoding: 'utf8' });
    if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
  }
}
console.log('All JavaScript syntax checks passed.');
