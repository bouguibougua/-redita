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
    const left = '.mythology-choice[data-side=left]', right = '.mythology-choice[data-side=right]';
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: site.url + '?intro=0&crystal=preview&left=u-mazzeru&right=u-diavule' });
    await page.waitFor(`window.Eredita?.MythologyUI?.crystalPreview?.crystal.diagnostics.ready && Eredita.GameView?.getState()`, 30000);
    const before = await page.evaluate('JSON.stringify(Eredita.GameView.getState())');
    await page.evaluate(`window.originalEffects=Eredita.MythologyEffects;
      Eredita.MythologyEffects={...originalEffects,activate:()=>{throw new Error('Un aperçu ne doit pas lancer de pouvoir');}};
      window.choices=[];${preview}.element.addEventListener('eredita:mythology-select',event=>choices.push(event.detail));`);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.started`), false, 'Wait for crystal activation');
    assert.equal(await page.evaluate(`${crystal}.diagnostics.cardsProgress`), 0);
    assert.equal(await page.evaluate("document.querySelector('.mythology-crystal-results').inert"), true);
    assert.equal(await page.evaluate("document.querySelector('.mythology-choice-title').hidden"), true);
    await screenshot(page, '01-cristal-disponible');
    await page.click('.mythology-crystal-stage');
    const runId = await page.evaluate(`${crystal}.diagnostics.runId`);
    await page.evaluate(`document.querySelector('.mythology-crystal-stage').click();document.querySelector('.mythology-crystal-stage').click()`);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.runId`), runId, 'Repeated activations cannot start another run');
    assert.equal(await page.evaluate(`${crystal}.play()`), false, 'Cannot restart an animation in progress');
    await page.evaluate(`${crystal}.seek(.35)`);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.beamsVisible`), true);
    assert.deepEqual(await page.evaluate(`${crystal}.diagnostics.beams`), [
      {direction:'down',colors:['#c73d4d','#d63843']}, {direction:'up',colors:['#c73d4d','#d63843']}
    ], 'Both vertical beams retain the two distinct catalog colors');
    assert.equal(await page.evaluate(`${crystal}.diagnostics.cardsProgress`), 0);
    await screenshot(page, '02-rayons-electriques');
    for (const seconds of [.499, .5]) {
      await page.evaluate(`${crystal}.seek(${seconds})`);
      assert.equal(await page.evaluate(`${crystal}.diagnostics.cardsProgress`), 0, `${seconds}s: no early card movement`);
    }
    await page.evaluate(`${crystal}.seek(.501)`);
    assert.ok(await page.evaluate(`${crystal}.diagnostics.cardsProgress>0`), 'Cards start immediately after the 500 ms boundary');
    await page.evaluate(`${crystal}.seek(.85)`);
    const opening = await page.evaluate(`(() => {
      const cards=[...document.querySelectorAll('.mythology-choice')], rects=cards.map(card=>card.getBoundingClientRect());
      return {offsets:cards.map(card=>new DOMMatrix(getComputedStyle(card).transform).m41),widths:rects.map(r=>r.width),tops:rects.map(r=>r.top)};
    })()`);
    assert.ok(Math.abs(opening.offsets[0] + opening.offsets[1]) < .001, 'Exact mirrored horizontal travel');
    assert.ok(opening.offsets[0] > 0 && opening.offsets[1] < 0);
    assert.ok(Math.abs(opening.widths[0]-opening.widths[1])<.001, 'Subpixel transforms preserve equal widths');
    assert.equal(opening.tops[0], opening.tops[1]);
    await screenshot(page, '03-deploiement-simultane');
    await page.evaluate(`${crystal}.seek(1.45)`);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.cardsProgress`), 1);
    await page.waitFor("[...document.querySelectorAll('.mythology-choice img')].every(img=>img.complete&&img.naturalWidth>0)");
    const geometry = await page.evaluate(`(() => {
      const cards=[...document.querySelectorAll('.mythology-choice')];
      return cards.map(card=>({rect:{width:card.offsetWidth,height:card.offsetHeight,top:card.getBoundingClientRect().top},
        radius:getComputedStyle(card).borderRadius,clip:card.style.clipPath,
        polygon:card.querySelector('.mythology-choice-edge').getAttribute('points'),
        texts:[...card.querySelectorAll('h3,.mythology-power,.mythology-category-icon')].map(el=>getComputedStyle(el).transform),
        illustration:new DOMMatrix(getComputedStyle(card.querySelector('.mythology-illustration-crop')).transform).a,
        image:card.querySelector('img').getAttribute('src'),buttons:card.querySelectorAll('button').length}));
    })()`);
    assert.deepEqual(geometry[0].rect, geometry[1].rect);
    for (const card of geometry) { assert.equal(card.radius, '0px'); assert.equal(card.buttons, 0); assert.ok(card.clip.startsWith('polygon(')); assert.deepEqual(card.texts, ['none', 'none', 'none']); }
    assert.equal(geometry[0].illustration, 1); assert.equal(geometry[1].illustration, -1);
    assert.equal(geometry[0].image, 'assets/mythology/u-mazzeru.webp');
    assert.equal(geometry[1].image, 'assets/mythology/u-diavulu.webp');
    assert.ok(geometry[0].rect.top < 200, 'Cards occupy the upper screen');
    assert.ok(geometry[0].rect.width>600, 'Desktop cards span almost the full screen');
    assert.equal(await page.evaluate("document.querySelector('.mythology-choice-title').textContent"), 'CHOISISSEZ VOTRE RENFORT');
    assert.equal(await page.evaluate("document.querySelector('.mythology-choice-title').hidden"), false);
    const hoverPoint=await page.evaluate(`(() => {const r=document.querySelector('${left}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await page.send('Input.dispatchMouseEvent', {type:'mouseMoved',...hoverPoint});
    await page.waitFor(`Number.parseFloat(getComputedStyle(document.querySelector('${left} .mythology-choice-edge')).strokeWidth)>2.8`);
    assert.equal(await page.evaluate('choices.length'), 0, 'Hover never selects a legend');
    assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('${left} .mythology-choice-edge')).stroke`), 'rgb(199, 61, 77)', 'Hover keeps the catalog color');
    await page.click(left);
    await page.evaluate(`document.querySelector('${left} .mythology-name').click();document.querySelector('${left} .mythology-illustration').click()`);
    assert.equal(await page.evaluate('choices.length'), 1, 'Clicking multiple parts of the selected card emits once');
    assert.deepEqual(await page.evaluate('choices[0]'), { legendId: 'u-mazzeru', side: 'left', pair: { leftId: 'u-mazzeru', rightId: 'u-diavulu' }, runId, preview: true });
    assert.equal(await page.evaluate(`document.querySelector('${left}').getAttribute('aria-pressed')`), 'true');
    assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('${left} .mythology-choice-edge')).stroke`), 'rgb(255, 213, 98)');
    assert.equal(await page.evaluate(`document.querySelector('${right}').classList.contains('is-selected')`), false);
    await screenshot(page, '04-selection-doree');
    await page.click(right);
    assert.equal(await page.evaluate('choices.length'), 2);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-choice.is-selected').length"), 1);
    await page.evaluate(`document.querySelector('${left}').focus()`);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    assert.equal(await page.evaluate('choices.length'), 3, 'Keyboard selection works');
    // Restart resets selection and uses the same renderer and shared clock.
    await page.click('.mythology-crystal-controls button:first-child');
    assert.equal(await page.evaluate(`${preview}.selection`), null);
    await page.click('.mythology-crystal-controls button:nth-child(2)');
    const paused = await page.evaluate(`${crystal}.diagnostics.seconds`);
    await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.equal(await page.evaluate(`${crystal}.diagnostics.seconds`), paused);
    await page.click('.mythology-crystal-controls button:nth-child(2)');
    await page.waitFor(`!${crystal}.diagnostics.playing`, 10000);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.cardsProgress`), 1);
    assert.equal(await page.evaluate(`${crystal}.activate()`), false, 'A consumed crystal waits for explicit replay');
    assert.equal(await page.evaluate('JSON.stringify(Eredita.GameView.getState())'), before);

    // Missing art remains a presentation-only state; simulate an incomplete future entry.
    await page.evaluate(`window.completeCatalog=Eredita.Mythology;Eredita.Mythology={...completeCatalog,
      getIllustration:(id,side)=>['u-stregu','a-fata'].includes(id)?{image:null,missing:true,mirrored:false}:completeCatalog.getIllustration(id,side)};`);
    await page.evaluate(`(() => {
      const select=(side,id)=>{const el=document.querySelector('.mythology-crystal-selectors [data-side='+side+']');el.value=id;el.dispatchEvent(new Event('change'));};
      select('left','u-stregu');select('right','a-fata');
    })()`);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.started`), false);
    await page.click('.mythology-crystal-stage'); await page.evaluate(`${crystal}.seek(4.4)`);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-missing').length"), 2);
    assert.match(await page.evaluate("document.querySelector('.mythology-crystal-notices').textContent"), /secondaire non renseignée/);
    await page.click(left); assert.equal(await page.evaluate(`${preview}.selection.legendId`), 'u-stregu');
    await screenshot(page, '05-pouvoirs-non-configures');
    await page.evaluate(`window.originalMythology=Eredita.Mythology;
      Eredita.Mythology={...originalMythology,getCrystalPalette:(left,right)=>{
        const a=originalMythology.get(left),b=originalMythology.get(right);
        return originalMythology.resolveCrystalPalette({...a,visuals:{...a.visuals,primaryColor:null}},b);
      }};document.querySelector('.mythology-crystal-selectors select').dispatchEvent(new Event('change'));`);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.ready`), false);
    assert.equal(await page.evaluate(`${crystal}.activate()`), false);
    assert.match(await page.evaluate("document.querySelector('.mythology-crystal-phase').textContent"), /principale absente/);
    assert.equal(await page.evaluate("document.querySelector('.mythology-crystal-stage').style.getPropertyValue('--crystal-left')"), '');
    await page.evaluate(`Eredita.Mythology=originalMythology;Eredita.Mythology=completeCatalog;Eredita.MythologyEffects=originalEffects;
      window.oldCrystal=${crystal};${preview}.close()`);
    assert.equal(await page.evaluate('oldCrystal.diagnostics.disposed'), true);
    await page.waitFor(`!${preview}`);

    // Mobile: same two-sided layout, real touch interaction and no horizontal overflow.
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await page.evaluate("Eredita.MythologyUI.openCrystalPreview({leftId:'u-mazzeru',rightId:'u-diavule'})");
    await page.waitFor(`${preview}?.crystal.diagnostics.ready`);
    const tap = async selector => {
      const point = await page.evaluate(`(() => {const el=document.querySelector('${selector}');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await tap('.mythology-crystal-stage');
    await page.waitFor(`${crystal}.diagnostics.started`);
    await page.evaluate(`${crystal}.seek(4.4)`); await tap(right);
    await page.waitFor(`${preview}.selection?.side==='right'`);
    assert.ok(await page.evaluate(`${preview}.dialog.scrollWidth<=${preview}.dialog.clientWidth+1`));
    const mobile = await page.evaluate(`(() => {const a=document.querySelector('${left}').getBoundingClientRect(),b=document.querySelector('${right}').getBoundingClientRect();return [a.width,b.width,a.height,b.height,a.top,b.top];})()`);
    assert.equal(mobile[0], mobile[1]); assert.equal(mobile[2], mobile[3]); assert.equal(mobile[4], mobile[5]);
    assert.ok(await page.evaluate("[...document.querySelectorAll('.mythology-choice .mythology-power')].every(el=>el.scrollHeight<=el.clientHeight+1)"), 'Short descriptions fit mobile cards');
    await screenshot(page, '06-selection-mobile');
    await page.send('Emulation.setDeviceMetricsOverride', {width:844,height:390,deviceScaleFactor:1,mobile:true});
    assert.ok(await page.evaluate(`${preview}.dialog.scrollWidth<=${preview}.dialog.clientWidth+1`));
    assert.ok(await page.evaluate("[...document.querySelectorAll('.mythology-choice .mythology-power')].every(el=>el.scrollHeight<=el.clientHeight+1)"), 'Short descriptions fit landscape cards');
    await screenshot(page, '06-selection-paysage');
    await page.send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
    await page.evaluate(`${preview}.close()`);
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await page.evaluate("Eredita.MythologyUI.openCrystalPreview({leftId:'squadra-arozza',rightId:'oeil-sainte-lucie'})");
    await page.waitFor(`${preview}?.crystal.diagnostics.ready`);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.started`), false);
    await page.evaluate(`${crystal}.activate()`);
    await page.waitFor(`!${crystal}.diagnostics.playing`);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.seconds`), .5);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.cardsProgress`), 1);
    assert.equal(await page.evaluate(`${crystal}.diagnostics.beamsVisible`), false);
    await page.click(right);
    assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('${right} .mythology-choice-glint')).animationName`), 'none');
    await screenshot(page, '07-mouvement-reduit');
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.waitFor(`!${preview}`);
    await page.evaluate('window.immediate=Eredita.MythologyUI.openCrystalPreview();immediate.close()');
    assert.equal(await page.evaluate('immediate.crystal.diagnostics.disposed'), true);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-crystal-canvas').length"), 0);
    assert.equal(await page.evaluate('JSON.stringify(Eredita.GameView.getState())'), before);
    assert.deepEqual(page.errors, []); assert.deepEqual(page.badResponses, []); assert.deepEqual(page.consoleErrors, []);
    console.log('Cristal : activation unique, rayons, délai 500 ms, déploiement symétrique, illustrations, sélection souris/clavier/tactile, mobile, mouvement réduit et absence de mutation du jeu validés sous /-redita/.');
  } finally { await browser?.close(); await new Promise(resolve => site.server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
