import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js', import.meta.url), 'utf8');
const preview = fs.readFileSync(new URL('./preview.html', import.meta.url), 'utf8');

assert.match(source, /@version\s+0\.1\.0/);
assert.match(source, /@grant\s+none/);
assert.doesNotMatch(source, /@require\b/);
assert.match(source, /viewport-fit=cover|safe-area-inset/);
assert.match(source, /grid-template-columns:minmax\(0,1fr\)/);
assert.match(source, /\.scroll\{min-width:0;min-height:0/);
assert.match(source, /data-open="true"\]:not\(\[data-positioned="true"\]\)/);
assert.match(source, /orientation:landscape[\s\S]*position:absolute;top:50px;right:0/);
assert.match(source, /data-action="reset-layout"/);
assert.match(source, /orientationchange/);
assert.match(source, /MutationObserver/);
assert.match(source, /dashboardOpen = false/);
assert.match(source, /data-page="combat"/);
assert.match(source, /data-page="efficiency"/);
assert.match(source, /data-page="access"/);
assert.match(source, /data-combat-tab="leveling"/);
assert.match(source, /data-efficiency-tab="merits"/);
assert.doesNotMatch(source, /\bfetch\s*\(/);
assert.doesNotMatch(source, /PDA_http(?:Get|Post|Put|Delete)\s*\(/);
assert.doesNotMatch(source, /GM_xmlhttpRequest\s*\(/);
assert.doesNotMatch(source, /location\.(?:reload|replace|assign)\s*\(/);
assert.doesNotMatch(source, /chrome\.(?:runtime|storage|alarms)/);
assert.match(preview, /SLINK_PDA_Dashboard\.user\.js/);

console.log('SLINK PDA overlay static safety and recovery checks passed.');
