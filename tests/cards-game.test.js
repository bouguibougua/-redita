"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
global.window = global;
for (const name of ["config", "biomes", "crops", "livestock", "equipment", "units", "buildings", "transport", "animals", "economy", "board", "combat", "cards", "card-effects", "card-game", "ai"]) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js", `${name}.js`), "utf8"), { filename: name });
}
const E = global.Eredita;

function scenario() {
  const state = E.Board.createState("classic"); state.phase = "running";
  for (const player of Object.values(state.players)) {
    player.gold = 50000;
    player.villages.forEach(v => { v.biome = "plaine"; v.slots = E.Biomes.createSlots("plaine"); });
  }
  E.CardGame.start(state, () => 0.5);
  return state;
}

function give(state, id, ownerId = "red", myth = false) {
  const card = { id: `test-${id}`, cardId: id };
  if (myth) state.players[ownerId].cards.mythological = [{ ...card, unlockAt: 0, used: false }];
  else state.players[ownerId].cards.hand = [card];
  return card.id;
}

function readyVillage(state, lane = 0) {
  const v = state.players.red.villages[lane];
  v.buildings = E.Config.building.types.map(type => ({ type, level: 3, hpBonus: 225 }));
  v.level = 3; v.populationMax = E.Config.village.T3.populationMax;
  v.maxHp = v.hp = E.Config.village.T3.hp + v.buildings.reduce((sum, b) => sum + b.hpBonus, 0);
  E.Config.resources.forEach(resource => { v.resources[resource] = 1000; });
  return v;
}

test("all 39 cards have a unique optimized illustration and valid starter decks", () => {
  assert.equal(E.Cards.all.length, 39);
  assert.equal(new Set(E.Cards.all.map(card => card.image)).size, 39);
  for (const card of E.Cards.all) {
    const bytes = fs.readFileSync(path.join(__dirname, "..", card.image));
    assert.equal(bytes.subarray(0, 4).toString(), "RIFF", card.id);
    assert.equal(bytes.subarray(8, 12).toString(), "WEBP", card.id);
    assert.ok(bytes.length < 250000, `${card.id}: small enough for the collection and XR`);
  }
  for (const deck of E.Config.cardGame.starterDecks) {
    assert.equal(E.CardGame.validateDeck(deck), true);
    assert.equal(Object.values(deck.quantities).reduce((a, b) => a + b, 0), 30);
    assert.equal(deck.mythological.length, 3);
  }
  assert.equal(E.CardGame.validateDeck({ quantities: { habitant: 5 }, mythological: [] }), false);
  assert.equal(E.CardGame.validateDeck({ quantities: { unknown: 1 }, mythological: [] }), false);
});

test("the initial hand, finite draw pile, pause, preparation, full-hand wait and Overtime boundary follow the rules", () => {
  const state = scenario(), cards = state.players.red.cards;
  assert.equal(cards.hand.length, 5); assert.equal(cards.drawPile.length, 25);
  assert.equal(cards.mythological.length, 2);
  assert.deepEqual(cards.mythological.map(card => card.unlockAt), [300, 600]);
  state.paused = true; E.CardGame.update(state, 30); assert.equal(cards.hand.length, 5);
  state.paused = false; state.preparationRemaining = 60; E.CardGame.update(state, 30); assert.equal(cards.hand.length, 5);
  state.preparationRemaining = 0; state.elapsed = 300; E.CardGame.update(state, 300);
  assert.equal(cards.hand.length, 15); assert.equal(cards.drawPile.length, 15);
  state.elapsed = 330; E.CardGame.update(state, 30);
  assert.equal(cards.drawTimer, 30); assert.equal(cards.drawPile.length, 15);
  const v = readyVillage(state); v.buildings = [];
  cards.hand[0].cardId = "artisanat";
  assert.ok(E.CardGame.play(state, "red", cards.hand[0].id, { lane: 0 }));
  assert.equal(cards.hand.length, 15); assert.equal(cards.drawPile.length, 14); assert.equal(cards.drawTimer, 0);
  state.elapsed = 750; cards.hand.length = 0; E.CardGame.update(state, 30); assert.equal(cards.hand.length, 0);
  assert.equal(E.CardGame.start(state), false, "Initialization cannot duplicate a hand");
});

