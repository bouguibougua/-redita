'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { spawn } = require('node:child_process');
const { startBrowser } = require('../scripts/export-menu-gif');
const port = 8895, url = `http://127.0.0.1:${port}/?intro=0`;
const state = 'Eredita.GameView.getState()', d = 'Eredita.MythologySession.diagnostics';
const stage = '.mythology-match-widget .mythology-crystal-stage';
const stock = '#mythology-stock';
async function run() {
  const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  let browser; const clients = [];
  async function capture(page, name) {
    if (!process.env.EREDITA_LEGENDS_PREVIEW_DIR) return;
    fs.mkdirSync(process.env.EREDITA_LEGENDS_PREVIEW_DIR, { recursive: true });
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.env.EREDITA_LEGENDS_PREVIEW_DIR, name + '.png'), Buffer.from(data, 'base64'));
  }
  async function load(page) {
    clients.push(page); await page.send('Page.navigate', { url });
    await page.waitFor('window.Eredita?.MenuScene?.diagnostics.ready && Eredita.GameView?.getState()', 30000);
  }
  async function choose(page, id) {
    await page.send('Page.bringToFront'); await page.waitFor(`${d}.crystal?.ready`);
    await page.click(stage); await page.waitFor(`${d}.crystal.cardsProgress===1`);
    await page.click('.mythology-match-widget [data-legend-id="' + id + '"]');
    await page.waitFor(`${d}.privateView.selections.some(s=>s.legendId===${JSON.stringify(id)})`);
    await page.waitFor(`[...document.querySelectorAll('${stock} img')].every(i=>i.complete&&i.naturalWidth>0)`);
  }
  async function nextOffer(page, elapsed, random) {
    await page.evaluate(`reinforcementRandom=${random};${state}.preparationRemaining=0;${state}.elapsed=${elapsed};Eredita.MythologySession.render(${state})`);
  }
  async function region3d(page, playerId, lane) {
    const point = await page.evaluate(`(() => {
      const {THREE,camera,terrainGroup,renderer}=Eredita.Board3D.getXRContext();
      const group=terrainGroup.children.find(g=>g.userData.playerId===${JSON.stringify(playerId)}&&g.userData.lane===${lane});
      group.updateWorldMatrix(true,false);camera.updateMatrixWorld();
      const p=group.localToWorld(new THREE.Vector3(-.35,.2,.45)).project(camera);
      const r=renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
    })()`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  }
  const region = (owner, lane) => `[data-mythology-region][data-player="${owner}"][data-lane="${lane}"]`;
  const thumb = id => `${stock} .mythology-stock-legend[data-legend-id="${id}"]`;
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 50)); }
    browser = await startBrowser(); const page = browser.page;
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await load(page);
    assert.equal(await page.evaluate('Eredita.CardGame'), undefined);
    assert.equal(await page.evaluate('Eredita.Cards'), undefined);
    assert.equal(await page.evaluate('Eredita.Decks'), undefined);
    await page.click('[data-menu-screen=legends]');
    await page.evaluate("document.querySelectorAll('.mythology-collection img').forEach(img=>img.loading='eager')");
    await page.waitFor("document.querySelectorAll('.mythology-collection img').length===16 && [...document.querySelectorAll('.mythology-collection img')].every(i=>i.complete&&i.naturalWidth===1536)");
    await page.click('#menu-back');
    await page.evaluate("Eredita.Network.startMode('local');Eredita.GameView.command('confirmBiomes','red','keep');Eredita.GameView.command('confirmBiomes','blue','keep');window.realRandom=Math.random;window.reinforcementRandom=.4;Math.random=()=>reinforcementRandom");
    await page.click('#start-game'); await page.evaluate('Math.random=realRandom');
    await page.waitFor(`${d}.crystal?.ready`);
    assert.equal(await page.evaluate("document.querySelector('.board-clock').parentElement.classList.contains('mythology-match-widget')"), true);
    assert.equal(await page.evaluate("document.querySelectorAll('#game-clock').length"), 1, 'The existing clock is moved, never duplicated');
    const clockLayout=await page.evaluate("(()=>{const c=document.querySelector('.board-clock').getBoundingClientRect(),s=document.querySelector('.mythology-match-widget .mythology-crystal-stage').getBoundingClientRect();return {center:c.x+c.width/2,screen:innerWidth,top:c.top,crystalBottom:s.bottom};})()");
    assert.ok(Math.abs(clockLayout.center-clockLayout.screen/2)<1);
    assert.ok(clockLayout.top>=clockLayout.crystalBottom, 'Clock sits directly below the closed crystal');
    assert.ok(await page.evaluate("document.querySelector('#preparation-hint').getBoundingClientRect().top>=document.querySelector('.board-clock').getBoundingClientRect().bottom+8"), 'The clock leaves room for the preparation message');
    await page.evaluate(`Eredita.GameView.command('togglePause');${state}.preparationRemaining=42;Eredita.UI.renderFrame(${state})`);
    assert.equal(await page.evaluate("document.querySelector('#game-clock').textContent"),'00:42');
    await page.evaluate("Eredita.GameView.command('togglePause')");
    assert.equal(await page.evaluate("document.querySelector('#village-inspector').textContent.includes('Banque locale')"), false);
    assert.equal(await page.evaluate("document.querySelector('#village-inspector').textContent.includes('Réserve de barques')"), false);
    assert.equal(await page.evaluate("document.querySelector('.mythology-inventory-toggle')"), null);
    assert.equal(await page.evaluate("document.querySelector('#slot-options')!==null"), true, 'Village slot controls are preserved');
    await choose(page, 'u-magu');
    assert.equal(await page.evaluate(`${state}.players.red.villages[0].nextMaguCharges`), undefined, 'Collection never activates a power');
    assert.equal(await page.evaluate(`document.querySelectorAll('${stock} .mythology-stock-legend').length`), 1, 'Obtained image appears immediately in the sidebar');
    assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('${stock} .mythology-stock-frame')).clipPath`), 'polygon(12% 0px, 100% 0px, 88% 100%, 0px 100%)');
    assert.equal(await page.evaluate(`document.querySelectorAll('${stock} select').length`), 0);
    await capture(page, '01-stock-lateral-parallelogramme');
    await page.click(thumb('u-magu'));
    assert.equal(await page.evaluate(`${d}.targeting.mode`), 'none');
    assert.equal(await page.evaluate(`Object.keys(${state}.mythology.executions).length`), 0, 'Arming still needs a terrain click');
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    assert.equal(await page.evaluate(`${d}.targeting`), null);
    await page.click(thumb('u-magu'));
    await page.waitFor("Eredita.Board3D.getXRContext().terrainGroup.children.filter(g=>g.getObjectByName('mythology-target')?.visible).length===4");
    await capture(page, '02-ciblage-global-3d');
    await region3d(page, 'blue', 1);
    await page.waitFor(`${d}.privateView.selections[0].status==='activated'`);
    assert.equal(await page.evaluate(`${state}.players.red.villages[0].nextMaguCharges`), 1);
    assert.equal(await page.evaluate(`${state}.players.blue.villages[0].nextMaguCharges`), undefined);
    assert.equal(await page.evaluate(`${d}.ownerId`), 'red', 'Targeting the other side never changes the acting player');
    assert.equal(await page.evaluate(`document.querySelectorAll('${stock} .mythology-stock-legend').length`), 0);
    const token = await page.evaluate(`${d}.privateView.selections[0].offerId`);
    assert.equal(await page.evaluate(`Eredita.MythologySession.activate(${JSON.stringify(token)},{})`), false);
    await page.evaluate(`window.buffed=Eredita.Economy.addResident(${state}.players.red.villages[0],${state})`);
    assert.equal(await page.evaluate('buffed.mythologyScale'), 1.5);

    await nextOffer(page, 120.01, 0); await choose(page, 'a-stregha');
    assert.equal(await page.evaluate(`document.querySelector('${stock} .is-mirrored')`), null, 'Right choice becomes a normal illustration in stock');
    await page.click('#toggle-board-view'); await page.waitFor('!Eredita.Board3D.enabled');
    await page.click(thumb('a-stregha'));
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-target-eligible').length"), 2);
    await page.click(region('red', 0));
    assert.equal(await page.evaluate(`${d}.privateView.selections.at(-1).status`), 'awaiting-activation');
    assert.equal(await page.evaluate(`${d}.ownerId`), 'red');
    await page.click('#pause-game'); await page.click(region('blue', 0));
    assert.equal(await page.evaluate(`${d}.privateView.selections.at(-1).status`), 'awaiting-activation', 'Paused terrain clicks cannot spend reinforcements');
    await page.click('#pause-game'); await page.click(region('blue', 0));
    assert.equal(await page.evaluate(`${d}.privateView.selections.at(-1).status`), 'activated');
    assert.ok(await page.evaluate(`${state}.players.blue.villages[0].curseUntil>${state}.elapsed`));

    await page.evaluate(`Eredita.Economy.removeResident(${state},'red',0,${state}.players.red.villages[0].residents[0].id)`);
    await nextOffer(page, 240.01, .8); await choose(page, 'i-lacrimenti');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await page.evaluate("document.querySelector('#mythology-stock').scrollIntoView({block:'center'})");
    await capture(page, '03-stock-mobile');
    const tapped = await page.evaluate(`(() => {const e=document.querySelector('${thumb('i-lacrimenti')}');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tapped] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitFor(`${d}.targeting?.mode==='column'`);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-target-eligible').length"), 4);
    await capture(page, '04-ciblage-colonne-mobile');
    await page.click(region('blue', 0));
    assert.equal(await page.evaluate(`${d}.privateView.selections.at(-1).status`), 'activated');
    assert.equal(await page.evaluate(`${state}.players.red.villages[0].residents[0].mythologyHpBonus`), 2);
    assert.equal(await page.evaluate(`${d}.ownerId`), 'red');
    assert.ok(await page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'));
    await page.evaluate('Eredita.GameView.returnToLobby()');
    assert.equal(await page.evaluate("document.querySelector('.board-clock').parentElement.id"),'battlefield','New games recover the same live clock');

    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    const host = page, guest = await browser.newPage(); await load(guest);
    await host.click('[data-menu-screen=play]'); await host.click('#open-multiplayer'); await host.click('#create-online');
    await host.waitFor("Eredita.Network.mode==='host'"); const code = await host.evaluate('Eredita.Network.roomCode');
    await guest.click('[data-menu-screen=play]'); await guest.click('#open-multiplayer');
    await guest.evaluate(`document.querySelector('#room-code').value=${JSON.stringify(code)}`); await guest.click('#join-online');
    await guest.waitFor("Eredita.Network.mode==='guest'"); await host.click('#continue-online');
    await host.evaluate("Eredita.GameView.command('confirmBiomes','red','keep')");
    await guest.evaluate("Eredita.GameView.command('confirmBiomes','blue','keep')");
    await host.waitFor(`${state}.players.blue.setupConfirmed`); await host.send('Page.bringToFront'); await host.click('#start-game');
    await host.waitFor(`${d}.privateView?.pending && ${d}.crystal?.ready`);
    await guest.waitFor(`${d}.privateView?.pending && ${d}.crystal?.ready`);
    await host.evaluate(`Eredita.Economy.removeResident(${state},'blue',0,${state}.players.blue.villages[0].residents[0].id);Eredita.Network.sendState(${state})`);
    await guest.waitFor(`${state}.mythology.deaths.length===1`);
    const redOffer = await host.evaluate(`${d}.privateView.pending.id`);
    const id = await guest.evaluate(`${d}.privateView.pending.legendIds[0]`); await choose(guest, id);
    const picked = await guest.evaluate(`${d}.privateView.selections[0]`), epoch = await guest.evaluate(`${d}.privateView.epoch`);
    await guest.evaluate(`Eredita.Network.activateReinforcement(${JSON.stringify(epoch)},${JSON.stringify(picked.offerId)},{lane:99})`);
    await guest.waitFor(`document.querySelector('${stock} [role=status]').textContent.length>0`);
    assert.equal(await guest.evaluate(`${d}.privateView.selections[0].status`), 'awaiting-activation');
    await host.evaluate(`Eredita.Network.activateReinforcement(${JSON.stringify(epoch)},${JSON.stringify(picked.offerId)},{})`);
    await host.waitFor(`document.querySelector('${stock} [role=status]').textContent.length>0`);
    assert.equal(await host.evaluate(`${d}.privateView.selections.length`), 0);
    await guest.click('#toggle-board-view');
    await guest.click(thumb(id));
    const target = await guest.evaluate(`${d}.targeting.targets[0]`);
    const tile = region(target.playerId || 'blue', target.lane || 0);
    await guest.evaluate(`document.querySelector(${JSON.stringify(tile)}).click();document.querySelector(${JSON.stringify(tile)}).click()`);
    await guest.waitFor(`${d}.privateView.selections[0].status==='activated'`);
    await guest.waitFor(`Object.keys(${state}.mythology.executions).length===1`);
    assert.equal(await host.evaluate(`Object.keys(${state}.mythology.executions).length`), 1);
    assert.equal(await host.evaluate(`${d}.privateView.pending.id`), redOffer);
    assert.equal(await host.evaluate(`${d}.privateView.selections.length`), 0);
    assert.equal(await host.evaluate(`document.querySelectorAll('${stock} .mythology-stock-legend').length`), 0);
    await capture(guest, '05-ciblage-valide-reseau-bleu');
    await host.evaluate('Eredita.GameView.returnToLobby()');
    for (const client of clients) { assert.deepEqual(client.errors, []); assert.deepEqual(client.consoleErrors, []); assert.deepEqual(client.badResponses, []); }
    console.log('Stock latéral sans banque/barques, images en parallélogramme, collecte immédiate, clic 3D global, régions 2D, colonne tactile mobile, annulation, pause et activation réseau unique validés.');
  } catch (error) {
    for (const client of clients) { console.error(await client.evaluate('Eredita?.MythologySession?.diagnostics')); await capture(client, 'failure'); }
    throw error;
  } finally { await browser?.close(); server.kill(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
