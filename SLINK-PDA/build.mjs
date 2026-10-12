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
const version = header.match(/^\\/\\/ @version\\s+(.+)$/m)?.[1]?.trim();
if (!version) throw new Error('Userscript version is missing.');

const result = await minify(body, {
  compress:{ passes:2, unsafe:false },
  mangle:false,
  format:{ comments:false, semicolons:true }
});
if (!result.code) throw new Error('Terser returned an empty PDA runtime.');

const runtimeSource = '// Generated SLINK PDA runtime ' + version + '. Loaded at startup by the PDA userscript.\\n' + result.code + '\\n';
new Script(runtimeSource, { filename:manifest.runtimeOutput });

const runtimeUrl = 'https://raw.githubusercontent.com/Considious/Torn-Scripts/main/SLINK-PDA/' + manifest.runtimeOutput + '?v=' + encodeURIComponent(version);
const loaderBody = [
  '(async () => {',
  "  'use strict';",
  '  const RUNTIME_URL = ' + JSON.stringify(runtimeUrl) + ';',
  "  const PDA_API_KEY = String('###PDA-APIKEY###').trim();",
  "  const ERROR_ID = 'slink-pda-runtime-load-error';",
  '',
  '  function showFailure(error) {',
  "    const message = String(error?.message || error || 'Unknown startup error');",
  "    console.error('SLINK PDA runtime failed to load:', error);",
  '    document.getElementById(ERROR_ID)?.remove();',
  "    const button = document.createElement('button');",
  '    button.id = ERROR_ID;',
  "    button.type = 'button';",
  "    button.textContent = 'SLINK failed to load — tap to retry';",
  '    button.title = message;',
  "    button.style.cssText = 'position:fixed;right:10px;bottom:76px;z-index:2147483647;padding:10px 12px;border:2px solid #111;border-radius:8px;background:#b91c1c;color:#fff;font:bold 12px Arial,sans-serif';",
  '    button.addEventListener(\'click\', () => {',
  '      button.remove();',
  '      void loadRuntime();',
  '    });',
  '    (document.body || document.documentElement).appendChild(button);',
  '  }',
  '',
  '  async function fetchRuntime() {',
  "    if (typeof globalThis.PDA_httpGet === 'function') {",
  '      const response = await globalThis.PDA_httpGet(RUNTIME_URL);',
  "      return String(response?.data ?? response?.responseText ?? '');",
  '    }',
  "    if (typeof globalThis.GM_xmlhttpRequest === 'function') {",
  '      return await new Promise((resolve, reject) => {',
  '        globalThis.GM_xmlhttpRequest({',
  "          method:'GET',",
  '          url:RUNTIME_URL,',
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
  "      if (globalThis.SLINK_PDA_DASHBOARD?.build === '0.4.43-external-runtime') {",
  '        globalThis.SLINK_PDA_DASHBOARD.open?.();',
  '        return;',
  '      }',
  '      const downloaded = await fetchRuntime();',
  "      if (downloaded.length < 1000) throw new Error('Downloaded runtime was empty or incomplete.');",
  "      const hydrated = downloaded.split('###PDA-APIKEY###').join(PDA_API_KEY) + '\\n//# sourceURL=SLINK_PDA_Runtime.js';",
  '      await executeRuntime(hydrated);',
  "      if (!globalThis.SLINK_PDA_DASHBOARD) throw new Error('Runtime executed without initializing SLINK.');",
  '      document.getElementById(ERROR_ID)?.remove();',
  '    } catch (error) {',
  '      showFailure(error);',
  '    }',
  '  }',
  '',
  '  await loadRuntime();',
  '})();',
  ''
].join('\\n');
new Script(loaderBody, { filename:manifest.output });
const loaderSource = header + '\\n' + loaderBody;

const runtimeBytes = Buffer.byteLength(runtimeSource, 'utf8');
const loaderBytes = Buffer.byteLength(loaderSource, 'utf8');
if (runtimeBytes > manifest.runtimeMaxBytes) {
  throw new Error(manifest.runtimeOutput + ' is ' + runtimeBytes + ' bytes; runtime ceiling is ' + manifest.runtimeMaxBytes + '.');
}
if (loaderBytes > manifest.loaderMaxBytes) {
  throw new Error(manifest.output + ' is ' + loaderBytes + ' bytes; loader ceiling is ' + manifest.loaderMaxBytes + '.');
}

const loaderPath = resolve(root, manifest.output);
const runtimePath = resolve(root, manifest.runtimeOutput);
if (process.argv.includes('--check')) {
  const [committedLoader, committedRuntime] = await Promise.all([
    readFile(loaderPath, 'utf8'),
    readFile(runtimePath, 'utf8')
  ]);
  if (committedLoader !== loaderSource) throw new Error(manifest.output + ' is stale. Run npm run build.');
  if (committedRuntime !== runtimeSource) throw new Error(manifest.runtimeOutput + ' is stale. Run npm run build.');
  console.log('PDA startup-loader build verified: loader ' + loaderBytes + ' bytes; external runtime ' + runtimeBytes + ' bytes.');
} else {
  await Promise.all([
    writeFile(loaderPath, loaderSource, 'utf8'),
    writeFile(runtimePath, runtimeSource, 'utf8')
  ]);
  console.log('Built PDA startup loader: ' + loaderBytes + ' bytes; external runtime: ' + runtimeBytes + ' bytes.');
}
