import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'source-manifest.json'), 'utf8'));
if (manifest.mode !== 'direct-source') throw new Error('PDA manifest must use direct-source mode.');
if (!Array.isArray(manifest.fragments) || !manifest.fragments.length) throw new Error('PDA manifest has no runtime fragments.');

const runtimeSources = await Promise.all(
  manifest.fragments.map(path => readFile(resolve(root, path), 'utf8'))
);
const runtimeSource = runtimeSources.join('');
new Script(runtimeSource, { filename:'SLINK_PDA_Direct_Runtime.js' });

const addons = await Promise.all((manifest.startupAddons || []).map(async addon => {
  const source = await readFile(resolve(root, addon.source), 'utf8');
  new Script(source, { filename:addon.source });
  return { path:addon.source, bytes:Buffer.byteLength(source, 'utf8') };
}));

const loaderPath = resolve(root, manifest.output || 'SLINK_PDA_Dashboard.user.js');
const loaderSource = await readFile(loaderPath, 'utf8');
new Script(loaderSource, { filename:loaderPath });
if (!loaderSource.includes("const MANIFEST_URL = SOURCE_ROOT + 'source-manifest.json';")) {
  throw new Error('PDA loader is not configured for direct source loading.');
}
if (!loaderSource.includes("const RUNTIME_CACHE_KEY = 'slink-pda-dashboard:runtime-cache:v1';")) {
  throw new Error('PDA loader is missing the last-known-working runtime cache.');
}
if (loaderSource.includes('SLINK_PDA_Runtime.js?v=')) {
  throw new Error('PDA loader still depends on the generated runtime.');
}
const loaderVersion = loaderSource.match(/^\/\/ @version\s+(.+)$/m)?.[1]?.trim();
if (!loaderVersion || loaderVersion !== String(manifest.revision || '')) {
  throw new Error('PDA loader version and source-manifest revision must match.');
}
if (!runtimeSource.includes("const CLIENT_VERSION = '" + loaderVersion + "';")) {
  throw new Error('PDA runtime client version must match the launcher.');
}
const loaderBytes = Buffer.byteLength(loaderSource, 'utf8');
if (loaderBytes > Number(manifest.loaderMaxBytes || 18000)) {
  throw new Error('PDA launcher exceeds its size ceiling: ' + loaderBytes + ' bytes.');
}
console.log(
  'PDA direct-source loader verified: launcher ' + loaderBytes +
  ' bytes; runtime ' + Buffer.byteLength(runtimeSource, 'utf8') +
  ' bytes across ' + runtimeSources.length + ' fragments; addons ' +
  addons.map(addon => addon.path + ' ' + addon.bytes + ' bytes').join('; ') + '.'
);
