// ==UserScript==
// @name         Considious Torn Custom Chat Buttons
// @namespace    Considious [3853023]
// @version      0.2.1
// @description  User-defined two-click HTML messages for Torn chats and faction newsletters.
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
  const CHAT_FALLBACK_LIMIT = 255;
  const NEWSLETTER_FALLBACK_LIMIT = 60_000;
  const CHAT_ROOT_SELECTOR = '[id^="faction-"], [id^="private-"]';
  const COMPOSER_SELECTOR = 'textarea[placeholder="Type your message here..."], textarea[class*="textarea___"], textarea';
  const SCOPE_CONTEXTS = Object.freeze({
    faction: ['faction'],
    private: ['private'],
    newsletter: ['newsletter'],
    both: ['faction', 'private'],
    faction_newsletter: ['faction', 'newsletter'],
    private_newsletter: ['private', 'newsletter'],
    all: ['faction', 'private', 'newsletter'],
  });
  const SCOPES = new Set(Object.keys(SCOPE_CONTEXTS));

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
  scanContexts();

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', scheduleScan);

  window.addEventListener('resize', () => {
    if (menu && !menu.hidden && menuChatRoot) positionMenu(menuChatRoot);
  });

  document.addEventListener('pointerdown', (event) => {
    if (!menu || menu.hidden) return;
    if (menu.contains(event.target) || event.target.closest?.('[data-ccb-trigger], [data-ccb-newsletter-trigger]')) return;
    closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (editor) closeEditor();
    else closeMenu();
  });

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Manage custom message buttons', openEditor);
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

  function isNewsletterPage() {
    return /factions\.php$/i.test(window.location.pathname) && /(?:^|[&#])option=newsletter(?:&|$)/i.test(window.location.hash);
  }

  function isNewsletterRoot(root) {
    return root?.dataset?.ccbNewsletterRoot === 'true';
  }

  function contextType(root) {
    if (isNewsletterRoot(root)) return 'newsletter';
    return String(root?.id || '').startsWith('faction-') ? 'faction' : 'private';
  }

  function contextTitle(root) {
    if (isNewsletterRoot(root)) return 'Faction newsletter';
    const title = root?.querySelector('button[class*="header___"] span[class*="title___"]')
      || root?.querySelector('button svg[aria-label="Minimize"]')?.parentElement?.querySelector('span');
    return String(title?.textContent || (contextType(root) === 'faction' ? 'Faction' : 'Private chat')).trim();
  }

  function chatHeader(root) {
    return root?.querySelector('button[class*="header___"]')
      || [...(root?.querySelectorAll('button') || [])].find((button) => button.querySelector('svg[aria-label="Minimize"]'))
      || null;
  }

  function newsletterSource(root) {
    return root?.querySelector('textarea[class*="sourceArea___"]') || null;
  }

  function newsletterRichEditor(root) {
    return root?.querySelector('[data-testid="editor-root"] .editor-content[contenteditable="true"], [data-testid="editor-root"] [class*="editorContent___"][contenteditable="true"]') || null;
  }

  function newsletterComposer(root) {
    const source = newsletterSource(root);
    const sourceVisible = source && !source.hidden && ![...source.classList].some((name) => name.startsWith('hidden___'));
    return sourceVisible ? source : (newsletterRichEditor(root) || source);
  }

  function contextComposer(root) {
    if (isNewsletterRoot(root)) return newsletterComposer(root);
    return root?.querySelector(COMPOSER_SELECTOR) || null;
  }

  function contextSendButton(root, composer = contextComposer(root)) {
    if (isNewsletterRoot(root)) {
      return root?.querySelector('button[aria-label="Send newsletter"]')
        || [...(root?.querySelectorAll('button') || [])].find((button) => String(button.textContent || '').trim() === 'Send')
        || null;
    }
    const rowButton = composer?.parentElement?.querySelector('button');
    if (rowButton) return rowButton;
    return [...(root?.querySelectorAll('button, [role="button"]') || [])].find((button) => {
      const label = `${button.textContent || ''} ${button.getAttribute?.('aria-label') || ''} ${button.getAttribute?.('title') || ''}`.trim();
      return button.type === 'submit' || /\bsend(?: message)?\b/i.test(label) || Boolean(button.querySelector?.('svg[viewBox="0 0 18 18"]'));
    }) || null;
  }

  function escapeChatHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function bazaarPlayerFromAnchor(anchor) {
    if (!anchor) return null;
    let profileUrl;
    try {
      profileUrl = new URL(anchor.getAttribute('href') || anchor.href || '', window.location.href);
    } catch {
      return null;
    }
    const playerId = profileUrl.searchParams.get('XID');
    if (!/^\d+$/.test(playerId || '')) return null;
    const anchorName = String(anchor.textContent || '').trim();
    if (!anchorName) return null;
    const possessiveName = /(?:'s|’s)$/i.test(anchorName) ? anchorName : `${anchorName}'s`;
    return {
      playerId,
      label: `${possessiveName} Bazaar`,
      url: `${window.location.origin}/bazaar.php?userId=${encodeURIComponent(playerId)}`,
    };
  }

  function findPlayerBazaar() {
    const details = [...document.querySelectorAll('.tt-bazaar-text')];
    for (const detail of details) {
      const container = detail.closest('[class*="messageContent___"], .msg') || detail.parentElement;
      const player = bazaarPlayerFromAnchor(container?.querySelector('a[href*="profiles.php?XID="]'));
      if (player) return player;
    }
    const profileLinks = [...document.querySelectorAll('[class*="messageContent___"] a[href*="profiles.php?XID="], .msg a[href*="profiles.php?XID="]')];
    const anchor = profileLinks.find((link) => /\bbazaar\b/i.test(link.parentElement?.textContent || ''));
    return bazaarPlayerFromAnchor(anchor);
  }

  function playerBazaarTokenPresent(value) {
    return /\{\{\s*player(?:_|\s+)bazaar\s*\}\}/i.test(String(value));
  }

  function expandMessageTemplate(template) {
    const pageUrl = escapeChatHtml(window.location.href);
    const pageTitle = escapeChatHtml(document.title.trim() || 'Open page');
    const playerBazaar = playerBazaarTokenPresent(template) ? findPlayerBazaar() : null;
    return String(template)
      .replace(/\{\{\s*player(?:_|\s+)bazaar\s*\}\}/gi, (token) => {
        if (!playerBazaar) return token;
        return `<a href="${escapeChatHtml(playerBazaar.url)}">${escapeChatHtml(playerBazaar.label)}</a>`;
      })
      .replace(/\{\{page_link(?::([^{}]*))?\}\}/gi, (_match, customLabel) => {
        const label = escapeChatHtml(String(customLabel || '').trim() || 'Open page');
        return `<a href="${pageUrl}">${label}</a>`;
      })
      .replace(/\{\{page_url\}\}/gi, pageUrl)
      .replace(/\{\{page_title\}\}/gi, pageTitle);
  }

  function scheduleScan() {
    if (scanTimer) window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      scanTimer = null;
      scanContexts();
    }, 80);
  }

  function scanContexts() {
    document.querySelectorAll(CHAT_ROOT_SELECTOR).forEach(injectMenuTrigger);
    injectNewsletterTrigger();
    if (menuChatRoot && !menuChatRoot.isConnected) closeMenu();
    else if (menu && !menu.hidden && menuChatRoot) positionMenu(menuChatRoot);
  }

  function findNewsletterRoot() {
    if (!isNewsletterPage()) return null;
    const editorRoot = document.querySelector('[data-testid="editor-root"]');
    return editorRoot?.closest('[class*="letterWrap___"]') || null;
  }

  function injectNewsletterTrigger() {
    const root = findNewsletterRoot();
    if (!root) return;
    root.dataset.ccbNewsletterRoot = 'true';
    if (root.querySelector(':scope > .ccb-newsletter-bar')) return;

    const editorRoot = root.querySelector('[data-testid="editor-root"]');
    if (!editorRoot) return;
    const bar = document.createElement('div');
    bar.className = 'ccb-newsletter-bar';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.dataset.ccbNewsletterTrigger = 'true';
    trigger.className = 'ccb-newsletter-trigger';
    trigger.setAttribute('aria-label', 'Custom newsletter buttons');
    trigger.textContent = '✦ Custom newsletter buttons';
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu(root);
    });

    const limit = document.createElement('small');
    limit.className = 'ccb-newsletter-limit';
    limit.textContent = `Newsletter presets: ${newsletterMessageLimit(root).toLocaleString()} character limit`;
    bar.append(trigger, limit);
    root.insertBefore(bar, editorRoot);
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
    renderMenu(false);
    positionMenu(root);
  }

  function closeMenu() {
    if (menu) menu.hidden = true;
    menuChatRoot = null;
    menuStatus = '';
  }

  function contextId(root) {
    return isNewsletterRoot(root) ? 'newsletter' : String(root?.id || '');
  }

  function eligibleMacros(root) {
    const type = contextType(root);
    return macros.filter((macro) => macro.enabled && scopeIncludes(macro.scope, type));
  }

  function renderMenu(preserveScroll = true) {
    if (!menu || !menuChatRoot) return;
    const previousScrollTop = preserveScroll
      ? (menu.querySelector('.ccb-menu-list')?.scrollTop || 0)
      : 0;
    menu.replaceChildren();

    const header = document.createElement('div');
    header.className = 'ccb-menu-head';
    const title = document.createElement('strong');
    title.textContent = `${contextTitle(menuChatRoot)} buttons`;
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.className = 'ccb-manage';
    manage.title = 'Manage custom message buttons';
    manage.setAttribute('aria-label', 'Manage custom message buttons');
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
      empty.textContent = `No buttons for this ${contextType(menuChatRoot) === 'newsletter' ? 'newsletter' : 'chat'}. Use ⚙ to add one.`;
      list.appendChild(empty);
    } else {
      available.forEach((macro) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ccb-macro';
        const isArmed = armed?.macroId === macro.id && armed?.contextId === contextId(menuChatRoot) && armed.expiresAt > Date.now();
        if (isArmed) button.classList.add('ccb-armed');
        button.disabled = sending;
        button.textContent = isArmed ? `Send: ${macro.label}` : macro.label;
        button.title = isArmed ? 'Click again to send' : 'First click loads the message; second click sends it';
        button.addEventListener('click', () => handleMacroClick(macro, menuChatRoot));
        list.appendChild(button);
      });
    }
    menu.appendChild(list);
    list.scrollTop = previousScrollTop;

    const status = document.createElement('div');
    status.className = 'ccb-status';
    status.textContent = menuStatus || 'First click loads · second click sends';
    menu.appendChild(status);
  }

  function positionMenu(root) {
    if (!menu || menu.hidden) return;
    const anchor = isNewsletterRoot(root)
      ? root.querySelector('[data-ccb-newsletter-trigger]')
      : (chatHeader(root)?.querySelector('[data-ccb-trigger]') || chatHeader(root));
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 12);
    menu.style.width = `${width}px`;
    menu.style.left = `${Math.max(6, Math.min(window.innerWidth - width - 6, rect.right - width))}px`;
    menu.style.top = `${Math.max(6, Math.min(window.innerHeight - menu.offsetHeight - 6, rect.bottom + 5))}px`;
  }

  function tinyNewsletterEditor(root) {
    try {
      if (!window.tinymce) return null;
      const rich = newsletterRichEditor(root);
      const editors = window.tinymce.editors || [];
      return editors.find((editorInstance) => {
        try {
          return editorInstance.getBody?.() === rich;
        } catch {
          return false;
        }
      }) || window.tinymce.activeEditor || null;
    } catch {
      return null;
    }
  }

  function newsletterMessageLimit(root) {
    const nativeLimit = Number(newsletterSource(root)?.maxLength || 0);
    return nativeLimit > 0 ? nativeLimit : NEWSLETTER_FALLBACK_LIMIT;
  }

  function chatMessageLimit(composer) {
    const nativeLimit = Number(composer?.maxLength || 0);
    return nativeLimit > 0 ? nativeLimit : CHAT_FALLBACK_LIMIT;
  }

  function newsletterContent(root, composer = newsletterComposer(root)) {
    const editorInstance = tinyNewsletterEditor(root);
    if (editorInstance?.getContent) {
      try {
        return String(editorInstance.getContent() || '');
      } catch {
        // Fall through to Torn's source or rich editor element.
      }
    }
    if (composer?.tagName === 'TEXTAREA') return String(composer.value || '');
    return String(newsletterRichEditor(root)?.innerHTML || newsletterSource(root)?.value || '');
  }

  function setNewsletterContent(root, html) {
    const editorInstance = tinyNewsletterEditor(root);
    const rich = newsletterRichEditor(root);
    const source = newsletterSource(root);
    let applied = false;

    if (editorInstance?.setContent) {
      try {
        editorInstance.setContent(html || '');
        editorInstance.fire?.('change');
        editorInstance.fire?.('input');
        editorInstance.fire?.('keyup');
        editorInstance.save?.();
        window.tinymce?.triggerSave?.();
        applied = true;
      } catch {
        // The direct editor elements below remain as fallbacks.
      }
    }

    if (rich) {
      if (!applied) rich.innerHTML = html || '';
      try {
        rich.focus({ preventScroll: true });
      } catch {
        rich.focus();
      }
      rich.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      rich.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      applied = true;
    }

    if (source) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(source, html || '');
      else source.value = html || '';
      source.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      source.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
    return applied;
  }

  function contextContent(root, composer = contextComposer(root)) {
    return isNewsletterRoot(root) ? newsletterContent(root, composer) : String(composer?.value || '');
  }

  function setContextContent(root, composer, html) {
    if (isNewsletterRoot(root)) return setNewsletterContent(root, html);
    setComposerContent(composer, html);
    return true;
  }

  function setComposerContent(composer, html) {
    try {
      composer.focus({ preventScroll: true });
    } catch {
      composer.focus();
    }
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
    const message = expandMessageTemplate(macro.message);
    if (playerBazaarTokenPresent(message)) {
      menuStatus = 'No player bazaar was found on this page. Open a bazaar page and try again.';
      renderMenu();
      positionMenu(root);
      return;
    }
    if (isNewsletterRoot(root)) {
      const limit = newsletterMessageLimit(root);
      if (message.length > limit) {
        menuStatus = `Newsletter is ${message.length.toLocaleString()} characters; the separate limit is ${limit.toLocaleString()}.`;
        renderMenu();
        positionMenu(root);
        return;
      }
    } else {
      const limit = chatMessageLimit(composer);
      if (message.length > limit) {
        menuStatus = `Chat message is ${message.length.toLocaleString()} characters; the limit is ${limit.toLocaleString()}.`;
        renderMenu();
        positionMenu(root);
        return;
      }
    }
    if (!setContextContent(root, composer, message)) {
      menuStatus = `Torn's ${isNewsletterRoot(root) ? 'newsletter editor' : 'message box'} could not be updated.`;
      renderMenu();
      return;
    }
    const storedMessage = contextContent(root, composer) || message;
    armed = {
      macroId: macro.id,
      contextId: contextId(root),
      message: storedMessage,
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
    const composer = contextComposer(root);
    if (!composer) {
      menuStatus = `Open the ${isNewsletterRoot(root) ? 'newsletter editor' : 'chat'} fully before using a message button.`;
      renderMenu();
      return;
    }

    const confirmsCurrent = armed?.macroId === macro.id
      && armed?.contextId === contextId(root)
      && armed.expiresAt > Date.now();
    if (!confirmsCurrent) {
      armMacro(macro, root, composer);
      return;
    }
    if (contextContent(root, composer) !== armed.message) {
      clearArmed();
      menuStatus = 'Message changed, so sending was disarmed. Click again to reload it.';
      renderMenu();
      return;
    }

    const sendButton = contextSendButton(root, composer);
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
        menuStatus = `Torn did not enable Send. The message may exceed the ${isNewsletterRoot(root) ? 'newsletter' : 'chat'} limit.`;
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

  function scopeIncludes(scope, context) {
    return SCOPE_CONTEXTS[scope]?.includes(context) === true;
  }

  function scopeFromContexts(contexts) {
    const selected = ['faction', 'private', 'newsletter'].filter((context) => contexts.has(context));
    return Object.keys(SCOPE_CONTEXTS).find((scope) => {
      const values = SCOPE_CONTEXTS[scope];
      return values.length === selected.length && values.every((value) => selected.includes(value));
    }) || '';
  }

  function scopeUsesNewsletter(scope) {
    return scopeIncludes(scope, 'newsletter');
  }

  function scopeUsesChat(scope) {
    return scopeIncludes(scope, 'faction') || scopeIncludes(scope, 'private');
  }

  function messageCountText(macro) {
    const count = String(macro.message || '').length.toLocaleString();
    if (!SCOPES.has(macro.scope)) return `${count} characters — choose at least one destination`;
    if (scopeUsesChat(macro.scope)) {
      const shared = scopeUsesNewsletter(macro.scope) ? ' (newsletter also enabled)' : '';
      return `${count} / ${CHAT_FALLBACK_LIMIT.toLocaleString()} chat characters${shared}`;
    }
    return `${count} / ${NEWSLETTER_FALLBACK_LIMIT.toLocaleString()} newsletter characters`;
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
    title.textContent = 'Custom message buttons';
    const note = document.createElement('small');
    note.textContent = 'Messages are stored as raw HTML. Choose whether each button belongs in chats, newsletters, or both.';
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
    help.textContent = 'Live placeholders: {{page_link}}, {{page_url}}, {{page_title}}, and {{Player Bazaar}}';
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

    let messageCount = null;
    const scopeField = document.createElement('fieldset');
    scopeField.className = 'ccb-scope-field';
    const scopeLegend = document.createElement('legend');
    scopeLegend.textContent = 'Show in';
    scopeField.appendChild(scopeLegend);
    const updateScope = () => {
      const selected = new Set(Array.from(scopeField.querySelectorAll('input[type="checkbox"]:checked'), (input) => input.value));
      macro.scope = scopeFromContexts(selected);
      if (messageCount) messageCount.textContent = messageCountText(macro);
    };
    [
      ['faction', 'Faction chat'],
      ['private', 'Private chat'],
      ['newsletter', 'Newsletter'],
    ].forEach(([value, text]) => {
      const choice = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = value;
      checkbox.checked = scopeIncludes(macro.scope, value);
      checkbox.addEventListener('change', updateScope);
      choice.append(checkbox, document.createTextNode(text));
      scopeField.appendChild(choice);
    });
    fields.append(labelField, scopeField);
    card.appendChild(fields);

    const messageField = document.createElement('div');
    messageField.className = 'ccb-message-field';
    const messageHeading = document.createElement('span');
    messageHeading.className = 'ccb-message-heading';
    const messageTitle = document.createElement('span');
    messageTitle.textContent = 'Message / Torn HTML';
    const tokenButtons = document.createElement('span');
    tokenButtons.className = 'ccb-token-buttons';
    messageCount = document.createElement('small');
    messageCount.textContent = messageCountText(macro);
    const message = document.createElement('textarea');
    message.rows = 5;
    message.spellcheck = false;
    message.value = macro.message;
    message.placeholder = 'Type the message exactly as Torn should receive it.';
    message.addEventListener('input', () => {
      macro.message = message.value;
      messageCount.textContent = messageCountText(macro);
    });
    const insertToken = (token) => {
      const start = message.selectionStart ?? message.value.length;
      const end = message.selectionEnd ?? start;
      message.setRangeText(token, start, end, 'end');
      message.dispatchEvent(new Event('input', { bubbles: true }));
      message.focus();
    };
    const pageLinkButton = smallEditorButton('Insert page link', 'Insert a link to the page open when this button is used', () => insertToken('{{page_link}}'));
    const pageUrlButton = smallEditorButton('Insert raw URL', 'Insert the current page URL without an anchor tag', () => insertToken('{{page_url}}'));
    const playerBazaarButton = smallEditorButton('Insert player bazaar', 'Insert the player name and bazaar link found on the page', () => insertToken('{{Player Bazaar}}'));
    tokenButtons.append(pageLinkButton, pageUrlButton, playerBazaarButton);
    messageHeading.append(messageTitle, tokenButtons);
    messageField.append(messageHeading, message, messageCount);
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
      window.alert('Every custom message button needs both a label and a message.');
      return;
    }
    const noDestination = editorDraft.find((macro) => !SCOPES.has(macro.scope));
    if (noDestination) {
      window.alert(`Choose at least one destination for "${noDestination.label}".`);
      return;
    }
    const oversizedChat = editorDraft.find((macro) => scopeUsesChat(macro.scope)
      && String(macro.message || '').length > CHAT_FALLBACK_LIMIT);
    if (oversizedChat) {
      window.alert(`Chat button "${oversizedChat.label}" exceeds the ${CHAT_FALLBACK_LIMIT.toLocaleString()}-character chat-safe limit.`);
      return;
    }
    const oversizedNewsletter = editorDraft.find((macro) => scopeUsesNewsletter(macro.scope)
      && String(macro.message || '').length > NEWSLETTER_FALLBACK_LIMIT);
    if (oversizedNewsletter) {
      window.alert(`Newsletter button "${oversizedNewsletter.label}" exceeds the separate ${NEWSLETTER_FALLBACK_LIMIT.toLocaleString()} character limit.`);
      return;
    }
    macros = normalizeMacros(editorDraft);
    saveMacros();
    clearArmed();
    closeEditor();
    scanContexts();
  }

  function addStyles() {
    const style = document.createElement('style');
    style.id = 'ccb-styles';
    style.textContent = `
      .ccb-trigger { display:inline-flex; align-items:center; justify-content:center; flex:0 0 25px; width:25px; height:25px; margin-left:auto; border-radius:5px; color:#bfffb1; background:rgba(57,255,20,.12); font:900 17px/1 system-ui,sans-serif; cursor:pointer; user-select:none; box-sizing:border-box; }
      .ccb-trigger:hover, .ccb-trigger:focus { outline:1px solid rgba(126,255,99,.8); color:#fff; background:rgba(57,255,20,.28); }
      .ccb-newsletter-bar { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:8px 0; padding:7px 9px; border:1px solid #59616a; border-radius:7px; color:#dce3e8; background:#1d2227; font:12px/1.3 system-ui,sans-serif; box-sizing:border-box; }
      .ccb-newsletter-trigger { padding:6px 10px; border:1px solid #6e9d64; border-radius:6px; color:#e8ffe3; background:#2c5a34; font:700 12px/1.2 system-ui,sans-serif; cursor:pointer; }
      .ccb-newsletter-trigger:hover, .ccb-newsletter-trigger:focus { border-color:#92ff7c; background:#376d40; outline:none; }
      .ccb-newsletter-limit { color:#9faab3; text-align:right; }
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
      .ccb-editor button, .ccb-editor input, .ccb-editor textarea { font:inherit; }
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
      .ccb-card-fields { display:grid; grid-template-columns:minmax(0,1fr) minmax(260px,.8fr); gap:8px; }
      .ccb-card-fields > label, .ccb-message-field { display:grid; gap:4px; color:#cbd3d9; font-weight:700; }
      .ccb-card-fields > label > input, .ccb-message-field textarea { width:100%; padding:7px 8px; border:1px solid #555f68; border-radius:6px; outline:none; color:#f0f3f5; background:#15191d; box-sizing:border-box; }
      .ccb-card-fields > label > input:focus, .ccb-message-field textarea:focus { border-color:#7fce70; }
      .ccb-scope-field { display:flex; flex-wrap:wrap; align-content:start; gap:5px 10px; min-width:0; margin:0; padding:5px 7px 7px; border:1px solid #555f68; border-radius:6px; color:#cbd3d9; }
      .ccb-scope-field legend { padding:0 3px; font-weight:700; }
      .ccb-scope-field label { display:flex; align-items:center; gap:4px; white-space:nowrap; font-weight:400; cursor:pointer; }
      .ccb-scope-field input { width:auto; margin:0; accent-color:#65b957; }
      .ccb-message-field textarea { min-height:88px; resize:vertical; font-family:Consolas,monospace; line-height:1.35; }
      .ccb-message-field small { color:#929da6; font-weight:400; text-align:right; }
      .ccb-message-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .ccb-token-buttons { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:4px; }
      .ccb-token-buttons .ccb-small { padding:3px 6px; font-size:11px; font-weight:400; }
      .ccb-editor-footer { border-top:1px solid rgba(255,255,255,.1); }
      .ccb-editor-footer > div { display:flex; gap:6px; }
      .ccb-editor-footer .ccb-primary { border-color:#75cb64; color:#e8ffe3; background:#2c5a34; }
      .ccb-editor-empty { padding:24px; color:#aeb7bf; text-align:center; }
      @media (max-width:600px) { .ccb-newsletter-bar { align-items:flex-start; flex-direction:column; } .ccb-newsletter-limit { text-align:left; } .ccb-card-fields { grid-template-columns:1fr; } .ccb-editor-head, .ccb-editor-footer { align-items:flex-start; flex-direction:column; } .ccb-editor-footer > div { align-self:flex-end; } }
    `;
    document.head?.appendChild(style);
  }
})();
