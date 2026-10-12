import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { minify } from 'terser';

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'source-manifest.json'), 'utf8'));
const readable = (await Promise.all(
  manifest.fragments.map(path => readFile(resolve(root, path), 'utf8'))
)).join('');
new Script(readable, { filename:'SLINK_PDA_Dashboard.source.js' });

const marker = '// ==/UserScript==';
const headerEnd = readable.indexOf(marker);
if (headerEnd < 0) throw new Error('Userscript metadata block is missing.');
const header = readable.slice(0, headerEnd + marker.length);
const body = readable.slice(headerEnd + marker.length);
const result = await minify(body, {
  compress:{ passes:2, unsafe:false },
  mangle:false,
  format:{ comments:false, semicolons:true }
});
if (!result.code) throw new Error('Terser returned an empty PDA build.');
const outputSource = header + '\n' + result.code + '\n';
new Script(outputSource, { filename:manifest.output });
const bytes = Buffer.byteLength(outputSource, 'utf8');
if (bytes > manifest.maxBytes) {
  throw new Error(`${manifest.output} is ${bytes} bytes; PDA safety ceiling is ${manifest.maxBytes}.`);
}
const output = resolve(root, manifest.output);
if (process.argv.includes('--check')) {
  const committed = await readFile(output, 'utf8');
  if (committed !== outputSource) throw new Error(`${manifest.output} is stale. Run npm run build.`);
  console.log(`PDA build verified: ${bytes} bytes.`);
} else {
  await writeFile(output, outputSource, 'utf8');
  console.log(`Built ${manifest.output}: ${bytes} bytes.`);
}
