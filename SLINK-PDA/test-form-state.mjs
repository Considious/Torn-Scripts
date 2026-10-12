import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./SLINK_PDA_Dashboard.user.js', import.meta.url), 'utf8');

assert(source.includes('function protectEditableState(root)'), 'PDA must install one shared editable-state guard.');
assert(source.includes("const selector = 'input,textarea,select,[contenteditable=\"true\"]'"), 'PDA guard must cover text fields, selects, checkboxes, radios, and editable text.');
assert(source.includes('new MutationObserver(scheduleRestore)'), 'PDA must restore dirty controls after background re-renders.');
assert(source.includes('focusTarget.focus({ preventScroll:true })'), 'PDA must restore focus without forcing the WebView to scroll.');
assert(source.includes('const editableState = protectEditableState(shadow);'), 'The guard must protect the complete PDA dashboard shadow root.');
assert(source.includes("(save|submit|apply|update|confirm|cancel|reset|clear|remove|delete)"), 'Explicit save/cancel/reset controls must release protected drafts.');

console.log('PDA shared non-destructive form-state wiring is verified.');
