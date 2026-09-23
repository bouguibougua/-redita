"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = global;
const root = path.resolve(__dirname, "..");
["config", "biomes", "crops", "livestock", "units", "buildings", "transport", "economy", "board"]
  .forEach((file) => vm.runInThisContext(fs.readFileSync(path.join(root, "js", `${file}.js`), "utf8"), { filename: file }));
const E = global.Eredita;

function scenario(biome = "montagne") {
  const state = E.Board.createState();
  state.phase = "running";
  state.players.red.gold = 1000;
  const village = state.players.red.villages[0];
  village.biome = biome;
  village.slots = E.Biomes.createSlots(biome);
  assert.equal(E.Buildings.buildT1(state, "red", 0, "bergerie"), true);
  return { state, village };
}

function withRandom(value, action) {
  const previous = Math.random;
  Math.random = () => value;
  try { return action(); } finally { Math.random = previous; }
}

function rejectedWithoutMutation(state, playerId, lane, type) {
  const before = JSON.stringify(state);
  assert.equal(E.Livestock.buy(state, playerId, lane, type), false);
  assert.equal(JSON.stringify(state), before);
}

// Un achat crée exactement un animal dans un emplacement compatible tiré au sort.
for (const type of ["chevre", "cochon", "vache"]) {
  const { state, village } = scenario();
  assert.equal(E.Crops.place(state, "red", 0, 0, "chataignier"), true);
  const crop = JSON.stringify(village.slots[0]);
  const neighboringVillages = JSON.stringify(state.players.red.villages.slice(1));
  const opponent = JSON.stringify(state.players.blue);
  const initialGold = state.players.red.gold;
  const quoteBefore = JSON.stringify(state);
  const quote = withRandom(0, () => E.Livestock.purchaseQuote(state, "red", 0, type));
  assert.equal(quote.allowed, true);
  assert.deepEqual(quote.slotIndices, [1, 2, 3]);
  assert.equal(JSON.stringify(state), quoteBefore, "Un devis ne modifie pas la partie");
  const bought = withRandom(0.99, () => E.Livestock.buy(state, "red", 0, type));
  assert.equal(bought.slotIndex, 3);
  assert.equal(state.players.red.gold, initialGold - E.Config.livestock[type].purchaseGold);
  assert.equal(village.slots[3].content.count, 1);
  assert.equal(village.slots[3].content.hp, E.Config.livestock[type].hpPerAnimal);
  assert.equal(JSON.stringify(village.slots[0]), crop);
  assert.equal(JSON.stringify(state.players.red.villages.slice(1)), neighboringVillages);
  assert.equal(JSON.stringify(state.players.blue), opponent);
}

// Les troupeaux existants de même espèce ont priorité, sans guérison gratuite.
{
  const { state, village } = scenario();
  E.Livestock.place(state, "red", 0, 0, "chevre");
  E.Livestock.place(state, "red", 0, 1, "cochon");
  E.Livestock.place(state, "red", 0, 2, "chevre");
  const woundedHerd = village.slots[2].content;
  woundedHerd.hp -= 9;
  woundedHerd.reproductionProgress = 31;
  const pig = JSON.stringify(village.slots[1]);
  assert.deepEqual(E.Livestock.purchaseQuote(state, "red", 0, "chevre").slotIndices, [0, 2]);
  assert.equal(withRandom(0.99, () => E.Livestock.buy(state, "red", 0, "chevre")).slotIndex, 2);
  assert.equal(woundedHerd.count, 2);
  assert.equal(woundedHerd.hp, 41);
  assert.equal(woundedHerd.maxHp - woundedHerd.hp, 9);
  assert.equal(woundedHerd.reproductionProgress, 31);
  assert.equal(village.slots[0].content.count, 1);
  assert.equal(village.slots[3].content, null);
  assert.equal(JSON.stringify(village.slots[1]), pig);
  assert.equal(withRandom(0, () => E.Livestock.buy(state, "red", 0, "chevre")).slotIndex, 0);
}

// Aucun achat ni débit en pause, sans bâtiment local, sans or ou sans place.
for (const alter of [
  (state) => { state.phase = "setup"; },
  (state) => { state.paused = true; },
  (state, village) => { village.destroyed = true; },
  (state, village) => { village.buildings = []; },
  (state, village) => { village.buildings[0].level = 0; },
  (state) => { state.players.red.gold = E.Config.livestock.chevre.purchaseGold - 1; },
  (state, village) => {
    village.slots.forEach((slot) => { slot.content = { category: "livestock", type: "cochon", count: 1, hp: 20, maxHp: 20 }; });
  },
  (state, village) => { village.slots.forEach((slot) => { slot.type = "water"; }); }
]) {
  const { state, village } = scenario();
  alter(state, village);
  assert.equal(E.Livestock.purchaseQuote(state, "red", 0, "chevre").allowed, false);
  rejectedWithoutMutation(state, "red", 0, "chevre");
}

{
  const { state } = scenario("littoral");
  // Une Bergerie d'une autre région ne débloque pas celle de ce village.
  rejectedWithoutMutation(state, "red", 1, "chevre");
  rejectedWithoutMutation(state, "blue", 0, "chevre");
  rejectedWithoutMutation(state, "red", 0, "sanglier");
  rejectedWithoutMutation(state, "red", 0, "__proto__");
  rejectedWithoutMutation(state, "unknown", 0, "chevre");
  rejectedWithoutMutation(state, "red", 20, "chevre");
  state.players.red.gold = E.Config.livestock.chevre.purchaseGold;
  assert.equal(E.Livestock.buy(state, "red", 0, "chevre").quantity, 1);
  assert.equal(state.players.red.gold, 0);
  rejectedWithoutMutation(state, "red", 0, "chevre");
}

console.log("Livestock shop tests passed.");
