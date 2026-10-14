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
const version = header.split('\n').find(line => line.startsWith('// @version'))?.slice('// @version'.length).trim();
if (!version) throw new Error('Userscript version is missing.');

const result = await minify(body, {
  compress:{ passes:2, unsafe:false },
  mangle:false,
  format:{ comments:false, semicolons:true }
});
if (!result.code) throw new Error('Terser returned an empty PDA runtime.');

const runtimeSource = '// Generated SLINK PDA runtime ' + version + '. Loaded at startup by the PDA userscript.\n' + result.code + '\n';
new Script(runtimeSource, { filename:manifest.runtimeOutput });

const addonBuilds = await Promise.all((manifest.startupAddons || []).map(async addon => {
  const readableAddon = await readFile(resolve(root, addon.source), 'utf8');
  new Script(readableAddon, { filename:addon.source });
  const minified = await minify(readableAddon, {
    compress:{ passes:2, unsafe:false },
    mangle:false,
    format:{ comments:false, semicolons:true }
  });
  if (!minified.code) throw new Error('Terser returned an empty PDA startup addon: ' + addon.source);
  const source = '// Generated SLINK PDA startup addon ' + version + '.\n' + minified.code + '\n';
  new Script(source, { filename:addon.output });
  const bytes = Buffer.byteLength(source, 'utf8');
  if (bytes > addon.maxBytes) console.warn(addon.output + ' is ' + bytes + ' bytes; advisory addon threshold is ' + addon.maxBytes + '.');
  return { ...addon, source, bytes };
}));

const runtimeUrl = 'https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-PDA/' + manifest.runtimeOutput + '?v=' + encodeURIComponent(version);
const addonUrls = addonBuilds.map(addon => 'https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-PDA/' + addon.output + '?v=' + encodeURIComponent(version));
const loaderBody = [
  '(async () => {',
  "  'use strict';",
  '  const RUNTIME_URL = ' + JSON.stringify(runtimeUrl) + ';',
  '  const ADDON_URLS = ' + JSON.stringify(addonUrls) + ';',
  "  const PDA_API_KEY = String('###PDA-APIKEY###').trim();",
  "  const ERROR_ID = 'slink-pda-runtime-load-error';",
  "  const DATA_STORAGE_KEY = 'slink-pda-dashboard:data:v1';",
  "  const STORAGE_WRITE_EVENT = 'slink-pda-storage-write:' + (globalThis.crypto?.randomUUID?.() || (String(Date.now()) + ':' + Math.random()));",
  '',
  '  function showFailure(error) {',
  "    const message = String(error?.message || error || 'Unknown startup error');",
  "    console.error('SLINK PDA runtime failed to load:', error);",
  '    document.getElementById(ERROR_ID)?.remove();',
  "    const button = document.createElement('button');",
  '    button.id = ERROR_ID;',
  "    button.type = 'button';",
  "    button.textContent = 'SLINK failed: ' + message.slice(0, 120) + ' — tap to retry';",
  '    button.title = message;',
  "    button.style.cssText = 'position:fixed;right:10px;bottom:76px;z-index:2147483647;padding:10px 12px;border:2px solid #111;border-radius:8px;background:#b91c1c;color:#fff;font:bold 12px Arial,sans-serif';",
  '    button.addEventListener(\'click\', () => {',
  '      button.remove();',
  '      void loadRuntime();',
  '    });',
  '    (document.body || document.documentElement).appendChild(button);',
  '  }',
  '',
  '  function isRecord(value) {',
  "    return Boolean(value && typeof value === 'object' && !Array.isArray(value));",
  '  }',
  '',
  '  function readPersistedData() {',
  "    try {",
  "      const value = typeof globalThis.GM_getValue === 'function' ? globalThis.GM_getValue(DATA_STORAGE_KEY, {}) : {};",
  "      return isRecord(value) && !(value && typeof value.then === 'function') ? value : {};",
  "    } catch { return {}; }",
  '  }',
  '',
  '  function collectBootstrap() {',
  '    return { [DATA_STORAGE_KEY]:readPersistedData(), storageWriteEvent:STORAGE_WRITE_EVENT };',
  '  }',
  '',
  '  function installStorageBridge() {',
  '    document.addEventListener(STORAGE_WRITE_EVENT, event => {',
  '      try {',
  "        const payload = JSON.parse(String(event?.detail || ''));",
  '        if (!isRecord(payload) || payload.key !== DATA_STORAGE_KEY) return;',
  '        if (payload.remove) {',
  "          if (typeof globalThis.GM_deleteValue === 'function') globalThis.GM_deleteValue(DATA_STORAGE_KEY);",
  '          return;',
  '        }',
  "        if (typeof globalThis.GM_setValue === 'function') globalThis.GM_setValue(DATA_STORAGE_KEY, payload.value);",
  '      } catch {}',
  '    });',
  '  }',
  '',
  '  async function fetchSource(url) {',
  "    if (typeof globalThis.PDA_httpGet === 'function') {",
  '      const response = await globalThis.PDA_httpGet(url);',
  "      return String(response?.data ?? response?.responseText ?? '');",
  '    }',
  "    if (typeof globalThis.GM_xmlhttpRequest === 'function') {",
  '      return await new Promise((resolve, reject) => {',
  '        globalThis.GM_xmlhttpRequest({',
  "          method:'GET',",
  '          url:url,',
  '          timeout:15000,',
  "          onload:response => response.status >= 200 && response.status < 300 ? resolve(String(response.responseText || '')) : reject(new Error('Runtime download returned HTTP ' + response.status + '.')),",
  "          onerror:() => reject(new Error('Runtime download failed.')),",
  "          ontimeout:() => reject(new Error('Runtime download timed out.'))",
  '        });',
  '      });',
  '    }',
  "    throw new Error('PDA_httpGet is unavailable.');",
  '  }',
  '',
  '  async function fetchRuntime() {',
  '    const [runtimeSource, ...addonSources] = await Promise.all([',
  '      fetchSource(RUNTIME_URL),',
  '      ...ADDON_URLS.map(url => fetchSource(url))',
  '    ]);',
  "    if (runtimeSource.length < 1000) throw new Error('Downloaded runtime was empty or incomplete.');",
  '    addonSources.forEach((source, index) => {',
  "      if (source.length < 100) throw new Error('Downloaded startup add-on ' + (index + 1) + ' was empty or incomplete.');",
  '    });',
  '    return { runtimeSource, addonSources };',
  '  }',
  '',
  '  async function executeRuntime(source) {',
  "    if (typeof globalThis.PDA_evaluateJavascript === 'function') {",
  '      await globalThis.PDA_evaluateJavascript(source);',
  '      return;',
  '    }',
  '    (0, eval)(source);',
  '  }',
  '',
  '  async function loadRuntime() {',
  '    try {',
  "      const currentHost = document.getElementById('slink-pda-dashboard-host');",
  "      const runtimeReady = currentHost?.dataset?.slinkReady === 'true';",
  '      if (runtimeReady && globalThis.__SLINK_PDA_ADDONS_READY__ === true) {',
  '        document.getElementById(ERROR_ID)?.remove();',
  '        return;',
  '      }',
  '      const { runtimeSource, addonSources } = await fetchRuntime();',
  "      const bootstrapSource = 'globalThis.__SLINK_PDA_BOOTSTRAP__=' + JSON.stringify(collectBootstrap()) + ';';",
  "      const executableSources = ['globalThis.__SLINK_PDA_ADDONS_READY__=false;'];",
  '      if (!runtimeReady) {',
  "        executableSources.push(bootstrapSource + runtimeSource.split('###PDA-APIKEY###').join(PDA_API_KEY) + '\\n//# sourceURL=SLINK_PDA_Runtime.js\\n');",
  '      }',
  '      addonSources.forEach((source, index) => {',
  "        executableSources.push(source.split('###PDA-APIKEY###').join(PDA_API_KEY) + '\\n//# sourceURL=SLINK_PDA_Addon_' + (index + 1) + '.js\\n');",
  '      });',
  "      executableSources.push('globalThis.__SLINK_PDA_ADDONS_READY__=true;');",
  "      await executeRuntime(executableSources.join('\\n;\\n'));",
  '      const readyDeadline = Date.now() + 15_000;',
  '      while (Date.now() < readyDeadline) {',
  "        const readyHost = document.getElementById('slink-pda-dashboard-host');",
  "        if (readyHost?.dataset?.slinkReady === 'true' && globalThis.__SLINK_PDA_ADDONS_READY__ === true) {",
  '          document.getElementById(ERROR_ID)?.remove();',
  '          return;',
  '        }',
  '        await new Promise(resolve => globalThis.setTimeout(resolve, 100));',
  '      }',
  "      throw new Error('Runtime did not signal readiness within 15 seconds.');",
  '    } catch (error) {',
  '      showFailure(error);',
  '    }',
  '  }',
  '',
  '  installStorageBridge();',
  '  await loadRuntime();',
  '})();',
  ''
].join('\n');
new Script(loaderBody, { filename:manifest.output });
const loaderSource = header + '\n' + loaderBody;

