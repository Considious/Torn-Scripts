import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./SLINK_PDA_Runtime.js', import.meta.url), 'utf8');

assert(source.includes('function protectEditableState(root)'), 'PDA must install one shared editable-state guard.');
assert(source.includes("const selector = 'input,textarea,select,[contenteditable=\"true\"],details'"), 'PDA guard must cover fields, selectors, checkboxes, editable text, and open sections.');
assert(source.includes('new MutationObserver(scheduleRestore)'), 'PDA must restore dirty controls after background re-renders.');
assert(source.includes('focusTarget.focus({ preventScroll:true })'), 'PDA must restore focus without forcing the WebView to scroll.');
assert(/editableState\s*=\s*protectEditableState\(shadow\)/.test(source), 'The guard must protect the complete PDA dashboard shadow root.');
assert(source.includes('function installModuleRenderGuard(root)'), 'Every module root must share the background-render guard.');
assert(/if\s*\(moduleHasActiveEditor\(root\)\)/.test(source), 'Background rendering must defer while a user is editing.');
assert(source.includes("tagName==='DETAILS'") || source.includes("tagName === 'DETAILS'"), 'Open module sections must survive background rendering.');
assert(source.includes("(save|submit|apply|update|confirm|cancel|reset|clear|remove|delete)"), 'Explicit save/cancel/reset controls must release protected drafts.');

console.log('PDA shared non-destructive form-state wiring is verified.');