test("every normal card can resolve, charges exactly once, and is consumed only after success", () => {
  for (const card of E.Cards.normal) {
    const state = scenario(), v = readyVillage(state);
    if (E.Config.building.types.includes(card.id)) v.buildings = [];
    if (["voilier", "filet-peche"].includes(card.id)) { v.biome = "littoral"; v.slots = E.Biomes.createSlots("littoral"); }
    if (["sentier", "vignoble"].includes(card.id)) { v.biome = "montagne"; v.slots = E.Biomes.createSlots("montagne"); }
    if (card.id === "moulin") v.terrain = { river: { type: "riviere" } };
    const instance = give(state, card.id);
    const targets = E.CardGame.targets(state, "red", instance).filter(target => target.lane === 0);
    assert.ok(targets.length, `${card.id}: a compatible target exists`);
    const gold = state.players.red.gold;
    assert.ok(E.CardGame.play(state, "red", instance, targets[0]), card.id);
    assert.equal(state.players.red.gold, gold - E.CardEffects.cost(card.id), `${card.id}: charged once`);
    assert.equal(E.CardGame.find(state, "red", instance), null, `${card.id}: consumed`);
    const after = JSON.stringify(state);
    assert.equal(E.CardGame.play(state, "red", instance, targets[0]), false);
    assert.equal(JSON.stringify(state), after, `${card.id}: replay cannot duplicate its effect`);
  }
});

test("bad targets, enemy residents, insufficient gold and pause cannot consume cards or mutate the match", () => {
  const state = scenario(); readyVillage(state);
  const instance = give(state, "outil-fer");
  for (const target of [null, [], { lane: 0, playerId: "blue" }, { lane: 999 }, { lane: 0, residentId: state.players.blue.villages[0].residents[0].id }]) {
    const before = JSON.stringify(state);
    assert.equal(E.CardGame.play(state, "red", instance, target), false);
    assert.equal(JSON.stringify(state), before);
  }
  const target = { lane: 0, residentId: state.players.red.villages[0].residents[0].id };
  state.players.red.gold = 0; assert.equal(E.CardGame.play(state, "red", instance, target), false);
  state.players.red.gold = 5000; state.paused = true; assert.equal(E.CardGame.play(state, "red", instance, target), false);
  assert.ok(E.CardGame.find(state, "red", instance));
});

test("river fishing and mill farming change production without adding biome slots", () => {
  const state = scenario(), v = state.players.red.villages[0];
  assert.ok(E.CardGame.play(state, "red", give(state, "riviere"), { lane: 0 }));
  assert.equal(v.slots.length, 4);
  assert.equal(E.Economy.assignResidentJob(state, "red", 0, v.residents[0].id, "peche"), true);
  E.Economy.updateProduction(state, 30); assert.equal(v.resources.poisson, 1);
  assert.ok(E.CardGame.play(state, "red", give(state, "moulin"), { lane: 0 }));
  E.Crops.place(state, "red", 0, 0, "ble");
  const farmer = v.residents[1]; E.Economy.assignResidentJob(state, "red", 0, farmer.id, "agriculture");
  farmer.workPhase = "harvesting"; farmer.targetSlotIndex = 0;
  E.Economy.updateProduction(state, 10); assert.equal(farmer.carrying.amount, 1.3);
});