const runtimeBytes = Buffer.byteLength(runtimeSource, 'utf8');
const loaderBytes = Buffer.byteLength(loaderSource, 'utf8');
const addonSummary = addonBuilds.map(addon => addon.output + ' ' + addon.bytes + ' bytes').join('; ');
if (runtimeBytes > manifest.runtimeMaxBytes) {
  console.warn(manifest.runtimeOutput + ' is ' + runtimeBytes + ' bytes; advisory runtime threshold is ' + manifest.runtimeMaxBytes + '.');
}
if (loaderBytes > manifest.loaderMaxBytes) {
  throw new Error(manifest.output + ' is ' + loaderBytes + ' bytes; loader ceiling is ' + manifest.loaderMaxBytes + '.');
}

const loaderPath = resolve(root, manifest.output);
const runtimePath = resolve(root, manifest.runtimeOutput);
const addonPaths = addonBuilds.map(addon => resolve(root, addon.output));
if (process.argv.includes('--check')) {
  const [committedLoader, committedRuntime, ...committedAddons] = await Promise.all([
    readFile(loaderPath, 'utf8'),
    readFile(runtimePath, 'utf8'),
    ...addonPaths.map(path => readFile(path, 'utf8'))
  ]);
  if (committedLoader !== loaderSource) throw new Error(manifest.output + ' is stale. Run npm run build.');
  if (committedRuntime !== runtimeSource) throw new Error(manifest.runtimeOutput + ' is stale. Run npm run build.');
  addonBuilds.forEach((addon,index) => {
    if (committedAddons[index] !== addon.source) throw new Error(addon.output + ' is stale. Run npm run build.');
  });
  console.log('PDA startup-loader build verified: loader ' + loaderBytes + ' bytes; external runtime ' + runtimeBytes + ' bytes; addons ' + addonSummary + '.');
} else {
  await Promise.all([
    writeFile(loaderPath, loaderSource, 'utf8'),
    writeFile(runtimePath, runtimeSource, 'utf8'),
    ...addonBuilds.map((addon,index) => writeFile(addonPaths[index], addon.source, 'utf8'))
  ]);
  console.log('Built PDA startup loader: ' + loaderBytes + ' bytes; external runtime: ' + runtimeBytes + ' bytes; addons: ' + addonSummary + '.');
}
