'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { startStaticServer, startBrowser } = require('../scripts/export-menu-gif.js');
async function run() {
  const site = await startStaticServer(); let browser;
  async function screenshot(page, name) {
    if (!process.env.EREDITA_MYTHOLOGY_PREVIEW_DIR) return;
    fs.mkdirSync(process.env.EREDITA_MYTHOLOGY_PREVIEW_DIR, { recursive: true });
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.env.EREDITA_MYTHOLOGY_PREVIEW_DIR, name + '.png'), Buffer.from(data, 'base64'));
  }
  try {
    browser = await startBrowser(); const page = browser.page;
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: site.url + '?intro=0' });
    await page.waitFor('window.Eredita?.GameView?.getState() && Eredita.MenuScene?.diagnostics.ready');
    assert.equal(await page.evaluate('Eredita.Mythology.all.length'), 16);
    assert.equal(await page.evaluate('Eredita.Cards.mythological.length'), 5);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-card').length"), 0, 'No new interface mounted automatically');
    const before = await page.evaluate('JSON.stringify(Eredita.GameView.getState())');
    await page.evaluate(`(() => {
      const d = window.mythologyPreview = document.createElement('dialog');
      d.style.cssText = 'width:760px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);padding:16px;border:1px solid #b5965c;background:#15140f;overflow:auto;box-sizing:border-box';
      d.append(Eredita.MythologyUI.createPair('u-mazzeru'));
      document.body.append(d); d.showModal();
    })()`);
    await page.waitFor("[...document.querySelectorAll('.mythology-card img')].every(img => img.complete && img.naturalWidth > 0)");
    const transforms = await page.evaluate(`(() => {
      const cards = [...document.querySelectorAll('.mythology-card')];
      return cards.map(card => ({
        title: card.querySelector('h3').textContent,
        card: getComputedStyle(card).transform,
        heading: getComputedStyle(card.querySelector('header')).transform,
        power: getComputedStyle(card.querySelector('.mythology-power')).transform,
        status: getComputedStyle(card.querySelector('.mythology-status')).transform,
        art: getComputedStyle(card.querySelector('.mythology-illustration-crop')).transform,
        clipping: getComputedStyle(card.querySelector('.mythology-illustration-crop')).overflow,
        image: card.querySelector('img').getAttribute('src')
      }));
    })()`);
    assert.equal(transforms[0].art, 'none');
    assert.equal(transforms[1].art, 'matrix(-1, 0, 0, 1, 0, 0)');
    for (const card of transforms) {
      for (const part of ['card','heading','power','status']) assert.equal(card[part], 'none');
      assert.equal(card.title, 'U Mazzeru'); assert.equal(card.clipping, 'hidden');
      assert.equal(card.image, 'assets/cards/fantasy/u-mazzeru.webp');
    }
    await screenshot(page, 'mazzeru-gauche-droite');
    // Inspecter les cinq recadrages sur le vrai moteur de mise en page.
    await page.evaluate(`(() => {
      const grid = document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px';
      Eredita.Mythology.all.filter(x=>x.visuals.normal).forEach(x=>grid.append(Eredita.MythologyUI.createCard(x.id)));
      mythologyPreview.replaceChildren(grid);mythologyPreview.style.width='1120px';
    })()`);
    await page.waitFor("[...document.querySelectorAll('.mythology-card img')].every(img=>img.complete && img.naturalWidth>0)");
    await screenshot(page, 'illustrations-disponibles');
    await page.evaluate("mythologyPreview.replaceChildren(Eredita.MythologyUI.createPair('u-stregu'))");
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-card img').length"), 0);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-missing').length"), 2);
    assert.equal(await page.evaluate("[...document.querySelectorAll('.mythology-status')].every(el=>el.textContent==='Pouvoir à définir')"), true);
    assert.equal(await page.evaluate('JSON.stringify(Eredita.GameView.getState())'), before);
    await screenshot(page, 'pouvoir-et-image-manquants');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.evaluate("mythologyPreview.replaceChildren(Eredita.MythologyUI.createPair('squadra-arozza'))");
    await page.waitFor("[...document.querySelectorAll('.mythology-card img')].every(img=>img.complete && img.naturalWidth>0)");
    assert.ok(await page.evaluate('mythologyPreview.scrollWidth <= mythologyPreview.clientWidth + 1'), 'No horizontal overflow on mobile');
    await screenshot(page, 'paire-mobile');
    await page.evaluate('mythologyPreview.close();mythologyPreview.remove()');
    await page.click('[data-menu-screen="decks"]');
    await page.waitFor("!!document.querySelector('.deck-builder')");
    assert.equal(await page.evaluate("document.querySelectorAll('.deck-myth-card').length"), 5);
    assert.equal(await page.evaluate("document.querySelectorAll('.deck-collection-card').length"), 34);
    await page.click('#menu-back');
    await page.click('[data-menu-screen="play"]');
    await page.waitFor("!!document.querySelector('#training-button')");
    await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.evaluate("Eredita.GameView.command('confirmBiomes','red','keep');Eredita.GameView.command('start')");
    await page.waitFor("Eredita.GameView.getState().phase==='running' && Eredita.GameView.getState().preparationRemaining>0");
    assert.equal(await page.evaluate('Eredita.GameView.getState().players.red.cards.hand.length'), 5);
    assert.equal(await page.evaluate('Eredita.GameView.getState().players.red.cards.mythological.length'), 2);
    assert.deepEqual(page.errors, []); assert.deepEqual(page.badResponses, []);
    console.log('Mythologie navigateur : recadrages, miroir limité aux illustrations, images manquantes, mobile, decks existants et lancement de partie sous /-redita/ validés.');
  } finally { await browser?.close(); await new Promise(resolve => site.server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
