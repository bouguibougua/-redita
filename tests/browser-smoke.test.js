"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const pageUrl = process.argv[2] || "http://127.0.0.1:8765/";
const port = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "eredita-edge-smoke-"));
const browser = spawn(edgePath, [
  "--headless=new",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--no-first-run",
  "--window-size=1440,1200",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "about:blank"
], { stdio: "ignore" });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function getDebugPage() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = pages.find((entry) => entry.type === "page");
      if (page) return page;
    } catch (_) {
      // Edge n'a pas encore ouvert son port de débogage.
    }
    await delay(100);
  }
  throw new Error("Edge headless n'a pas démarré.");
}

async function run() {
  const page = await getDebugPage();
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const exceptions = [];
  const badResponses = [];
  let messageId = 0;

  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
    if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
      badResponses.push(`${message.params.response.status} ${message.params.response.url}`);
    }
  };

  function send(method, params = {}) {
    const id = ++messageId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function evaluate(expression) {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  }

  async function waitFor(expression) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`Condition non atteinte : ${expression}`);
  }

  async function realClick(selector) {
    const point = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
      element.scrollIntoView({ block: "center", inline: "nearest" });
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    assert.ok(point, `Élément absent : ${selector}`);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await delay(90);
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await delay(120);
  }

  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: pageUrl });
  await waitFor("document.readyState === 'complete' && !!document.querySelector('#play-local')");
  await realClick("#play-local");
  await waitFor("!!document.querySelector('[data-setup-action=keep]') && document.querySelector('#connection-screen').hidden");
  await evaluate(`(() => {
    const original = Eredita.UI.render;
    Eredita.UI.render = (state) => { window.testState = state; original(state); };
  })()`);

  await realClick('[data-setup-action="keep"][data-player="red"]');
  await realClick('[data-setup-action="keep"][data-player="blue"]');
  assert.equal(await evaluate("document.querySelector('#start-game').disabled"), false);

  await realClick("#start-game");
  await waitFor("document.querySelector('#game-screen').hidden === false");
  assert.equal(await evaluate("testState.players.red.gold"), 5000);
  assert.equal(await evaluate("testState.players.blue.gold"), 5000);
  await waitFor("Eredita.Board3D.ready || !!Eredita.Board3D.error");
  assert.equal(await evaluate("Eredita.Board3D.ready"), true, await evaluate("Eredita.Board3D.error"));
  await waitFor("document.querySelector('#battlefield').classList.contains('three-mode') && !!document.querySelector('#battlefield-3d canvas')");
  assert.equal(await evaluate("document.querySelector('#toggle-board-view').textContent"), "Vue 2D");
  assert.equal(await evaluate("document.querySelector('#battlefield-3d canvas').width > 0"), true);
  await realClick("#toggle-board-view");
  await waitFor("!document.querySelector('#battlefield').classList.contains('three-mode')");
  const coastalArt = await evaluate(`(() => {
    const red = getComputedStyle(document.querySelector('.region.littoral.red'), '::before');
    const blue = getComputedStyle(document.querySelector('.region.littoral.blue'), '::before');
    return { red: red.backgroundImage, blue: blue.backgroundImage, blueTransform: blue.transform };
  })()`);
  assert.ok(coastalArt.red.includes("terrain-littoral-rouge.png"));
  assert.ok(coastalArt.blue.includes("terrain-littoral-bleu.png"));
  assert.equal(coastalArt.blueTransform, "none");
  assert.equal(await evaluate("document.querySelectorAll('[data-village-select]').length"), 8);
  assert.equal(await evaluate("!!document.querySelector('#village-shop') && !document.querySelector('#event-log')"), true);
  assert.equal(await evaluate("document.querySelectorAll('[data-shop-store]').length"), 3);
  assert.equal(await evaluate("document.querySelectorAll('[data-buy-shop-item]').length"), 4);
  assert.equal(await evaluate("document.querySelectorAll('[data-map-village]').length"), 8);
  assert.equal(await evaluate("document.querySelectorAll('[data-map-village] [data-map-resource]').length"), 48);
  assert.equal(await evaluate("document.querySelectorAll('[data-map-hp], [data-map-population], [data-map-available]').length"), 24);
  assert.equal(await evaluate("document.querySelectorAll('[data-map-village][aria-current=true]').length"), 1);
  assert.equal(await evaluate("Boolean(document.querySelector('#battlefield').compareDocumentPosition(document.querySelector('#village-selector')) & Node.DOCUMENT_POSITION_FOLLOWING)"), true);
  assert.equal(await evaluate("document.querySelectorAll('.board-columns button').length"), 0);
  assert.equal(await evaluate("document.querySelectorAll('[data-terrain-building=village].tier-1').length"), 8);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-terrain-building=village]')).backgroundImage.includes('buildings-tier-atlas.png')"), true);
  assert.equal(await evaluate("document.querySelectorAll('[data-select-slot]').length"), 4);
  assert.equal(await evaluate("document.querySelector('#village-inspector').textContent.includes('Élevages ·')"), false);
  await realClick('[data-select-slot="0"]');
  assert.equal(await evaluate("document.querySelectorAll('[data-place-crop]').length"), 2);
  await realClick('[data-place-crop]:not([disabled])');
  await waitFor("document.querySelectorAll('.slot.occupied.crop').length === 1");
  const placedCrop = await evaluate(`(() => {
    const village = testState.players.red.villages[0];
    const index = village.slots.findIndex(slot => slot.content?.category === 'crop');
    return { index, type: village.slots[index].content.type };
  })()`);
  await realClick(`[data-select-slot="${placedCrop.index}"]`);
  await realClick(`[data-place-crop]:not([data-place-crop="${placedCrop.type}"]):not([disabled])`);
  assert.notEqual(await evaluate(`testState.players.red.villages[0].slots[${placedCrop.index}].content.type`), placedCrop.type);
  assert.equal(await evaluate("document.querySelectorAll('.slot.occupied.crop').length"), 1);
  const livestockIndex = await evaluate("testState.players.red.villages[0].slots.findIndex(slot => !slot.content && ['free', 'animal'].includes(slot.type))");
  await realClick(`[data-select-slot="${livestockIndex}"]`);
  await realClick('[data-place-livestock="chevre"]');
  await waitFor("document.querySelectorAll('.slot.occupied.livestock').length === 1");
  assert.equal(await evaluate("testState.players.red.villages[0].buildings.length"), 0);
  await realClick('[data-build="bergerie"]');
  assert.equal(await evaluate("document.querySelectorAll('.region.red [data-terrain-building=bergerie].tier-1').length"), 1);
  assert.equal(await evaluate("document.querySelector('[data-shop-store=bergerie] > summary b').textContent"), "T1");
  assert.equal(await evaluate("document.querySelector('[data-shop-store=bergerie] [data-shop-tier=\"1\"]').classList.contains('unlocked')"), true);
  assert.equal(await evaluate("document.querySelector('[data-shop-store=bergerie] [data-shop-tier=\"2\"]').classList.contains('locked')"), true);
  await realClick('[data-build="artisanat"]');
  await realClick('[data-build="boucherie"]');
  await realClick('[data-select-resident][data-resident-state="disponible"]');
  assert.equal(await evaluate("document.querySelector('[data-resident-mission=agriculture]').classList.contains('boosted')"), false);
  await realClick('[data-profession="agriculteur"]');
  assert.equal(await evaluate("document.querySelector('[data-resident-mission=agriculture]').classList.contains('boosted')"), true);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-resident-mission=agriculture]')).borderTopColor"), "rgb(87, 184, 255)");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-profession=agriculteur]')).borderTopColor"), "rgb(255, 227, 77)");
  assert.equal(await evaluate("document.querySelector('[data-resident-mission=peche]').classList.contains('boosted')"), false);
  await realClick('[data-resident-mission="agriculture"]');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-resident-mission=agriculture]')).borderTopColor"), "rgb(255, 227, 77)");
  assert.equal(await evaluate("document.querySelector('[data-resident-mission=agriculture]').getAttribute('aria-pressed')"), "true");
  await waitFor("document.querySelectorAll('.unit.worker.red').length === 1");
  await realClick('[data-profession-all="agriculteur"]');
  assert.equal(await evaluate("testState.players.red.villages[0].residents.every(resident => resident.profession === 'agriculteur')"), true);
  assert.equal(await evaluate("document.querySelector('#residents-panel').classList.contains('lane-0')"), true);
  assert.equal(await evaluate("document.querySelector('#residents-panel').parentElement.classList.contains('board-panel')"), true);
  assert.equal(await evaluate("!!document.querySelector('#residents-panel [data-build]')"), true);
  assert.equal(await evaluate("document.querySelectorAll('#residents-panel .management-column').length"), 4);
  assert.equal(await evaluate("document.querySelectorAll('#residents-panel [data-assign-all]').length"), 6);
  assert.equal(await evaluate("document.querySelectorAll('#residents-panel [data-profession-all]').length"), 7);
  assert.equal(await evaluate("document.querySelectorAll('#residents-panel [data-sell], #village-inspector [data-select-resident]').length"), 0);
  await realClick('[data-select-resident][data-resident-state="disponible"]');
  await realClick('[data-resident-mission="elevage"]');
  await waitFor("document.querySelectorAll('[data-worker-mission=elevage]').length === 1");
  assert.equal(await evaluate(`document.querySelector('[data-select-slot="${livestockIndex}"] small').textContent.includes('×1')`), true);
  await evaluate(`(() => {
    const village = testState.players.red.villages[0];
    const herd = village.slots.find(slot => slot.content?.category === 'livestock').content;
    herd.reproductionProgress = Eredita.Config.livestock.chevre.reproductionInterval;
    Eredita.Economy.updateProduction(testState, 0.1);
  })()`);
  await waitFor(`document.querySelector('[data-select-slot="${livestockIndex}"] small').textContent.includes('×2')`);
  await realClick(`[data-select-slot="${livestockIndex}"]`);
  assert.equal(await evaluate("document.querySelector('[data-slaughter-quantity]').max"), "2");
  assert.equal(await evaluate("document.querySelector('[data-slaughter]').closest('.enclosure-control') !== null"), true);
  await realClick('[data-slaughter]');
  await waitFor(`document.querySelector('[data-select-slot="${livestockIndex}"] small').textContent.includes('×1')`);
  assert.equal(await evaluate("testState.players.red.villages[0].resources.viande"), 4);
  assert.equal(await evaluate("document.querySelector('[data-resource=viande]').textContent"), "4");
  assert.equal(await evaluate("document.querySelector('[data-map-village][data-player=red][data-lane=\"0\"] [data-map-resource=viande]').textContent"), "4");
  assert.equal(await evaluate("document.querySelector('.sell-meat-button')"), null);
  assert.equal(await evaluate("document.querySelector('[data-sell=viande]').disabled"), false);
  assert.equal(await evaluate("document.querySelectorAll('[data-resident-state=agriculture]').length"), 1);
  assert.equal(await evaluate("document.querySelectorAll('[data-resident-state=elevage]').length"), 1);
  await realClick('[data-select-resident][data-resident-state="disponible"]');
  await realClick('[data-resident-mission="attaque"]');
  await waitFor("document.querySelectorAll('.unit.red:not(.worker)').length === 1");

  await realClick('[data-select-resident][data-resident-state="disponible"]');
  await realClick('[data-resident-mission="defense"]');
  await waitFor("document.querySelectorAll('.unit.red:not(.worker)').length === 2");
  assert.equal(await evaluate("document.querySelectorAll('[data-resident-state=defense]').length"), 1);
  assert.equal(await evaluate("testState.units.every(unit => unit.role === 'habitant')"), true);

  await realClick('[data-select-resident][data-resident-state="disponible"]');
  await realClick('[data-profession="chasseur"]');
  await realClick('[data-resident-mission="chasse"]');
  await waitFor("document.querySelectorAll('[data-worker-mission=chasse]').length === 1");
  const hunterStart = await evaluate("testState.players.red.villages[0].residents.find(resident => resident.mission === 'chasse').workPosition");
  await delay(500);
  const hunterEnd = await evaluate("testState.players.red.villages[0].residents.find(resident => resident.mission === 'chasse').workPosition");
  assert.notEqual(hunterEnd, hunterStart);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-worker-mission=chasse] .unit-body')).animationName"), "hunter-step");

  await evaluate(`(() => {
    testState.players.red.villages[0].damageSmoke = 5;
    Eredita.UI.renderFrame(testState);
  })()`);
  assert.equal(await evaluate("document.querySelector('.region.red .terrain-building-layer').classList.contains('under-attack')"), true);
  assert.equal(await evaluate("document.querySelector('[data-map-village][data-player=red][data-lane=\"0\"]').classList.contains('under-attack')"), true);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.terrain-building-layer.under-attack .terrain-building'), '::before').animationName"), "structure-smoke");
  await realClick('#toggle-board-view');
  await waitFor("document.querySelector('#battlefield').classList.contains('three-mode')");
  assert.equal(await evaluate("[...document.querySelectorAll('[data-map-village]')].every(card => card.getBoundingClientRect().width > 0)"), true);
  await delay(250);
  await realClick('#toggle-board-view');
  await waitFor("!document.querySelector('#battlefield').classList.contains('three-mode')");

  // Fixture de banque : clics réels, conversion en or et améliorations T2/T3.
  await evaluate(`(() => {
    testState.players.red.gold = 1000;
    testState.players.red.villages[0].resources.ble = 1000;
    Eredita.UI.render(testState);
  })()`);
  await realClick('[data-sell="ble"]');
  assert.equal(await evaluate("testState.players.red.gold"), 1010.5);
  assert.equal(await evaluate("testState.players.red.villages[0].resources.ble"), 990);
  const populationBeforePurchase = await evaluate("testState.players.red.villages[0].population");
  await realClick('[data-buy-resident]');
  assert.equal(await evaluate("testState.players.red.villages[0].population"), populationBeforePurchase + 1);
  assert.equal(await evaluate("testState.players.red.villages[0].resources.ble"), 940);
  assert.ok((await evaluate("getComputedStyle(document.querySelector('.region.plaine, .region.montagne, .region.littoral'), '::before').backgroundImage")).includes("terrain-"));
  assert.ok((await evaluate("getComputedStyle(document.querySelector('.resident-avatar')).backgroundImage")).includes("characters-atlas"));
  await realClick('[data-upgrade="0"]');
  assert.equal(await evaluate("testState.players.red.villages[0].buildings[0].level"), 2);
  assert.equal(await evaluate("testState.players.red.villages[0].resources.ble"), 840);
  await realClick('[data-upgrade="0"]');
  assert.equal(await evaluate("testState.players.red.villages[0].buildings[0].level"), 3);
  assert.equal(await evaluate("document.querySelectorAll('.region.red [data-terrain-building=bergerie].tier-3').length"), 1);
  assert.equal(await evaluate("!!document.querySelector('[data-upgrade=\"0\"]')"), false);
  await realClick('[data-upgrade="village"]');
  assert.equal(await evaluate("testState.players.red.villages[0].level"), 2);
  assert.equal(await evaluate("document.querySelectorAll('.region.red [data-terrain-building=village].tier-2').length"), 1);
  assert.equal(await evaluate("document.querySelector('[data-upgrade=village]').disabled"), true);
  const coastalLane = await evaluate("testState.players.red.villages.find(village => village.biome === 'littoral').lane");
  await realClick(`[data-village-select][data-player="red"][data-lane="${coastalLane}"]`);
  await evaluate("testState.players.red.gold = 1000; Eredita.UI.render(testState)");
  if (!await evaluate("testState.players.red.villages[" + coastalLane + "].buildings.some(building => building.type === 'artisanat' || building.type === 'boucherie')")) {
    await realClick('[data-build="artisanat"]');
  }
  const shopGold = await evaluate("testState.players.red.gold");
  const barqueCost = await evaluate("Eredita.Config.maritime.shop.barque.gold");
  await realClick('[data-buy-shop-item="barque"]:not([disabled])');
  assert.equal(await evaluate("testState.players.red.villages[" + coastalLane + "].maritime.barque"), 1);
  assert.equal(await evaluate("testState.players.red.gold"), shopGold - barqueCost);
  assert.equal(await evaluate("document.querySelector('[data-shop-count=barque]').textContent.includes('1/4')"), true);
  assert.equal(await evaluate("document.querySelectorAll('.region.red.littoral [data-terrain-fleet=barque] .terrain-vessel').length"), 1);

  // Animaux et équipements : achats par vrais clics, silhouettes et refus sans coût.
  await evaluate(`(() => {
    const E = Eredita, village = testState.players.red.villages[${coastalLane}];
    testState.players.red.gold = 5000;
    village.resources.ble = 1000;
    for (const type of ['bergerie', 'artisanat', 'boucherie']) {
      if (!E.Buildings.has(village, type)) E.Buildings.buildT1(testState, 'red', village.lane, type);
    }
    village.slots = E.Biomes.createSlots('littoral');
    const resident = village.residents.find(person => !person.unitId);
    testState.selectedResidentId = resident.id;
    window.equippedResidentId = resident.id;
    E.UI.render(testState);
  })()`);
  const animalGold = await evaluate("testState.players.red.gold");
  await realClick('[data-buy-animal="chevre"]');
  const purchasedHerd = await evaluate(`testState.players.red.villages[${coastalLane}].slots.findIndex(slot => slot.content?.type === 'chevre')`);
  assert.ok(purchasedHerd >= 0);
  await realClick('[data-buy-animal="chevre"]');
  assert.equal(await evaluate(`testState.players.red.villages[${coastalLane}].slots[${purchasedHerd}].content.count`), 2);
  assert.equal(await evaluate("testState.players.red.gold"), animalGold - 100);
  await realClick('[data-buy-animal="cochon"]');
  assert.equal(await evaluate("document.querySelector('[data-buy-animal=vache]').disabled"), true);
  assert.equal(await evaluate("document.querySelector('[data-buy-animal=vache]').closest('article').querySelector('[data-shop-reason]').textContent"), "Aucun enclos compatible disponible");

  for (const profession of ['habitant', 'agriculteur', 'berger', 'pecheur', 'chasseur', 'guerrier', 'ravageur']) {
    await realClick(`[data-profession="${profession}"]`);
    assert.equal(await evaluate("document.querySelector('.resident-card.selected [data-visual-profession]').dataset.visualProfession"), profession);
    assert.equal(await evaluate("document.querySelector('.equipment-preview [data-visual-profession]').dataset.visualProfession"), profession);
  }
  const equipmentGold = await evaluate("testState.players.red.gold");
  await realClick('[data-buy-equipment="bois"][data-equipment-kind="tools"]');
  await realClick('[data-buy-equipment="cuir"][data-equipment-kind="armors"]');
  assert.equal(await evaluate("testState.players.red.gold"), equipmentGold - 150);
  assert.equal(await evaluate("document.querySelector('.resident-card.selected [data-visual-tool]').dataset.visualTool"), 'bois');
  assert.equal(await evaluate("document.querySelector('.resident-card.selected [data-visual-armor]').dataset.visualArmor"), 'cuir');
  assert.equal(await evaluate("document.querySelector('[data-buy-equipment=bois]').closest('article').classList.contains('equipped')"), true);
  assert.equal(await evaluate("document.querySelector('[data-buy-equipment=bois]').disabled"), true);
  assert.equal(await evaluate("document.querySelector('[data-buy-equipment=bronze]').disabled"), true);
  const artisanIndex = await evaluate(`testState.players.red.villages[${coastalLane}].buildings.findIndex(building => building.type === 'artisanat')`);
  await realClick(`[data-upgrade="${artisanIndex}"]`);
  await realClick('[data-buy-equipment="bronze"]');
  await realClick('[data-buy-equipment="maille"]');
  await realClick(`[data-upgrade="${artisanIndex}"]`);
  await realClick('[data-buy-equipment="fer"][data-equipment-kind="tools"]');
  await realClick('[data-buy-equipment="fer"][data-equipment-kind="armors"]');
  assert.equal(await evaluate(`testState.players.red.villages[${coastalLane}].residents.find(resident => resident.id === equippedResidentId).tool`), 'fer');
  assert.equal(await evaluate("document.querySelectorAll('.equipment-preview .gear-armor.armor-fer, .equipment-preview .gear-tool.tool-fer').length"), 2);

  // Bergerie T2/T3 : âne associé, chiens commandés et sanglier abattu ou déployé.
  await evaluate(`testState.players.red.gold = 5000; testState.players.red.villages[${coastalLane}].resources.ble = 1000; Eredita.UI.render(testState)`);
  const sheepfoldIndex = await evaluate(`testState.players.red.villages[${coastalLane}].buildings.findIndex(building => building.type === 'bergerie')`);
  while (await evaluate(`testState.players.red.villages[${coastalLane}].buildings[${sheepfoldIndex}].level < 2`)) await realClick(`[data-upgrade="${sheepfoldIndex}"]`);
  assert.equal(await evaluate("document.querySelector('[data-buy-special-animal=ane]').disabled"), false);
  await realClick('[data-buy-special-animal="ane"]');
  assert.equal(await evaluate(`testState.players.red.villages[${coastalLane}].residents.find(resident => resident.id === equippedResidentId).donkey`), true);
  assert.equal(await evaluate("document.querySelector('.resident-card.selected [data-visual-donkey]').dataset.visualDonkey"), "true");
  assert.equal(await evaluate("document.querySelector('[data-buy-special-animal=ane]').disabled"), true);
  if (await evaluate(`testState.players.red.villages[${coastalLane}].buildings[${sheepfoldIndex}].level === 2`)) {
    assert.equal(await evaluate("document.querySelector('[data-buy-special-animal=chien]').disabled"), true);
    await realClick(`[data-upgrade="${sheepfoldIndex}"]`);
  }
  const populationBeforeAnimals = await evaluate(`testState.players.red.villages[${coastalLane}].population`);
  await realClick('[data-buy-special-animal="chien"]');
  await realClick('[data-buy-special-animal="chien"]');
  await realClick('[data-buy-special-animal="sanglier"]');
  assert.equal(await evaluate("document.querySelectorAll('[data-companion-card]').length"), 3);
  await realClick('[data-order-animal="garde"]:not([disabled])');
  await realClick('[data-order-animal="defense"]:not([disabled])');
  assert.equal(await evaluate(`testState.players.red.villages[${coastalLane}].animals.filter(animal => animal.type === 'chien' && animal.unitId).length`), 2);
  const meatBeforeBoar = await evaluate(`testState.players.red.villages[${coastalLane}].resources.viande`);
  await realClick('[data-slaughter-special]:not([disabled])');
  assert.equal(await evaluate(`testState.players.red.villages[${coastalLane}].resources.viande`), meatBeforeBoar + 8);
  await realClick('[data-buy-special-animal="sanglier"]');
  await realClick('[data-order-animal="attaque"]:not([disabled])');
  assert.equal(await evaluate(`testState.players.red.villages[${coastalLane}].animals.find(animal => animal.type === 'sanglier').mission`), "attaque");
  assert.equal(await evaluate(`testState.players.red.villages[${coastalLane}].population`), populationBeforeAnimals);
  assert.equal(await evaluate("document.querySelectorAll('#units-layer [data-visual-animal=chien]').length"), 2);
  assert.equal(await evaluate("document.querySelectorAll('#units-layer [data-visual-animal=sanglier]').length"), 1);
  await realClick('#toggle-board-view');
  await waitFor("document.querySelector('#battlefield').classList.contains('three-mode')");
  await delay(250);
  if (process.env.EREDITA_SCREENSHOT) {
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    fs.writeFileSync(process.env.EREDITA_SCREENSHOT, Buffer.from(shot.data, "base64"));
  }
  await realClick('#toggle-board-view');

  // Les deux panneaux suivent la sélection sans déborder, même au bord du plateau.
  for (const width of [1440, 768, 320]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate("window.scrollTo(0, scrollY)");
    const bankLayout = await evaluate(`(() => {
      const boxes = [...document.querySelectorAll('.resource-row')].map(el => el.getBoundingClientRect());
      return { sameRow: Math.abs(boxes[0].top - boxes[1].top) < 1,
        nextRow: boxes[2].top > boxes[0].bottom, thirdRow: boxes[4].top > boxes[2].bottom,
        columns: Math.abs(boxes[0].left - boxes[2].left) < 1,
        buttons: [...document.querySelectorAll('.resource-row [data-sell]')].every(button => {
          const rect = button.getBoundingClientRect(), parent = button.closest('.resource-row').getBoundingClientRect();
          return rect.left >= parent.left && rect.right <= parent.right;
        }) };
    })()`);
    assert.deepEqual(bankLayout, { sameRow: true, nextRow: true, thirdRow: true, columns: true, buttons: true });
    const mapLayout = await evaluate(`(() => {
      const map = document.querySelector('#battlefield').getBoundingClientRect();
      const selector = document.querySelector('#village-selector').getBoundingClientRect();
      const cards = [...document.querySelectorAll('[data-map-village]')].map(card => card.getBoundingClientRect());
      return { count: cards.length, allVisible: cards.every(card => card.width > 0 && card.height > 0),
        allInside: cards.every(card => card.left >= map.left && card.right <= map.right && card.top >= map.top && card.bottom <= map.bottom),
        selectorBelowMap: selector.top >= map.bottom };
    })()`);
    assert.deepEqual(mapLayout, { count: 8, allVisible: true, allInside: true, selectorBelowMap: true });
    for (const player of ["red", "blue"]) {
      for (const lane of [0, 1, 2, 3]) {
        await realClick(`[data-village-select][data-player="${player}"][data-lane="${lane}"]`);
        const layout = await evaluate(`(() => {
          const panel = document.querySelector('#residents-panel').getBoundingClientRect();
          const village = document.querySelector('.village-token.selected').getBoundingClientRect();
          return { below: panel.top >= village.bottom, fits: panel.left >= 0 && panel.right <= innerWidth,
            panelLeft: panel.left, panelRight: panel.right, viewport: innerWidth, scrollX,
            sidebar: document.querySelector('#village-inspector .step-label').textContent,
            overflow: document.documentElement.scrollWidth > innerWidth };
        })()`);
        assert.equal(layout.below, true);
        assert.equal(layout.fits, true, JSON.stringify({ width, player, lane, layout }));
        assert.equal(layout.overflow, false);
        assert.ok(layout.sidebar.includes(`Ligne ${lane + 1}`));
      }
    }
  }
  await realClick('[data-assign-all="chasse"]');
  assert.equal(await evaluate("testState.players.blue.villages[3].residents.every(resident => resident.mission === 'chasse')"), true);
  assert.equal(await evaluate("document.querySelector('[data-map-village][data-player=blue][data-lane=\"3\"] [data-map-available]').textContent"), "0");
  await realClick('#residents-panel summary');
  assert.equal(await evaluate("document.querySelector('#residents-panel details').open"), false);
  await realClick('#residents-panel summary');
  assert.equal(await evaluate("document.querySelector('#residents-panel details').open"), true);
  assert.equal(await evaluate("document.querySelector('#residents-panel').hidden"), false);
  assert.equal(await evaluate("document.querySelector('[data-cancel-placement]')"), null);
  assert.equal(await evaluate("document.querySelectorAll('.board-columns button').length"), 0);

  // Les destructions et malus doivent apparaître sans clic ni rendu complet.
  await evaluate(`(() => {
    const E = Eredita, red = testState.players.red.villages[0], blue = testState.players.blue.villages[0];
    testState.players.red.gold = testState.players.blue.gold = 5000;
    testState.units = [];
    testState.paused = false;
    red.biome = blue.biome = 'plaine';
    blue.slots = E.Biomes.createSlots('plaine');
    const sheepfold = red.buildings.find(building => building.type === 'bergerie');
    sheepfold.level = 3;
    if (!E.Buildings.has(blue, 'bergerie')) E.Buildings.buildT1(testState, 'blue', 0, 'bergerie');
    E.Crops.place(testState, 'blue', 0, 0, 'ble');
    E.Livestock.place(testState, 'blue', 0, 1, 'chevre');
    E.Animals.buy(testState, 'red', 0, 'sanglier');
    const boar = red.animals.find(animal => animal.type === 'sanglier' && !animal.unitId);
    const unit = E.Animals.deploy(testState, 'red', 0, boar.id, 'attaque');
    unit.position = E.Config.temporaryProduction.agricultureFieldPositionByOwner.blue;
    blue.slots[0].content.hp = 0.5;
    testState.selectedVillage = { playerId:'blue', lane:0 };
    E.UI.render(testState);
    E.Combat.update(testState, 0.1);
    for (let i=0; i<5; i++) {
      E.Animals.buy(testState, 'red', 0, 'chien');
      const dog = red.animals.find(animal => animal.type === 'chien' && !animal.unitId);
      const guard = E.Animals.deploy(testState, 'red', 0, dog.id, 'perturber');
      guard.position = E.Config.temporaryProduction.agricultureFieldPositionByOwner.blue;
    }
    testState.paused = true;
    E.UI.renderFrame(testState);
  })()`);
  await realClick('[data-select-slot="1"]');
  await waitFor("document.querySelector('[data-herd-harassment=\"1\"]').textContent.includes('28 %')");
  assert.equal(await evaluate("document.querySelector('[data-slot-visual][data-player=blue][data-lane=\"0\"][data-slot-index=\"0\"]').classList.contains('occupied')"), false);
  assert.equal(await evaluate("document.querySelector('[data-herd-harassment=\"1\"]').textContent.includes('4 chien')"), true);

  assert.deepEqual(exceptions, []);
  assert.deepEqual(badResponses, []);
  socket.close();
  console.log("Test navigateur valide : achats, âne associé, chiens en garde/défense, sanglier abattu/déployé, champs détruits, malus visible, plateau 2D/3D et tailles d’écran.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    browser.kill();
    await delay(300);
    fs.rmSync(profile, { recursive: true, force: true });
  });
