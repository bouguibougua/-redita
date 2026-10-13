"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const pageUrl = process.argv[2] || "http://127.0.0.1:8765/";
const port = 9337;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "eredita-transport-"));
const browser = spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", [
  "--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run",
  "--window-size=1440,1200", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"
], { stdio: "ignore" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;

async function run() {
  let page;
  for (let i = 0; i < 60 && !page; i++) {
    try {
      page = (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())).find((item) => item.type === "page");
    } catch (_) { /* Wait for the browser debugging port. */ }
    if (!page) await delay(100);
  }
  assert.ok(page, "Edge headless starts");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const pending = new Map(), exceptions = [];
  let id = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
  };
  function send(method, params = {}) {
    const messageId = ++id;
    socket.send(JSON.stringify({ id: messageId, method, params }));
    return new Promise((resolve, reject) => pending.set(messageId, { resolve, reject }));
  }
  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function waitFor(expression) {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`Condition non atteinte : ${expression}`);
  }
  async function click(selector) {
    const point = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element || element.disabled) throw new Error('Bouton absent ou désactivé');
      element.scrollIntoView({ block: 'center' });
      const r = element.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
    await delay(120);
  }
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: pageUrl });
  await waitFor("document.readyState === 'complete' && !!window.Eredita?.GameView?.getState()");
  await evaluate(`(() => {
    const E = Eredita;
    E.Network.startMode('local', 'simplified');
    const s = window.testState = E.GameView.getState();
    s.phase = 'running'; s.preparationRemaining = 3600;
    for (const [lane, biome] of ['plaine', 'montagne'].entries()) {
      const village = s.players.red.villages[lane];
      village.biome = biome; village.slots = E.Biomes.createSlots(biome);
      const enemy = s.players.blue.villages[lane];
      enemy.biome = 'littoral'; enemy.slots = E.Biomes.createSlots('littoral');
      E.Buildings.buildT1(s, 'red', lane, 'artisanat');
    }
    s.selectedVillage = { playerId: 'red', lane: 0 };
    E.UI.render(s);
  })()`);
  await click("#open-shop-modal");
  for (const lane of [0, 1]) {
    await click(`[data-shop-village="${lane}"]`);
    assert.match(await evaluate("document.querySelector('#village-shop [data-fleet-summary]').textContent"), /0\/4 barques/);
    const gold = await evaluate("testState.players.red.gold");
    await click('[data-buy-shop-item="barque"][data-shop-building="artisanat"]');
    assert.equal(await evaluate(`testState.players.red.villages[${lane}].maritime.barque`), 1);
    assert.equal(await evaluate("testState.players.red.gold"), gold - await evaluate("Eredita.Config.maritime.shop.barque.gold"));
    assert.match(await evaluate("document.querySelector('#village-inspector [data-fleet-summary]').textContent"), /1\/4 barques.*2\/2 places libres/);
    assert.match(await evaluate("document.querySelector('#village-shop [data-fleet-summary]').textContent"), /1\/4 barques.*2\/2 places libres/);
  }
  await click("#close-shop-modal");
  await evaluate(`(() => {
    const E = Eredita, s = testState, village = s.players.red.villages[1];
    s.preparationRemaining = 0;
    E.GameView.command('assignResidentMission', village.residents[0].id, 'attaque');
    const unit = window.testUnit = s.units.find(u => u.originLane === 1);
    unit.position = E.Config.maritime.waterRanges.blue.min - 0.05;
    E.Combat.update(s, 0.1);
    s.preparationRemaining = 3600;
    E.UI.renderFrame(s);
  })()`);
  assert.equal(await evaluate("testUnit.waterTransport"), "barque");
  assert.match(await evaluate("document.querySelector('#village-inspector [data-fleet-summary]').textContent"), /1\/2 places libres/);
  assert.equal(await evaluate("document.querySelectorAll('.unit.on-water.transport-barque').length"), 1);
  await evaluate(`testUnit.position = Eredita.Config.maritime.waterRanges.blue.max + 1;
    Eredita.Transport.updateUnitWaterState(testState, testUnit); Eredita.UI.renderFrame(testState);`);
  assert.match(await evaluate("document.querySelector('#village-inspector [data-fleet-summary]').textContent"), /2\/2 places libres/);
  assert.equal(await evaluate("testState.players.red.villages[1].maritime.barque"), 1);
  assert.deepEqual(exceptions, []);
  console.log("Navigateur : achat de barques en Plaine/Montagne, réserve locale, embarquement automatique et compteur de places validés.");
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  socket?.close();
  browser.kill();
  await delay(300);
  const relative = path.relative(os.tmpdir(), profile);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});
