(function registerWar(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const WAR = SLINK.core.war;
  const MODULE_STYLES = `
    .slink-war-subtabs { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:4px; }
    .slink-war-subtab[aria-selected="true"] { border-color:var(--slink-border); background:var(--slink-accent); }
    .slink-war-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; }
    .slink-war-stat { padding:6px; border-radius:6px; background:var(--slink-bg-raised); text-align:center; }
    .slink-war-stat b,.slink-war-stat span { display:block; }
    .slink-war-stat span { color:var(--slink-muted); font-size:9px; }
    .slink-war-card { display:grid; gap:5px; padding:8px 0; border-top:1px solid var(--slink-border-soft); }
    .slink-war-card:first-child { border-top:0; }
    .slink-war-card-head,.slink-war-meta,.slink-war-card-actions { display:flex; align-items:center; flex-wrap:wrap; gap:5px; }
    .slink-war-card-head a { flex:1; color:var(--slink-text); font-weight:700; text-decoration:none; }
    .slink-war-pill { padding:1px 5px; border-radius:999px; background:var(--slink-bg-raised); color:var(--slink-text); }
    .slink-war-online { color:var(--slink-ready); }
    .slink-war-hospital { color:var(--slink-warning); }
    .slink-war-retal { border-left:3px solid var(--slink-error); padding-left:8px; }
    .slink-war-card-actions a { padding:4px 7px; border:1px solid var(--slink-border-soft); border-radius:5px; background:var(--slink-bg-control); color:var(--slink-text); text-decoration:none; }
    .slink-war-empty,.slink-war-note,.slink-war-error { padding:9px; border-radius:6px; background:var(--slink-bg-raised); color:var(--slink-muted); }
    .slink-war-error { background:var(--slink-danger-bg); color:var(--slink-error); }
    .slink-war-settings { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
    .slink-war-settings label { display:grid; gap:3px; color:var(--slink-muted); }
    .slink-war-settings .wide,.slink-war-terms,.slink-war-settings-actions { grid-column:1/-1; }
    .slink-war-settings input,.slink-war-settings select { min-width:0; padding:6px; border:1px solid var(--slink-border-soft); border-radius:5px; background:var(--slink-bg-control); color:var(--slink-text); }
    .slink-war-terms { padding:8px; border:1px solid var(--slink-border); border-radius:6px; background:var(--slink-bg-raised); }
    .slink-war-terms summary { cursor:pointer; font-weight:700; }
    .slink-war-terms a { color:var(--slink-link); }
    .slink-war-agree { display:flex !important; grid-template-columns:auto 1fr !important; align-items:start; gap:7px !important; }
    .slink-war-settings-actions { display:flex; flex-wrap:wrap; gap:6px; }
    @media(max-width:420px) { .slink-war-settings{grid-template-columns:1fr}.slink-war-summary{grid-template-columns:repeat(2,1fr)} }
  `;

  function escape(value) {
    return SLINK.core.format.escapeHtml(value);
  }

  function detectOpponent(ownFactionId) {
    try {
      const cached = JSON.parse(localStorage.getItem('rw-target-panel:opponent') || 'null');
      const id = WAR.positiveInteger(cached?.id);
      const end = Number(cached?.end) || 0;
      if (id && id !== ownFactionId && (!end || end * 1000 > Date.now())) {
        return { opponentFactionId:id, opponentName:String(cached?.name || `Faction ${id}`), startedAt:Number(cached?.start) ? Number(cached.start) * 1000 : 0 };
      }
    } catch {}
    const candidates = [...document.querySelectorAll('a[href*="factions.php"]')]
      .map(link => {
        try {
          const url = new URL(link.href, location.href);
          const id = WAR.positiveInteger(url.searchParams.get('ID'));
          return { id, name:String(link.textContent || '').trim(), element:link };
        } catch { return null; }
      })
      .filter(candidate => candidate?.id && candidate.id !== ownFactionId)
      .filter(candidate => candidate.element.closest('[class*="war" i],#war-react-root,[class*="ranked" i]'));
    const candidate = candidates[0];
    return candidate ? { opponentFactionId:candidate.id, opponentName:candidate.name || `Faction ${candidate.id}`, startedAt:0 } : null;
  }

  SLINK.modules.register({
    id:'war',
    title:'SLINK War',
    defaultShowInTorn:true,
    requiredScopes:['slink.war'],
    matches:url => url.hostname === 'www.torn.com',

    async start(context) {
      let current = null;
      let activeTab = 'targets';
      let stopped = false;
      let busy = false;
      let timer = null;
      let localError = '';
      const shownAlerts = new Set();
      const fullUi = context.presentation === 'full';

      if (fullUi) {
        context.ui.setTitle('SLINK War');
        context.ui.setModuleStyles(MODULE_STYLES);
      }

      function profileUrl(id) { return `https://www.torn.com/profiles.php?XID=${encodeURIComponent(id)}`; }
      function attackUrl(id) { return `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(id)}`; }
      function duration(seconds) { return SLINK.core.format.formatHumanDuration(Math.max(0, seconds)); }

      function targetCards() {
        const members = WAR.sortMembers(current?.runtime?.snapshot?.members || []);
        if (!members.length) return '<div class="slink-war-empty">No eligible targets in the latest shared snapshot.</div>';
        return members.map(member => {
          const hospitalized = WAR.isHospitalized(member);
          const remaining = WAR.statusSeconds(member);
          return `<article class="slink-war-card">
            <div class="slink-war-card-head"><a href="${profileUrl(member.id)}" target="_blank" rel="noopener noreferrer">${escape(member.name)} [${member.id}]</a><span>Lv ${member.level || '?'}</span></div>
            <div class="slink-war-meta"><span class="slink-war-pill ${member.activity === 'Online' ? 'slink-war-online' : ''}">${escape(member.activity)}</span><span class="slink-war-pill ${hospitalized ? 'slink-war-hospital' : ''}">${escape(member.statusState || 'Okay')}${hospitalized ? ` ${duration(remaining)}` : ''}</span>${member.lastActionRelative ? `<span>${escape(member.lastActionRelative)}</span>` : ''}</div>
            <div class="slink-war-card-actions"><a href="${attackUrl(member.id)}" target="_blank" rel="noopener noreferrer">Attack</a><a href="${profileUrl(member.id)}" target="_blank" rel="noopener noreferrer">Profile</a></div>
          </article>`;
        }).join('');
      }

      function retalCards() {
        const retals = current?.runtime?.snapshot?.retals || [];
        if (!retals.length) return '<div class="slink-war-empty">No active retaliation alerts.</div>';
        const now = Math.floor(Date.now() / 1000);
        return retals.map(retal => `<article class="slink-war-card slink-war-retal">
          <div class="slink-war-card-head"><a href="${profileUrl(retal.attackerId)}" target="_blank" rel="noopener noreferrer">${escape(retal.attackerName || `Player ${retal.attackerId}`)} [${retal.attackerId}]</a><span>${duration(Number(retal.expiresAt) - now)}</span></div>
          <div class="slink-war-meta"><span class="slink-war-pill">${retal.againstWarOpponent ? 'War opponent' : 'Retal'}</span><span>Hit ${escape(retal.defenderName || retal.defenderId)}</span></div>
          <div class="slink-war-card-actions"><a href="${attackUrl(retal.attackerId)}" target="_blank" rel="noopener noreferrer">Retaliate</a><a href="${profileUrl(retal.attackerId)}" target="_blank" rel="noopener noreferrer">Profile</a></div>
        </article>`).join('');
      }

      function logCards() {
        const logs = current?.runtime?.logs || [];
        if (!logs.length) return '<div class="slink-war-empty">No loss, escape, or online-hit counters yet.</div>';
        return logs.map(row => `<article class="slink-war-card">
          <div class="slink-war-card-head"><strong>${escape(row.attacker_name || row.attacker_id)} → ${escape(row.defender_name || row.defender_id)}</strong><span>${Number(row.event_count) || 0}</span></div>
          <div class="slink-war-meta"><span class="slink-war-pill">${escape(String(row.outcome || '').replace('_', ' '))}</span><span>${new Date(Number(row.last_seen_at) || 0).toLocaleDateString()} ${new Date(Number(row.last_seen_at) || 0).toLocaleTimeString()}</span></div>
        </article>`).join('');
      }

      function settingsHtml() {
        const settings = current?.settings || {};
        const accepted = current?.terms?.accepted;
        return `<div class="slink-war-settings">
          <details class="slink-war-terms" ${accepted ? '' : 'open'}><summary>SLINK War data terms${accepted ? ' — accepted' : ''}</summary><p>${escape(current?.terms?.summary || 'Loading current terms...')}</p><a href="${escape(current?.terms?.documentUrl || '#')}" target="_blank" rel="noopener noreferrer">Read the complete terms</a>${accepted ? '<p>Current terms accepted.</p>' : '<label class="slink-war-agree"><input id="slink-war-accept" type="checkbox"><span>I agree to the current SLINK API & Data Terms.</span></label>'}</details>
          <label class="wide">Torn API key<input id="slink-war-key" type="password" autocomplete="off" placeholder="${settings.hasTornKey ? 'Saved - leave blank to keep' : 'Required'}"></label>
          <label>Display mode<select id="slink-war-display"><option value="extension" ${settings.displayMode === 'extension' ? 'selected' : ''}>Extension only</option><option value="torn" ${settings.displayMode === 'torn' ? 'selected' : ''}>Fully in Torn</option><option value="hybrid" ${settings.displayMode === 'hybrid' ? 'selected' : ''}>Hybrid retal alerts</option></select></label>
          <label>War mode<select id="slink-war-mode"><option value="war" ${settings.warMode === 'war' ? 'selected' : ''}>Real war</option><option value="termed" ${settings.warMode === 'termed' ? 'selected' : ''}>Termed war</option></select></label>
          <label>Recent idle filter<input id="slink-war-idle" type="number" min="0" max="60" value="${Number(settings.idleMinutes) || 0}"></label>
          <div class="slink-war-settings-actions"><button id="slink-war-save" type="button">Save and authenticate</button><button id="slink-war-clear" type="button">Clear War session</button></div>
        </div>`;
      }

      function render() {
        if (!fullUi) return;
        const snapshot = current?.runtime?.snapshot || {};
        context.ui.setSubtitle(current?.session?.authenticated ? `${current.session.factionCapable ? 'Faction API' : 'Public API'} / ${current.activeWar?.opponentName || 'No active opponent'}` : 'Setup required');
        context.ui.setStatus(localError || current?.runtime?.lastError || current?.runtime?.status || 'SLINK War ready.', (localError || current?.runtime?.lastError) ? 'error' : (current?.configured ? 'ready' : 'normal'));
        context.ui.setActions([{ label:busy ? 'Refreshing...' : 'Refresh', disabled:busy, onClick:() => runCycle(true) }]);
        const body = activeTab === 'targets' ? targetCards() : activeTab === 'retals' ? retalCards() : activeTab === 'logs' ? logCards() : settingsHtml();
        context.ui.setContentHtml(`<div class="slink-war-subtabs">${['targets','retals','logs','settings'].map(tab => `<button class="slink-war-subtab" data-war-tab="${tab}" aria-selected="${activeTab === tab}">${tab[0].toUpperCase()}${tab.slice(1)}</button>`).join('')}</div><div class="slink-war-summary"><div class="slink-war-stat"><b>${snapshot.members?.length || 0}</b><span>Targets</span></div><div class="slink-war-stat"><b>${snapshot.retals?.length || 0}</b><span>Retals</span></div><div class="slink-war-stat"><b>${current?.runtime?.logs?.length || 0}</b><span>Log groups</span></div></div>${localError ? `<div class="slink-war-error">${escape(localError)}</div>` : ''}<div>${body}</div>`);
        bindEvents();
      }

      function bindEvents() {
        const root = context.ui.getContentElement();
        for (const button of root.querySelectorAll('[data-war-tab]')) button.addEventListener('click', () => { activeTab = button.dataset.warTab; render(); });
        root.querySelector('#slink-war-clear')?.addEventListener('click', async () => { current = await SLINK.core.messaging.send('war.session.clear'); render(); });
        root.querySelector('#slink-war-save')?.addEventListener('click', async () => {
          try {
            current = await SLINK.core.messaging.send('war.settings.save', {
              tornKey:root.querySelector('#slink-war-key')?.value || '',
              displayMode:root.querySelector('#slink-war-display')?.value,
              warMode:root.querySelector('#slink-war-mode')?.value,
              idleMinutes:root.querySelector('#slink-war-idle')?.value,
              acceptTerms:root.querySelector('#slink-war-accept')?.checked === true
            });
            localError = '';
            render();
            void runCycle(true);
          } catch (error) { localError = SLINK.core.format.errorMessage(error); render(); }
        });
      }

      async function dismissedRetals() {
        const values = await SLINK.core.storage.get('war.dismissedRetals.v1', {});
        const now = Math.floor(Date.now() / 1000);
        return Object.fromEntries(Object.entries(values || {}).filter(([, expiresAt]) => Number(expiresAt) > now));
      }

      async function renderHybridAlerts() {
        if (context.presentation !== 'headless') return;
        const dismissed = await dismissedRetals();
        const currentIds = new Set();
        for (const retal of current?.runtime?.snapshot?.retals || []) {
          const id = String(retal.attackId);
          currentIds.add(id);
          if (dismissed[id] || shownAlerts.has(id)) continue;
          shownAlerts.add(id);
          context.ui.showAlert({
            id:`war-retal-${id}`,
            title:'SLINK Retaliation',
            subtitle:`${retal.attackerName || `Player ${retal.attackerId}`} / ${duration(Number(retal.expiresAt) - Math.floor(Date.now() / 1000))}`,
            contentHtml:`<div><strong>${escape(retal.attackerName || `Player ${retal.attackerId}`)} [${retal.attackerId}]</strong></div><div>${retal.againstWarOpponent ? 'Current war opponent' : 'Retaliation available'}</div>`,
            actions:[{ label:'Retaliate', href:attackUrl(retal.attackerId) }, { label:'Profile', href:profileUrl(retal.attackerId) }],
            onDismiss:async () => {
              dismissed[id] = Number(retal.expiresAt) || Math.floor(Date.now() / 1000) + 300;
              await SLINK.core.storage.set('war.dismissedRetals.v1', dismissed);
            }
          });
        }
        for (const id of [...shownAlerts]) {
          if (!currentIds.has(id)) {
            context.ui.dismissAlert(`war-retal-${id}`);
            shownAlerts.delete(id);
          }
        }
      }

      async function runCycle(force = false) {
        if (busy || stopped) return;
        busy = true;
        if (fullUi) render();
        try {
          current = await SLINK.core.messaging.send('war.status');
          const opponent = detectOpponent(Number(current?.session?.factionId) || 0);
          current = await SLINK.core.messaging.send('war.cycle.prepare', opponent || {});
          localError = '';
          await renderHybridAlerts();
        } catch (error) {
          localError = SLINK.core.format.errorMessage(error);
          if (!force && /terms|API key|permission/i.test(localError)) localError = '';
        } finally {
          busy = false;
          if (fullUi) render();
          schedule();
        }
      }

      function schedule() {
        if (stopped) return;
        clearTimeout(timer);
        timer = setTimeout(() => void runCycle(false), 10_000);
      }

      current = await SLINK.core.messaging.send('war.status');
      if (fullUi && !current.configured) activeTab = 'settings';
      render();
      void runCycle(false);
      return { stop() { stopped = true; clearTimeout(timer); for (const id of shownAlerts) context.ui.dismissAlert(`war-retal-${id}`); } };
    }
  });
})(globalThis);
