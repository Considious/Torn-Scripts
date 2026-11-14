const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.SLINK_PLAYWRIGHT_MODULE || 'playwright');
const max = '<input type="button" class="wai-btn" aria-label="Click here to add the maximum amount" data-action="max">';
const item = (id, name) => `<div class="row___fixture"><button aria-controls="item-${id}-itemInfoWrapper">${name}</button><form id="item-${id}-form">${max}<input data-input-money-visible="true" placeholder="Qty"></form><button type="submit" form="item-${id}-form" aria-controls="item-${id}-buyPanel" aria-expanded="false" data-action="buy">Buy</button></div>`;
const slot = (i) => `<li class="inventorySlot___fixture"><button type="button" class="itemButton___fixture" aria-label="Opium slot ${i}" aria-expanded="false" data-action="select"><img class="torn-item" alt="Opium"></button></li>`;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.SLINK_BROWSER_EXECUTABLE });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile:true, hasTouch:true });
    page.setDefaultTimeout(3000);
    page.on('pageerror', error => console.error(error));
    await page.route('https://www.torn.com/**', route => route.fulfill({ contentType: 'text/html', body:
      `<meta name="viewport" content="width=device-width, initial-scale=1"><main><div id="travel-root"><ul class="inventoryPanel___fixture" aria-label="Inventory 2 items">${slot(1)}${slot(2)}</ul>${item(1, 'Xanax')}${item(2, 'Shark Fin')}<a href="" class="travel-home-header-button" aria-controls="travel-home-panel" aria-expanded="false" data-action="home">Travel home</a></div></main>` }));
    await page.goto('https://www.torn.com/travelagency.php');
    await page.evaluate(({max}) => {
      window.nativeClicks = [];
      document.addEventListener('click', event => {
        const control = event.target.closest('[data-action]');
        if (!control) return;
        event.preventDefault();
        const action = control.dataset.action;
        window.nativeClicks.push(action);
        if (action === 'select') {
          control.setAttribute('aria-expanded','true');
          control.parentElement.insertAdjacentHTML('beforeend','<div class="panel___fixture"><div role="group"><button type="button" data-action="sell">Sell</button></div></div>');
        }
        if (action === 'sell') {
          control.setAttribute('aria-current','true');
          control.parentElement.parentElement.insertAdjacentHTML('beforeend','<form>'+max+'<input aria-label="Amount to sell" data-input-money-visible="true"><button type="submit" data-action="confirm">Yes</button></form>');
        }
        if (action === 'max') {
          control.form.querySelector('[data-input-money-visible]').value = '18';
          control.form.querySelector('[data-input-money-visible]').dispatchEvent(new Event('input',{bubbles:true}));
        }
        if (action === 'buy' || action === 'home') control.setAttribute('aria-expanded','true');
      });
    }, {max});
    const inject = () => page.addScriptTag({ path: path.resolve(__dirname,'../src/addons/travel-run.js') });
    await inject();
    const ui = page.locator('#slink-travel-run');
    await ui.getByRole('button', { name:'Set up Travel Run' }).tap();
    await ui.locator('input[name="sell"]').fill('Opium');
    await ui.locator('textarea[name="buys"]').fill('Xanax\nShark Fin');
    await ui.getByRole('combobox').selectOption('heal');
    await ui.getByRole('button', { name:'Save and start run' }).tap();
    assert.equal(await ui.locator('details').getAttribute('open'), null);
    for (const name of ['Select Opium to sell','Open Sell for Opium','Set maximum sale quantity','Confirm: Sell Opium done',
      'Unavailable · next choice','Set maximum quantity for Shark Fin','Open Buy for Shark Fin','Confirm: Buy Shark Fin done','Open Travel Home']) {
      await ui.getByRole('button', {name, exact:true}).tap();
    }
    assert.deepEqual(await page.evaluate(() => window.nativeClicks), ['select','sell','max','max','buy','home']);
    await page.reload();
    await inject();
    assert.match(await ui.getByRole('status').textContent(), /Next: Return to Torn/);
    await page.locator('#travel-root').evaluate(root => {
      root.insertAdjacentHTML('afterend','<div id="travel-root"><h2>Travel</h2></div>');
      root.remove();
    });
    await page.waitForFunction(() => !!document.querySelector('#travel-root > #slink-travel-run'));
    assert.match(await ui.getByRole('status').textContent(), /Next: Return to Torn/);
    console.log('Travel Run browser fixture passed (sell, buy priority, live Max, return, reload, remount).');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
