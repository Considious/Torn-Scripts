(function installUiShell(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before the UI shell.');

  const HOST_ID = 'slink-extension-panel';
  const STYLES = `
    :host { all: initial; ${SLINK.core.themes.cssVariables('slink-dark')} }
    * { box-sizing:border-box; }
    .window { position:fixed; z-index:999999; width:min(350px,calc(100vw - 16px)); overflow:hidden; border:1px solid var(--slink-border); border-radius:10px; background:var(--slink-bg); color:var(--slink-text); box-shadow:0 10px 28px var(--slink-shadow); font:12px/1.4 Arial,sans-serif; }
    .window[hidden], .module-view[hidden] { display:none; }
    .main { right:12px; top:88px; }
    .popup { left:12px; top:88px; }
    .head { display:flex; align-items:center; gap:8px; padding:9px 10px; border-bottom:1px solid var(--slink-border-soft); cursor:grab; touch-action:none; user-select:none; }
    .head[data-dragging="true"] { cursor:grabbing; }
    .mark { display:grid; place-items:center; width:32px; height:32px; flex:0 0 auto; border-radius:9px; background:linear-gradient(145deg,#3478b9,#172f4c); font-weight:800; }
    .heading { min-width:0; flex:1; }
    .title { font-size:13px; font-weight:700; }
    .subtitle { overflow:hidden; color:var(--slink-muted); font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
    button { min-height:30px; border:1px solid var(--slink-border-soft); border-radius:6px; background:var(--slink-bg-control); color:var(--slink-text); cursor:pointer; }
    button:hover { filter:brightness(1.15); }
    .icon-button { width:30px; padding:0; }
    .tabs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; overflow:auto; padding:6px 7px; border-bottom:1px solid var(--slink-border-soft); }
    .tab { flex:1 0 auto; min-height:27px; padding:3px 7px; color:var(--slink-muted); }
    .tab[aria-selected="true"] { border-color:var(--slink-border); background:var(--slink-accent); color:var(--slink-text); }
    .module-head { display:flex; align-items:center; gap:7px; padding:6px 9px 0; }
    .module-head strong { flex:1; }
    .status { padding:7px 10px; border-bottom:1px solid var(--slink-border-soft); color:var(--slink-accent); }
    .status[data-tone="ready"] { color:var(--slink-ready); }
    .status[data-tone="error"] { color:var(--slink-error); }
    .content { display:grid; gap:7px; max-height:min(420px,calc(100dvh - 210px)); overflow:auto; padding:9px 10px; }
    .row { display:grid; grid-template-columns:105px minmax(0,1fr); gap:8px; }
    .label { color:var(--slink-muted); }
    .value { overflow-wrap:anywhere; color:var(--slink-text); }
    .actions { display:flex; gap:6px; padding:0 10px 10px; }
    .actions:empty { display:none; }
    .actions button { flex:1; padding:4px 8px; }
    .slink-alert { width:min(330px,calc(100vw - 16px)); }
    .slink-alert .content { max-height:min(300px,calc(100dvh - 170px)); }
    .slink-alert-body { display:grid; gap:7px; }
    @media(max-width:420px) { .window{width:min(300px,calc(100vw - 8px))}.main{right:4px;top:4px}.popup{left:4px;top:4px}.row{grid-template-columns:90px minmax(0,1fr)}.content{max-height:calc(100dvh - 190px)} }
  `;

  function createShell(options = {}) {
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      document.documentElement.appendChild(host);
    }
    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    shadow.replaceChildren();
    const style = document.createElement('style');
    style.textContent = STYLES;
    shadow.append(style);

    const main = createWindow('main', options.title || 'SLINK', options.subtitle || 'Extension systems');
    const tabs = document.createElement('nav');
    tabs.className = 'tabs';
    main.head.after(tabs);
    shadow.append(main.element);
    const views = new Map();
    const alerts = new Map();
    let hidden = false;
    let activeId = '';
    let hideHandler = null;

    function createWindow(kind, title, subtitle) {
      const element = document.createElement('section');
      element.className = `window ${kind}`;
      element.innerHTML = `<header class="head"><div class="mark" aria-hidden="true">SL</div><div class="heading"><div class="title"></div><div class="subtitle"></div></div><button class="icon-button hide" type="button" title="Hide SLINK UI">X</button></header>`;
      element.querySelector('.title').textContent = title;
      element.querySelector('.subtitle').textContent = subtitle;
      const head = element.querySelector('.head');
      makeMovable(element, head, kind === 'main' ? 'ui.main.position' : `ui.popouts.${kind}.position`);
      return { element, head };
    }

    function makeMovable(element, head, storageKey) {
      let drag = null;
      const setPosition = (position, persist = false) => {
        if (!Number.isFinite(Number(position?.left)) || !Number.isFinite(Number(position?.top))) return;
        const width = element.getBoundingClientRect().width || 300;
        const height = element.getBoundingClientRect().height || 100;
        const next = {
          left: Math.round(Math.max(4, Math.min(Number(position.left), global.innerWidth - width - 4))),
          top: Math.round(Math.max(4, Math.min(Number(position.top), global.innerHeight - height - 4)))
        };
        element.style.left = `${next.left}px`; element.style.top = `${next.top}px`; element.style.right = 'auto';
        if (persist) void SLINK.core.storage.set(storageKey, next);
      };
      head.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('button')) return;
        const box = element.getBoundingClientRect();
        drag = { id:event.pointerId, x:event.clientX, y:event.clientY, left:box.left, top:box.top };
        head.dataset.dragging = 'true'; head.setPointerCapture(event.pointerId); event.preventDefault();
      });
      head.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        setPosition({ left:drag.left + event.clientX - drag.x, top:drag.top + event.clientY - drag.y });
      });
      const finish = event => {
        if (!drag || event.pointerId !== drag.id) return;
        const box = element.getBoundingClientRect(); drag = null; delete head.dataset.dragging;
        setPosition({ left:box.left, top:box.top }, true);
      };
      head.addEventListener('pointerup', finish); head.addEventListener('pointercancel', finish);
      void SLINK.core.storage.get(storageKey, null).then(position => { if (position) setPosition(position); });
    }

    function setActive(id) {
      if (!views.has(id) || views.get(id).popped) return;
      activeId = id;
      for (const [moduleId, view] of views) {
        if (!view.popped) view.element.hidden = moduleId !== id;
        view.tab?.setAttribute('aria-selected', String(moduleId === id));
      }
    }

    function refreshShell() {
      const docked = [...views.values()].filter(view => !view.popped);
      if (!docked.some(view => view.id === activeId)) activeId = docked[0]?.id || '';
      if (activeId) setActive(activeId);
      tabs.hidden = docked.length < 2;
      main.element.hidden = hidden || docked.length === 0;
      for (const view of views.values()) {
        if (view.popup) view.popup.element.hidden = hidden;
      }
      for (const alert of alerts.values()) alert.element.hidden = hidden;
    }

    function dismissAlert(id) {
      const key = String(id || '');
      const alert = alerts.get(key);
      if (!alert) return;
      alert.element.remove();
      alerts.delete(key);
    }

    function showAlert(definition = {}) {
      const id = String(definition.id || '').trim();
      if (!id) throw new Error('A SLINK alert ID is required.');
      dismissAlert(id);
      const alert = createWindow(`alert-${id}`, definition.title || 'SLINK alert', definition.subtitle || '');
      alert.element.classList.add('popup', 'slink-alert');
      const content = document.createElement('div');
      content.className = 'content slink-alert-body';
      content.innerHTML = String(definition.contentHtml || '');
      const actions = document.createElement('div');
      actions.className = 'actions';
      for (const action of definition.actions || []) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = String(action.label || 'Action');
        if (action.href) {
          button.addEventListener('click', () => global.open(String(action.href), '_blank', 'noopener'));
        } else if (typeof action.onClick === 'function') {
          button.addEventListener('click', event => void action.onClick(event));
        }
        actions.append(button);
      }
      alert.element.append(content, actions);
      alert.element.querySelector('.hide').addEventListener('click', () => {
        if (typeof definition.onDismiss === 'function') void definition.onDismiss();
        dismissAlert(id);
      });
      alerts.set(id, alert);
      shadow.append(alert.element);
      refreshShell();
      return Object.freeze({ dismiss:() => dismissAlert(id), element:alert.element });
    }

    async function setPopped(view, popped) {
      view.popped = Boolean(popped);
      await SLINK.core.storage.set(`ui.modules.${view.id}.docked`, !view.popped);
      if (view.popped) {
        view.popup = createWindow(view.id, view.title, 'Popped out from SLINK');
        view.popup.element.append(view.element);
        view.popup.element.querySelector('.hide').addEventListener('click', () => void setPopped(view, false));
        shadow.append(view.popup.element);
        view.popButton.textContent = 'Pop back in';
        view.popButton.title = 'Return this feature to the main SLINK window';
        view.element.hidden = false;
      } else {
        view.popup?.element.remove(); view.popup = null;
        main.element.append(view.element);
        view.popButton.textContent = 'Pop out';
        view.popButton.title = 'Open this feature in its own movable window';
        setActive(view.id);
      }
      refreshShell();
    }

    async function createModuleView(module) {
      if (views.has(module.id)) return views.get(module.id).api;
      const element = document.createElement('section');
      element.className = 'module-view';
      element.innerHTML = `<div class="module-head"><strong></strong><button class="pop" type="button">Pop out</button></div><div class="status" role="status"></div><div class="content"></div><div class="actions"></div>`;
      element.querySelector('strong').textContent = module.title;
      const tab = document.createElement('button');
      tab.className = 'tab'; tab.type = 'button'; tab.textContent = module.title; tab.setAttribute('role', 'tab');
      tabs.append(tab); main.element.append(element);
      const view = { id:module.id, title:module.title, element, tab, popped:false, popup:null, popButton:element.querySelector('.pop') };
      views.set(module.id, view);
      tab.addEventListener('click', () => setActive(module.id));
      view.popButton.addEventListener('click', () => void setPopped(view, !view.popped));
      const moduleStyle = document.createElement('style'); shadow.append(moduleStyle);
      const content = element.querySelector('.content'); const status = element.querySelector('.status'); const actions = element.querySelector('.actions');
      const api = {
        host,
        setHidden(value) { hidden = Boolean(value); refreshShell(); },
        setTitle(value) { element.querySelector('strong').textContent = String(value || module.title); },
        setSubtitle(value) { status.title = String(value || ''); },
        setModuleStyles(value) { moduleStyle.textContent = String(value || ''); },
        setContentHtml(value) { content.innerHTML = String(value || ''); },
        getContentElement() { return content; },
        setStatus(message, tone = 'normal') { status.textContent = String(message || ''); status.dataset.tone = String(tone || 'normal'); },
        setRows(rows) {
          content.replaceChildren();
          for (const row of rows || []) {
            const item = document.createElement('div'); item.className = 'row';
            const label = document.createElement('span'); label.className = 'label'; label.textContent = String(row.label || '');
            const value = document.createElement('span'); value.className = 'value'; value.textContent = String(row.value ?? '');
            item.append(label, value); content.append(item);
          }
        },
        setActions(definitions) {
          actions.replaceChildren();
          for (const definition of definitions || []) {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = String(definition.label || 'Action'); button.disabled = Boolean(definition.disabled);
            if (definition.id) button.dataset.action = String(definition.id);
            if (typeof definition.onClick === 'function') button.addEventListener('click', event => void definition.onClick(event));
            actions.append(button);
          }
        },
        showAlert,
        dismissAlert,
        remove() { view.popup?.element.remove(); view.tab.remove(); element.remove(); moduleStyle.remove(); views.delete(module.id); refreshShell(); },
        ui: null
      };
      api.ui = api;
      view.api = Object.freeze(api);
      const docked = await SLINK.core.storage.get(`ui.modules.${module.id}.docked`, true);
      if (!docked) await setPopped(view, true); else { if (!activeId) activeId = module.id; refreshShell(); }
      return view.api;
    }

    main.element.querySelector('.hide').addEventListener('click', () => { if (hideHandler) void hideHandler(); });
    return Object.freeze({
      host,
      createModuleView,
      dismissAlert,
      showAlert,
      setHidden(value) { hidden = Boolean(value); refreshShell(); },
      onHide(handler) { hideHandler = handler; },
      resetPosition() { void SLINK.core.storage.remove('ui.main.position'); },
      setPosition() {},
      setRows() {},
      setStatus() {}
    });
  }

  SLINK.define('core', 'uiShell', Object.freeze({ createShell }));
})(globalThis);
