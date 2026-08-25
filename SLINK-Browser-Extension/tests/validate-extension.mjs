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
assert(
  manifest.host_permissions.length === 6 &&
  manifest.host_permissions.includes('https://www.torn.com/*') &&
  manifest.host_permissions.includes('https://api.torn.com/*') &&
  manifest.host_permissions.includes('https://ffscouter.com/*') &&
  manifest.host_permissions.includes('https://slinkyleveling.richard-johnson554.workers.dev/*') &&
  manifest.host_permissions.includes('https://slinkcontributionworker.richard-johnson554.workers.dev/*') &&
  manifest.host_permissions.includes('https://slinkwarworker.richard-johnson554.workers.dev/*'),
  'Required host access must include Torn, Torn API, FFScouter, and all SLINK Workers.'
);
assert(
  !Object.prototype.hasOwnProperty.call(manifest, 'optional_host_permissions'),
  'Core SLINK services must not be presented as optional access.'
);

assertFile(manifest.background.service_worker);
assertFile(manifest.action.default_popup);
assertFile(manifest.options_ui.page);
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

for (const page of [manifest.action.default_popup, manifest.options_ui.page]) {
  const html = read(page);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const reference = match[1];
    if (/^(?:https?:|#)/.test(reference)) continue;
    const resolved = path.resolve(path.dirname(path.join(root, page)), reference);
    assert(fs.existsSync(resolved), `Missing extension-page resource: ${reference}`);
  }
}

for (const file of listFiles(path.join(root, 'src')).filter(file => file.endsWith('.js'))) {
  const source = fs.readFileSync(file, 'utf8');
  new vm.Script(source, { filename: path.relative(root, file) });
  assert(!source.includes('chrome.permissions.request'), 'Core SLINK hosts must not require runtime permission buttons.');
}

assert(!read(manifest.action.default_popup).includes('Optional access'), 'Popup must not present core services as optional.');

const runtimeSource = read('src/core/runtime.js');
assert(runtimeSource.includes(`const VERSION = '${manifest.version}'`), 'Core runtime version must match the manifest.');

console.log(`Validated Manifest V3 extension ${manifest.version} (${listFiles(path.join(root, 'src')).length} source files).`);
