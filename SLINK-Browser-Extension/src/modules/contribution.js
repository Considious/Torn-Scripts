(function registerContribution(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  const STYLES = `
    .donation-card{display:grid;gap:8px}.donation-card p{margin:0;color:var(--slink-muted)}
    .donation-card a{color:var(--slink-accent)}.donation-card input[type=password]{width:100%;padding:7px;border:1px solid var(--slink-border-soft);border-radius:6px;background:#0e151e;color:var(--slink-text)}
    .donation-agree{display:flex;align-items:flex-start;gap:7px}.donation-actions{display:flex;gap:6px}.donation-actions button{flex:1;padding:4px 7px}.donation-danger{background:#512c2c;color:#ffd0d0}
  `;

  SLINK.modules.register({
    id:'contribution',
    title:'API Donation',
    defaultShowInTorn:false,
    requiredScopes:[],
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      let terms = null;
      let state = null;
      context.ui.setModuleStyles(STYLES);

      function render() {
        const active = state?.donation?.active;
        context.ui.setStatus(active ? 'Public Only key donation active' : 'No donated key', active ? 'ready' : 'normal');
        context.ui.setContentHtml(active ? `
          <div class="donation-card"><strong>Thank you for contributing</strong>
          <p>Torn user ${SLINK.core.format.escapeHtml(state.donation.user_id)} / ${SLINK.core.format.escapeHtml(state.donation.access_type)}</p>
          <p>Your encrypted key can support approved SLINK public-data jobs while this browser is offline.</p>
          <div class="donation-actions"><button id="donation-replace" type="button">Replace key</button><button id="donation-revoke" class="donation-danger" type="button">Revoke donation</button></div></div>
        ` : `
          <div class="donation-card"><strong>Donate a Torn Public Only key</strong>
          <p>${SLINK.core.format.escapeHtml(terms?.summary || 'Loading donation terms...')}</p>
          <a href="${SLINK.core.format.escapeHtml(terms?.document_url || '#')}" target="_blank" rel="noopener noreferrer">Read the complete donation terms</a>
          <input id="donation-key" type="password" autocomplete="off" placeholder="Public Only Torn API key">
          <label class="donation-agree"><input id="donation-accept" type="checkbox"><span>I agree to donation terms ${SLINK.core.format.escapeHtml(terms?.version || '')}.</span></label>
          <div class="donation-actions"><button id="donation-submit" type="button">Encrypt and donate key</button></div></div>
        `);
        bind();
      }

      function bind() {
        const root = context.ui.getContentElement();
        root.querySelector('#donation-submit')?.addEventListener('click', async event => {
          event.currentTarget.disabled = true;
          try {
            state = await SLINK.core.messaging.send('contribution.donate', {
              apiKey:root.querySelector('#donation-key').value,
              acceptTerms:root.querySelector('#donation-accept').checked
            });
            render();
          } catch (error) { context.ui.setStatus(SLINK.core.format.errorMessage(error), 'error'); event.currentTarget.disabled = false; }
        });
        root.querySelector('#donation-revoke')?.addEventListener('click', async () => {
          if (!confirm('Revoke this donation? The encrypted key material will be erased and can no longer be used.')) return;
          state = await SLINK.core.messaging.send('contribution.revoke'); render();
        });
        root.querySelector('#donation-replace')?.addEventListener('click', async () => { state = { configured:false, donation:null }; render(); });
      }

      [terms, state] = await Promise.all([
        SLINK.core.messaging.send('contribution.terms'),
        SLINK.core.messaging.send('contribution.status').catch(() => ({ configured:false, donation:null }))
      ]);
      render();
      return { stop() {} };
    }
  });
})(globalThis);
