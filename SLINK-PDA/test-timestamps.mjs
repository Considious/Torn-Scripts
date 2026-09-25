import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js', import.meta.url), 'utf8');
const start = source.indexOf('  function discordTimestamp(');
assert(start >= 0);
const context = vm.createContext({ Date });
vm.runInContext(source.slice(start, source.indexOf('\n  }', start) + 4), context);
const convert = context.discordTimestamp;
assert.equal(convert('1970-01-01T00:00').code, '<t:0:R>');
for (const invalid of ['', '2026-02-30T10:00', '2026-09-25T24:00', '2026-09-25T10:99', '2026-09-25', '2026-09-25T10:00Z']) assert.equal(convert(invalid), null);
assert(convert('2024-02-29T12:00'), 'Valid leap day rejected');
assert.equal(convert('2026-09-25T18:00').code, `<t:${Date.UTC(2026, 8, 25, 18) / 1000}:R>`);

const previousZone = process.env.TZ;
try {
  process.env.TZ = 'America/Denver';
  assert.match(convert('2026-07-01T18:00').local, /12:00/, 'Summer TCT conversion must apply daylight saving');
  assert.match(convert('2026-01-01T18:00').local, /11:00/, 'Winter conversion must use standard time');
  const denverCode = convert('2026-09-25T18:00').code;
  process.env.TZ = 'Asia/Kathmandu';
  assert.equal(convert('2026-09-25T18:00').code, denverCode, 'Discord instant must not depend on local timezone');
  assert.match(convert('2026-09-25T18:00').local, /(?:11|23):45/, 'Fractional-hour timezone conversion failed');
} finally {
  if (previousZone === undefined) delete process.env.TZ; else process.env.TZ = previousZone;
}
console.log('TCT-to-local conversion, relative Discord format, DST, fractional timezones and invalid-date checks passed.');
