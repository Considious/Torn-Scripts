import assert from 'node:assert/strict';
import fs from 'node:fs';

const core = fs.readFileSync(new URL('./src/00-runtime-core.part', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('./src/90-shell-bootstrap.part', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('./source-manifest.json', import.meta.url), 'utf8'));
const launcher = fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js', import.meta.url), 'utf8');

assert.equal(manifest.revision, '0.4.78');
assert.match(launcher, /@version\s+0\.4\.78/);
assert.match(core, /THEME_ASSET_ORIGIN/);
assert.match(core, /normalizeThemeAssets/);
assert.match(core, /Theme .* disallowed .* asset URL/);
assert.match(core, /15 \* 60_000/);
assert.match(shell, /data-theme-image="true"/);
assert.match(shell, /data-theme-icons="true"/);
assert.match(shell, /--s-theme-background-image/);
assert.match(shell, /--s-theme-icon-sheet/);
assert.match(shell, /background-size:400% 500%/);
assert.match(shell, /definition\.assets\?\.background/);
assert.match(shell, /definition\.assets\?\.iconSheet/);
assert.match(shell, /host\.dataset\.themeImage/);
assert.match(shell, /host\.dataset\.themeIcons/);
assert.match(core, /themePanelOpacity: 87/);
assert.match(shell, /data-theme-panel-opacity/);
assert.match(shell, /--s-theme-panel-opacity/);
assert.match(shell, /syncThemePanelOpacityControls/);
assert.match(shell, /min="0" max="100" step="1"/);
assert.match(shell, /themePanelOpacityDrag/);
assert.match(shell, /--s-theme-panel-blur/);
assert.match(shell, /--s-theme-veil-top/);

console.log('SLINK PDA image-backed theme checks passed.');

