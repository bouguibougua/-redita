"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const context = vm.createContext({ console, Math });
context.window = context;
for (const file of ["config", "biomes", "crops", "livestock", "equipment", "units", "buildings", "transport", "economy", "animals", "board", "combat"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", `${file}.js`), "utf8"), context, { filename: `${file}.js` });
}
const E = context.Eredita;

function scenario(tier = 3) {
  const state = E.Board.createState();
  state.phase = "running";
  for (const player of Object.values(state.players)) {
    player.gold = 10000;
    for (const village of player.villages) {
      village.biome = "plaine";
      village.slots = E.Biomes.createSlots("plaine");
    }
    assert.equal(E.Buildings.buildT1(state, player.id, 0, "bergerie"), true);
    player.villages[0].buildings[0].level = tier;
  }
  return { state, village: state.players.red.villages[0], enemy: state.players.blue.villages[0] };
}

function buyAnimal(state, type = "chien", playerId = "red", lane = 0) {
  assert.ok(E.Animals.buy(state, playerId, lane, type), `Purchase ${type}`);
  return state.players[playerId].villages[lane].animals.at(-1);
}

function deploy(state, type = "chien", mission = "attaque", slotIndex, playerId = "red") {
  const animal = buyAnimal(state, type, playerId);
  const unit = E.Animals.deploy(state, playerId, 0, animal.id, mission, slotIndex);
  assert.ok(unit, `Deploy ${type}: ${mission}`);
  return { animal, unit };
}

function herd(state, ownerId = "blue", type = "chevre", slotIndex = 0) {
  assert.equal(E.Livestock.place(state, ownerId, 0, slotIndex, type), true);
  return state.players[ownerId].villages[0].slots[slotIndex].content;
}

function rejectedWithoutMutation(state, action) {
  const before = JSON.stringify(state);
  assert.equal(action(), false);
  assert.equal(JSON.stringify(state), before, "Rejected action must leave the entire state unchanged");
}

function population(state) {
  return JSON.stringify(Object.values(state.players).map((player) => player.villages.map((village) => ({
    count: village.population, residents: village.residents.map((resident) => resident.id)
  }))));
}

function near(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: expected ${expected}, received ${actual}`);
}

test("GDD animal stats and unlock tiers stay centralized", () => {
  assert.equal(E.Config.specialAnimals.ane.requiredTier, 2);
  assert.equal(E.Config.specialAnimals.chien.requiredTier, 3);
  assert.equal(E.Config.specialAnimals.chien.hp, 40);
  assert.equal(E.Config.specialAnimals.chien.damage, 7);
  assert.equal(E.Config.specialAnimals.sanglier.requiredTier, 3);
  assert.equal(E.Config.specialAnimals.sanglier.hp, 80);
  assert.equal(E.Config.specialAnimals.sanglier.damage, 8);
  assert.equal(E.Config.specialAnimals.sanglier.meatAtDeath, 8);
  assert.equal(E.Config.specialAnimals.sanglier.waterSpeedMultiplier, 0.5);
});

test("local Bergerie tiers gate purchases; quotes have no side effects", () => {
  const { state, village } = scenario(1);
  const resident = village.residents[0];
  for (const type of ["ane", "chien", "sanglier"]) {
    const before = JSON.stringify(state);
    assert.equal(E.Animals.purchaseQuote(state, "red", 0, type, resident.id).allowed, false);
    assert.equal(JSON.stringify(state), before);
    rejectedWithoutMutation(state, () => E.Animals.buy(state, "red", 0, type, resident.id));
  }
  village.buildings[0].level = 2;
  assert.equal(E.Animals.purchaseQuote(state, "red", 0, "ane", resident.id).allowed, true);
  assert.equal(E.Animals.purchaseQuote(state, "red", 0, "chien").allowed, false);
  assert.equal(E.Animals.purchaseQuote(state, "red", 0, "sanglier").allowed, false);
  village.buildings[0].level = 3;
  for (const type of ["chien", "sanglier"]) {
    const before = JSON.stringify(state);
    assert.equal(E.Animals.purchaseQuote(state, "red", 0, type).allowed, true);
    assert.equal(JSON.stringify(state), before);
    rejectedWithoutMutation(state, () => E.Animals.buy(state, "red", 1, type));
  }
});

test("purchases debit exact gold, create unique companions, and do not use humans or enclosures", () => {
  const { state, village } = scenario();
  village.slots.forEach((slot) => { slot.content = { category: "crop", type: "ble", hp: 200, maxHp: 200 }; });
  const slotsBefore = JSON.stringify(village.slots);
  const humansBefore = population(state);
  const ids = new Set();
  for (const ownerId of ["red", "blue"]) {
    for (const type of ["chien", "sanglier", "chien"]) {
      const goldBefore = state.players[ownerId].gold;
      const animal = buyAnimal(state, type, ownerId);
      assert.equal(animal.type, type);
      assert.equal(animal.mission, "disponible");
      assert.equal(animal.unitId, null);
      assert.ok(animal.id);
      assert.equal(ids.has(animal.id), false, "Animal IDs must be unique across players");
      ids.add(animal.id);
      assert.equal(state.players[ownerId].gold, goldBefore - E.Config.specialAnimals[type].gold);
    }
  }
  assert.equal(state.units.length, 0);
  assert.equal(population(state), humansBefore);
  assert.equal(JSON.stringify(village.slots), slotsBefore);
});

test("bad IDs, unknown types, phases, paused games, lost villages and insufficient gold cannot buy", () => {
  for (const alter of [
    (state) => { state.phase = "setup"; },
    (state) => { state.phase = "ended"; },
    (state) => { state.paused = true; },
    (state, village) => { village.destroyed = true; },
    (state, village) => { village.buildings = []; },
    (state) => { state.players.red.gold = E.Config.specialAnimals.chien.gold - 1; }
  ]) {
    const { state, village } = scenario();
    alter(state, village);
    assert.equal(E.Animals.purchaseQuote(state, "red", 0, "chien").allowed, false);
    rejectedWithoutMutation(state, () => E.Animals.buy(state, "red", 0, "chien"));
  }
  const { state } = scenario();
  for (const [playerId, lane, type] of [
    ["unknown", 0, "chien"], ["__proto__", 0, "chien"], ["red", 99, "chien"],
    ["red", -1, "chien"], ["red", 0.5, "chien"], ["red", 0, "chevre"],
    ["red", 0, "__proto__"], ["red", 0, "constructor"]
  ]) rejectedWithoutMutation(state, () => E.Animals.buy(state, playerId, lane, type));
  state.players.red.gold = E.Config.specialAnimals.chien.gold;
  buyAnimal(state);
  assert.equal(state.players.red.gold, 0);
  rejectedWithoutMutation(state, () => E.Animals.buy(state, "red", 0, "chien"));
});

test("the donkey belongs to one eligible local resident and has no standalone military unit", () => {
  const { state, village, enemy } = scenario(2);
  const resident = village.residents[0];
  const humansBefore = population(state);
  const slotsBefore = JSON.stringify(village.slots);
  const goldBefore = state.players.red.gold;
  rejectedWithoutMutation(state, () => E.Animals.buy(state, "red", 0, "ane", enemy.residents[0].id));
  rejectedWithoutMutation(state, () => E.Animals.buy(state, "red", 0, "ane", "missing"));
  assert.ok(E.Animals.buy(state, "red", 0, "ane", resident.id));
  assert.equal(resident.donkey, true);
  assert.equal(state.players.red.gold, goldBefore - E.Config.specialAnimals.ane.gold);
  assert.equal(state.units.length, 0);
  assert.equal(population(state), humansBefore);
  assert.equal(JSON.stringify(village.slots), slotsBefore);
  rejectedWithoutMutation(state, () => E.Animals.buy(state, "red", 0, "ane", resident.id));
  const soldier = village.residents[1];
  assert.equal(E.Economy.deployResident(state, "red", 0, soldier.id, "attaque"), true);
  rejectedWithoutMutation(state, () => E.Animals.buy(state, "red", 0, "ane", soldier.id));
});

test("all dog missions and boar attack deploy independent units exactly once", () => {
  for (const [type, mission] of [["chien", "attaque"], ["chien", "defense"], ["chien", "garde"], ["chien", "perturber"], ["sanglier", "attaque"]]) {
    const { state, village, enemy } = scenario();
    herd(state, "red");
    herd(state, "blue");
    const animal = buyAnimal(state, type);
    const humansBefore = population(state);
    const beforeQuote = JSON.stringify(state);
    assert.equal(E.Animals.orderQuote(state, "red", 0, animal.id, mission, 0).allowed, true);
    assert.equal(JSON.stringify(state), beforeQuote);
    const unit = E.Animals.deploy(state, "red", 0, animal.id, mission, 0);
    assert.ok(unit);
    assert.equal(unit.role, type);
    assert.equal(unit.animalType, type);
    assert.equal(unit.animalId, animal.id);
    assert.equal(unit.originLane, 0);
    assert.equal(Boolean(unit.residentId), false);
    assert.equal(unit.hp, E.Config.specialAnimals[type].hp);
    assert.equal(unit.damage, E.Config.specialAnimals[type].damage);
    assert.equal(animal.unitId, unit.id);
    assert.equal(animal.mission, mission);
    assert.equal(state.units.length, 1);
    assert.equal(population(state), humansBefore);
    if (mission === "defense") assert.equal(unit.position, E.Config.combat.defensePositionByOwner.red);
    if (mission === "garde") {
      assert.equal(unit.position, E.Config.temporaryProduction.agricultureFieldPositionByOwner.red);
      assert.equal(unit.targetSlotIndex, 0);
      assert.equal(village.slots[0].content.type, "chevre");
    }
    if (mission === "perturber") {
      assert.equal(unit.targetSlotIndex, 0);
      assert.equal(unit.targetVillageId, enemy.id);
    }
    rejectedWithoutMutation(state, () => E.Animals.deploy(state, "red", 0, animal.id, mission, 0));
  }
});

test("mission validation rejects unavailable animals and incompatible targets without mutation", () => {
  const { state, village } = scenario();
  const dog = buyAnimal(state);
  const boar = buyAnimal(state, "sanglier");
  for (const [owner, lane, id, mission, slot] of [
    ["red", 0, "missing", "attaque"], ["blue", 0, dog.id, "attaque"],
    ["red", 1, dog.id, "attaque"], ["red", 0, dog.id, "unknown"],
    ["red", 0, boar.id, "defense"], ["red", 0, boar.id, "garde", 0],
    ["red", 0, boar.id, "perturber", 0], ["red", 0, dog.id, "garde", 0],
    ["red", 0, dog.id, "perturber", 0], ["red", 0, dog.id, "garde", -1],
    ["red", 0, dog.id, "perturber", 0.5]
  ]) rejectedWithoutMutation(state, () => E.Animals.deploy(state, owner, lane, id, mission, slot));
  for (const key of ["paused", "destroyed"]) {
    const object = key === "paused" ? state : village;
    object[key] = true;
    rejectedWithoutMutation(state, () => E.Animals.deploy(state, "red", 0, dog.id, "attaque"));
    object[key] = false;
  }
  state.phase = "setup";
  rejectedWithoutMutation(state, () => E.Animals.deploy(state, "red", 0, dog.id, "attaque"));
});

test("guard and frontier dogs hold position and strike for seven at the configured cadence", () => {
  for (const mission of ["garde", "defense"]) {
    const { state } = scenario();
    herd(state, "red");
    const { unit } = deploy(state, "chien", mission, 0);
    const enemy = E.Units.create("blue", 0, "habitant", { stance: "defense" });
    enemy.position = unit.position + 1;
    enemy.damage = 0;
    state.units.push(enemy);
    const position = unit.position;
    E.Combat.update(state, 0.1);
    assert.equal(enemy.hp, enemy.maxHp - 7);
    E.Combat.update(state, E.Config.specialAnimals.chien.attackInterval / 2);
    assert.equal(enemy.hp, enemy.maxHp - 7);
    E.Combat.update(state, E.Config.specialAnimals.chien.attackInterval / 2);
    assert.equal(enemy.hp, enemy.maxHp - 14);
    assert.equal(unit.position, position);
  }
});

test("boars prioritize enemy crops over nearby troops and destroy the crop at eight DPS", () => {
  const { state, enemy } = scenario();
  assert.equal(E.Crops.place(state, "blue", 0, 0, "ble"), true);
  assert.equal(E.Economy.assignResidentJob(state, "blue", 0, enemy.residents[0].id, "agriculture"), true);
  const { unit } = deploy(state, "sanglier");
  const soldier = E.Units.create("blue", 0, "habitant", { stance: "defense" });
  soldier.position = unit.position = 10;
  soldier.damage = 0;
  state.units.push(soldier);
  E.Combat.update(state, 0.1);
  assert.equal(soldier.hp, soldier.maxHp, "A boar with a crop ahead does not attack nearby troops");
  assert.ok(unit.position > 10, "The boar advances toward the crop");
  soldier.position = unit.position = E.Config.temporaryProduction.agricultureFieldPositionByOwner.blue;
  const crop = enemy.slots[0].content;
  const villageHp = enemy.hp;
  E.Combat.update(state, 0.25);
  near(crop.hp, crop.maxHp - 2, "Quarter-second crop damage");
  assert.equal(soldier.hp, soldier.maxHp);
  assert.equal(enemy.hp, villageHp);
  crop.hp = 2;
  E.Combat.update(state, 0.25);
  assert.equal(enemy.slots[0].content, null, "Destruction clears the slot");
  assert.equal(E.Crops.canPlace(state, "blue", 0, 0, "ble"), true);
  E.Combat.update(state, 0.25);
  near(soldier.hp, soldier.maxHp - 2, "Quarter-second damage after the crop is gone");
  E.Economy.updateProduction(state, 200);
  assert.equal(enemy.resources.ble, 0, "A destroyed field cannot produce another harvest");
});

test("boar village damage is continuous and its death credits only the origin village", () => {
  const { state, village, enemy } = scenario();
  const humansBefore = population(state);
  const { animal, unit } = deploy(state, "sanglier");
  unit.position = E.Config.movement.columnLength;
  const hpBefore = enemy.hp;
  E.Combat.update(state, 0.25);
  near(enemy.hp, hpBefore - 2, "Quarter-second village damage");
  unit.lane = unit.lanePosition = 1;
  unit.hp = E.Config.combat.villageRetaliationDamagePerSecond * 0.25;
  E.Combat.update(state, 0.25);
  assert.equal(unit.hp, 0, "Village retaliation kills the wounded boar");
  assert.equal(village.resources.viande, 8);
  assert.equal(state.players.red.villages[1].resources.viande, 0);
  assert.equal(enemy.resources.viande, 0);
  assert.equal(state.units.some((item) => item.id === unit.id), false);
  rejectedWithoutMutation(state, () => E.Animals.slaughter(state, "red", 0, animal.id));
  E.Combat.update(state, 0.1);
  E.Animals.onUnitDeath(state, unit);
  assert.equal(village.resources.viande, 8, "A corpse cannot pay out twice");
  assert.equal(population(state), humansBefore);
});

test("a harassment mission approaches its selected enclosure and stops within range", () => {
  const { state, enemy } = scenario();
  const content = herd(state);
  const { unit } = deploy(state, "chien", "perturber", 0);
  assert.equal(E.Animals.harassment(state, enemy, 0).stacks, 0);
  for (let tick = 0; tick < 200; tick += 1) E.Combat.update(state, 0.1);
  assert.ok(Math.abs(unit.position - E.Config.temporaryProduction.agricultureFieldPositionByOwner.blue) <= E.Config.combat.attackRange);
  const position = unit.position;
  E.Combat.update(state, 1);
  assert.equal(unit.position, position);
  assert.equal(E.Animals.harassment(state, enemy, 0).stacks, 1);
  assert.equal(content.hp, content.maxHp, "Harassment does not damage the herd");
  assert.equal(enemy.hp, enemy.maxHp);
});

test("harassment caps at four dogs per enclosure and multiplies reproduction without resetting progress", () => {
  for (const [type, penalty] of [["chevre", 0.28], ["cochon", 0.2], ["vache", 0.2]]) {
    const { state, enemy } = scenario();
    const target = herd(state, "blue", type);
    const other = herd(state, "blue", type, 1);
    target.reproductionProgress = other.reproductionProgress = 11;
    const dogs = Array.from({ length: 5 }, () => deploy(state, "chien", "perturber", 0).unit);
    for (const dog of dogs) dog.position = E.Config.temporaryProduction.agricultureFieldPositionByOwner.blue;
    const effect = E.Animals.harassment(state, enemy, 0);
    assert.equal(effect.stacks, 4);
    near(effect.penalty, penalty, `${type} capped penalty`);
    assert.equal(E.Animals.harassment(state, enemy, 1).stacks, 0);
    E.Economy.updateProduction(state, 10);
    near(target.reproductionProgress, 11 + 10 * (1 - penalty), "Existing cycle progress plus slowed production");
    assert.equal(other.reproductionProgress, 21);
    for (const dog of dogs) dog.hp = 0;
    assert.equal(E.Animals.harassment(state, enemy, 0).stacks, 0, "Dead dogs stop harassment immediately");
    E.Economy.updateProduction(state, 10);
    near(target.reproductionProgress, 21 + 10 * (1 - penalty), "Normal speed resumes without losing progress");
  }
});

test("harassment requires a live enemy dog in range on the target lane", () => {
  const { state, village, enemy } = scenario();
  herd(state, "blue");
  herd(state, "red");
  const { unit } = deploy(state, "chien", "perturber", 0);
  const field = E.Config.temporaryProduction.agricultureFieldPositionByOwner.blue;
  unit.position = field;
  assert.equal(E.Animals.harassment(state, enemy, 0).stacks, 1);
  near(E.Animals.harassment(state, enemy, 0).penalty, 0.07, "One dog's penalty on goats");
  assert.equal(E.Animals.harassment(state, village, 0).stacks, 0);
  unit.animalMission = "attaque";
  assert.equal(E.Animals.harassment(state, enemy, 0).stacks, 0, "Leaving the harassment mission clears its effect");
  unit.animalMission = "perturber";
  unit.position = field - E.Config.combat.attackRange - 0.01;
  assert.equal(E.Animals.harassment(state, enemy, 0).stacks, 0);
  unit.position = field;
  unit.lane = unit.lanePosition = 1;
  assert.equal(E.Animals.harassment(state, enemy, 0).stacks, 0);
  unit.lane = unit.lanePosition = 0;
  unit.hp = 0;
  assert.equal(E.Animals.harassment(state, enemy, 0).stacks, 0);
  const attacker = deploy(state).unit;
  attacker.position = field;
  attacker.targetVillageId = enemy.id;
  attacker.targetSlotIndex = 0;
  assert.equal(E.Animals.harassment(state, enemy, 0).stacks, 0, "Merely being nearby does not activate an attack dog's harassment");
});

test("slaughter pays eight meat once, only for an available local boar", () => {
  const { state, village } = scenario();
  const humansBefore = population(state);
  const dog = buyAnimal(state);
  const boar = buyAnimal(state, "sanglier");
  rejectedWithoutMutation(state, () => E.Animals.slaughter(state, "red", 0, dog.id));
  rejectedWithoutMutation(state, () => E.Animals.slaughter(state, "blue", 0, boar.id));
  state.paused = true;
  rejectedWithoutMutation(state, () => E.Animals.slaughter(state, "red", 0, boar.id));
  state.paused = false;
  assert.equal(E.Animals.slaughter(state, "red", 0, boar.id).meat, 8);
  assert.equal(village.resources.viande, 8);
  rejectedWithoutMutation(state, () => E.Animals.slaughter(state, "red", 0, boar.id));
  const engaged = deploy(state, "sanglier").animal;
  rejectedWithoutMutation(state, () => E.Animals.slaughter(state, "red", 0, engaged.id));
  assert.equal(population(state), humansBefore);
});

test("boars swim at half speed, recover land speed, and never take a boat seat", () => {
  const { state, village } = scenario();
  village.biome = "littoral";
  village.maritime.barque = 1;
  const { unit } = deploy(state, "sanglier");
  const humansBefore = population(state);
  unit.position = 42;
  const dogs = Array.from({ length: 2 }, () => deploy(state).unit);
  for (const dog of dogs) dog.position = 42;
  E.Combat.update(state, 0.1);
  near(unit.position, 42 + E.Config.specialAnimals.sanglier.speed * 0.5 * 0.1, "Swimming step");
  assert.equal(unit.hp, 80);
  assert.equal(Boolean(unit.waterTransport), false);
  assert.equal(Boolean(unit.transportHomeId), false);
  assert.equal(Boolean(unit.drowned), false);
  for (const dog of dogs) {
    assert.equal(dog.hp, 40);
    assert.equal(dog.waterTransport, "barque", "Both seats remain available for dogs");
  }
  unit.position = 10;
  E.Combat.update(state, 0.1);
  near(unit.position, 10 + E.Config.specialAnimals.sanglier.speed * 0.1, "Land step after leaving the water");
  assert.equal(population(state), humansBefore);
});

test("lateral redirection also halves boar speed while swimming", () => {
  const { state, village, enemy } = scenario();
  village.biome = "littoral";
  state.players.red.villages[1].biome = "littoral";
  enemy.destroyed = true;
  const { unit } = deploy(state, "sanglier");
  unit.position = 42;
  E.Combat.update(state, 0.1);
  near(unit.lanePosition, E.Config.combat.redirectSpeed * 0.5 * 0.1, "Lateral swimming step");
  assert.equal(unit.hp, 80);
  assert.equal(Boolean(unit.drowned), false);
});

test("a dog drowns without a fleet without removing a human or producing boar meat", () => {
  const { state, village } = scenario();
  village.biome = "littoral";
  const humansBefore = population(state);
  const { animal, unit } = deploy(state);
  unit.position = 42;
  E.Combat.update(state, 0.1);
  assert.equal(unit.hp, 0);
  assert.equal(unit.drowned, true);
  assert.equal(state.units.some((item) => item.id === unit.id), false);
  assert.equal(population(state), humansBefore);
  assert.equal(village.resources.viande, 0);
  rejectedWithoutMutation(state, () => E.Animals.deploy(state, "red", 0, animal.id, "attaque"));
});