test("traps inflict 50 damage and slow movement for three seconds, while the trail speeds mountain movement", () => {
  const state = scenario(), v = state.players.red.villages[0];
  assert.ok(E.CardGame.play(state, "red", give(state, "piege"), { lane: 0 }));
  const enemy = E.Units.create("blue", 0, "guerrier"); enemy.position = E.Config.combat.defensePositionByOwner.red;
  state.units.push(enemy); E.CardEffects.update(state);
  assert.equal(enemy.hp, 20); assert.equal(v.terrain.traps.length, 0);
  assert.equal(E.CardEffects.movementMultiplier(state, enemy), 0.5);
  state.elapsed = 3; assert.equal(E.CardEffects.movementMultiplier(state, enemy), 1);
  v.biome = "montagne";
  assert.ok(E.CardGame.play(state, "red", give(state, "sentier"), { lane: 0 }));
  assert.equal(E.CardEffects.movementMultiplier(state, E.Units.create("red", 0, "habitant")), 1.2);
});

test("carts preserve their passengers and human population when destroyed, and disembark before water", () => {
  for (const water of [false, true]) {
    const state = scenario(), v = state.players.red.villages[0];
    const ids = v.residents.slice(0, 2).map(person => person.id);
    assert.ok(E.CardGame.play(state, "red", give(state, "charrette"), { lane: 0, residentIds: ids }));
    const cart = state.units.find(unit => unit.isCart), population = v.population;
    assert.equal(cart.passengers.length, 2); assert.equal(cart.hp, 150);
    if (water) {
      state.players.blue.villages[0].biome = "littoral";
      cart.position = E.Config.maritime.waterRanges.blue.min - 0.05;
      E.Combat.update(state, 0.1);
    } else { cart.hp = 0; E.Combat.settleDeaths(state); }
    assert.equal(state.units.length, 2); assert.equal(v.population, population);
    assert.ok(state.units.every(unit => ids.includes(unit.residentId) && unit.hp > 0));
  }
});

test("all five Mythological cards resolve once, enforce unlock time, and apply their documented effects", () => {
  for (const card of E.Cards.mythological) {
    const state = scenario(), v = readyVillage(state);
    state.elapsed = 600;
    if (card.id === "oeil-sainte-lucie") v.biome = "littoral";
    if (card.id === "u-diavulu") v.biome = "montagne";
    if (card.id === "squadra-arozza") E.Economy.removeResident(state, "red", 0, v.residents[0].id);
    const instance = give(state, card.id, "red", true), target = { lane: 0, targetLane: 1 };
    assert.ok(E.CardGame.play(state, "red", instance, target), card.id);
    assert.equal(state.players.red.cards.mythological[0].used, true);
    assert.equal(E.CardGame.play(state, "red", instance, target), false);
    if (card.id === "u-mazzeru") assert.equal(state.players.red.revealPeopleUntil, 720);
    if (card.id === "a-stregha") assert.equal(state.players.blue.villages[1].curseUntil, 720);
    if (card.id === "oeil-sainte-lucie") assert.equal(state.players.red.revealCoasts, true);
    if (card.id === "u-diavulu") {
      assert.equal(state.players.red.villages[1].population, 0);
      assert.equal(state.players.blue.villages[1].population, 0);
      assert.equal(state.players.blue.villages[1].hp, 75);
      assert.equal(E.Buildings.buildT1(state, "red", 1, "artisanat"), false);
      assert.equal(E.Crops.place(state, "red", 1, 0, "ble"), false);
      state.elapsed = 720; assert.equal(E.Crops.place(state, "red", 1, 0, "ble"), true);
    }
    if (card.id === "squadra-arozza") assert.equal(v.population, 5);
  }
  const state = scenario(), held = state.players.red.cards.mythological[0];
  assert.equal(E.CardGame.play(state, "red", held.id, { lane: 0 }), false);
});

