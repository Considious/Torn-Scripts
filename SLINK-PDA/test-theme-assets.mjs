import assert from 'node:assert/strict';
import fs from 'node:fs';

const core = fs.readFileSync(new URL('./src/00-runtime-core.part', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('./src/90-shell-bootstrap.part', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('./source-manifest.json', import.meta.url), 'utf8'));
const launcher = fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js', import.meta.url), 'utf8');

assert.equal(manifest.revision, '0.4.73');
assert.match(launcher, /@version\s+0\.4\.73/);
assert.match(core, /THEME_ASSET_ORIGIN/);
assert.match(core, /normalizeThemeAssets/);
assert.match(core, /Theme .* disallowed .* asset URL/);
assert.match(shell, /data-theme="halloween-2026"/);
assert.match(shell, /--s-theme-background-image/);
assert.match(shell, /--s-theme-icon-sheet/);
assert.match(shell, /background-size:400% 500%/);
assert.match(shell, /definition\.assets\?\.background/);
assert.match(shell, /definition\.assets\?\.iconSheet/);

console.log('SLINK PDA image-backed theme checks passed.');