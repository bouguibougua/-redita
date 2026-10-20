'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { startStaticServer, startBrowser } = require('../scripts/export-menu-gif.js');
async function run() {
  const site = await startStaticServer(); let browser;
  async function screenshot(page, name) {
    if (!process.env.EREDITA_CRYSTAL_PREVIEW_DIR) return;
    fs.mkdirSync(process.env.EREDITA_CRYSTAL_PREVIEW_DIR, { recursive: true });
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.env.EREDITA_CRYSTAL_PREVIEW_DIR, name + '.png'), Buffer.from(data, 'base64'));
  }
  try {
    browser = await startBrowser(); const page = browser.page;
    const preview = 'Eredita.MythologyUI.crystalPreview', crystal = preview + '.crystal';
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: site.url + '?intro=0&crystal=preview&left=u-mazzeru&right=u-diavule' });
    await page.waitFor(`window.Eredita?.MythologyUI?.crystalPreview?.crystal.diagnostics.ready && Eredita.GameView?.getState()`, 30000);
    const before = await page.evaluate('JSON.stringify(Eredita.GameView.getState())');
    // La prévisualisation doit réussir même si toute activation des pouvoirs échoue.
    await page.evaluate(`window.originalPlay=Eredita.CardGame.play;window.originalApply=Eredita.CardEffects.apply;
      Eredita.CardGame.play=Eredita.CardEffects.apply=()=>{throw new Error('Un aperçu ne doit pas lancer de pouvoir');}`);
    const colors = await page.evaluate(`(() => {
      const state=${crystal}.diagnostics, host=document.querySelector('.mythology-crystal-stage');
      return {left:state.palette.left.primaryColor,right:state.palette.right.primaryColor,
        cssLeft:host.style.getPropertyValue('--crystal-left'),cssRight:host.style.getPropertyValue('--crystal-right'),
        sourceLeft:Eredita.Mythology.get('u-mazzeru').visuals.primaryColor,sourceRight:Eredita.Mythology.get('u-diavule').visuals.primaryColor};
    })()`);
    assert.equal(colors.left, colors.sourceLeft); assert.equal(colors.right, colors.sourceRight);
    assert.equal(colors.cssLeft, colors.sourceLeft); assert.equal(colors.cssRight, colors.sourceRight);
    assert.match(await page.evaluate("document.querySelector('.mythology-crystal-notices').textContent"), /provisoires/);
    await page.evaluate(`${crystal}.seek(.8)`);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.reveal`), 0);
    await screenshot(page, '01-cristal-bicolore');
    await page.evaluate(`${crystal}.seek(2.4)`); await screenshot(page, '02-ouverture');
    await page.evaluate(`${crystal}.seek(4.4)`);
    await page.waitFor("[...document.querySelectorAll('.mythology-card img')].every(img=>img.complete&&img.naturalWidth>0)");
    assert.equal(await page.evaluate("document.querySelector('.mythology-crystal-results').getAttribute('aria-hidden')"), 'false');
    assert.deepEqual(await page.evaluate("[...document.querySelectorAll('.mythology-card')].map(card=>card.dataset.legendId)"), ['u-mazzeru', 'u-diavulu']);
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('.mythology-card[data-side=right] h3')).transform"), 'none');
    await screenshot(page, '03-renforts-reveles');
    await page.click('.mythology-crystal-controls button:first-child');
    await page.waitFor(`${crystal}.diagnostics.playing && ${crystal}.diagnostics.seconds<1`);
    await page.click('.mythology-crystal-controls button:nth-child(2)');
    assert.equal(await page.evaluate(`${crystal}.diagnostics.paused`), true);
    const paused = await page.evaluate(`${crystal}.diagnostics.seconds`);
    // Deux frames navigateur permettent de contrôler la pause sans attente arbitraire.
    await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.equal(await page.evaluate(`${crystal}.diagnostics.seconds`), paused);
    await page.click('.mythology-crystal-controls button:nth-child(2)');
    await page.waitFor(`${crystal}.diagnostics.seconds>${paused}`);
    await page.waitFor(`!${crystal}.diagnostics.playing`, 10000);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.reveal`), 1, 'The real animation reaches its end and stops');
    assert.match(await page.evaluate("document.querySelector('.mythology-crystal-phase').textContent"), /sont révélés/);

    // Deux légendes sans pouvoir ni illustration : la présentation reste indépendante.
    await page.evaluate(`(() => {
      const select=(side,id)=>{const el=document.querySelector('.mythology-crystal-selectors [data-side='+side+']');el.value=id;el.dispatchEvent(new Event('change'));};
      select('left','u-stregu');select('right','a-fata');${crystal}.seek(4.4);
    })()`);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.ready`), true);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-missing').length"), 2);
    assert.equal(await page.evaluate("[...document.querySelectorAll('.mythology-status')].every(el=>el.textContent==='Pouvoir à définir')"), true);
    assert.match(await page.evaluate("document.querySelector('.mythology-crystal-notices').textContent"), /secondaire non renseignée/);
    await screenshot(page, '04-pouvoirs-non-configures');

    // Injecter une palette incomplète dans le résolveur, sans modifier le catalogue gelé.
    await page.evaluate(`window.originalMythology=Eredita.Mythology;
      Eredita.Mythology={...originalMythology,getCrystalPalette:(left,right)=>{
        const a=originalMythology.get(left),b=originalMythology.get(right);
        return originalMythology.resolveCrystalPalette({...a,visuals:{...a.visuals,primaryColor:null}},b);
      }};
      document.querySelector('.mythology-crystal-selectors select').dispatchEvent(new Event('change'));`);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.ready`), false);
    assert.equal(await page.evaluate("document.querySelector('.mythology-crystal-controls button').disabled"), true);
    assert.match(await page.evaluate("document.querySelector('.mythology-crystal-phase').textContent"), /principale absente/);
    assert.equal(await page.evaluate("document.querySelector('.mythology-crystal-stage').style.getPropertyValue('--crystal-left')"), '');
    assert.equal(await page.evaluate(`${crystal}.play()`), false);
    await screenshot(page, '05-couleur-manquante');
    await page.evaluate(`Eredita.Mythology=originalMythology;document.querySelector('.mythology-crystal-selectors select').dispatchEvent(new Event('change'));`);
    assert.equal(await page.evaluate('JSON.stringify(Eredita.GameView.getState())'), before);
    await page.evaluate(`Eredita.CardGame.play=originalPlay;Eredita.CardEffects.apply=originalApply;window.oldCrystal=${crystal};${preview}.close()`);
    await page.waitFor(`!${preview}`);
    assert.equal(await page.evaluate('oldCrystal.diagnostics.disposed'), true);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-crystal-canvas').length"), 0);

    // Mouvement réduit et petit écran : révélation fixe immédiate, sans boucle animée.
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.evaluate("Eredita.MythologyUI.openCrystalPreview({leftId:'u-mazzeru',rightId:'u-diavule'})");
    await page.waitFor(`${preview}?.crystal.diagnostics.ready`);
    const reduced = await page.evaluate(`${crystal}.diagnostics`);
    assert.equal(reduced.reducedMotion, true); assert.equal(reduced.playing, false); assert.equal(reduced.reveal, 1);
    assert.equal(await page.evaluate("document.querySelector('.mythology-crystal-controls button:nth-child(2)').disabled"), true);
    assert.ok(await page.evaluate(`${preview}.dialog.scrollWidth<=${preview}.dialog.clientWidth+1`), 'No horizontal overflow on mobile');
    await screenshot(page, '06-mobile-mouvement-reduit');
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.waitFor(`!${preview}`);
    // Une fermeture immédiate doit aussi nettoyer une initialisation asynchrone.
    await page.evaluate('window.immediate=Eredita.MythologyUI.openCrystalPreview();immediate.close()');
    await page.waitFor(`!${preview}`);
    assert.equal(await page.evaluate('immediate.crystal.diagnostics.disposed'), true);
    assert.equal(await page.evaluate('JSON.stringify(Eredita.GameView.getState())'), before);
    assert.deepEqual(page.errors, []); assert.deepEqual(page.badResponses, []);
    console.log('Cristal : couleurs du catalogue, ouverture, cartes existantes, pause/relecture, pouvoirs absents, couleur manquante, mobile, mouvement réduit et nettoyage sous /-redita/ validés.');
  } finally { await browser?.close(); await new Promise(resolve => site.server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