test("curse halves fishing yield, survey reveals people temporarily and towers/coastal eye reveal their regions", () => {
  const state = scenario(), v = state.players.blue.villages[0];
  v.terrain = { river: { type: "riviere" } }; v.curseUntil = 120;
  E.Economy.assignResidentJob(state, "blue", 0, v.residents[0].id, "peche");
  E.Economy.updateProduction(state, 30); assert.equal(v.resources.poisson, 0.5);
  state.elapsed = 120; E.Economy.updateProduction(state, 30); assert.equal(v.resources.poisson, 1.5);
  assert.equal(E.CardEffects.vision(state, "red", v).fraction, 0);
  state.players.red.revealPeopleUntil = 240;
  assert.equal(E.CardEffects.vision(state, "red", v).people, true);
  state.elapsed = 240; assert.equal(E.CardEffects.vision(state, "red", v).people, false);
  state.players.red.villages[0].terrain = { tower: { hp: 300 } };
  assert.equal(E.CardEffects.vision(state, "red", v).fraction, 0.25);
  state.players.red.villages[0].biome = "littoral";
  assert.equal(E.CardEffects.vision(state, "red", v).fraction, 0.5);
  v.biome = "littoral"; state.players.red.revealCoasts = true;
  assert.equal(E.CardEffects.vision(state, "red", v).all, true);
});

test("resurrection moves a lost village's residents to the nearest living village, waits at capacity and cannot duplicate them", () => {
  const state = scenario(), v = state.players.red.villages[1];
  const person = v.residents[0]; person.profession = "guerrier";
  E.Economy.removeResident(state, "red", 1, person.id);
  v.destroyed = true;
  const nearest = state.players.red.villages[0]; nearest.populationMax = nearest.population;
  assert.ok(E.CardGame.play(state, "red", give(state, "squadra-arozza", "red", true), { lane: 2 }));
  assert.equal(state.pendingResurrections.length, 1);
  nearest.populationMax++; E.CardEffects.update(state);
  assert.equal(state.pendingResurrections.length, 0);
  assert.equal(nearest.residents.at(-1).profession, "guerrier");
  assert.notEqual(nearest.residents.at(-1).id, person.id);
  const population = nearest.population; E.CardEffects.update(state); assert.equal(nearest.population, population);
});

test("Artisanat grants each allied human +2 damage and +5 HP, without stacking or healing on repeated updates", () => {
  const state = scenario(), v = state.players.red.villages[0];
  E.Economy.deployResident(state, "red", 0, v.residents[0].id, "attaque");
  const unit = state.units[0];
  assert.equal(unit.damage, 5); assert.equal(unit.maxHp, 50);
  assert.ok(E.CardGame.play(state, "red", give(state, "artisanat"), { lane: 0 }));
  assert.equal(unit.damage, 7); assert.equal(unit.maxHp, 55); assert.equal(unit.hp, 55);
  unit.hp -= 10;
  E.Buildings.buildT1(state, "red", 0, "artisanat");
  E.CardEffects.updateArtisanatBonuses(state);
  assert.equal(unit.damage, 7); assert.equal(unit.maxHp, 55); assert.equal(unit.hp, 45);
  unit.lane = unit.lanePosition = 1;
  E.CardEffects.updateArtisanatBonuses(state);
  assert.equal(unit.damage, 5); assert.equal(unit.maxHp, 50); assert.equal(unit.hp, 40);
  unit.lane = unit.lanePosition = 0;
  E.CardEffects.updateArtisanatBonuses(state);
  assert.equal(unit.hp, 45, "Re-entering the column keeps the ten damage already suffered");
  const dog = E.Units.create("red", 0, "chien"), enemy = E.Units.create("blue", 0, "habitant");
  state.units.push(dog, enemy); E.CardEffects.updateArtisanatBonuses(state);
  assert.equal(dog.damage, 7); assert.equal(dog.maxHp, 40);
  assert.equal(enemy.damage, 5); assert.equal(enemy.maxHp, 50);
  const snapshot = JSON.parse(JSON.stringify(state));
  E.CardEffects.updateArtisanatBonuses(snapshot); assert.equal(snapshot.units[0].hp, 45);
});
