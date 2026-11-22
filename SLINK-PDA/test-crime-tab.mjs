import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const panel = read('./src/40-war.part');
const stateCode = panel.slice(panel.indexOf('const PDA_CRIME_TABS='), panel.indexOf('function isPdaCrimeAlert'));
const shell = read('./src/90-shell-bootstrap.part');
const clickCode = shell.slice(shell.indexOf("if(action==='select-crime-tab')"), shell.indexOf("if (action === 'alerts-enable-all'"));
const saved = new Map();
const location = { pathname:'/page.php', search:'?sid=crimes', hash:'#/pickpocketing' };
const storage = { getItem:key=>saved.get(key), setItem:(key, value)=>saved.set(key,value) };
let renders = 0;

function start(sessionStorage) {
  const context = {
    URLSearchParams, global:{ location, sessionStorage },
    action:'select-crime-tab', event:{ target:{ closest:()=>({ dataset:{ crimeTab:'forgery' } }) } },
    renderAlerts(){ renders++; }
  };
  return {
    current: runInNewContext(stateCode + '\npdaCrimeTab.current.bind(pdaCrimeTab)', context),
    click: () => runInNewContext(clickCode, context)
  };
}

let tab = start(storage);
assert.equal(tab.current(),'pickpocket');
tab.click();
assert.equal(renders,1);
assert.equal(tab.current(),'forgery');
location.hash = '#/arson';
assert.equal(start(storage).current(),'forgery', 'A PDA runtime reload restores the explicit selection.');
const blocked = start({ getItem(){ throw Error('Blocked'); }, setItem(){ throw Error('Blocked'); } });
assert.equal(blocked.current(),'arson');
blocked.click();
assert.equal(blocked.current(),'forgery', 'Selection still works if session storage is unavailable.');
