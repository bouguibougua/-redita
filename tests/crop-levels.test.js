"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
global.window = global;
for (const file of ["config", "biomes", "crops", "livestock", "units", "buildings", "transport", "equipment", "animals", "economy", "board", "combat"]) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, "../js", file + ".js"), "utf8"), { filename: file });
}
const E = Eredita;
function scenario(biome = "plaine") {
  const state = E.Board.createState("classic"), village = state.players.red.villages[0];
  state.phase = "running"; state.preparationRemaining = 60;
  village.biome = biome; village.slots = E.Biomes.createSlots(biome);
  return { state, village, player: state.players.red };
}
function unchanged(state, action) { const before = JSON.stringify(state); assert.equal(action(), false); assert.equal(JSON.stringify(state), before); }
for (const type of ["ble", "chataignier", "vignoble"]) {
  const { state, village, player } = scenario(type === "vignoble" ? "montagne" : "plaine");
  const gold = player.gold;
  assert.equal(E.Crops.place(state, "red", 0, 0, type), true);
  const crop = village.slots[0].content;
  assert.equal(player.gold, gold - 75); assert.equal(crop.level, 1); assert.equal(crop.investedGold, 75);
  assert.equal(E.Crops.yieldOf(crop), 1);
  crop.hp = 123;
  for (const [level, price, total] of [[2, 150, 225], [3, 300, 525]]) {
    assert.equal(E.Crops.upgradeQuote(state, "red", 0, 0).gold, price);
    assert.equal(E.Crops.upgrade(state, "red", 0, 0), true);
    assert.equal(crop.level, level); assert.equal(E.Crops.yieldOf(crop), level);
    assert.equal(crop.hp, 123); assert.equal(crop.maxHp, 200, "L'amélioration ne soigne pas et ne multiplie pas les PV");
    assert.equal(crop.investedGold, total); assert.equal(player.gold, gold - total);
  }
  unchanged(state, () => E.Crops.upgrade(state, "red", 0, 0));
  assert.equal(E.Crops.remove(state, "red", 0, 0).refund, 525);
  assert.equal(player.gold, gold); assert.equal(village.slots[0].content, null);
  unchanged(state, () => E.Crops.remove(state, "red", 0, 0));
}

// Argent insuffisant, slots invalides, pause et borne exacte de préparation.
{
  const { state, village, player } = scenario();
  player.gold = 74; unchanged(state, () => E.Crops.place(state, "red", 0, 0, "ble"));
  player.gold = 75; assert.equal(E.Crops.place(state, "red", 0, 0, "ble"), true); assert.equal(player.gold, 0);
  for (const index of [-1, 8, "0", 0.5]) unchanged(state, () => E.Crops.upgrade(state, "red", 0, index));
  for (const lane of [-1, 999, "__proto__"]) unchanged(state, () => E.Crops.upgrade(state, "red", lane, 0));
  unchanged(state, () => E.Crops.remove(state, "__proto__", 0, 0));
  player.gold = 149; unchanged(state, () => E.Crops.upgrade(state, "red", 0, 0));
  player.gold = 150; state.paused = true;
  unchanged(state, () => E.Crops.upgrade(state, "red", 0, 0)); unchanged(state, () => E.Crops.remove(state, "red", 0, 0));
  state.paused = false; state.preparationRemaining = 0;
  unchanged(state, () => E.Crops.remove(state, "red", 0, 0));
  assert.equal(E.Crops.upgrade(state, "red", 0, 0), true, "Amélioration encore disponible après préparation");
  assert.equal(village.slots[0].content.level, 2);
}

// Le remplacement existant coûte aussi 75 or et recommence au niveau 1.
{
  const { state, village, player } = scenario("montagne");
  E.Crops.place(state, "red", 0, 0, "chataignier"); E.Crops.upgrade(state, "red", 0, 0);
  const gold = player.gold;
  assert.equal(E.Crops.place(state, "red", 0, 0, "vignoble"), true);
  assert.equal(player.gold, gold - 75); assert.equal(village.slots[0].content.level, 1);
  assert.equal(E.Crops.removalQuote(state, "red", 0, 0).refund, 75);
}

// Un N3 et un N1 rapportent quatre unités, sans compter une autre culture ou un autre village.
{
  const { state, village } = scenario(); state.preparationRemaining = 0;
  E.Crops.place(state, "red", 0, 0, "ble"); E.Crops.upgrade(state, "red", 0, 0); E.Crops.upgrade(state, "red", 0, 0);
  E.Crops.place(state, "red", 0, 1, "ble"); E.Crops.place(state, "red", 0, 2, "chataignier"); E.Crops.upgrade(state, "red", 0, 2);
  const remote = state.players.red.villages[1]; remote.biome = "plaine"; remote.slots = E.Biomes.createSlots("plaine");
  E.Crops.place(state, "red", 1, 0, "ble"); E.Crops.upgrade(state, "red", 1, 0);
  assert.equal(E.Economy.cropCount(village, "ble"), 2); assert.equal(E.Economy.cropYield(village, "ble"), 4);
  const worker = village.residents[0]; E.Economy.assignResidentJob(state, "red", 0, worker.id, "agriculture");
  function until(test) { for (let i = 0; i < 2000 && !test(); i++) E.Economy.updateProduction(state, .1); assert.ok(test()); }
  until(() => worker.workPhase === "toVillage"); assert.deepEqual(worker.carrying, { resource: "ble", amount: 4 });
  E.Crops.upgrade(state, "red", 0, 1);
  assert.equal(worker.carrying.amount, 4, "La cargaison déjà chargée reste fixe");
  until(() => worker.workPhase === "villageStop"); assert.equal(village.resources.ble, 4);
  until(() => worker.workPhase === "toVillage"); assert.equal(worker.carrying.amount, 5);
  village.slots[0].content.hp = 0; assert.equal(E.Economy.cropYield(village, "ble"), 2);
}

// Retrait d'un élevage sans viande pendant la préparation ; abattage toujours disponible ensuite.
for (const type of ["chevre", "cochon", "vache"]) {
  const { state, village, player } = scenario("montagne"); const gold = player.gold, meat = village.resources.viande;
  E.Livestock.place(state, "red", 0, 2, type);
  assert.equal(E.Livestock.remove(state, "red", 0, 2).refund, 0);
  assert.equal(village.slots[2].content, null); assert.equal(player.gold, gold); assert.equal(village.resources.viande, meat);
  E.Livestock.place(state, "red", 0, 2, type); state.preparationRemaining = 0;
  unchanged(state, () => E.Livestock.remove(state, "red", 0, 2));
  assert.ok(E.Livestock.slaughter(state, "red", 0, 2, 1)); assert.equal(village.slots[2].content, null);
  assert.equal(village.resources.viande, meat + E.Config.livestock[type].meatAtDeath);
}
console.log("Cultures : coûts 75/150/300, niveaux et récoltes cumulées, remboursement intégral, préparation et élevages validés.");
