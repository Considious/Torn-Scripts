(function registerLeveling(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const MODULE_STYLES = `
    .leveling-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; }
    .leveling-stat { padding:6px; border-radius:6px; background:#202c39; text-align:center; }
    .leveling-stat b { display:block; font-size:13px; }
    .leveling-stat span { color:#8fa3b6; font-size:9px; }
    .leveling-note, .leveling-error { padding:7px; border-radius:6px; background:#202c39; color:#a9d5ff; }
    .leveling-error { background:#432929; color:#ffc0c0; }
    .leveling-settings { display:grid; grid-template-columns:1fr 1fr; gap:7px; padding-top:2px; }
    .leveling-settings label { display:grid; gap:3px; color:#9eb0c2; }
    .leveling-settings .wide, .leveling-terms, .leveling-settings-actions { grid-column:1/-1; }
    .leveling-settings input { min-width:0; padding:6px; border:1px solid #45586b; border-radius:5px; background:#111821; color:#edf7ff; }
    .leveling-terms { padding:8px; border:1px solid #425d76; border-radius:6px; background:#172330; }
    .leveling-terms p { margin:0 0 7px; color:#d5e5f3; }
    .leveling-terms a { color:#8fc9ff; }
    .leveling-agree { display:flex !important; grid-column:auto !important; grid-template-columns:auto 1fr !important; align-items:start; gap:7px !important; margin-top:8px; color:#fff !important; }
    .leveling-agree input { margin-top:2px; }
    .leveling-terms-summary { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .leveling-settings-actions { display:flex; flex-wrap:wrap; gap:6px; }
    .leveling-settings-actions button, .leveling-terms button { min-height:29px; padding:4px 7px; }
    .leveling-danger { border-color:#754444; background:#482828; color:#ffd0d0; }
    .leveling-target { padding:8px 0; border-top:1px solid rgba(255,255,255,.08); }
    .leveling-target:first-child { border-top:0; }
    .leveling-target-head, .leveling-target-meta, .leveling-target-actions { display:flex; align-items:center; flex-wrap:wrap; gap:5px; }
    .leveling-target-head a { flex:1; color:#fff; font-weight:700; text-decoration:none; }
    .leveling-level { color:#ffd27a; }
    .leveling-target-meta { margin-top:4px; color:#9eb0c2; }
    .leveling-badge { padding:1px 5px; border-radius:8px; background:#303e4d; color:#e3edf6; }
    .leveling-target-actions { margin-top:6px; }
    .leveling-target-actions a { padding:4px 7px; border:1px solid rgba(255,255,255,.15); border-radius:5px; background:#2b3745; color:#fff; text-decoration:none; }
    .leveling-empty { padding:14px 3px; color:#9eb0c2; text-align:center; }
    @media (max-width:420px) {
      .leveling-settings { grid-template-columns:1fr; }
      .leveling-settings-actions { flex-direction:column; }
      .leveling-summary { grid-template-columns:repeat(2,1fr); }
    }
  `;

  function escape(value) {
    return SLINK.core.format.escapeHtml(String(value ?? ''));
  }

  function shortNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? SLINK.core.format.shortNumber(number) : 'Unknown';
  }

  function humanFuture(timestamp) {
    const seconds = Math.ceil((Number(timestamp) - Date.now()) / 1000);
    return seconds <= 0 ? 'Due now' : `in ${SLINK.core.format.formatHumanDuration(seconds)}`;
  }

  function parseVisibleRemainingMs(text) {
    const lower = String(text || '').toLowerCase();
    const units = [
      [/([0-9]+)\s*d(?:ay)?s?/, 86_400_000],
      [/([0-9]+)\s*h(?:our)?s?/, 3_600_000],
      [/([0-9]+)\s*m(?:in(?:ute)?)?s?/, 60_000],
      [/([0-9]+)\s*s(?:ec(?:ond)?)?s?/, 1_000]
    ];
    return units.reduce((total, [pattern, multiplier]) => {
      const match = lower.match(pattern);
      return total + (match ? Number(match[1]) * multiplier : 0);
    }, 0);
  }

  function detectAttackStatus(text) {
    const lower = String(text || '').toLowerCase();
    if (lower.includes('federal jail')) return 'Federal';
    if (lower.includes('hiding out')) return 'Hiding Out';
    if (lower.includes('in hospital') || lower.includes('hospitalized')) return 'Hospital';
    if (lower.includes('traveling') || lower.includes('flying')) return 'Traveling';
    if (lower.includes('abroad')) return 'Abroad';
    return '';
  }

  SLINK.modules.register({
    id: 'leveling',
    title: 'SLINK Leveling',
    defaultShowInTorn: true,
    requiredScopes: ['slink.level'],
    matches: url => url.hostname === 'www.torn.com',

    async start(context) {
      let current = null;
      let busy = false;
      let settingsOpen = false;
      let termsOpen = false;
      let stopped = false;
      let cycleTimer = null;
      let leaderTimer = null;
      let localError = '';
      let lastActivityTouchAt = 0;

      context.ui.setTitle('SLINK Leveling');
      context.ui.setModuleStyles(MODULE_STYLES);

      function settingsHtml() {
        const accepted = current?.terms?.accepted === true;
        const admin = SLINK.core.permissions.hasScope(current?.permissions, 'admin.*');
        const showTerms = !accepted || termsOpen;
        const settings = current?.settings || {};
        return `
          <div class="leveling-settings">
            <div class="leveling-terms">
              ${showTerms ? `
                <p><strong>Required SLINK Leveling disclosure</strong></p>
                <p>${escape(current?.terms?.summary || 'Loading current terms...')}</p>
                <a href="${escape(current?.terms?.documentUrl || '#')}" target="_blank" rel="noopener noreferrer">Read the complete SLINK API &amp; Data Terms</a>
                <label class="leveling-agree">
                  <input id="leveling-accept-terms" type="checkbox" ${accepted ? 'checked' : ''}>
                  <span>I agree to terms ${escape(current?.terms?.version || '')} and the current Leveling disclosure.</span>
                </label>
                ${accepted ? '<button id="leveling-hide-terms" type="button">Hide terms</button>' : ''}
              ` : `
                <div class="leveling-terms-summary">
                  <span>Terms ${escape(current?.terms?.version || '')} accepted</span>
                  <button id="leveling-show-terms" type="button">View terms</button>
                </div>
              `}
            </div>
            <label class="wide">Torn API key
              <input id="leveling-torn-key" type="password" autocomplete="off" placeholder="${settings.hasTornKey ? 'Saved - leave blank to keep' : 'Required'}">
            </label>
            <label class="wide">FFScouter API key
              <input id="leveling-ff-key" type="password" autocomplete="off" placeholder="${settings.hasFfKey ? 'Saved - leave blank to keep' : 'Add for refined Fair Fight values'}">
            </label>
            <label>Poll seconds
              <input id="leveling-poll" type="number" min="60" max="300" value="${Number(settings.pollSeconds) || 300}">
            </label>
            <label class="wide leveling-agree">
              <input id="leveling-contributor-only" type="checkbox" ${settings.contributorOnly ? 'checked' : ''}>
              <span>Contribute API only — supply checks when Leveling is in use, without receiving targets or counting as an active user.</span>
            </label>
            ${admin ? `
              <label class="wide leveling-agree">
                <input id="leveling-zero-contribution" type="checkbox" ${Number(settings.apiContributionLimit) === 0 ? 'checked' : ''}>
                <span>Admin override: use zero routine Torn API calls for SLINK contribution</span>
              </label>
            ` : ''}
            <label>Minimum FF
              <input id="leveling-min-ff" type="number" min="1" max="3" step="0.1" value="${Number(settings.minFF) || 1}">
            </label>
            <label>Maximum FF
              <input id="leveling-max-ff" type="number" min="1" max="3" step="0.1" value="${Number(settings.maxFF) || 3}">
            </label>
            <div class="leveling-settings-actions">
              <button id="leveling-save" type="button">Save and authenticate</button>
              <button id="leveling-clear-session" type="button">Clear session</button>
              <button id="leveling-hide-all" class="leveling-danger" type="button">Hide all SLINK UI</button>
            </div>
          </div>
        `;
      }

      function targetsHtml(targets) {
        if (!targets?.length) return `<div class="leveling-empty">${busy ? 'Asking SLINK for targets...' : 'No recommendations are currently assigned.'}</div>`;
        return targets.map(target => {
          const profile = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(target.id)}`;
          const attack = `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(target.id)}`;
          const fairFight = finiteFairFight(target.fair_fight, target.fair_fight_estimated);
          return `
            <article class="leveling-target">
              <div class="leveling-target-head">
                <a href="${profile}" target="_blank" rel="noopener noreferrer">${escape(target.name)} [${escape(target.id)}]</a>
                <span class="leveling-level">Lv ${escape(target.level ?? '?')}</span>
              </div>
              <div class="leveling-target-meta">
                <span class="leveling-badge">${escape(target.status || 'Unknown')}</span>
                <span class="leveling-badge">FF ${fairFight}</span>
                ${target.local_difficulty ? `<span class="leveling-badge">${escape(target.local_difficulty)}</span>` : ''}
                <span class="leveling-badge">BS ${escape(shortNumber(target.bs_estimate ?? target.total_stats))}</span>
                <span class="leveling-badge">Hosp 24h: ${Number(target.hospitalizations_24h) || 0}</span>
              </div>
              <div class="leveling-target-meta">
                <span>${escape(target.competition_tier || 'Prime')} ${Number(target.competition_score) || 0}</span>
                <span>Next check: ${target.next_check_at ? escape(humanFuture(target.next_check_at)) : 'Unscheduled'}</span>
              </div>
              <div class="leveling-target-actions">
                <a href="${attack}" target="_blank" rel="noopener noreferrer">Attack</a>
                <a href="${profile}" target="_blank" rel="noopener noreferrer">Profile</a>
              </div>
            </article>
          `;
        }).join('');
      }

      function finiteFairFight(value, estimated) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? `${estimated ? '~' : ''}${parsed.toFixed(2)}` : '?';
      }

      function render() {
        const runtime = current?.runtime || {};
        const usage = current?.tornApiUsage || { count: 0, limit: 60 };
        context.ui.setSubtitle(current?.session?.authenticated
          ? `${runtime.contributorOnly || runtime.idle ? 'API contributor' : (runtime.collector ? 'API collector' : 'Standby device')} / Worker ${runtime.workerVersion || 'connected'}`
          : 'Setup required');
        context.ui.setStatus(
          localError || runtime.lastError || runtime.cycleStatus || 'SLINK Leveling ready.',
          (localError || runtime.lastError) ? 'error' : (current?.configured ? 'ready' : 'normal')
        );
        context.ui.setActions([
          { id: 'refresh', label: busy ? 'Syncing...' : 'Refresh', disabled: busy, onClick: () => runCycle(true) },
          { id: 'settings', label: settingsOpen ? 'Close settings' : 'Settings', onClick: () => { settingsOpen = !settingsOpen; if (!settingsOpen) termsOpen = false; render(); } }
        ]);
        context.ui.setContentHtml(`
          <div class="leveling-summary">
            <div class="leveling-stat"><b>${runtime.targets?.length || 0}</b><span>Targets</span></div>
            <div class="leveling-stat"><b>${Number(runtime.lastCycleChecked) || 0}</b><span>Assigned</span></div>
            <div class="leveling-stat"><b>${Number(runtime.lastCycleReported) || 0}</b><span>Reported</span></div>
            <div class="leveling-stat"><b>${Number(runtime.pendingChecks) || 0}</b><span>Pending</span></div>
            <div class="leveling-stat"><b>${usage.count}/${usage.limit}</b><span>API / min</span></div>
            <div class="leveling-stat"><b>${current?.settings?.hasFfKey ? 'Yes' : 'Local'}</b><span>FFScouter</span></div>
          </div>
          ${!current?.configured ? '<div class="leveling-note">Add your Torn API key and accept the current terms to start.</div>' : ''}
          ${(localError || runtime.lastError) ? `<div class="leveling-error">${escape(localError || runtime.lastError)}</div>` : ''}
          ${settingsOpen ? settingsHtml() : ''}
          <div>${targetsHtml(runtime.targets || [])}</div>
        `);
        bindEvents();
      }

      function bindEvents() {
        const root = context.ui.getContentElement();
        root.addEventListener('pointerdown', () => void markActivity(), { once: true });
        root.querySelector('#leveling-show-terms')?.addEventListener('click', () => { termsOpen = true; render(); });
        root.querySelector('#leveling-hide-terms')?.addEventListener('click', () => { termsOpen = false; render(); });
        root.querySelector('#leveling-clear-session')?.addEventListener('click', async () => {
          current = await SLINK.core.messaging.send('leveling.session.clear');
          render();
        });
        root.querySelector('#leveling-hide-all')?.addEventListener('click', async () => {
          const confirmed = global.confirm(
            'This removes the SLINK panel completely while background contribution continues. ' +
            'Use the extension popup or dashboard to show it again. Hide all SLINK UI now?'
          );
          if (!confirmed) return;
          await SLINK.core.storage.set('ui.pagePanelHidden', true);
          context.ui.setHidden(true);
        });
        root.querySelector('#leveling-save')?.addEventListener('click', async () => {
          localError = '';
          const accept = root.querySelector('#leveling-accept-terms');
          const payload = {
            tornKey: root.querySelector('#leveling-torn-key')?.value || '',
            ffKey: root.querySelector('#leveling-ff-key')?.value || '',
            pollSeconds: root.querySelector('#leveling-poll')?.value,
            apiContributionLimit: root.querySelector('#leveling-zero-contribution')?.checked ? 0 : 60,
            contributorOnly: root.querySelector('#leveling-contributor-only')?.checked === true,
            minFF: root.querySelector('#leveling-min-ff')?.value,
            maxFF: root.querySelector('#leveling-max-ff')?.value,
            acceptTerms: Boolean(accept?.checked && !current?.terms?.accepted)
          };
          if (!current?.terms?.accepted && !accept?.checked) {
            localError = 'Accept the current SLINK terms before authentication.';
            render();
            return;
          }
          busy = true;
          render();
          let runAfterSave = false;
          try {
            current = await SLINK.core.messaging.send('leveling.settings.save', payload);
            settingsOpen = false;
            termsOpen = false;
            runAfterSave = true;
          } catch (error) {
            localError = SLINK.core.format.errorMessage(error);
          } finally {
            busy = false;
            render();
            if (runAfterSave) void runCycle(true);
          }
        });
      }

      async function markActivity() {
        if (!current?.configured || current?.settings?.contributorOnly) return;
        if (Date.now() - lastActivityTouchAt < 60_000) return;
        lastActivityTouchAt = Date.now();
        try {
          current = await SLINK.core.messaging.send('leveling.activity.touch');
        } catch {}
      }

      async function refreshStatus() {
        current = await SLINK.core.messaging.send('leveling.status');
        if (!current.configured) settingsOpen = true;
        render();
      }

      async function isLeader() {
        const result = await SLINK.core.messaging.send('leveling.leader.claim');
        return result.leader === true;
      }

      async function runPacedChecks(checks, pollSeconds) {
        if (!checks.length) return;
        const horizon = Math.max(0, Number(pollSeconds) * 1000 - 5_000);
        const spacing = checks.length > 1 ? horizon / (checks.length - 1) : 0;
        const startedAt = Date.now();
        const observations = [];
        const failures = [];
        await Promise.all(checks.map(async (check, index) => {
          const delay = Math.max(0, startedAt + Math.floor(index * spacing) - Date.now());
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          if (stopped) return;
          try {
            const observation = await SLINK.core.messaging.send('leveling.check', check);
            if (observation?.completed_locally !== true) observations.push(observation);
          } catch (error) {
            failures.push(error);
          }
        }));
        if (observations.length) current = await SLINK.core.messaging.send('leveling.observations.submit', { observations });
        if (failures.length) localError = `${failures.length} assigned Torn check${failures.length === 1 ? '' : 's'} failed.`;
      }

      async function runCycle(force = false) {
        if (busy || stopped) return;
        if (force) await markActivity();
        if (!await isLeader()) {
          if (force) localError = 'Another Torn tab is currently coordinating SLINK Leveling.';
          render();
          scheduleNext(10_000);
          return;
        }
        busy = true;
        localError = '';
        render();
        const startedAt = Date.now();
        try {
          const prepared = await SLINK.core.messaging.send('leveling.cycle.prepare');
          current = prepared.status;
          render();
          await runPacedChecks(prepared.checks || [], current.settings.pollSeconds);
          await refreshStatus();
        } catch (error) {
          localError = SLINK.core.format.errorMessage(error);
        } finally {
          busy = false;
          render();
          const elapsed = Date.now() - startedAt;
          const nextPollSeconds = Number(current?.runtime?.nextPollSeconds || current?.settings?.pollSeconds || 300);
          scheduleNext(Math.max(5_000, nextPollSeconds * 1000 - elapsed));
        }
      }

      function scheduleNext(delay) {
        clearTimeout(cycleTimer);
        cycleTimer = setTimeout(() => void runCycle(false), delay);
      }

      async function reportAttackPage() {
        const page = new URL(global.location.href);
        if (page.searchParams.get('sid') !== 'attack') return false;
        const targetId = Number(page.searchParams.get('user2ID'));
        if (!Number.isInteger(targetId) || targetId <= 0 || document.visibilityState !== 'visible') return false;
        const nodes = [...document.querySelectorAll('[class*="status"], [class*="profile"], [class*="info"], [data-testid*="status"]')];
        const candidates = [...nodes.map(node => node.innerText || node.textContent || ''), document.body?.innerText || ''];
        for (const text of candidates) {
          const status = detectAttackStatus(text);
          if (!status) continue;
          const remaining = parseVisibleRemainingMs(text);
          await SLINK.core.messaging.send('leveling.attack.observe', {
            targetId,
            state: status,
            description: text.trim().slice(0, 500),
            until: remaining > 0 ? Math.floor((Date.now() + remaining) / 1000) : 0
          });
          return true;
        }
        return false;
      }

      leaderTimer = setInterval(() => void isLeader(), 5_000);
      await refreshStatus();
      if (current.configured) void runCycle(false);
      let attackAttempts = 0;
      const attackTimer = setInterval(async () => {
        attackAttempts++;
        if (await reportAttackPage() || attackAttempts >= 6) clearInterval(attackTimer);
      }, 1_000);

      return Object.freeze({
        async stop() {
          stopped = true;
          clearTimeout(cycleTimer);
          clearInterval(leaderTimer);
          clearInterval(attackTimer);
          await SLINK.core.messaging.send('leveling.leader.release');
        }
      });
    }
  });
})(globalThis);
