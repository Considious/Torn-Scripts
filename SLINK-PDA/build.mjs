import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'source-manifest.json'), 'utf8'));
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (manifest.mode !== 'direct-source') throw new Error('PDA manifest must use direct-source mode.');
if (!Array.isArray(manifest.fragments) || !manifest.fragments.length) throw new Error('PDA manifest has no runtime fragments.');

const runtimeSources = await Promise.all(
  manifest.fragments.map(path => readFile(resolve(root, path), 'utf8'))
);
const runtimeSource = runtimeSources.join('');
new Script(runtimeSource, { filename:'SLINK_PDA_Direct_Runtime.js' });

const addonSources = await Promise.all((manifest.startupAddons || []).map(async addon => {
  const source = await readFile(resolve(root, addon.source), 'utf8');
  new Script(source, { filename:addon.source });
  return { path:addon.source, source, bytes:Buffer.byteLength(source, 'utf8') };
}));

const loaderPath = resolve(root, manifest.output || 'SLINK_PDA_Dashboard.user.js');
let loaderSource = await readFile(loaderPath, 'utf8');
const sourceRevision = 'sha256-' + createHash('sha256')
  .update([runtimeSource, ...addonSources.map(addon => addon.source)].join('\n;\n'), 'utf8')
  .digest('hex');
if (process.argv.includes('--write')) {
  manifest.revision = sourceRevision;
  await writeFile(resolve(root, 'source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  loaderSource = loaderSource.replace(
    'JSON.stringify(await collectBootstrap())',
    'JSON.stringify({...await collectBootstrap(),sourceRevision:e.revision})'
  ).replace(/^\/\/ @version\s+.+$/m, '// @version      ' + packageJson.version);
  await writeFile(loaderPath, loaderSource, 'utf8');
} else {
  if (manifest.revision !== sourceRevision) {
    throw new Error('PDA source manifest digest is stale. Run node build.mjs --write after editing runtime/add-on source.');
  }
}
if (!loaderSource.includes('JSON.stringify({...await collectBootstrap(),sourceRevision:e.revision})')) {
  throw new Error('PDA loader must pass the manifest content revision into the runtime bootstrap.');
}
new Script(loaderSource, { filename:loaderPath });
if (!loaderSource.includes('source-manifest.json')) {
  throw new Error('PDA loader is not configured for direct source loading.');
}
if (!loaderSource.includes('slink-pda-dashboard:runtime-cache:audit-test:v1')) {
  throw new Error('PDA loader is missing the last-known-working runtime cache.');
}
if (loaderSource.includes('SLINK_PDA_Runtime.js?v=')) {
  throw new Error('PDA loader still depends on the generated runtime.');
}
if (!loaderSource.includes('raw.githubusercontent.com/Considious/Torn-Scripts/audit/test-foundation/SLINK-PDA/')) {
  throw new Error('PDA loader must follow the installable testing branch instead of a pinned historical commit.');
}
if (/Torn-Scripts\/[a-f0-9]{40}\/SLINK-PDA\//.test(loaderSource)) {
  throw new Error('PDA loader still pins runtime downloads to an immutable historical commit.');
}
const loaderVersion = loaderSource.match(/^\/\/ @version\s+(.+)$/m)?.[1]?.trim();
if (!loaderVersion || loaderVersion !== String(packageJson.version || '')) {
  throw new Error('PDA installer version must match the single package version.');
}
if (runtimeSource.includes("const CLIENT_VERSION = '0.") || runtimeSource.includes("const BUILD = '0.")) {
  throw new Error('PDA runtime must use its manifest content revision, not a separately synchronized version literal.');
}
const loaderBytes = Buffer.byteLength(loaderSource, 'utf8');
console.log(
  'PDA direct-source loader verified: launcher ' + loaderBytes +
  ' bytes (measurement only; no assumed PDA source limit); runtime ' + Buffer.byteLength(runtimeSource, 'utf8') +
  ' bytes across ' + runtimeSources.length + ' fragments; addons ' +
  addonSources.map(addon => addon.path + ' ' + addon.bytes + ' bytes').join('; ') +
  '; source revision ' + sourceRevision.slice(0, 20) + '.'
);
