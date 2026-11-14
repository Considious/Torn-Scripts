/* Travel Run delegates at most one native control per trusted press; never submits confirmations or calls endpoints. */
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
      ...(value.sell ? [{ type: 'sell', item: value.sell, label: 'Sell ' + value.sell }] : []),
      ...value.buys.map(name => ({ type: 'buy', item: name, label: 'Buy ' + name })),
      ...(value.fallback !== 'home' ? [{ type: value.fallback, label: fallbackLabels[value.fallback] }] : []),
      { type: 'home', label: fallbackLabels.home }
    ];
  }
  function advance(queue, index, result) {
    const current = queue[index];
    if (!current) return index;
    if (current.type === 'buy' && result === 'done') return queue.length - 1;
    if (result === 'done' || (result === 'unavailable' && ['sell', 'buy', 'hospital', 'heal'].includes(current.type))) return index + 1;
    return index;
  }
  const norm = text => String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const one = nodes => nodes.length === 1 ? nodes[0] : null;
  const usable = node => node && node.getClientRects().length > 0 && !node.disabled &&
    node.getAttribute('aria-disabled') !== 'true' && !node.closest('[hidden],[inert],[aria-hidden="true"]') &&
    !['hidden', 'collapse'].includes(node.ownerDocument.defaultView.getComputedStyle(node).visibility);
  const maxControl = root => one(Array.from(root.querySelectorAll(
    'input[type="button"][aria-label^="Click here to add the maximum amount"]'
  )).filter(usable));
  const amount = input => /^[1-9]\d*$/.test(input?.value.trim().replaceAll(',', '') || '');
  function nativeAction(root, current, maxSet) {
    const query = (area, selector) => Array.from(area.querySelectorAll(selector)).filter(usable);
    if (current.type === 'home') {
      const control = one(query(root, 'a.travel-home-header-button[aria-controls="travel-home-panel"][aria-expanded="false"]'));
      return control && { control, label: 'Open Travel Home' };
    }
    if (current.type === 'sell') {
      const inv = one(query(root, 'ul[class*="inventoryPanel___"][aria-label^="Inventory "]'));
      if (!inv) return null;
      const slots = query(inv, 'li[class*="inventorySlot___"] > button[class*="itemButton___"][aria-expanded]')
        .filter(button => norm(button.querySelector('img.torn-item')?.alt) === norm(current.item) &&
          norm(button.getAttribute('aria-label')).replace(/ slot \d+$/, '') === norm(current.item));
      const selected = slots.filter(button => button.getAttribute('aria-expanded') === 'true');
      if (selected.length > 1) return null;
      if (!selected.length) {
        const control = slots[0];
        return control ? { control, label: 'Select ' + current.item + ' to sell' } : null;
      }
      const slot = selected[0].parentElement;
      const panel = one(query(slot, '[class*="panel___"]'));
      if (!panel) return null;
      const sell = one(query(panel, '[role="group"] > button[type="button"]').filter(button => norm(button.textContent) === 'sell'));
      if (!sell) return null;
      if (sell.getAttribute('aria-current') !== 'true') return { control: sell, label: 'Open Sell for ' + current.item };
      const quantity = one(query(panel, 'input[aria-label="Amount to sell"][data-input-money-visible="true"]:not([type="hidden"])'));
      const control = quantity && !maxSet.has(quantity) && maxControl(quantity.closest('form') || panel);
      return control ? { control, quantity, label: 'Set maximum sale quantity' } : null;
    }
    if (current.type === 'buy') {
      const rows = query(root, 'button[form][aria-controls][aria-expanded]').flatMap(control => {
        const id = /^item-(\d+)-buyPanel$/.exec(control.getAttribute('aria-controls'))?.[1];
        if (!id || control.getAttribute('form') !== 'item-' + id + '-form' || norm(control.textContent) !== 'buy') return [];
        const row = control.closest('[class^="row___"],[class*=" row___"]');
        if (!row || norm(row.querySelector('button[aria-controls="item-' + id + '-itemInfoWrapper"]')?.textContent) !== norm(current.item)) return [];
        const form = control.form;
        const quantity = form && row.contains(form) && one(query(form, 'input[data-input-money-visible="true"]:not([type="hidden"])'));
        return [{ control, quantity, form }];
      });
      const row = one(rows);
      if (!row?.quantity || row.control.getAttribute('aria-expanded') !== 'false') return null;
      if (!maxSet.has(row.quantity)) {
        const control = maxControl(row.form);
        if (control) return { control, quantity: row.quantity, label: 'Set maximum quantity for ' + current.item };
      }
      if (amount(row.quantity)) return { control: row.control, label: 'Open Buy for ' + current.item };
    }
    return null;
  }
  if (typeof module === 'object' && module.exports) module.exports = { plan, steps, advance, nativeAction };
  const d = g.document, loc = g.location;
  if (!d || !loc || g.__slinkTravelRunInstalled || g.top !== g.self ||
      !(loc.pathname === '/travelagency.php' || (loc.pathname === '/page.php' && ['travel', 'travelAgency', 'travelagency'].includes(new URLSearchParams(loc.search).get('sid'))))) return;
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
  let host, refresh;
  function mount() {
    const app = d.getElementById('travel-root');
    const root = app || d.querySelector('a.travel-home-header-button[aria-controls="travel-home-panel"],ul[class*="inventoryPanel___"][aria-label^="Inventory "]')
      ?.closest('main,[role="main"],.content-wrapper');
    if (!root) return;
    if (host?.parentNode === root) { refresh?.(); return; }
    if (host) { root.prepend(host); refresh?.(); return; }
    host = d.createElement('div');
    host.id = 'slink-travel-run';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host{display:block;min-width:0;max-width:100%;box-sizing:border-box;margin:6px 0;font:13px system-ui;color:var(--default-color,inherit)}
      details{border:1px solid var(--default-color,#888);border-radius:6px;padding:8px 10px;background:var(--default-bg-panel-color,transparent);color:inherit}
      summary{cursor:pointer;font-weight:650} form,label{display:grid;gap:5px} form{margin-top:8px;max-width:440px;gap:8px}
      input,textarea,select,button{box-sizing:border-box;font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:4px;padding:5px}
      option{color:#151515;background:white} button{cursor:pointer} .actions{display:flex;flex-wrap:wrap;gap:6px} [hidden]{display:none!important}
      p{margin:6px 0} textarea{resize:vertical}
      </style><details><summary>SLINK Travel Run · Plan</summary>
      <form><label>Sell first (optional)<input name="sell" maxlength="80" placeholder="Item name"></label>
      <label>Buy in priority order (one item per line)<textarea name="buys" rows="3" maxlength="972" placeholder="Xanax&#10;Shark Fin"></textarea></label>
      <label>If nothing can be bought<select name="fallback"><option value="home">Return to Torn</option><option value="hospital">Self-hospitalize, then return</option><option value="heal">Heal out, then return</option></select></label>
      <div class="actions"><button type="submit">Save and start run</button></div></form>
      </details>
      <p id="status" role="status"></p>
      <div class="actions"><button type="button" id="open" hidden></button><button type="button" id="next"></button><button type="button" id="skip">Skip this step</button><button type="button" id="edit">Set up Travel Run</button></div>`;
    const get = id => shadow.getElementById(id);
    const details = shadow.querySelector('details'), form = shadow.querySelector('form');
    const next = get('next'), skip = get('skip'), edit = get('edit'), status = get('status'), open = get('open');
    let editing = index === null;
    let maxSet = new WeakSet();
    const foreground = () => d.visibilityState === 'visible' && d.hasFocus();
    const active = () => steps(value)[index];
    function actionFor(current) { return !editing && current && foreground() ? nativeAction(host.parentElement, current, maxSet) : null; }
    function paintAction() {
      const action = actionFor(active());
      const current = active();
      open.hidden = editing || !current || !['sell', 'buy', 'home'].includes(current.type);
      open.disabled = !action;
      const label = action?.label || (current ? current.label + ' · not available here' : '');
      if (open.textContent !== label) open.textContent = label;
    }
    refresh = paintAction;
    const fields = form.elements;
    function fill() { fields.sell.value = value.sell; fields.buys.value = value.buys.join('\n'); fields.fallback.value = value.fallback; }
    function render(message = '') {
      const current = index === null ? null : steps(value)[index];
      form.hidden = !editing;
      next.hidden = editing || !current;
      skip.hidden = editing || !current || current.type === 'home';
      skip.textContent = current?.type === 'buy' ? 'Unavailable · next choice' : 'Skip this step';
      edit.textContent = index === null ? 'Set up Travel Run' : current ? 'Edit plan' : 'Start another run';
      status.textContent = message || (editing ? '' : current ? (
        'Next: ' + current.label + (['hospital', 'heal'].includes(current.type)
          ? ' · Use your item in Torn, or skip to Travel Home.'
          : ' · Mark done after Torn completes this step.')
      ) : 'Run complete.');
      if (host.parentElement) paintAction();
      next.textContent = current?.type === 'home' ? 'Confirm return started' : 'Confirm: ' + (current?.label || '') + ' done';
    }
    function act(result, event) {
      if (!event.isTrusted || !foreground() || editing || index === null) return;
      const saved = plan(read('localStorage', key) || {});
      if (JSON.stringify(saved) !== JSON.stringify(value) && read('localStorage', key)) {
        render('This plan changed in another tab. Reopen the page before continuing.'); return;
      }
      const upcoming = advance(steps(value), index, result);
      if (upcoming === index) return;
      index = upcoming;
      maxSet = new WeakSet();
      render(saveProgress() ? '' : 'Progress is available only on this page.');
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!event.isTrusted) return;
      value = plan({ sell: fields.sell.value, buys: fields.buys.value.split(/\r?\n/), fallback: fields.fallback.value });
      index = 0; editing = false; maxSet = new WeakSet(); details.open = false;
      const saved = write('localStorage', key, value), progress = saveProgress();
      render(saved && progress ? '' : 'Storage is unavailable; this run may reset on navigation.');
    });
    next.addEventListener('click', event => act('done', event));
    open.addEventListener('click', event => {
      if (!event.isTrusted || !foreground() || editing || !host.isConnected) return;
      const saved = read('localStorage', key);
      if (saved && JSON.stringify(plan(saved)) !== JSON.stringify(value)) {
        render('This plan changed in another tab. Reopen the page before continuing.'); return;
      }
      const selected = actionFor(active());
      if (!selected || selected.label !== open.textContent) { paintAction(); return; }
      selected.control.click();
      if (selected.quantity) maxSet.add(selected.quantity);
      render('Review Torn’s controls before confirming. The run has not advanced.');
    });
    skip.addEventListener('click', event => act('unavailable', event));
    edit.addEventListener('click', event => {
      if (!event.isTrusted) return;
      if (editing && details.open) return;
      editing = true; details.open = true; fill(); render();
    });
    details.addEventListener('toggle', () => {
      if (details.open && !editing) { editing = true; fill(); render(); }
      if (!details.open && editing && index !== null) { editing = false; render(); }
    });
    root.prepend(host);
    fill(); render();
  }
  if (foregroundPage()) mount();
  let scheduled = false;
  const schedule = () => {
    if (!foregroundPage() || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (foregroundPage()) { if (host?.isConnected) refresh?.(); else mount(); }
    });
  };
  function foregroundPage() { return d.visibilityState === 'visible' && d.hasFocus(); }
  new MutationObserver(records => {
    if (!host?.isConnected || records.some(record => host.parentElement.contains(record.target))) schedule();
  }).observe(d.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded','aria-disabled','aria-current','disabled','hidden','inert'] });
  g.addEventListener('focus', schedule);
  d.addEventListener('visibilitychange', schedule);
  d.addEventListener('input', event => {
    if (host?.parentElement?.contains(event.target)) schedule();
  });
})(globalThis);
