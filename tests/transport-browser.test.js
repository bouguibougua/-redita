"use strict";
const assert = require("node:assert/strict");
const { createBrowser } = require("./browser-helpers");

async function run() {
  const browser = await createBrowser({ url: process.argv[2], serverPort: 8874, debugPort: 9448 });
  const { click, evaluate } = browser;
  try {
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
    assert.equal(await evaluate("document.querySelector('#village-inspector [data-fleet-summary]')"), null, 'La réserve est consultable dans la boutique et ne remplit plus le panneau latéral');
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
  await click('#open-shop-modal');
  assert.match(await evaluate("document.querySelector('#village-shop [data-fleet-summary]').textContent"), /1\/2 places libres/);
  assert.equal(await evaluate("document.querySelectorAll('.unit.on-water.transport-barque').length"), 1);
  await evaluate(`testUnit.position = Eredita.Config.maritime.waterRanges.blue.max + 1;
    Eredita.Transport.updateUnitWaterState(testState, testUnit); Eredita.UI.renderFrame(testState);`);
  assert.match(await evaluate("document.querySelector('#village-shop [data-fleet-summary]').textContent"), /2\/2 places libres/);
  assert.equal(await evaluate("testState.players.red.villages[1].maritime.barque"), 1);
  assert.deepEqual(browser.exceptions, []);
  assert.deepEqual(browser.imageErrors, []);
  console.log("Navigateur : achat de barques en Plaine/Montagne, réserve locale, embarquement automatique et compteur de places validés.");
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
