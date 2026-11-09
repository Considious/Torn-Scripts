/* Shared by the extension and PDA. Only opens verified native panels on a trusted press; never submits confirmations or calls endpoints. */
(function (g) {
  'use strict';
  const key = 'slink.travel-run.plan.v1', runKey = key + '.progress';
  const fallbackLabels = { hospital: 'Self-hospitalize', heal: 'Heal out', home: 'Return to Torn' };
  function plan(input = {}) {
    const clean = value => String(value ?? '').trim().slice(0, 80);
    const seen = new Set();
    const buys = (Array.isArray(input.buys) ? input.buys : []).map(clean).filter(name => {
      const lower = name.toLowerCase();
      if (!lower || seen.has(lower)) return false;
      seen.add(lower);
      return true;
    }).slice(0, 12);
    return { sell: clean(input.sell), buys, fallback: Object.hasOwn(fallbackLabels, input.fallback) ? input.fallback : 'home' };
  }
  function steps(value) {
    return [
      ...(value.sell ? [{ type: 'sell', label: 'Sell ' + value.sell }] : []),
      ...value.buys.map(name => ({ type: 'buy', label: 'Buy ' + name })),
      ...(value.fallback !== 'home' ? [{ type: value.fallback, label: fallbackLabels[value.fallback] }] : []),
      { type: 'home', label: fallbackLabels.home }
    ];
  }
  function advance(queue, index, result) {
    const current = queue[index];
    if (!current) return index;
    if (current.type === 'buy' && result === 'done') return queue.length - 1;
    if (result === 'done' || (result === 'unavailable' && ['sell', 'buy'].includes(current.type))) return index + 1;
    return index;
  }
  if (typeof module === 'object' && module.exports) module.exports = { plan, steps, advance };
  const d = g.document, loc = g.location;
  if (!d || !loc || g.__slinkTravelRunInstalled || g.top !== g.self ||
      !(loc.pathname === '/travelagency.php' || (loc.pathname === '/page.php' && new URLSearchParams(loc.search).get('sid') === 'travel'))) return;
  g.__slinkTravelRunInstalled = true;
  function read(storage, name) { try { return JSON.parse(g[storage].getItem(name)); } catch { return null; } }
  function write(storage, name, value) {
    try { g[storage].setItem(name, JSON.stringify(value)); return true; } catch { return false; }
  }
  let value = plan(read('localStorage', key) || {});
  const progress = read('sessionStorage', runKey);
  let index = progress?.plan === JSON.stringify(value) ? progress.index : null;
  const saveProgress = () => write('sessionStorage', runKey, { plan: JSON.stringify(value), index });
  if (!Number.isInteger(index) || index < 0 || index > steps(value).length) index = null;
  let host;
  function mount() {
    const root = d.getElementById('travel-root');
    if (!root || host?.parentNode === root) return;
    if (host) { root.prepend(host); return; }
    host = d.createElement('div');
    host.id = 'slink-travel-run';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host{display:block;margin:6px 0;font:13px system-ui;color:var(--default-color,#eee)}
      details{border:1px solid var(--default-color,#888);border-radius:6px;padding:8px 10px;background:var(--default-bg-panel-color,#252525);color:inherit}
      summary{cursor:pointer;font-weight:650} form,label{display:grid;gap:5px} form{margin-top:8px;max-width:440px;gap:8px}
      input,textarea,select,button{box-sizing:border-box;font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:4px;padding:5px}
      option{color:#151515;background:white} button{cursor:pointer} .actions{display:flex;flex-wrap:wrap;gap:6px} [hidden]{display:none!important}
      p{margin:6px 0} textarea{resize:vertical}
      </style><details><summary>SLINK Travel Run</summary>
      <form><label>Sell first (optional)<input name="sell" maxlength="80" placeholder="Item name"></label>
      <label>Buy in priority order (one item per line)<textarea name="buys" rows="3" maxlength="972" placeholder="Xanax&#10;Shark Fin"></textarea></label>
      <label>If nothing can be bought<select name="fallback"><option value="home">Return to Torn</option><option value="hospital">Self-hospitalize, then return</option><option value="heal">Heal out, then return</option></select></label>
      <div class="actions"><button type="submit">Save and start run</button></div></form>
      <p id="help">Use Torn’s controls for each action. Advance only after you verify the result.</p>
      <p id="status" role="status"></p>
      <div class="actions"><button type="button" id="open" hidden></button><button type="button" id="next"></button><button type="button" id="skip">Unavailable</button><button type="button" id="edit">Edit plan</button></div>
      </details>`;
    const get = id => shadow.getElementById(id);
    const details = shadow.querySelector('details'), form = shadow.querySelector('form');
    const next = get('next'), skip = get('skip'), edit = get('edit'), status = get('status'), open = get('open');
    let editing = index === null;
    const fields = form.elements;
    function fill() { fields.sell.value = value.sell; fields.buys.value = value.buys.join('\n'); fields.fallback.value = value.fallback; }
    function render(message = '') {
      const current = index === null ? null : steps(value)[index];
      form.hidden = editing;
      next.hidden = editing || !current;
      open.hidden = editing || !['buy', 'home'].includes(current?.type);
      open.textContent = current?.type === 'home' ? 'Open Travel Home' : 'Open ' + (current?.label || '') + ' panel';
      skip.hidden = editing || !current || !['sell','buy'].includes(current.type);
      edit.hidden = editing;
      status.textContent = message || (editing ? '' : current ? 'Next: ' + current.label : 'Run complete.');
      next.textContent = current?.type === 'home' ? 'Confirm return started' : 'Confirm: ' + (current?.label || '') + ' done';
    }
    function act(result, event) {
      if (!event.isTrusted || !details.open || d.visibilityState !== 'visible' || editing || index === null) return;
      const saved = plan(read('localStorage', key) || {});
      if (JSON.stringify(saved) !== JSON.stringify(value) && read('localStorage', key)) {
        render('This plan changed in another tab. Reopen the page before continuing.'); return;
      }
      const upcoming = advance(steps(value), index, result);
      if (upcoming === index) return;
      index = upcoming;
      render(saveProgress() ? '' : 'Progress is available only on this page.');
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!event.isTrusted) return;
      value = plan({ sell: fields.sell.value, buys: fields.buys.value.split(/\r?\n/), fallback: fields.fallback.value });
      index = 0; editing = false;
      const saved = write('localStorage', key, value), progress = saveProgress();
      render(saved && progress ? '' : 'Storage is unavailable; this run may reset on navigation.');
    });
    next.addEventListener('click', event => act('done', event));
    open.addEventListener('click', event => {
      if (!event.isTrusted || !details.open || editing || d.visibilityState !== 'visible' || !d.hasFocus()) return;
      const current = steps(value)[index];
      if (!current || !['buy', 'home'].includes(current.type)) return;
      const activeRoot = host.parentElement;
      const usable = node => node.getClientRects().length > 0 && !node.disabled &&
        node.getAttribute('aria-disabled') !== 'true' && !node.closest('[hidden],[inert],[aria-hidden="true"]');
      let matches;
      if (current.type === 'home') {
        matches = Array.from(activeRoot.querySelectorAll('a.travel-home-header-button[aria-controls="travel-home-panel"][aria-expanded="false"]')).filter(usable);
      } else {
        const wanted = value.buys[index - (value.sell ? 1 : 0)]?.toLowerCase();
        matches = Array.from(activeRoot.querySelectorAll('button[form][aria-controls][aria-expanded="false"]')).filter(button => {
          const id = /^item-(\d+)-buyPanel$/.exec(button.getAttribute('aria-controls'))?.[1];
          if (!id || button.getAttribute('form') !== 'item-' + id + '-form' || button.textContent.trim() !== 'Buy' || !usable(button)) return false;
          const row = button.closest('[class^="row___"],[class*=" row___"]');
          if (!row || row.querySelector('button[aria-controls="item-' + id + '-itemInfoWrapper"]')?.textContent.trim().toLowerCase() !== wanted) return false;
          const quantity = row.querySelector('form[id="item-' + id + '-form"] input[data-input-money-visible="true"]:not([type="hidden"])');
          return quantity && usable(quantity) && /^[1-9]\d*$/.test(quantity.value.trim().replaceAll(',', ''));
        });
      }
      if (matches.length !== 1) {
        render(current.type === 'buy' ? 'Could not verify one Buy control. Make sure the item is visible and enter a quantity in Torn first.' : 'Could not verify one Travel Home control. Open it in Torn if available.');
        return;
      }
      matches[0].click();
      render('Use Torn’s panel to review and confirm. The run has not advanced.');
    });
    skip.addEventListener('click', event => act('unavailable', event));
    edit.addEventListener('click', event => { if (event.isTrusted) { editing = true; fill(); render(); } });
    fill(); render();
    details.open = index !== null && index < steps(value).length;
    root.prepend(host);
  }
  mount();
  let scheduled = false;
  new MutationObserver(() => {
    if (host?.isConnected || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; mount(); });
  }).observe(d.documentElement, { childList: true, subtree: true });
})(globalThis);
