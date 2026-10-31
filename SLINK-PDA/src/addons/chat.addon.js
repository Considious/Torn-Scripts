(() => {
  'use strict';
  const pluginApi = globalThis.SLINK_PDA_PLUGIN_API;

  const EXTENSION_STORAGE_PREFIX = 'slink-extension:chat-buttons:';
  const GM_getValue = (key, fallback) => {
    try { const raw = localStorage.getItem(EXTENSION_STORAGE_PREFIX + key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; }
  };
  const GM_setValue = (key, value) => {
    try { localStorage.setItem(EXTENSION_STORAGE_PREFIX + key, JSON.stringify(value)); } catch {}
  };

  const STORAGE_KEY = 'considious-custom-chat-buttons-v1';
  const ARM_DURATION_MS = 10_000;
  const NEWSLETTER_FALLBACK_LIMIT = 60_000;
  const CHAT_ROOT_SELECTOR = '[id^="faction-"], [id^="private-"], #chatRoot [id="faction"], #chatRoot [id="company"]';
  const COMPOSER_SELECTOR = 'textarea[placeholder="Type your message here..."], textarea[class*="textarea___"], textarea';
  const CHAT_HEADER_SELECTOR = 'button[class*="header___"], [class*="header___"]';
  const CHAT_HEADER_DISCOVERY_SELECTOR = 'button[data-prevent-flyout-swipe="true"][class*="header___"], button[class*="header___"]';
  const MINIMIZE_CONTROL_SELECTOR = 'svg[aria-label="Minimize"], svg[class*="minimizeIcon___"]';
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
  let menuMacros = null;
  let windowMedia = null;
  let menuChatRoot = null;
  let menuStatus = '';
  let editor = null;
  let editorDraft = null;
  let editorSaving = false;
  let armed = null;
  let sending = false;
  let armTimer = null;
  let scanTimer = null;

  let observer = null;
  let enabled = false;
  const activity = globalThis.SLINK_PDA_PAGE_ACTIVITY;
  function syncActivity() {
    observer?.disconnect();
    if (!enabled || !activity.eligible()) { activity.cancel(scanTimer); scanTimer=null; closeMenu(); return; }
    observer.observe(document.documentElement, { childList:true, subtree:true }); scheduleScan();
  }
  activity.subscribe(syncActivity);
  function enable() {
    if (enabled) return;
    enabled = true;
    addStyles();
    observer = new MutationObserver(mutations => {
      if (!activity.eligible()) return;
      if (menuChatRoot && !menuChatRoot.isConnected) closeMenu();
      const selector = CHAT_ROOT_SELECTOR + ',' + CHAT_HEADER_DISCOVERY_SELECTOR + ',' + COMPOSER_SELECTOR + ',[data-testid="editor-root"]';
      if (mutations.some(mutation => [...(mutation.addedNodes || [])].some(node => node.nodeType === 1 && (node.matches?.(selector) || node.querySelector?.(selector))))) scheduleScan();
    });
    syncActivity();
    window.addEventListener('hashchange', scheduleScan);
  }
  window.addEventListener('slink-chat-enable', enable);

  window.addEventListener('resize', () => {
    if (activity.eligible() && menu && !menu.hidden && menuChatRoot) positionMenu(menuChatRoot);
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
      const config=pluginApi.settings('chat',{});
      if(Array.isArray(config.macros))return normalizeMacros(config.macros);
      const legacy=normalizeMacros(GM_getValue(STORAGE_KEY, []));
      if(legacy.length){config.macros=legacy;pluginApi.save().catch(()=>{});}
      return legacy;
    } catch {
      return [];
    }
  }

  async function saveMacros(values) {
    pluginApi.settings('chat',{}).macros=JSON.parse(JSON.stringify(values));
    await pluginApi.save();
  }

  function isNewsletterPage() {
    return /factions\.php$/i.test(window.location.pathname) && /(?:^|[&#])option=newsletter(?:&|$)/i.test(window.location.hash);
  }

  function isNewsletterRoot(root) {
    return root?.dataset?.ccbNewsletterRoot === 'true';
  }

  function contextType(root) {
    if (isNewsletterRoot(root)) return 'newsletter';
    const id = String(root?.id || '');
    if(id==='faction')return 'faction';
    if(id==='company')return 'company';
    if(/^\d+$/.test(id))return 'private';
    if (id.startsWith('faction-')) return 'faction';
    if (id.startsWith('private-')) return 'private';
    return chatHeader(root)?.querySelector('[class*="arrowIcon___"]') ? 'faction' : 'private';
  }

  function contextTitle(root) {
    if (isNewsletterRoot(root)) return 'Faction newsletter';
    const header = chatHeader(root);
    const title = header?.querySelector('span[class*="title___"]')
      || root?.querySelector('span[class*="title___"]')
      || minimizeControl(root)?.parentElement?.querySelector('span');
    return String(title?.textContent || (contextType(root) === 'faction' ? 'Faction' : 'Private chat')).trim();
  }

  function minimizeControl(root) {
    return root?.querySelector(MINIMIZE_CONTROL_SELECTOR) || null;
  }

  function chatHeader(root) {
    const minimize = minimizeControl(root);
    return root?.querySelector(CHAT_HEADER_SELECTOR)
      || minimize?.closest('button, [role="button"], [class*="header___"]')
      || minimize?.parentElement
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

  function currentProfile() {
    let page;
    try { page = new URL(window.location.href); } catch { return null; }
    if (!/\/profiles\.php$/i.test(page.pathname)) return null;
    const playerId = page.searchParams.get('XID');
    if (!/^\d+$/.test(playerId || '')) return null;
    const heading = document.querySelector('h4[class*="user"], h4[class*="name"], [class*="profile"] h4');
    const name = String(heading?.textContent || document.title || '').replace(/\s*\|.*$/, '').trim();
    return { playerId, label:name ? `${name} [${playerId}]` : `Player ${playerId}`, url:`${window.location.origin}/profiles.php?XID=${encodeURIComponent(playerId)}` };
  }

  function profileTokenPresent(value) {
    return /\{\{\s*profile(?:_|\s+)link(?::[^{}]*)?\s*\}\}/i.test(String(value));
  }

  function playerBazaarTokenPresent(value) {
    return /\{\{\s*player(?:_|\s+)bazaar\s*\}\}/i.test(String(value));
  }

  function expandMessageTemplate(template) {
    const pageUrl = escapeChatHtml(window.location.href);
    const pageTitle = escapeChatHtml(document.title.trim() || 'Open page');
    const playerBazaar = playerBazaarTokenPresent(template) ? findPlayerBazaar() : null;
    const profile = profileTokenPresent(template) ? currentProfile() : null;
    return String(template)
      .replace(/\{\{\s*profile(?:_|\s+)link(?::([^{}]*))?\s*\}\}/gi, (token, customLabel) => {
        if (!profile) return token;
        const label = escapeChatHtml(String(customLabel || '').trim() || profile.label);
        return `<a href="${escapeChatHtml(profile.url)}">${label}</a>`;
      })
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
    if (!enabled || !activity.eligible()) return;
    if (scanTimer) activity.cancel(scanTimer);
    scanTimer = activity.defer(() => {
      scanTimer = null;
      scanContexts();
    }, 80);
  }

  function chatRootFromHeader(header) {
    if (!header) return null;
    const legacyRoot = header.closest(CHAT_ROOT_SELECTOR);
    if (legacyRoot) return legacyRoot;
    let candidate = header.parentElement;
    const fallback = candidate;
    for (let depth = 0; candidate && candidate !== document.body && depth < 8; depth += 1) {
      if (candidate.querySelector(COMPOSER_SELECTOR)&&(!header.closest('#chatRoot')||/^(?:\d+|faction(?:-.*)?|private-.+|company)$/.test(candidate.id))) return candidate;
      candidate = candidate.parentElement;
    }
    return header.closest('#chatRoot')?null:fallback;
  }

  function scanContexts() {
    if (!enabled || !activity.eligible()) return;
    const handledHeaders = new Set();
    document.querySelectorAll(CHAT_ROOT_SELECTOR).forEach((root) => {
      const header = chatHeader(root);
      if (!header) return;
      handledHeaders.add(header);
      injectMenuTrigger(root, header);
    });
    document.querySelectorAll(CHAT_HEADER_DISCOVERY_SELECTOR).forEach((header) => {
      if (handledHeaders.has(header) || !minimizeControl(header)) return;
      const root = chatRootFromHeader(header);
      if (root) injectMenuTrigger(root, header);
    });
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

  function injectMenuTrigger(root, suppliedHeader = null) {
    const header = suppliedHeader || chatHeader(root);
    if (!header) return;
    const minimize = minimizeControl(header) || minimizeControl(root);
    const actionContainer = minimize?.parentElement || header;
    const current = actionContainer.querySelector(':scope > [data-ccb-trigger]');
    if (current) return;
    const currentRoot = () => chatRootFromHeader(header) || root;

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
      toggleMenu(currentRoot());
    });
    trigger.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      stopHeaderAction(event);
      toggleMenu(currentRoot());
    });

    actionContainer.insertBefore(trigger, minimize?.parentElement === actionContainer ? minimize : null);
  }

  function ensureMenu() {
    if (menu) return menu;
    menu = document.createElement('section');
    menu.id = 'ccb-menu';
    menu.hidden = true;
    menu.addEventListener('pointerdown', (event) => event.stopPropagation());
    menuMacros=document.createElement('div');menuMacros.dataset.ccbMacros='';
    windowMedia=globalThis.SLINK_CHAT_WINDOW_MEDIA?.({menu,macros:menuMacros,isActive:()=>enabled&&activity.eligible()&&!!menuChatRoot?.isConnected,layout:()=>{if(menuChatRoot)positionMenu(menuChatRoot);}});
    if(!windowMedia)menu.append(menuMacros);
    document.body.appendChild(menu);
    return menu;
  }

  function toggleMenu(root) {
    if(!enabled||!activity.eligible())return;
    if (menu && !menu.hidden && menuChatRoot === root) {
      closeMenu();
      return;
    }
    menuChatRoot = root;
    menuStatus = '';
    const element = ensureMenu();
    element.hidden = false;
    renderMenu(false);
    windowMedia?.resume();
    positionMenu(root);
  }

  function closeMenu() {
    windowMedia?.suspend();
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
    menuMacros.replaceChildren();

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
    menuMacros.appendChild(header);

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
    menuMacros.appendChild(list);
    list.scrollTop = previousScrollTop;

    const status = document.createElement('div');
    status.className = 'ccb-status';
    status.textContent = menuStatus || 'First click loads · second click sends';
    menuMacros.appendChild(status);
  }

  function positionMenu(root) {
    if (!menu || menu.hidden) return;
    const anchor = isNewsletterRoot(root)
      ? root.querySelector('[data-ccb-newsletter-trigger]')
      : (chatHeader(root)?.querySelector('[data-ccb-trigger]') || chatHeader(root));
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(menu.dataset.ccbMediaOpen==='true'?420:280, window.innerWidth - 12);
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

  function normalizeAnchorHrefs(value) {
    return String(value).replace(/<a\b([^>]*?)\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_match, before, doubleQuoted, singleQuoted, bare) => {
      const href = String(doubleQuoted ?? singleQuoted ?? bare ?? '').replaceAll('"', '&quot;');
      return `<a${before}href="${href}"`;
    });
  }

  function armMacro(macro, root, composer) {
    clearArmed();
    const rawMessage = normalizeAnchorHrefs(expandMessageTemplate(macro.message));
    const message = isNewsletterRoot(root) ? rawMessage : globalThis.SLINK_NORMALIZE_CHAT_HTML(rawMessage);
    if (profileTokenPresent(message)) {
      menuStatus = 'No profile was found on this page. Open the player profile and try again.';
      renderMenu();
      positionMenu(root);
      return;
    }
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

  async function waitForEnabledSend(button, timeoutMs = 1500, generation = activity.token()) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (!activity.current(generation)) return false;
      if (button?.isConnected && !button.disabled && button.getAttribute('aria-disabled') !== 'true') return true;
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    return false;
  }

  async function handleMacroClick(macro, root) {
    if(!enabled||!activity.eligible())return;
    if (sending || !activity.eligible()) return;
    const generation = activity.token();
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
      const enabled = await waitForEnabledSend(sendButton, 1500, generation);
      if (!activity.current(generation)) {
        clearArmed();
        menuStatus = 'Page activity changed. Click again to reload the message before sending.';
        return;
      }
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
      return scopeUsesNewsletter(macro.scope)
        ? `${count} / ${NEWSLETTER_FALLBACK_LIMIT.toLocaleString()} newsletter characters • also available in chat`
        : `${count} chat characters`;
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
    help.textContent = 'Live placeholders: {{page_link}}, {{page_url}}, {{page_title}}, {{profile_link}}, and {{Player Bazaar}}';
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
    const profileLinkButton = smallEditorButton('Insert profile link', 'Insert the profile open when this button is used', () => insertToken('{{profile_link}}'));
    const playerBazaarButton = smallEditorButton('Insert player bazaar', 'Insert the player name and bazaar link found on the page', () => insertToken('{{Player Bazaar}}'));
    tokenButtons.append(pageLinkButton, pageUrlButton, profileLinkButton, playerBazaarButton);
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

  async function saveEditor() {
    if(editorSaving||!editorDraft)return;
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
    const oversizedNewsletter = editorDraft.find((macro) => scopeUsesNewsletter(macro.scope)
      && String(macro.message || '').length > NEWSLETTER_FALLBACK_LIMIT);
    if (oversizedNewsletter) {
      window.alert(`Newsletter button "${oversizedNewsletter.label}" exceeds the separate ${NEWSLETTER_FALLBACK_LIMIT.toLocaleString()} character limit.`);
      return;
    }
    const submitted=JSON.stringify(editorDraft),owner=editor,values=normalizeMacros(editorDraft);
    editorSaving=true;
    try {
      await saveMacros(values);
      macros=values;
      clearArmed();
      if(editor===owner&&JSON.stringify(editorDraft)===submitted)closeEditor();
      if(activity.eligible())scanContexts();
    } catch(error) { window.alert('Custom messages were not saved. Your editor has been kept. '+(global.SLINK_ERRORS?.message(error)||String(error.message||error))); }
    finally {editorSaving=false;}
  }

  function addStyles() {
    if(document.getElementById('ccb-styles'))return;
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
      #ccb-menu [hidden] {display:none!important}
      #ccb-menu[data-ccb-media-open=true] {max-height:min(620px,calc(100dvh - 12px));overflow-y:auto;overscroll-behavior:contain;}
      .ccb-media-tabs {display:flex;flex-wrap:wrap;gap:5px;padding:4px 0 8px;position:sticky;top:-7px;z-index:1;background:#1d2227;}
      .ccb-media-tabs button {padding:7px;border:1px solid #777;border-radius:5px;background:#303840;color:#fff;cursor:pointer;font:12px/1.3 system-ui;}
      .ccb-media-tabs button[aria-pressed=true] {background:#645184;border-color:#cba9fa;}
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
  globalThis.SLINK_CHAT_BUTTONS = Object.freeze({ enable, openEditor });
  window.addEventListener('slink-chat-open-editor', openEditor);
})();


(function registerSlinkPdaChat(global){
'use strict';
const api=global.SLINK_PDA_PLUGIN_API;if(!api)return;
const ID='chat',COLORS=[['yellow','#ffe066','#241f00'],['orange','#ff9f43','#2b1300'],['red','#ff6b6b','#2a0000'],['pink','#ff85c2','#2a0016'],['purple','#c792ea','#170025'],['blue','#74c0fc','#001c2e'],['cyan','#66d9e8','#002126'],['green','#8ce99a','#002607'],['lime','#c0eb75','#172500'],['white','#f1f3f5','#111']],SELECTOR='[class*="messageContent___"],[class*="messageText___"],.msg';
let observer=null,timer=null;
global.SLINK_PDA_PAGE_ACTIVITY.subscribe(active=>{observer?.disconnect();global.SLINK_PDA_PAGE_ACTIVITY.cancel(timer);timer=null;if(active&&observer){observer.observe(document.body,{childList:true,subtree:true});schedule();}});
function config(){const value=api.settings(ID,{});value.highlights=Array.isArray(value.highlights)?value.highlights:[];return value;}
function rx(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function palette(id){return COLORS.find(row=>row[0]===id)||COLORS[0];}
function clear(){document.querySelectorAll('mark[data-slink-chat-highlight]').forEach(mark=>mark.replaceWith(document.createTextNode(mark.textContent||'')));document.querySelectorAll(SELECTOR).forEach(node=>{delete node.dataset.slinkChatHighlighted;node.normalize();});}
function scan(){if(!global.SLINK_PDA_PAGE_ACTIVITY.eligible())return;const active=config().highlights.filter(row=>row.enabled!==false&&String(row.term||'').trim());document.querySelectorAll(SELECTOR).forEach(container=>{if(container.dataset.slinkChatHighlighted==='true')return;const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,{acceptNode(node){if(!node.nodeValue?.trim()||node.parentElement?.closest('a,button,textarea,input,mark,[contenteditable="true"],style,script'))return NodeFilter.FILTER_REJECT;return active.some(row=>new RegExp(rx(row.term),'i').test(node.nodeValue))?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}}),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){const pattern=new RegExp(active.map(row=>'('+rx(row.term)+')').join('|'),'gi'),fragment=document.createDocumentFragment();let last=0,found;while((found=pattern.exec(node.nodeValue))!==null){if(found.index>last)fragment.append(document.createTextNode(node.nodeValue.slice(last,found.index)));const row=active.find(candidate=>new RegExp(rx(candidate.term),'i').test(found[0])),colors=palette(row?.color),mark=document.createElement('mark');mark.dataset.slinkChatHighlight='true';mark.textContent=found[0];mark.style.cssText='background:'+colors[1]+';color:'+colors[2]+';padding:0 2px;border-radius:3px;font-weight:800';fragment.append(mark);last=found.index+found[0].length;if(!found[0].length)pattern.lastIndex++;}if(last<node.nodeValue.length)fragment.append(document.createTextNode(node.nodeValue.slice(last)));node.replaceWith(fragment);}container.dataset.slinkChatHighlighted='true';});}
function schedule(){if(!global.SLINK_PDA_PAGE_ACTIVITY.eligible())return;global.SLINK_PDA_PAGE_ACTIVITY.cancel(timer);timer=global.SLINK_PDA_PAGE_ACTIVITY.defer(scan,80);}
function renderBase(){const root=api.root(ID)?.querySelector('[data-chat-base]');if(!root)return;if(root.contains(document.activeElement)&&document.activeElement?.matches('input,select,textarea'))return;const rows=config().highlights;root.innerHTML='<div class="grid"><article class="card full"><div class="card-head"><div><h2>Custom chat buttons</h2><span class="muted">First click loads the HTML message; second click sends it.</span></div></div><p>Unquoted links are corrected to &lt;a href="link"&gt;. Page-link and page-URL tokens remain available in the existing custom-button editor.</p><div class="target-actions"><button type="button" data-chat-action="manage">Manage custom buttons</button></div></article><article class="card full"><div class="card-head"><div><h2>Highlight chat terms</h2><span class="muted">Case-insensitive custom words and phrases.</span></div></div><div data-chat-rows>'+(rows.length?rows.map((row,index)=>'<div class="module-toolbar" data-chat-row="'+index+'"><input type="text" data-chat-term value="'+api.escapeHtml(String(row.term||''))+'" placeholder="Term or phrase"><select data-chat-color>'+COLORS.map(color=>'<option value="'+color[0]+'" '+(row.color===color[0]?'selected':'')+'>'+color[0]+'</option>').join('')+'</select><label><input type="checkbox" data-chat-enabled '+(row.enabled!==false?'checked':'')+'>On</label><button type="button" data-chat-action="delete" data-chat-index="'+index+'">×</button></div>').join(''):'<p>No highlighted terms configured.</p>')+'</div><div class="target-actions"><button type="button" data-chat-action="add">Add term</button><button type="button" data-chat-action="save">Save highlights</button></div></article></div>';}
let giphyPanel=null;
const ffBubbles=global.SLINK_CHAT_FF.mount({activity:global.SLINK_PDA_PAGE_ACTIVITY,enabled:()=>config().ffBubbles===true&&(api.hasScope('slink.qol.chat')||api.hasScope('admin.*')),lookup:ids=>api.chatFairFight(ids)});
global.addEventListener('slink-chat-enable',()=>ffBubbles.sync());
function render(){
  const root=api.root(ID);if(!root)return;
  if(!root.querySelector('[data-chat-base]')){const base=document.createElement('div');base.dataset.chatBase='';root.append(base);}
  renderBase();
  if(!root.querySelector('[data-chat-ff-panel]')){
   const panel=document.createElement('article');panel.className='card full';panel.dataset.chatFfPanel='';panel.innerHTML='<h2>Fair Fight in chat</h2><label><input type="checkbox" data-chat-ff-toggle> Show Fair Fight bubbles beside chat names and profile links</label><p>Uses your saved FFScouter key and SLINK backup. † marks cached backup data; hold or hover for source and age.</p><span role="status" data-chat-ff-status></span>';root.append(panel);
   const toggle=panel.querySelector('input');toggle.checked=config().ffBubbles===true;
   api.listen(toggle,'change',async()=>{config().ffBubbles=toggle.checked;ffBubbles.sync();const status=panel.querySelector('[data-chat-ff-status]');status.textContent='Saving…';try{await api.save();status.textContent='Saved.';}catch{status.textContent='Not saved. Change the option again to retry.';}});
  }
  if(!giphyPanel&&global.SLINK_GIPHY_PANEL)giphyPanel=global.SLINK_GIPHY_PANEL();
  if(giphyPanel&&!root.contains(giphyPanel.host))root.append(giphyPanel.host);
}
function bind(){const root=api.root(ID);if(!root||root.dataset.chatBound==='true')return;root.dataset.chatBound='true';api.listen(root,'click',async event=>{const button=event.target.closest('[data-chat-action]');if(!button)return;const action=button.dataset.chatAction;if(action==='manage')global.dispatchEvent(new CustomEvent('slink-chat-open-editor'));if(action==='add'){config().highlights.push({term:'',color:'yellow',enabled:true});await api.save();render();}if(action==='delete'){config().highlights.splice(Number(button.dataset.chatIndex),1);await api.save();clear();scan();render();}if(action==='save'){config().highlights=[...root.querySelectorAll('[data-chat-row]')].map(row=>({term:String(row.querySelector('[data-chat-term]')?.value||'').trim().slice(0,80),color:String(row.querySelector('[data-chat-color]')?.value||'yellow'),enabled:row.querySelector('[data-chat-enabled]')?.checked!==false})).filter(row=>row.term);await api.save();clear();scan();render();}});}
api.register({id:ID,title:'Chat',shortTitle:'Chat',scopes:['slink.qol.chat','admin.*'],start(){global.dispatchEvent(new CustomEvent('slink-chat-enable'));observer=new MutationObserver(schedule);if(global.SLINK_PDA_PAGE_ACTIVITY.eligible())observer.observe(document.body,{childList:true,subtree:true});scan();},render(){render();bind();},alerts(){return[];}});
})(globalThis);


