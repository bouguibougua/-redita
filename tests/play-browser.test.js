'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), net = require('node:net');
const { spawn } = require('node:child_process');
const { startBrowser, delay } = require('../scripts/export-menu-gif.js');

async function run() {
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const url = 'http://127.0.0.1:' + port + '/?intro=0';
  const server = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  let browser;
  const pages = [];
  async function screenshot(page, name) {
    const folder = process.env.EREDITA_PLAY_PREVIEW_DIR;
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    if (folder) { fs.mkdirSync(folder, { recursive: true }); fs.writeFileSync(path.join(folder, name + '.png'), Buffer.from(shot.data, 'base64')); }
    return shot.data;
  }
  async function openArmory(page) {
    await page.send('Page.navigate', { url });
    await page.waitFor('window.Eredita?.GameView?.getState() && Eredita.MenuScene?.diagnostics.ready');
    await page.click('[data-menu-screen="play"]');
    await page.waitFor("document.querySelector('.play-panel').getAnimations().every(a => a.playState==='finished')");
  }
  async function click(page, selector) {
    await page.evaluate('document.querySelector(' + JSON.stringify(selector) + ').scrollIntoView({block:"center"})');
    await page.click(selector);
  }
  async function equalPanels(page) {
    const sizes = await page.evaluate("[...document.querySelectorAll('.play-main-panel')].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height};})");
    assert.equal(sizes.length, 3);
    assert.ok(sizes.every(r => Math.abs(r.width-sizes[0].width)<1 && Math.abs(r.height-sizes[0].height)<1), 'Les trois panneaux ont la même largeur et la même hauteur');
  }
  async function checkPaintedButton(page) {
    const data = await screenshot(page, 'multiplayer-desktop');
    const sample = await page.evaluate('(async()=>{const button=document.querySelector("#play-local"),r=button.getBoundingClientRect(),expected=getComputedStyle(button).backgroundColor.match(/\\d+/g).slice(0,3).map(Number);const image=new Image();image.src="data:image/png;base64,' + data + '";await image.decode();const c=document.createElement("canvas");c.width=image.width;c.height=image.height;const ctx=c.getContext("2d");ctx.drawImage(image,0,0);return {expected,actual:[...ctx.getImageData(Math.floor(r.left+12),Math.floor(r.top+12),1,1).data].slice(0,3)};})()');
    assert.deepEqual(sample.actual, sample.expected, 'Le bouton est réellement peint au-dessus du décor, et pas seulement présent dans le DOM');
  }
  try {
    for (let i=0; i<60; i++) { try { if ((await fetch(url)).ok) break; } catch (_) {} await delay(100); }
    browser = await startBrowser(); const host = browser.page; pages.push(host);
    await host.send('Emulation.setDeviceMetricsOverride', { width:1440, height:900, deviceScaleFactor:1, mobile:false });
    await openArmory(host); await equalPanels(host);
    assert.equal(await host.evaluate('Eredita.Network.format'), 'simplified');
    await screenshot(host, 'armory-desktop');
    await click(host, '.play-lobby [data-match-format="classic"]');
    assert.equal(await host.evaluate('Eredita.Network.format'), 'classic');
    await click(host, '.play-lobby [data-match-format="simplified"]');
    await click(host, '#menu-back');
    assert.equal(await host.evaluate("document.querySelector('#main-menu').hidden"), false);
    await host.click('[data-menu-screen="play"]');
    await click(host, '#training-button');
    await host.waitFor("Eredita.Network.mode==='solo'");
    assert.equal(await host.evaluate('Eredita.GameView.getState().format'), 'simplified');

    await openArmory(host); await click(host, '#open-multiplayer');
    await host.waitFor("!document.querySelector('#connection-screen').hidden");
    await checkPaintedButton(host);
    await click(host, '#connection-screen [data-match-format="classic"]');
    await click(host, '#play-local');
    await host.waitFor("Eredita.Network.mode==='local'");
    assert.equal(await host.evaluate('Eredita.GameView.getState().players.red.villages.length'), 4);

    await openArmory(host); await click(host, '#open-multiplayer');
    await click(host, '#play-solo');
    await host.waitFor("Eredita.Network.mode==='solo'");

    await openArmory(host); await click(host, '#open-multiplayer');
    await click(host, '#join-online');
    await host.waitFor("document.querySelector('#online-status').classList.contains('error')");
    await host.evaluate("document.querySelector('#room-code').focus()");
    await host.send('Input.insertText', { text:'zzzzz' });
    assert.equal(await host.evaluate("document.querySelector('#room-code').value"), 'ZZZZZ');
    await click(host, '#join-online');
    await host.waitFor("document.querySelector('#online-status').textContent.includes('introuvable')");
    await click(host, '#connection-back');
    assert.equal(await host.evaluate('Eredita.Network.mode'), 'pending');

    await host.click('[data-menu-screen="play"]'); await click(host, '#open-multiplayer');
    await click(host, '#create-online');
    await host.waitFor("Eredita.Network.mode==='host' && Eredita.Network.roomCode");
    await screenshot(host, 'multiplayer-room');
    await click(host, '#connection-back');
    assert.equal(await host.evaluate("Eredita.Network.mode==='pending' && Eredita.Network.roomCode===null"), true, 'Retour ferme le salon et permet de choisir un autre mode');
    await host.click('[data-menu-screen="play"]');
    await host.evaluate("document.querySelector('#training-button').focus()");
    await host.send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, text:'\r' });
    await host.send('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
    await host.waitFor("Eredita.Network.mode==='solo'");

    await openArmory(host); await click(host, '.play-lobby [data-match-format="classic"]');
    await click(host, '#open-multiplayer'); await click(host, '#create-online');
    await host.waitFor("Eredita.Network.mode==='host' && Eredita.Network.roomCode");
    const code = await host.evaluate('Eredita.Network.roomCode');
    const guest = await browser.newPage(); pages.push(guest);
    await openArmory(guest); await click(guest, '#open-multiplayer');
    await guest.evaluate("document.querySelector('#room-code').focus()");
    await guest.send('Input.insertText', { text:code.toLowerCase() });
    await click(guest, '#join-online');
    await guest.waitFor("Eredita.Network.mode==='guest' && Eredita.GameView.getState().format==='classic'");
    await click(host, '#continue-online');
    await host.waitFor("document.querySelector('#connection-screen').hidden && !document.querySelector('.app-shell').classList.contains('connection-pending')");

    const mobile = await browser.newPage(); pages.push(mobile);
    await mobile.send('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:true });
    await openArmory(mobile); await equalPanels(mobile);
    assert.equal(await mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
    await screenshot(mobile, 'armory-mobile');
    await click(mobile, '#open-multiplayer');
    await screenshot(mobile, 'multiplayer-mobile');
    for (const selector of ['#play-solo','#play-local','#create-online','#join-online','#connection-back']) {
      assert.equal(await mobile.evaluate('(()=>{const b=document.querySelector(' + JSON.stringify(selector) + '),r=b.getBoundingClientRect();return r.width>0&&r.height>=44&&getComputedStyle(b).visibility==="visible";})()'), true);
    }
    await click(mobile, '#play-local'); await mobile.waitFor("Eredita.Network.mode==='local'");
    for (const page of pages) { assert.deepEqual(page.errors, []); assert.deepEqual(page.badResponses, []); }
    console.log('Armurerie : panneaux identiques, rendu visible du multijoueur, tous les boutons, clavier, mobile, annulation de salon et connexion réelle hôte/invité validés.');
  } finally { await browser?.close(); server.kill(); }
}
run().catch(error => { console.error(error); process.exitCode=1; });
