import assert from 'node:assert/strict';
import fs from 'node:fs';

const marketSource = fs.readFileSync(new URL('./src/10-market-runtime.part', import.meta.url), 'utf8');
const shellSource = fs.readFileSync(new URL('./src/90-shell-bootstrap.part', import.meta.url), 'utf8');
const alertsSource = fs.readFileSync(new URL('./src/40-war.part', import.meta.url), 'utf8');
const source = marketSource + '\n' + shellSource + '\n' + alertsSource;

assert(source.includes('function protectEditableState(root)'), 'PDA must install one shared editable-state guard.');
assert(source.includes("const selector = 'input,textarea,select,[contenteditable=\"true\"],details'"), 'PDA guard must cover fields, selectors, checkboxes, editable text, and open sections.');
assert(source.includes("control.matches('[data-ui-autosave=\"true\"]')"), 'Auto-saved model controls must not be retained as stale drafts.');
assert(source.includes('function mutationNeedsRestore(mutations)'), 'PDA must distinguish editor replacement from harmless text updates.');
assert(source.includes('if (mutationNeedsRestore(mutations)) scheduleRestore()'), 'PDA must restore drafts only when editors are actually replaced.');
assert(source.includes('focusTarget.focus({ preventScroll:true })'), 'PDA must restore focus without forcing the WebView to scroll.');
assert(/editableState\s*=\s*protectEditableState\(shadow\)/.test(source), 'The guard must protect the complete PDA dashboard shadow root.');
assert(source.includes('function installModuleRenderGuard(root)'), 'Every module root must share the background-render guard.');
assert(/if\s*\(moduleHasActiveEditor\(root\)\)/.test(source), 'Background rendering must defer while a user is editing.');
assert(source.includes("tagName==='DETAILS'") || source.includes("tagName === 'DETAILS'"), 'Open module sections must survive background rendering.');
assert(source.includes("data-ui-key=\"alerts.settings\""), 'Alert settings must have a stable persisted panel identity.');
assert(source.includes('data-ui-autosave="true" data-alert-type='), 'Alert checkboxes must use committed model state after rendering.');
assert(source.includes("restoreKeyedPanels(root)"), 'Module replacements must restore keyed panel state immediately.');
assert(source.includes("state.panels[key] = event.target.open"), 'User-controlled panel state must be saved, not inferred from API renders.');
assert(source.includes('(save|submit|apply|update|confirm|cancel|reset|clear|remove|delete)'), 'Explicit save/cancel/reset controls must release protected drafts.');

console.log('PDA shared non-destructive form-state wiring is verified.');
