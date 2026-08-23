(function installUiShell(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before the UI shell.');

  const HOST_ID = 'slink-extension-foundation';

  const STYLES = `
    :host { all: initial; }
    .shell {
      position: fixed;
      right: 12px;
      top: 88px;
      z-index: 999999;
      width: min(330px, calc(100vw - 16px));
      overflow: hidden;
      border: 1px solid rgba(132, 199, 255, .42);
      border-radius: 10px;
      background: rgba(18, 25, 34, .98);
      color: #eaf4ff;
      box-shadow: 0 10px 28px rgba(0, 0, 0, .42);
      font: 12px/1.4 Arial, sans-serif;
    }
    .shell[hidden] { display: none; }
    .head { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,.1); cursor: grab; touch-action: none; user-select: none; }
    .head[data-dragging="true"] { cursor: grabbing; }
    .mark { display: grid; place-items: center; width: 32px; height: 32px; flex: 0 0 auto; border-radius: 9px; background: linear-gradient(145deg,#3478b9,#172f4c); font-weight: 800; }
    .heading { min-width: 0; flex: 1; }
    .title { font-size: 13px; font-weight: 700; }
    .subtitle { overflow: hidden; color: #9eb0c2; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
    .drag-hint { color: #71869a; font-size: 9px; }
    button { min-height: 30px; border: 1px solid rgba(255,255,255,.16); border-radius: 6px; background: #2b3745; color: #eef7ff; cursor: pointer; }
    button:hover { background: #37485a; }
    .icon-button { width: 30px; padding: 0; }
    .status { padding: 7px 10px; border-bottom: 1px solid rgba(255,255,255,.08); color: #a9d5ff; }
    .status[data-tone="ready"] { color: #8fe0a5; }
    .status[data-tone="error"] { color: #ffaaaa; }
    .content { display: grid; gap: 7px; max-height: min(420px, calc(100dvh - 190px)); overflow: auto; padding: 9px 10px; }
    .row { display: grid; grid-template-columns: 105px minmax(0,1fr); gap: 8px; }
    .label { color: #93a7ba; }
    .value { overflow-wrap: anywhere; color: #f5f9ff; }
    .actions { display: flex; gap: 6px; padding: 0 10px 10px; }
    .actions button { flex: 1; padding: 4px 8px; }
    @media (max-width: 420px) {
      .shell { right: 4px; top: 4px; width: min(300px, calc(100vw - 8px)); }
      .row { grid-template-columns: 90px minmax(0,1fr); }
    }
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

    const shell = document.createElement('section');
    shell.className = 'shell';
    shell.innerHTML = `
      <header class="head" title="Drag to move the SLINK panel">
        <div class="mark" aria-hidden="true">SL</div>
        <div class="heading">
          <div class="title"></div>
          <div class="subtitle"></div>
          <div class="drag-hint">Drag to move</div>
        </div>
        <button class="icon-button hide" type="button" title="Hide the SLINK page panel" aria-label="Hide the SLINK page panel">X</button>
      </header>
      <div class="status" role="status"></div>
      <div class="content"></div>
      <div class="actions">
        <button class="refresh" type="button">Run diagnostic</button>
      </div>
    `;

    shell.querySelector('.title').textContent = options.title || 'SLINK';
    shell.querySelector('.subtitle').textContent = options.subtitle || 'Extension foundation';
    shadow.append(style, shell);

    const content = shell.querySelector('.content');
    const head = shell.querySelector('.head');
    const status = shell.querySelector('.status');
    const refresh = shell.querySelector('.refresh');
    let drag = null;

    function clampPosition(left, top) {
      const bounds = shell.getBoundingClientRect();
      const margin = 4;
      return {
        left: Math.round(Math.min(
          Math.max(margin, Number(left) || margin),
          Math.max(margin, global.innerWidth - bounds.width - margin)
        )),
        top: Math.round(Math.min(
          Math.max(margin, Number(top) || margin),
          Math.max(margin, global.innerHeight - bounds.height - margin)
        ))
      };
    }

    function setPosition(position, persist = false) {
      if (!Number.isFinite(Number(position?.left)) || !Number.isFinite(Number(position?.top))) return;
      const next = clampPosition(position.left, position.top);
      shell.style.left = `${next.left}px`;
      shell.style.top = `${next.top}px`;
      shell.style.right = 'auto';
      if (persist) void SLINK.core.storage.set('ui.pagePanelPosition', next);
    }

    function resetPosition() {
      shell.style.removeProperty('left');
      shell.style.removeProperty('top');
      shell.style.removeProperty('right');
      void SLINK.core.storage.remove('ui.pagePanelPosition');
    }

    head.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button')) return;
      const bounds = shell.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: bounds.left,
        top: bounds.top
      };
      head.dataset.dragging = 'true';
      head.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    head.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      setPosition({
        left: drag.left + event.clientX - drag.startX,
        top: drag.top + event.clientY - drag.startY
      });
    });

    function finishDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const bounds = shell.getBoundingClientRect();
      drag = null;
      delete head.dataset.dragging;
      setPosition({ left: bounds.left, top: bounds.top }, true);
    }

    head.addEventListener('pointerup', finishDrag);
    head.addEventListener('pointercancel', finishDrag);
    global.addEventListener('resize', () => {
      if (shell.style.left) {
        const bounds = shell.getBoundingClientRect();
        setPosition({ left: bounds.left, top: bounds.top }, true);
      }
    });

    const api = {
      host,
      setHidden(hidden) {
        shell.hidden = Boolean(hidden);
      },
      resetPosition,
      setPosition,
      setStatus(message, tone = 'normal') {
        status.textContent = String(message || '');
        status.dataset.tone = String(tone || 'normal');
      },
      setRows(rows) {
        content.replaceChildren();
        for (const row of rows || []) {
          const item = document.createElement('div');
          item.className = 'row';
          const label = document.createElement('span');
          label.className = 'label';
          label.textContent = String(row.label || '');
          const value = document.createElement('span');
          value.className = 'value';
          value.textContent = String(row.value ?? '');
          item.append(label, value);
          content.appendChild(item);
        }
      },
      onRefresh(handler) {
        refresh.addEventListener('click', () => void handler());
      },
      onHide(handler) {
        shell.querySelector('.hide').addEventListener('click', () => void handler());
      }
    };

    void SLINK.core.storage.get('ui.pagePanelPosition', null).then(position => {
      if (position) setPosition(position);
    });

    return Object.freeze(api);
  }

  SLINK.define('core', 'uiShell', Object.freeze({ createShell }));
})(globalThis);
