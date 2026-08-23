import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertFile(relativePath) {
  assert(fs.existsSync(path.join(root, relativePath)), `Missing extension file: ${relativePath}`);
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

const manifest = JSON.parse(read('manifest.json'));
const packageJson = JSON.parse(read('package.json'));

assert(manifest.manifest_version === 3, 'The extension must use Manifest V3.');
assert(manifest.version === packageJson.version, 'Manifest and package versions must match.');
assert(!JSON.stringify(manifest).includes('<all_urls>'), 'The extension must not request <all_urls>.');
assert(manifest.permissions.includes('storage'), 'Storage permission is required.');
assert(manifest.permissions.includes('alarms'), 'Alarms permission is required.');
assert(manifest.host_permissions.length === 1 && manifest.host_permissions[0] === 'https://www.torn.com/*', 'Required host access must remain Torn-only.');

assertFile(manifest.background.service_worker);
assertFile(manifest.action.default_popup);
for (const entry of manifest.content_scripts) {
  for (const script of entry.js || []) assertFile(script);
  for (const stylesheet of entry.css || []) assertFile(stylesheet);
}

const backgroundPath = path.join(root, manifest.background.service_worker);
const backgroundSource = fs.readFileSync(backgroundPath, 'utf8');
for (const match of backgroundSource.matchAll(/['"]([^'"]+\.js)['"]/g)) {
  if (!match[1].startsWith('.')) continue;
  const importedPath = path.resolve(path.dirname(backgroundPath), match[1]);
  assert(fs.existsSync(importedPath), `Missing service-worker import: ${match[1]}`);
}

const popupHtml = read(manifest.action.default_popup);
for (const match of popupHtml.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const reference = match[1];
  if (/^(?:https?:|#)/.test(reference)) continue;
  const resolved = path.resolve(path.dirname(path.join(root, manifest.action.default_popup)), reference);
  assert(fs.existsSync(resolved), `Missing popup resource: ${reference}`);
}

for (const file of listFiles(path.join(root, 'src')).filter(file => file.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(file, 'utf8'), { filename: path.relative(root, file) });
}

const runtimeSource = read('src/core/runtime.js');
assert(runtimeSource.includes(`const VERSION = '${manifest.version}'`), 'Core runtime version must match the manifest.');

console.log(`Validated Manifest V3 extension ${manifest.version} (${listFiles(path.join(root, 'src')).length} source files).`);
