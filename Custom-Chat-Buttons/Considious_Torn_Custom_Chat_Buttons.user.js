// ==UserScript==
// @name         Considious Torn Custom Chat Buttons
// @namespace    Considious [3853023]
// @version      0.1.0
// @description  User-defined two-click HTML message buttons inside Torn faction and private chat headers.
// @author       Considious [3853023]
// @match        https://www.torn.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @updateURL    https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Custom-Chat-Buttons/Considious_Torn_Custom_Chat_Buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/Considious/Torn-Scripts/main/Custom-Chat-Buttons/Considious_Torn_Custom_Chat_Buttons.user.js
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

  const STORAGE_KEY = 'considious-custom-chat-buttons-v1';
  const ARM_DURATION_MS = 10_000;
  const CHAT_ROOT_SELECTOR = '[id^="faction-"], [id^="private-"]';
  const COMPOSER_SELECTOR = 'textarea[placeholder="Type your message here..."], textarea[class*="textarea___"], textarea';
  const SCOPES = new Set(['both', 'faction', 'private']);

  let macros = loadMacros();
  let menu = null;
  let menuChatRoot = null;
  let menuStatus = '';
  let editor = null;
  let editorDraft = null;
  let armed = null;
  let sending = false;
  let armTimer = null;
  let scanTimer = null;

  addStyles();
  scanChatWindows();

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('resize', () => {
    if (menu && !menu.hidden && menuChatRoot) positionMenu(menuChatRoot);
  });

  document.addEventListener('pointerdown', (event) => {
    if (!menu || menu.hidden) return;
    if (menu.contains(event.target) || event.target.closest?.('[data-ccb-trigger]')) return;
    closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (editor) closeEditor();
    else closeMenu();
  });

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Manage custom chat buttons', openEditor);
  }

  if (typeof GM_addValueChangeListener === 'function') {
    GM_addValueChangeListener(STORAGE_KEY, (_key, _oldValue, _newValue, remote) => {
      if (!remote) return;
      macros = loadMacros();
      clearArmed();
      if (menu && !menu.hidden) renderMenu();
    });
  }

  function newId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `ccb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizedMacro(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      id: String(source.id || newId()),
      label: String(source.label || '').trim().slice(0, 80),
      message: String(source.message || ''),
      scope: SCOPES.has(source.scope) ? source.scope : 'both',
      enabled: source.enabled !== false,
    };
  }

  function normalizeMacros(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map(normalizedMacro).filter((macro) => {
      if (!macro.label || !macro.message || seen.has(macro.id)) return false;
      seen.add(macro.id);
      return true;
    });
  }

  function loadMacros() {
    try {
      return normalizeMacros(GM_getValue(STORAGE_KEY, []));
    } catch {
      return [];
    }
  }

  function saveMacros() {
    GM_setValue(STORAGE_KEY, macros);
  }

  function chatType(root) {
    return String(root?.id || '').startsWith('faction-') ? 'faction' : 'private';
  }

  function chatTitle(root) {
    const title = root?.querySelector('button[class*="header___"] span[class*="title___"]')
      || root?.querySelector('button svg[aria-label="Minimize"]')?.parentElement?.querySelector('span');
    return String(title?.textContent || (chatType(root) === 'faction' ? 'Faction' : 'Private chat')).trim();
  }

  function chatHeader(root) {
    return root?.querySelector('button[class*="header___"]')
      || [...(root?.querySelectorAll('button') || [])].find((button) => button.querySelector('svg[aria-label="Minimize"]'))
      || null;
  }

  function chatComposer(root) {
    return root?.querySelector(COMPOSER_SELECTOR) || null;
  }

  function chatSendButton(root, composer = chatComposer(root)) {
    const rowButton = composer?.parentElement?.querySelector('button');
    if (rowButton) return rowButton;
    return [...(root?.querySelectorAll('button, [role="button"]') || [])].find((button) => {
      const label = `${button.textContent || ''} ${button.getAttribute?.('aria-label') || ''} ${button.getAttribute?.('title') || ''}`.trim();
      return button.type === 'submit' || /\bsend(?: message)?\b/i.test(label) || Boolean(button.querySelector?.('svg[viewBox="0 0 18 18"]'));
    }) || null;
  }

  function scheduleScan() {
    if (scanTimer) window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      scanTimer = null;
      scanChatWindows();
    }, 80);
  }

  function scanChatWindows() {
    document.querySelectorAll(CHAT_ROOT_SELECTOR).forEach(injectMenuTrigger);
    if (menuChatRoot && !menuChatRoot.isConnected) closeMenu();
    else if (menu && !menu.hidden && menuChatRoot) positionMenu(menuChatRoot);
  }

  function stopHeaderAction(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function injectMenuTrigger(root) {
    const header = chatHeader(root);
    if (!header) return;
    const current = header.querySelector(':scope > [data-ccb-trigger]');
    if (current) return;

    const trigger = document.createElement('span');
    trigger.dataset.ccbTrigger = 'true';
    trigger.className = 'ccb-trigger';
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('aria-label', 'Custom chat buttons');
    trigger.title = 'Custom chat buttons';
    trigger.textContent = '✦';

    ['pointerdown', 'mousedown', 'dragstart'].forEach((type) => {
      trigger.addEventListener(type, stopHeaderAction);
    });
    trigger.addEventListener('click', (event) => {
      stopHeaderAction(event);
      toggleMenu(root);
    });
    trigger.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      stopHeaderAction(event);
      toggleMenu(root);
    });

    const minimize = header.querySelector(':scope > svg[aria-label="Minimize"]');
    header.insertBefore(trigger, minimize || null);
  }

  function ensureMenu() {
    if (menu) return menu;
    menu = document.createElement('section');
    menu.id = 'ccb-menu';
    menu.hidden = true;
    menu.addEventListener('pointerdown', (event) => event.stopPropagation());
    document.body.appendChild(menu);
    return menu;
  }

  function toggleMenu(root) {
    if (menu && !menu.hidden && menuChatRoot === root) {
      closeMenu();
      return;
    }
    menuChatRoot = root;
    menuStatus = '';
    const element = ensureMenu();
    element.hidden = false;
    renderMenu();
    positionMenu(root);
  }

  function closeMenu() {
    if (menu) menu.hidden = true;
    menuChatRoot = null;
    menuStatus = '';
  }

  function eligibleMacros(root) {
    const type = chatType(root);
    return macros.filter((macro) => macro.enabled && (macro.scope === 'both' || macro.scope === type));
  }

  function renderMenu() {
    if (!menu || !menuChatRoot) return;
    menu.replaceChildren();

    const header = document.createElement('div');
    header.className = 'ccb-menu-head';
    const title = document.createElement('strong');
    title.textContent = `${chatTitle(menuChatRoot)} buttons`;
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.className = 'ccb-manage';
    manage.title = 'Manage custom chat buttons';
    manage.setAttribute('aria-label', 'Manage custom chat buttons');
    manage.textContent = '⚙';
    manage.addEventListener('click', openEditor);
    header.append(title, manage);
    menu.appendChild(header);

    const list = document.createElement('div');
    list.className = 'ccb-menu-list';
    const available = eligibleMacros(menuChatRoot);
    if (!available.length) {
      const empty = document.createElement('div');
      empty.className = 'ccb-empty';
      empty.textContent = 'No buttons for this chat. Use ⚙ to add one.';
      list.appendChild(empty);
    } else {
      available.forEach((macro) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ccb-macro';
        const isArmed = armed?.macroId === macro.id && armed?.chatId === menuChatRoot.id && armed.expiresAt > Date.now();
        if (isArmed) button.classList.add('ccb-armed');
        button.disabled = sending;
        button.textContent = isArmed ? `Send: ${macro.label}` : macro.label;
        button.title = isArmed ? 'Click again to send' : 'First click loads the message; second click sends it';
        button.addEventListener('click', () => handleMacroClick(macro, menuChatRoot));
        list.appendChild(button);
      });
    }
    menu.appendChild(list);

    const status = document.createElement('div');
    status.className = 'ccb-status';
    status.textContent = menuStatus || 'First click loads · second click sends';
    menu.appendChild(status);
  }

  function positionMenu(root) {
    if (!menu || menu.hidden) return;
    const anchor = chatHeader(root)?.querySelector('[data-ccb-trigger]') || chatHeader(root);
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 12);
    menu.style.width = `${width}px`;
    menu.style.left = `${Math.max(6, Math.min(window.innerWidth - width - 6, rect.right - width))}px`;
    menu.style.top = `${Math.max(6, Math.min(window.innerHeight - menu.offsetHeight - 6, rect.bottom + 5))}px`;
  }

  function setComposerContent(composer, html) {
    composer.focus();
    const prototype = composer.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(composer, html);
    else composer.value = html;
    try {
      composer.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertText',
        data: html,
      }));
    } catch {
      composer.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    composer.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  function armMacro(macro, root, composer) {
    clearArmed();
    setComposerContent(composer, macro.message);
    armed = {
      macroId: macro.id,
      chatId: root.id,
      message: macro.message,
      expiresAt: Date.now() + ARM_DURATION_MS,
    };
    armTimer = window.setTimeout(() => {
      armTimer = null;
      clearArmed();
      menuStatus = 'Send confirmation expired. Click the button again.';
      if (menu && !menu.hidden) renderMenu();
    }, ARM_DURATION_MS);
    menuStatus = 'Message loaded. Click the same button again to send.';
    renderMenu();
    positionMenu(root);
  }

  function clearArmed() {
    armed = null;
    if (armTimer) window.clearTimeout(armTimer);
    armTimer = null;
  }

  async function waitForEnabledSend(button, timeoutMs = 1500) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (button?.isConnected && !button.disabled && button.getAttribute('aria-disabled') !== 'true') return true;
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    return false;
  }

  async function handleMacroClick(macro, root) {
    if (sending) return;
    if (!root?.isConnected) {
      closeMenu();
      return;
    }
    const composer = chatComposer(root);
    if (!composer) {
      menuStatus = 'Open this chat fully before using a message button.';
      renderMenu();
      return;
    }

    const confirmsCurrent = armed?.macroId === macro.id
      && armed?.chatId === root.id
      && armed.expiresAt > Date.now();
    if (!confirmsCurrent) {
      armMacro(macro, root, composer);
      return;
    }
    if (composer.value !== armed.message) {
      clearArmed();
      menuStatus = 'Message changed, so sending was disarmed. Click again to reload it.';
      renderMenu();
      return;
    }

    const sendButton = chatSendButton(root, composer);
    if (!sendButton) {
      menuStatus = 'Torn’s Send button could not be found.';
      renderMenu();
      return;
    }
    menuStatus = 'Waiting for Torn to enable Send…';
    sending = true;
    renderMenu();
    try {
      const enabled = await waitForEnabledSend(sendButton);
      if (!enabled) {
        menuStatus = 'Torn did not enable Send. The message may exceed the chat limit.';
        renderMenu();
        return;
      }
      sendButton.click();
      clearArmed();
      menuStatus = 'Sent.';
      renderMenu();
      window.setTimeout(() => {
        if (menuStatus !== 'Sent.') return;
        menuStatus = '';
        if (menu && !menu.hidden) renderMenu();
      }, 1200);
    } finally {
      sending = false;
      if (menu && !menu.hidden) renderMenu();
    }
  }

  function openEditor() {
    closeMenu();
    if (editor) return;
    editorDraft = macros.map((macro) => ({ ...macro }));
    editor = document.createElement('div');
    editor.id = 'ccb-editor-overlay';
    editor.addEventListener('pointerdown', (event) => {
      if (event.target === editor) closeEditor();
    });
    document.body.appendChild(editor);
    renderEditor();
  }

  function closeEditor() {
    editor?.remove();
    editor = null;
    editorDraft = null;
  }

  function renderEditor() {
    if (!editor || !editorDraft) return;
    editor.replaceChildren();
    const panel = document.createElement('section');
    panel.className = 'ccb-editor';

    const heading = document.createElement('div');
    heading.className = 'ccb-editor-head';
    const headingText = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = 'Custom chat buttons';
    const note = document.createElement('small');
    note.textContent = 'Messages are stored as raw text and passed to Torn chat. Torn decides which HTML and message length it accepts.';
    headingText.append(title, note);
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = '+ Add button';
    add.addEventListener('click', () => {
      editorDraft.push({ id: newId(), label: 'New button', message: '', scope: 'both', enabled: true });
      renderEditor();
    });
    heading.append(headingText, add);
    panel.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'ccb-editor-list';
    if (!editorDraft.length) {
      const empty = document.createElement('div');
      empty.className = 'ccb-editor-empty';
      empty.textContent = 'No custom buttons yet. Choose “Add button” to create one.';
      list.appendChild(empty);
    }
    editorDraft.forEach((macro, index) => list.appendChild(editorMacroCard(macro, index)));
    panel.appendChild(list);

    const footer = document.createElement('div');
    footer.className = 'ccb-editor-footer';
    const help = document.createElement('small');
    help.textContent = 'HTML examples: <br> and <a href="https://www.torn.com/">Open Torn</a>';
    const actions = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'ccb-secondary';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', closeEditor);
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'ccb-primary';
    save.textContent = 'Save buttons';
    save.addEventListener('click', saveEditor);
    actions.append(cancel, save);
    footer.append(help, actions);
    panel.appendChild(footer);
    editor.appendChild(panel);
  }

  function editorMacroCard(macro, index) {
    const card = document.createElement('article');
    card.className = 'ccb-editor-card';

    const toolbar = document.createElement('div');
    toolbar.className = 'ccb-card-toolbar';
    const enabledLabel = document.createElement('label');
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = macro.enabled;
    enabled.addEventListener('change', () => { macro.enabled = enabled.checked; });
    enabledLabel.append(enabled, document.createTextNode(' Enabled'));
    const controls = document.createElement('div');
    const up = smallEditorButton('↑', 'Move up', () => moveDraft(index, index - 1));
    const down = smallEditorButton('↓', 'Move down', () => moveDraft(index, index + 1));
    up.disabled = index === 0;
    down.disabled = index === editorDraft.length - 1;
    const remove = smallEditorButton('Delete', 'Delete button', () => {
      editorDraft.splice(index, 1);
      renderEditor();
    });
    remove.classList.add('ccb-danger');
    controls.append(up, down, remove);
    toolbar.append(enabledLabel, controls);
    card.appendChild(toolbar);

    const fields = document.createElement('div');
    fields.className = 'ccb-card-fields';
    const labelField = document.createElement('label');
    labelField.appendChild(document.createTextNode('Button label'));
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.maxLength = 80;
    labelInput.value = macro.label;
    labelInput.placeholder = 'e.g. War callout';
    labelInput.addEventListener('input', () => { macro.label = labelInput.value; });
    labelField.appendChild(labelInput);

    const scopeField = document.createElement('label');
    scopeField.appendChild(document.createTextNode('Show in'));
    const scope = document.createElement('select');
    [['both', 'Faction and private'], ['faction', 'Faction only'], ['private', 'Private only']].forEach(([value, text]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      option.selected = macro.scope === value;
      scope.appendChild(option);
    });
    scope.addEventListener('change', () => { macro.scope = scope.value; });
    scopeField.appendChild(scope);
    fields.append(labelField, scopeField);
    card.appendChild(fields);

    const messageField = document.createElement('label');
    messageField.className = 'ccb-message-field';
    const messageHeading = document.createElement('span');
    messageHeading.textContent = 'Message / Torn chat HTML';
    const count = document.createElement('small');
    count.textContent = `${macro.message.length.toLocaleString()} characters`;
    const message = document.createElement('textarea');
    message.rows = 5;
    message.spellcheck = false;
    message.value = macro.message;
    message.placeholder = 'Type the message exactly as Torn chat should receive it.';
    message.addEventListener('input', () => {
      macro.message = message.value;
      count.textContent = `${macro.message.length.toLocaleString()} characters`;
    });
    messageField.append(messageHeading, message, count);
    card.appendChild(messageField);
    return card;
  }

  function smallEditorButton(text, title, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ccb-small';
    button.textContent = text;
    button.title = title;
    button.addEventListener('click', action);
    return button;
  }

  function moveDraft(from, to) {
    if (!editorDraft || to < 0 || to >= editorDraft.length) return;
    const [macro] = editorDraft.splice(from, 1);
    editorDraft.splice(to, 0, macro);
    renderEditor();
  }

  function saveEditor() {
    const incomplete = editorDraft.find((macro) => !String(macro.label || '').trim() || !String(macro.message || '').trim());
    if (incomplete) {
      window.alert('Every custom chat button needs both a label and a message.');
      return;
    }
    macros = normalizeMacros(editorDraft);
    saveMacros();
    clearArmed();
    closeEditor();
    scanChatWindows();
  }

  function addStyles() {
    const style = document.createElement('style');
    style.id = 'ccb-styles';
    style.textContent = `
      .ccb-trigger { display:inline-flex; align-items:center; justify-content:center; flex:0 0 25px; width:25px; height:25px; margin-left:auto; border-radius:5px; color:#bfffb1; background:rgba(57,255,20,.12); font:900 17px/1 system-ui,sans-serif; cursor:pointer; user-select:none; box-sizing:border-box; }
      .ccb-trigger:hover, .ccb-trigger:focus { outline:1px solid rgba(126,255,99,.8); color:#fff; background:rgba(57,255,20,.28); }
      #ccb-menu { position:fixed; z-index:2147483600; max-height:min(360px,calc(100vh - 12px)); overflow:hidden; padding:7px; border:1px solid #59616a; border-radius:8px; color:#e9edf0; background:#1d2227; box-shadow:0 10px 32px rgba(0,0,0,.58); font:12px/1.3 system-ui,sans-serif; box-sizing:border-box; }
      #ccb-menu[hidden] { display:none !important; }
      .ccb-menu-head { display:flex; align-items:center; gap:8px; padding:2px 2px 6px; border-bottom:1px solid rgba(255,255,255,.1); }
      .ccb-menu-head strong { min-width:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .ccb-manage { width:27px; height:25px; padding:0; border:1px solid #59616a; border-radius:5px; color:#e9edf0; background:#303840; cursor:pointer; }
      .ccb-menu-list { display:grid; gap:5px; max-height:260px; overflow-y:auto; padding:7px 1px; }
      .ccb-macro { width:100%; padding:7px 9px; border:1px solid #59616a; border-radius:6px; color:#eef3f6; background:#303840; font:700 12px/1.25 system-ui,sans-serif; text-align:left; cursor:pointer; }
      .ccb-macro:hover { border-color:#78d564; background:#38463b; }
      .ccb-macro.ccb-armed { border-color:#92ff7c; color:#dfffd8; background:#27512d; box-shadow:0 0 8px rgba(57,255,20,.28); }
      .ccb-status, .ccb-empty { color:#aeb7bf; font-size:11px; }
      .ccb-status { padding:5px 2px 1px; border-top:1px solid rgba(255,255,255,.1); }
      .ccb-empty { padding:8px 4px; }
      #ccb-editor-overlay { position:fixed; inset:0; z-index:2147483601; display:flex; align-items:center; justify-content:center; padding:14px; background:rgba(0,0,0,.72); box-sizing:border-box; font:12px/1.35 system-ui,sans-serif; }
      .ccb-editor { display:grid; grid-template-rows:auto minmax(0,1fr) auto; width:min(760px,100%); max-height:min(850px,calc(100vh - 28px)); overflow:hidden; border:1px solid #59616a; border-radius:10px; color:#e7ecef; background:#1d2227; box-shadow:0 18px 60px rgba(0,0,0,.68); }
      .ccb-editor button, .ccb-editor input, .ccb-editor select, .ccb-editor textarea { font:inherit; }
      .ccb-editor-head, .ccb-editor-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 12px; }
      .ccb-editor-head { border-bottom:1px solid rgba(255,255,255,.1); }
      .ccb-editor-head > div { display:grid; gap:2px; }
      .ccb-editor-head strong { font-size:15px; }
      .ccb-editor-head small, .ccb-editor-footer small { color:#aeb7bf; }
      .ccb-editor-head button, .ccb-editor-footer button, .ccb-small { padding:6px 9px; border:1px solid #59616a; border-radius:6px; color:#edf2f5; background:#303840; cursor:pointer; }
      .ccb-editor-list { display:grid; gap:9px; overflow-y:auto; padding:11px 12px; }
      .ccb-editor-card { display:grid; gap:8px; padding:10px; border:1px solid #48515a; border-radius:8px; background:#252b31; }
      .ccb-card-toolbar { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .ccb-card-toolbar > div { display:flex; gap:4px; }
      .ccb-small { padding:4px 7px; }
      .ccb-small:disabled { opacity:.42; cursor:not-allowed; }
      .ccb-small.ccb-danger { color:#ffc1c1; border-color:#7d4949; }
      .ccb-card-fields { display:grid; grid-template-columns:minmax(0,1fr) 180px; gap:8px; }
      .ccb-card-fields label, .ccb-message-field { display:grid; gap:4px; color:#cbd3d9; font-weight:700; }
      .ccb-card-fields input, .ccb-card-fields select, .ccb-message-field textarea { width:100%; padding:7px 8px; border:1px solid #555f68; border-radius:6px; outline:none; color:#f0f3f5; background:#15191d; box-sizing:border-box; }
      .ccb-card-fields input:focus, .ccb-card-fields select:focus, .ccb-message-field textarea:focus { border-color:#7fce70; }
      .ccb-message-field textarea { min-height:88px; resize:vertical; font-family:Consolas,monospace; line-height:1.35; }
      .ccb-message-field small { color:#929da6; font-weight:400; text-align:right; }
      .ccb-editor-footer { border-top:1px solid rgba(255,255,255,.1); }
      .ccb-editor-footer > div { display:flex; gap:6px; }
      .ccb-editor-footer .ccb-primary { border-color:#75cb64; color:#e8ffe3; background:#2c5a34; }
      .ccb-editor-empty { padding:24px; color:#aeb7bf; text-align:center; }
      @media (max-width:600px) { .ccb-card-fields { grid-template-columns:1fr; } .ccb-editor-head, .ccb-editor-footer { align-items:flex-start; flex-direction:column; } .ccb-editor-footer > div { align-self:flex-end; } }
    `;
    document.head?.appendChild(style);
  }
})();
