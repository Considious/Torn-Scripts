import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'source-manifest.json'), 'utf8'));
const source = (await Promise.all(
  manifest.fragments.map(path => readFile(resolve(root, path), 'utf8'))
)).join('');
new Script(source, { filename:manifest.output });
const bytes = Buffer.byteLength(source, 'utf8');
if (bytes > manifest.maxBytes) {
  throw new Error(`${manifest.output} is ${bytes} bytes; PDA limit is ${manifest.maxBytes}. Split source is safe, but the generated userscript must be reduced before publishing.`);
}
const output = resolve(root, manifest.output);
if (process.argv.includes('--check')) {
  const committed = await readFile(output, 'utf8');
  if (committed !== source) throw new Error(`${manifest.output} is stale. Run npm run build.`);
  console.log(`PDA build verified: ${bytes} bytes.`);
} else {
  await writeFile(output, source, 'utf8');
  console.log(`Built ${manifest.output}: ${bytes} bytes.`);
}
