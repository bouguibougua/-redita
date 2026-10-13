"use strict";
const assert = require("node:assert/strict");
const { createBrowser } = require("./browser-helpers");

async function run() {
  const browser = await createBrowser({ url: process.argv[2] });
  const { click, evaluate, waitFor, screenshot, send } = browser;
  try {
    await waitFor("Eredita.Board3D.ready");
    await click('[data-menu-screen="decks"]');
    await waitFor("document.querySelectorAll('.deck-collection-card').length === 34");
    assert.equal(await evaluate("document.querySelectorAll('.deck-card-body img').length"), 39);
    assert.ok(await evaluate("document.querySelector('.deck-collection-card').getBoundingClientRect().height >= 230"), "Collection cards must preserve their illustration and quantity controls");
    await waitFor("[...document.querySelectorAll('.deck-collection-card img')].slice(0,4).every(i => i.complete && i.naturalWidth > 0)");
    await screenshot("collection.png");
    await evaluate(`(() => {
      const E = Eredita;
      E.Network.startMode('local', 'simplified');
      const s = window.testState = E.GameView.getState();
      for (const p of Object.values(s.players)) p.villages.forEach(v => { v.biome = 'plaine'; v.slots = E.Biomes.createSlots('plaine'); });
      E.Decks.state.decks[0] = { quantities: { 'champ-ble':4, artisanat:4, riviere:4, bergerie:4, chataignier:4, barque:4, moulin:4, agriculteur:2 }, mythological: ['u-mazzeru','a-stregha','squadra-arozza'] };
      E.GameView.command('confirmBiomes','red','keep');
      E.GameView.command('confirmBiomes','blue','keep');
      const random = Math.random; Math.random = () => 0.999999;
      E.GameView.command('start'); Math.random = random;
      E.UI.render(s);
    })()`);
    await waitFor("!document.querySelector('#card-hand').hidden");
    assert.equal(await evaluate("testState.players.red.cards.hand.length"), 5);
    assert.equal(await evaluate("testState.players.red.cards.drawPile.length"), 25);
    assert.equal(await evaluate("document.querySelector('[data-map-village][data-player=blue] [data-map-population]').textContent"), "?");
    const artisanat = await evaluate("testState.players.red.cards.hand.find(c => c.cardId === 'artisanat').id");
    const gold = await evaluate("testState.players.red.gold");
    await click(`[data-hand-card="${artisanat}"]`);
    assert.equal(await evaluate("document.querySelector('[data-confirm-card]').disabled"), false);
    await click("[data-confirm-card]");
    assert.equal(await evaluate("testState.players.red.villages[0].buildings[0].type"), "artisanat");
    assert.equal(await evaluate("testState.players.red.gold"), gold - 200);
    assert.equal(await evaluate("testState.players.red.cards.hand.length"), 4);
    const crop = await evaluate("testState.players.red.cards.hand.find(c => c.cardId === 'champ-ble').id");
    await click(`[data-hand-card="${crop}"]`); await click("[data-cancel-card]");
    assert.equal(await evaluate("testState.players.red.cards.hand.length"), 4);
    await click(`[data-hand-card="${crop}"]`);
    assert.ok(await evaluate("document.querySelectorAll('.card-target-allowed').length > 0"));
    await click("[data-confirm-card]");
    assert.equal(await evaluate("testState.players.red.villages[0].slots[0].content.type"), "ble");
    assert.equal(await evaluate("testState.players.red.cards.hand.length"), 3);
    await evaluate("testState.preparationRemaining = 0; testState.elapsed = 30; Eredita.CardGame.update(testState,30); testState.preparationRemaining = 3600; Eredita.UI.renderFrame(testState)");
    assert.equal(await evaluate("testState.players.red.cards.hand.length"), 4);
    const myth = await evaluate("testState.players.red.cards.mythological[0].id");
    await evaluate("testState.elapsed = 300; Eredita.UI.renderFrame(testState)");
    await click(`[data-hand-card="${myth}"]`); await click("[data-confirm-card]");
    assert.equal(await evaluate("testState.players.red.cards.mythological[0].used"), true);
    assert.notEqual(await evaluate("document.querySelector('[data-map-village][data-player=blue] [data-map-population]').textContent"), "?");
    await evaluate("testState.elapsed = 420; Eredita.UI.renderFrame(testState)");
    assert.equal(await evaluate("document.querySelector('[data-map-village][data-player=blue] [data-map-population]').textContent"), "?");
    await waitFor("[...document.querySelectorAll('#card-hand img')].every(i => i.complete && i.naturalWidth > 0)");
    await screenshot("main.png", "#card-hand");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate("Eredita.UI.render(testState)");
    const overflow = await evaluate("document.documentElement.scrollWidth - window.innerWidth");
    assert.ok(overflow <= 2, `Mobile overflow: ${overflow}`);
    await screenshot("mobile.png", "#card-hand");
    assert.deepEqual(browser.exceptions, []);
    assert.deepEqual(browser.imageErrors, []);
    console.log("Cartes navigateur : 39 illustrations, deck personnalisé, main, jeu/annulation, coût, cibles, pioche, Mythologiques, brouillard et mobile validés.");
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
