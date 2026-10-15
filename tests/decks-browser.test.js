"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const externalUrl = process.argv[2];
const serverPort = 8877;
const pageUrl = externalUrl || `http://127.0.0.1:${serverPort}/`;
const server = externalUrl ? null : spawn(process.execPath, ["server.js"], {
  cwd: path.join(__dirname, ".."),
  env: { ...process.env, PORT: String(serverPort) },
  stdio: "ignore"
});
const port = 9444;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "eredita-decks-"));
const browser = spawn(edgePath, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run", "--window-size=1440,1000", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  let page;
  for (let attempt = 0; attempt < 50 && !page; attempt += 1) {
    try { page = (await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())).find((entry) => entry.type === "page"); } catch (_) {}
    if (!page) await delay(100);
  }
  assert.ok(page, "Edge headless doit démarrer");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const exceptions = [];
  let id = 0;
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const resolver = pending.get(message.id); pending.delete(message.id);
      return message.error ? resolver.reject(new Error(message.error.message)) : resolver.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const messageId = ++id; pending.set(messageId, { resolve, reject }); socket.send(JSON.stringify({ id: messageId, method, params })); });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 50; attempt += 1) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(`Condition non atteinte : ${expression}`);
  };
  const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const screenshot = async name => {
    if (!process.env.EREDITA_DECKS_PREVIEW_DIR) return;
    fs.mkdirSync(process.env.EREDITA_DECKS_PREVIEW_DIR, { recursive: true });
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.env.EREDITA_DECKS_PREVIEW_DIR, name + '.png'), Buffer.from(data, 'base64'));
  };

  await send("Runtime.enable");
  await send("Page.enable");
  const target = new URL(pageUrl); target.searchParams.set('intro', '0');
  await send("Page.navigate", { url: target.href });
  await waitFor("document.readyState === 'complete' && !!document.querySelector('[data-menu-screen=decks]')");
  await click("[data-menu-screen=decks]");
  await waitFor("!!document.querySelector('.deck-builder')");
  assert.equal(await evaluate("document.querySelectorAll('.deck-collection-card').length"), 34);
  assert.equal(await evaluate("document.querySelectorAll('.deck-myth-card').length"), 5);
  assert.equal(await evaluate("[...document.querySelectorAll('.deck-myth-card')].every(card=>!!card.closest('.deck-collection-grid'))"), true, 'La mythologie fait partie de la collection');
  assert.equal(await evaluate("(()=>{const a=document.querySelector('.deck-current').getBoundingClientRect(),b=document.querySelector('.deck-collection').getBoundingClientRect();return a.right<b.left && Math.abs(a.top-b.top)<1;})()"), true, 'Deck à gauche et collection à droite');
  await evaluate("(async()=>{const image=new Image();image.src='assets/deck-library.webp';await image.decode();return true;})()");
  assert.ok(await evaluate("getComputedStyle(document.querySelector('.decks-screen')).backgroundImage.includes('deck-library.webp')"));
  await evaluate("document.querySelector('#deck-search').focus()");
  for (const text of ['pe', 'cheur']) await send('Input.insertText', { text });
  assert.equal(await evaluate("document.activeElement.id==='deck-search' && document.querySelector('#deck-search').value==='pecheur'"), true, 'La recherche conserve son focus et le texte saisi');
  assert.ok(await evaluate("!!document.querySelector('.deck-collection [data-open-card=pecheur]') && document.querySelectorAll('.deck-collection-card').length<34"), 'Recherche insensible aux accents');
  await send('Input.insertText', { text: 'xyzabsent' });
  assert.equal(await evaluate("!!document.querySelector('.deck-no-results')"), true);
  await click('[data-reset-search]');
  assert.equal(await evaluate("document.querySelectorAll('.deck-collection-card').length"), 34);

  await click('[data-quantity="habitant"][data-delta="1"]');
  assert.equal(await evaluate("Eredita.Decks.quantity('habitant')"), 1);
  assert.equal(await evaluate("!!document.querySelector('.deck-modal-backdrop')"), false, "le bouton + ne doit pas ouvrir la fiche");
  await click('[data-open-card="habitant"]');
  assert.equal(await evaluate("document.querySelector('#deck-modal-title').textContent"), "Habitant");
  await click('.deck-modal-actions [data-delta="1"]');
  assert.equal(await evaluate("Eredita.Decks.quantity('habitant')"), 2);
  const scrollBefore = await evaluate("const panel=document.querySelector('.deck-collection-scroll');panel.scrollTop=500;panel.scrollTop");
  await click('.deck-current-entry [data-quantity="habitant"][data-delta="1"]');
  assert.equal(await evaluate("Eredita.Decks.quantity('habitant')"), 3);
  assert.equal(await evaluate("document.querySelector('.deck-collection-scroll').scrollTop"), scrollBefore, 'Modifier la quantité garde la position de la collection');
  await click('.deck-current-entry [data-quantity="habitant"][data-delta="-1"]');
  await click(".deck-modal-close"); await delay(180);
  assert.equal(await evaluate("!!document.querySelector('.deck-modal-backdrop')"), false);

  await click('[data-open-card="agriculteur"]');
  await evaluate("document.querySelector('.deck-modal-backdrop').click()"); await delay(180);
  assert.equal(await evaluate("!!document.querySelector('.deck-modal-backdrop')"), false);
  await click('[data-open-card="berger"]');
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))"); await delay(180);
  assert.equal(await evaluate("!!document.querySelector('.deck-modal-backdrop')"), false);

  await click('[data-filter="Équipement"]');
  assert.equal(await evaluate("document.querySelectorAll('.deck-collection-card').length"), 6);
  await click('[data-deck-index="1"]');
  assert.equal(await evaluate("Eredita.Decks.quantity('habitant')"), 0);
  await click('[data-deck-index="0"]');
  assert.equal(await evaluate("Eredita.Decks.quantity('habitant')"), 2);

  const mythIds = await evaluate("Eredita.Cards.mythological.map(card => card.id)");
  await click('.deck-filters [data-filter="Mythologique"]');
  assert.equal(await evaluate("document.querySelectorAll('.deck-collection-card').length"), 0);
  assert.equal(await evaluate("document.querySelectorAll('.deck-myth-card').length"), 5);
  for (const mythId of mythIds.slice(0, 3)) await click(`[data-toggle-myth="${mythId}"]`);
  assert.equal(await evaluate("Eredita.Decks.state.decks[0].mythological.length"), 3);
  assert.equal(await evaluate(`document.querySelector('[data-toggle-myth="${mythIds[3]}"]').disabled`), true);
  assert.equal(await evaluate("document.querySelectorAll('.deck-myth-slot.filled').length"), 3, 'La sélection mythologique est visible dans le deck');
  await click('.deck-myth-remove');
  assert.equal(await evaluate("Eredita.Decks.state.decks[0].mythological.length"), 2);
  assert.equal(await evaluate(`document.querySelector('[data-toggle-myth="${mythIds[3]}"]').disabled`), false);

  await click('[data-use-starter]');
  await click('.deck-filters [data-filter="Toutes"]');
  await evaluate("Promise.all([...document.querySelectorAll('.deck-current img, .deck-collection img')].map(image=>image.decode().catch(()=>{})))");
  await screenshot('decks-desktop');
  await click('.deck-filters [data-filter="Mythologique"]');
  await evaluate("Promise.all([...document.querySelectorAll('.deck-myth-card img')].map(image=>image.decode()))");
  await screenshot('decks-mythologie');
  await click('.deck-filters [data-filter="Toutes"]');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(150);
  assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"), 'Pas de débordement horizontal sur mobile');
  assert.ok(await evaluate("const builder=document.querySelector('.deck-builder');builder.scrollHeight>builder.clientHeight"), 'La collection reste accessible par défilement sur mobile');
  await screenshot('decks-mobile-composition');
  const mobileScroll = await evaluate("const b=document.querySelector('.deck-builder');b.scrollTop=document.querySelector('.deck-collection').offsetTop-b.offsetTop; b.scrollTop");
  await screenshot('decks-mobile-collection');
  await evaluate("document.querySelector('#deck-search').focus({preventScroll:true})");
  await send('Input.insertText', { text: 'berger' });
  assert.equal(await evaluate("document.querySelector('.deck-builder').scrollTop"), mobileScroll, 'Rechercher sur mobile ne ramène pas en haut de la page');
  assert.ok(await evaluate("!!document.querySelector('.deck-collection [data-open-card=berger]')"));
  await click('.deck-filters [data-filter="Mythologique"]');
  await send('Input.insertText', { text: 'aucun' });
  await click('[data-reset-search]');

  await click("#menu-back");
  assert.equal(await evaluate("document.querySelector('#main-menu').hidden"), false);
  await click('[data-menu-screen="play"]');
  assert.equal(await evaluate("!!document.querySelector('#training-button')"), true, "le jeu actuel doit rester accessible");
  await click("#menu-back");
  assert.deepEqual(exceptions, [], `Erreurs navigateur : ${exceptions.join(", ")}`);
  socket.close();
  console.log("Deck builder navigateur: menu, contrôles, filtres, modales et sélections validés.");
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  browser.kill();
  server?.kill();
  await delay(500);
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); } catch (_) {}
});
