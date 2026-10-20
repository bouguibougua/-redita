'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { spawn } = require('node:child_process');
const { startBrowser } = require('../scripts/export-menu-gif');
const port = 8894, url = `http://127.0.0.1:${port}/?intro=0`;
async function run() {
  const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  let browser; const clients = [];
  const diagnostic = 'Eredita.MythologySession.diagnostics';
  const stage = '.mythology-match-widget .mythology-crystal-stage';
  const left = '.mythology-match-widget .mythology-choice[data-side=left]';
  const right = '.mythology-match-widget .mythology-choice[data-side=right]';
  async function screenshot(page, name) {
    if (!process.env.EREDITA_REINFORCEMENT_PREVIEW_DIR) return;
    fs.mkdirSync(process.env.EREDITA_REINFORCEMENT_PREVIEW_DIR, { recursive: true });
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.env.EREDITA_REINFORCEMENT_PREVIEW_DIR, name + '.png'), Buffer.from(data, 'base64'));
  }
  async function load(page) {
    await page.send('Page.navigate', { url });
    await page.waitFor('window.Eredita?.GameView?.getState() && Eredita.MenuScene?.diagnostics.ready', 30000);
  }
  async function openChoices(page) {
    await page.send('Page.bringToFront');
    await page.waitFor(`${diagnostic}.crystal?.ready`);
    assert.equal(await page.evaluate("document.querySelector('.mythology-match-widget').classList.contains('is-open')"), false);
    await page.click(stage);
    await page.waitFor(`${diagnostic}.crystal.cardsProgress===1`, 10000);
  }
  async function checkOverlay(page, open) {
    const layout = await page.evaluate(`(() => {
      const widget=document.querySelector('.mythology-match-widget'),stage=widget.querySelector('.mythology-crystal-stage'),
        r=stage.getBoundingClientRect(),w=widget.getBoundingClientRect(),cards=[...widget.querySelectorAll('.mythology-choice')];
      return {position:getComputedStyle(widget).position,center:r.x+r.width/2,viewport:document.documentElement.clientWidth,
        width:w.width,top:w.top,bottom:w.bottom,background:getComputedStyle(widget).backgroundColor,
        title:!widget.querySelector('.mythology-choice-title').hidden,closed:!widget.classList.contains('is-open'),
        cards:cards.map(c=>({width:c.offsetWidth,height:c.offsetHeight,top:c.getBoundingClientRect().top})),
        clock:(()=>{const c=widget.querySelector('.board-clock').getBoundingClientRect();return {left:c.left,right:c.right}})(),
        gap:{left:cards[0].getBoundingClientRect().right,right:cards[1].getBoundingClientRect().left},
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth};
    })()`);
    assert.equal(layout.position, 'fixed'); assert.ok(Math.abs(layout.center-layout.viewport/2)<1, 'Crystal is exactly centered');
    assert.equal(layout.background, 'rgba(0, 0, 0, 0)', 'No modal panel hides the board');
    assert.equal(layout.title, open); assert.equal(layout.closed, !open); assert.equal(layout.overflow, false);
    assert.ok(layout.top<85); assert.ok(layout.width>layout.viewport*.9, 'Cards span almost the full screen');
    if(open) {
      assert.deepEqual(layout.cards[0],layout.cards[1]); assert.ok(layout.bottom<600, 'Board remains visible below the cards');
      assert.ok(layout.clock.left>=layout.gap.left-1 && layout.clock.right<=layout.gap.right+1, 'The clock fits between the choices, including on mobile');
    }
  }
  async function startLocal(page) {
    await page.evaluate("Eredita.Network.startMode('local');Eredita.GameView.command('confirmBiomes','red','keep');Eredita.GameView.command('confirmBiomes','blue','keep')");
    await page.click('#start-game');
    await page.waitFor(`${diagnostic}.privateView?.pending && ${diagnostic}.crystal?.ready`);
  }
  try {
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) { try { ready = (await fetch(url)).ok; } catch (_) { await new Promise(resolve => setTimeout(resolve, 50)); } }
    assert.ok(ready); browser = await startBrowser(); const page = browser.page; clients.push(page);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await load(page); await startLocal(page);
    await page.evaluate(`window.collected=[];document.addEventListener('eredita:mythology-collected',e=>collected.push(e.detail));
      window.boardClicks=0;document.querySelector('#battlefield').addEventListener('click',()=>boardClicks++);
      window.initialCrystal=document.querySelector('.mythology-match-widget canvas');`);
    await checkOverlay(page, false);
    assert.equal(await page.evaluate('Eredita.MythologyUI.crystalPreview'), null, 'Actual game, without preview route');
    const first = await page.evaluate(`${diagnostic}.privateView`);
    assert.equal(first.pending.availableAt, 0); assert.equal(new Set(first.pending.legendIds).size, 2);
    assert.equal(await page.evaluate("document.querySelector('.mythology-match-count').textContent"), '1');
    assert.match(await page.evaluate("getComputedStyle(document.querySelector('.mythology-match-widget canvas')).filter"), /drop-shadow/);
    await screenshot(page, '01-disponible-en-partie');
    // Accumuler les échéances sur l’horloge réelle, sans créer de minuteur de test parallèle.
    await page.evaluate("Eredita.GameView.command('togglePause');Eredita.GameView.getState().preparationRemaining=0;Eredita.GameView.getState().elapsed=119.9");
    await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.equal(await page.evaluate('Eredita.GameView.getState().elapsed'), 119.9);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.pendingCount`), 1);
    await page.evaluate("Eredita.GameView.command('togglePause')");
    await page.waitFor(`${diagnostic}.privateView.pendingCount===2`);
    await page.evaluate('Eredita.GameView.getState().elapsed=240.01;Eredita.MythologySession.render(Eredita.GameView.getState())');
    const accumulated = await page.evaluate(`${diagnostic}.privateView`);
    assert.equal(accumulated.pendingCount, 3); assert.equal(accumulated.pending.id, first.pending.id);
    assert.deepEqual(accumulated.queue.map(p=>p.availableAt), [0,120,240]);
    assert.equal(await page.evaluate("document.querySelector('.mythology-match-count').textContent"), '3');
    assert.equal(await page.evaluate(`${diagnostic}.crystal.started`), false);
    await screenshot(page, '02-file-de-trois');
    await openChoices(page);
    await checkOverlay(page, true);
    await screenshot(page, '02-cartes-sur-plateau');
    await page.click('.mythology-match-close');
    assert.equal(await page.evaluate(`${diagnostic}.privateView.pendingCount`), 3, 'Closing without choosing never consumes the head');
    assert.equal(await page.evaluate(`${diagnostic}.privateView.pending.id`), first.pending.id);
    await checkOverlay(page, false);
    await openChoices(page);
    const inventory = 'JSON.stringify(Object.values(Eredita.GameView.getState().players).map(p=>({gold:p.gold,resources:p.villages.map(v=>v.resources),cards:p.cards})))';
    const players = await page.evaluate(inventory);
    await page.evaluate(`window.consumedCard=document.querySelector('${left}')`);
    await page.click(left);
    await page.evaluate(`consumedCard.click();document.querySelector('${right}').click();document.querySelector('${left}').click()`);
    await page.waitFor(`${diagnostic}.privateView.selections.length===1`);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.pendingCount`), 2);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.pending.id`), accumulated.queue[1].id);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.selections[0].offerId`), accumulated.queue[0].id);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.selections[0].status`), 'awaiting-activation');
    assert.equal(await page.evaluate("initialCrystal===document.querySelector('.mythology-match-widget canvas')"), true, 'Reuse the renderer between offers');
    assert.equal(await page.evaluate('collected.length'), 1);
    assert.equal(await page.evaluate('Eredita.MythologySession.getObtainedLegends()[0].illustration.mirrored'), false);
    await page.waitFor(`${diagnostic}.crystal?.ready`);
    assert.equal(await page.evaluate(`${diagnostic}.crystal.started`), false, 'Next crystal is armed without opening cards');
    assert.equal(await page.evaluate("document.querySelector('.mythology-match-widget').classList.contains('is-open')"), false);
    assert.equal(await page.evaluate("document.querySelector('.mythology-match-count').textContent"), '2');
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('.mythology-match-sparks')).display"), 'block');
    await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.equal(await page.evaluate(`${diagnostic}.crystal.started`), false, 'A later render never opens the next offer');
    await screenshot(page, '03-cristal-rearme-deux');
    await openChoices(page);
    assert.deepEqual(await page.evaluate("[...document.querySelectorAll('.mythology-match-widget .mythology-choice')].map(c=>c.dataset.legendId)"), accumulated.queue[1].legendIds);
    await page.click(right);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.pendingCount`), 1);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.pending.id`), accumulated.queue[2].id);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.selections[1].offerId`), accumulated.queue[1].id);
    assert.equal(await page.evaluate("document.querySelector('.mythology-match-count').textContent"), '1');
    await openChoices(page); await page.click(left);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.pending`), null);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.pendingCount`), 0);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.selections.length`), 3);
    assert.equal(await page.evaluate("document.querySelector('.mythology-match-count').hidden"), true);
    assert.equal(await page.evaluate(inventory), players, 'No card, resource or power is played');
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-match-widget .is-selected').length"), 0);
    await checkOverlay(page, false);
    assert.equal(await page.evaluate(`${diagnostic}.crystal.started`), false, 'The last pair also closes automatically');
    assert.equal(await page.evaluate(`document.querySelector('${stage}').getAttribute('aria-disabled')`), 'true');
    await page.evaluate(`document.querySelector('${stage}').click()`);
    assert.equal(await page.evaluate(`${diagnostic}.crystal.started`), false, 'Empty crystal cannot open');
    assert.equal(await page.evaluate('boardClicks'), 0, 'Crystal/card clicks never act on the board');
    assert.equal(await page.evaluate('collected.length'), 3);
    assert.deepEqual(await page.evaluate('Eredita.MythologySession.getObtainedLegends().map(s=>s.offerId)'), accumulated.queue.map(p=>p.id));
    assert.equal(await page.evaluate('Eredita.MythologySession.getObtainedLegends().every(s=>s.illustration.source===\'normal\'&&!s.illustration.mirrored)'), true);
    await screenshot(page, '04-file-consommee');
    assert.equal(await page.evaluate("document.querySelector('.mythology-match-widget').classList.contains('is-available')"), false);
    await page.evaluate("Eredita.GameView.selectVillage('blue',0)");
    await page.waitFor(`${diagnostic}.ownerId==='blue' && ${diagnostic}.privateView.pending`);
    const blueOffer = await page.evaluate(`${diagnostic}.privateView.pending.id`);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.pendingCount`), 3, 'Red selections do not consume the blue queue');
    await page.evaluate("Eredita.GameView.selectVillage('red',0);Eredita.GameView.command('togglePause');Eredita.GameView.getState().elapsed=359.9");
    await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.equal(await page.evaluate('Eredita.GameView.getState().elapsed'), 359.9);
    await page.evaluate("Eredita.GameView.command('togglePause')");
    await page.waitFor(`${diagnostic}.privateView.pending?.availableAt===360`);
    assert.notEqual(await page.evaluate(`${diagnostic}.privateView.pending.id`), first.pending.id);
    await page.evaluate("Eredita.GameView.selectVillage('blue',0)");
    await page.waitFor(`${diagnostic}.ownerId==='blue'`);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.pending.id`), blueOffer);
    assert.equal(await page.evaluate(`${diagnostic}.privateView.pendingCount`), 4);
    await page.evaluate('Eredita.GameView.returnToLobby()'); await startLocal(page);
    const second = await page.evaluate(`${diagnostic}.privateView`);
    assert.notEqual(second.epoch, first.epoch); assert.equal(second.selections.length, 0); assert.equal(second.pending.availableAt, 0);
    assert.equal(second.pendingCount, 1); assert.equal(second.queue.length, 1);
    assert.deepEqual(await page.evaluate('Eredita.MythologySession.getObtainedLegends()'), []);
    await page.evaluate("Eredita.GameView.getState().phase='ended';Eredita.GameView.getState().result='red'");
    await page.waitFor("!document.querySelector('.mythology-match-widget')");
    await page.evaluate('Eredita.GameView.returnToLobby()');

    // Two real clients through the existing relay, with independent private acknowledgements.
    const host = page, guest = await browser.newPage(); clients.push(guest); await load(guest);
    await host.click('[data-menu-screen=play]'); await host.click('#open-multiplayer'); await host.click('#create-online');
    await host.waitFor("Eredita.Network.mode==='host'");
    const code = await host.evaluate('Eredita.Network.roomCode');
    await guest.click('[data-menu-screen=play]'); await guest.click('#open-multiplayer');
    await guest.evaluate(`document.querySelector('#room-code').value='${code}'`); await guest.click('#join-online');
    await guest.waitFor("Eredita.Network.mode==='guest'"); await host.click('#continue-online');
    await host.evaluate("Eredita.GameView.command('confirmBiomes','red','keep')");
    await guest.evaluate("Eredita.GameView.command('confirmBiomes','blue','keep')");
    await host.waitFor('Eredita.GameView.getState().players.blue.setupConfirmed'); await host.send('Page.bringToFront'); await host.click('#start-game');
    await host.waitFor(`${diagnostic}.privateView?.pending && ${diagnostic}.crystal?.ready`);
    await guest.waitFor(`${diagnostic}.privateView?.pending && ${diagnostic}.crystal?.ready`);
    const redPrivate = await host.evaluate(`${diagnostic}.privateView`), bluePrivate = await guest.evaluate(`${diagnostic}.privateView`);
    assert.equal(redPrivate.playerId, 'red'); assert.equal(bluePrivate.playerId, 'blue');
    assert.equal(await host.evaluate('Eredita.GameView.getState().players.blue.reinforcements'), undefined);
    assert.equal(await guest.evaluate('Eredita.GameView.getState().players.red.reinforcements'), undefined);
    await host.evaluate('collected=[]');
    await guest.evaluate("window.collected=[];document.addEventListener('eredita:mythology-collected',e=>collected.push(e.detail))");
    await openChoices(guest); await guest.click(right);
    await guest.waitFor(`${diagnostic}.resolved && ${diagnostic}.privateView.selections.length===1`);
    assert.equal(await host.evaluate(`${diagnostic}.privateView.selections.length`), 0);
    assert.equal(await host.evaluate(`${diagnostic}.privateView.pending.id`), redPrivate.pending.id);
    assert.equal(await guest.evaluate(`${diagnostic}.privateView.selections[0].legendId`), bluePrivate.pending.legendIds[1]);
    assert.equal(await host.evaluate('collected.length'), 0, 'The future LÉGENDE hook never discloses the opponent choice');
    assert.equal(await guest.evaluate('collected.length'), 1);
    const selectionCount = await guest.evaluate(`${diagnostic}.privateView.selections.length`);
    await guest.evaluate(`Eredita.Network.selectReinforcement('${bluePrivate.epoch}','${bluePrivate.pending.id}','${bluePrivate.pending.legendIds[0]}')`);
    await guest.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.equal(await guest.evaluate(`${diagnostic}.privateView.selections.length`), selectionCount);
    assert.equal(await guest.evaluate('collected.length'), 1, 'Duplicate packets never duplicate the collection hook');
    assert.equal(await guest.evaluate("document.querySelector('.mythology-match-widget').classList.contains('is-open')"), false, 'Validated network choice closes the pair');
    assert.deepEqual(await guest.evaluate('Eredita.MythologySession.getObtainedLegends().map(s=>s.legendId)'), [bluePrivate.pending.legendIds[1]]);
    assert.equal(await guest.evaluate('Eredita.MythologySession.getObtainedLegends()[0].illustration.mirrored'), false, 'Right choice uses normal illustration for the future LÉGENDE menu');
    await screenshot(guest, '03-bleu-en-reseau');
    // Mobile network client consumes a queued head and waits for a new click on its successor.
    await guest.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await host.send('Page.bringToFront');
    await host.evaluate('Eredita.GameView.getState().preparationRemaining=0;Eredita.GameView.getState().elapsed=239.99');
    await guest.waitFor(`${diagnostic}.privateView.pendingCount===2`);
    const queuedMobile = await guest.evaluate(`${diagnostic}.privateView.queue`);
    assert.deepEqual(queuedMobile.map(p=>p.availableAt), [120,240]);
    assert.equal(await host.evaluate(`${diagnostic}.privateView.pendingCount`), 3);
    assert.equal(await host.evaluate(`${diagnostic}.privateView.pending.id`), redPrivate.pending.id);
    await openChoices(guest); await guest.click(left);
    await guest.waitFor(`${diagnostic}.privateView.selections.length===2 && ${diagnostic}.crystal?.ready`);
    assert.equal(await guest.evaluate(`${diagnostic}.privateView.pendingCount`), 1);
    assert.equal(await guest.evaluate(`${diagnostic}.privateView.pending.id`), queuedMobile[1].id);
    assert.equal(await guest.evaluate(`${diagnostic}.crystal.started`), false);
    assert.equal(await guest.evaluate("document.querySelector('.mythology-match-count').textContent"), '1');
    assert.equal(await guest.evaluate("document.querySelector('.mythology-match-widget').classList.contains('is-open')"), false);
    assert.ok(await guest.evaluate("document.querySelector('.mythology-match-widget').scrollWidth<=document.querySelector('.mythology-match-widget').clientWidth+1"));
    await screenshot(guest, '05-fifo-mobile-rearme');
    await openChoices(guest);
    await checkOverlay(guest, true);
    await screenshot(guest, '06-fifo-mobile-cartes');
    await guest.click(right); await guest.waitFor(`${diagnostic}.privateView.selections.length===3`);
    assert.equal(await guest.evaluate(`${diagnostic}.privateView.pendingCount`), 0);
    assert.equal(await host.evaluate(`${diagnostic}.privateView.pendingCount`), 3, 'Guest draining its queue does not affect the host queue');
    await host.evaluate('Eredita.GameView.returnToLobby()');
    await host.send('Page.bringToFront');
    await host.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await host.evaluate("Eredita.Network.startMode('solo');Eredita.GameView.command('confirmBiomes','red','keep')");
    await host.click('#start-game');
    await host.waitFor(`${diagnostic}.privateView?.pending && ${diagnostic}.crystal?.ready`);
    await host.evaluate(`document.querySelector('${stage}').click();Eredita.GameView.command('togglePause');Eredita.MythologySession.render(Eredita.GameView.getState())`);
    assert.equal(await host.evaluate(`${diagnostic}.crystal.paused`), true);
    await host.evaluate("Eredita.GameView.command('togglePause');Eredita.MythologySession.render(Eredita.GameView.getState())");
    await host.waitFor(`${diagnostic}.crystal.cardsProgress===1`);
    await host.click(left);
    assert.equal(await host.evaluate(`${diagnostic}.privateView.selections.length`), 1, 'Reduced motion remains selectable after a match pause');
    await host.evaluate("Eredita.GameView.selectVillage('blue',0)");
    assert.equal(await host.evaluate(`${diagnostic}.privateView.playerId`), 'red', 'Inspecting the AI village does not expose its reinforcement');
    await host.evaluate('Eredita.GameView.returnToLobby()');
    for (const client of [page, guest]) {
      assert.deepEqual(client.errors, []); assert.deepEqual(client.badResponses, []); assert.deepEqual(client.consoleErrors, []);
    }
    console.log('Renforts en partie réelle : surimpression supérieure symétrique, cristal permanent centré, fermeture après validation, raccordement LÉGENDE privé et ordonné, FIFO 3→2→1→0, réarmement sans ouverture automatique, pause, reset, deux clients réseau et mobile validés.');
  } catch (error) {
    for (let i = 0; i < clients.length; i++) {
      console.error('Client', i, await clients[i].evaluate('({mode:Eredita.Network.mode,phase:Eredita.GameView.getState().phase,epoch:Eredita.GameView.getState().reinforcementEpoch,diagnostics:Eredita.MythologySession.diagnostics,modals:[...document.querySelectorAll("[role=dialog]")].map(el=>({id:el.id,hidden:el.hidden}))})'));
      await screenshot(clients[i], 'failure-client-' + i);
    }
    throw error;
  } finally { await browser?.close(); server.kill(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
