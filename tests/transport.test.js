"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

global.window = global;
for (const name of ["config", "biomes", "crops", "livestock", "equipment", "units", "buildings", "transport", "animals", "economy", "board", "combat"]) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js", `${name}.js`), "utf8"), { filename: name });
}
const E = global.Eredita;
const boat = E.Config.maritime.shop.barque;

function scenario(ownerId = "red", biome = "plaine", ownCoast = false) {
  const state = E.Board.createState("classic");
  state.phase = "running";
  const enemyId = ownerId === "red" ? "blue" : "red";
  const village = state.players[ownerId].villages[0];
  village.biome = ownCoast ? "littoral" : biome;
  village.slots = E.Biomes.createSlots(village.biome);
  state.players[enemyId].villages[0].biome = "littoral";
  state.players[enemyId].villages[0].slots = E.Biomes.createSlots("littoral");
  return { state, village, ownerId, enemyId };
}

function deploy({ state, village, ownerId }, index = 0) {
  const resident = village.residents[index];
  assert.equal(E.Economy.deployResident(state, ownerId, village.lane, resident.id, "attaque"), true);
  return state.units.find((unit) => unit.residentId === resident.id);
}

test("barques can be bought and stocked locally in all biomes, with the existing unlocks and limits", () => {
  for (const ownerId of ["red", "blue"]) for (const biome of ["plaine", "montagne", "littoral"]) {
    const { state, village } = scenario(ownerId, biome);
    assert.equal(E.Transport.buy(state, ownerId, 0, "barque"), false);
    const building = biome === "montagne" ? "boucherie" : "artisanat";
    assert.equal(E.Buildings.buildT1(state, ownerId, 0, building), true);
    const gold = state.players[ownerId].gold;
    for (let i = 0; i < boat.max; i++) assert.ok(E.Transport.buy(state, ownerId, 0, "barque"));
    assert.equal(village.maritime.barque, boat.max);
    assert.equal(state.players[ownerId].gold, gold - boat.max * boat.gold);
    assert.equal(state.players[ownerId].villages[1].maritime.barque, 0);
    assert.equal(E.Transport.buy(state, ownerId, 0, "barque"), false);
    assert.equal(E.Transport.fleetStatus(state, village).available, boat.max * boat.capacity);
    if (biome !== "littoral") {
      assert.equal(E.Transport.shopQuote(state, ownerId, 0, "voilier").reason, "Littoral requis");
      assert.equal(E.Transport.shopQuote(state, ownerId, 0, "filet").reason, "Littoral requis");
    }
  }
});

test("paused, inactive, destroyed or unaffordable villages cannot buy barques", () => {
  for (const invalidate of [
    (s) => { s.paused = true; },
    (s) => { s.phase = "setup"; },
    (s, v) => { v.destroyed = true; },
    (s) => { s.players.red.gold = boat.gold - 1; }
  ]) {
    const { state, village } = scenario();
    E.Buildings.buildT1(state, "red", 0, "artisanat");
    invalidate(state, village);
    const before = JSON.stringify(state);
    assert.equal(E.Transport.buy(state, "red", 0, "barque"), false);
    assert.equal(JSON.stringify(state), before);
  }
});

test("attackers from any biome automatically cross allied and enemy water in both directions", () => {
  for (const ownerId of ["red", "blue"]) for (const biome of ["plaine", "montagne", "littoral"]) {
    const setup = scenario(ownerId, biome);
    const { state, village } = setup;
    E.Buildings.buildT1(state, ownerId, 0, "artisanat");
    E.Transport.buy(state, ownerId, 0, "barque");
    const unit = deploy(setup);
    let boarded = false;
    for (let i = 0; i < 150; i++) {
      E.Combat.update(state, E.Config.simulation.maxDelta);
      assert.ok(state.units.includes(unit), `${ownerId}/${biome}: the attacker survives the crossing`);
      if (unit.waterOwner) {
        boarded = true;
        assert.equal(unit.waterTransport, "barque");
        assert.equal(unit.transportHomeId, village.id);
        assert.equal(E.Transport.fleetStatus(state, village).available, boat.capacity - 1);
      }
    }
    assert.equal(boarded, true);
    assert.equal(unit.waterTransport, null);
    assert.equal(unit.transportHomeId, null);
    assert.equal(village.maritime.barque, 1, "The crossing does not consume the boat");
    assert.equal(E.Transport.fleetStatus(state, village).available, boat.capacity);
  }
});

test("a barque has two seats, releases them on land or death, and remains reusable after a snapshot", () => {
  const setup = scenario();
  const { state, village } = setup;
  village.maritime.barque = 1;
  const range = E.Config.maritime.waterRanges.blue;
  const first = deploy(setup, 0), second = deploy(setup, 1), excess = deploy(setup, 2);
  for (const unit of [first, second]) {
    unit.position = range.min + 1;
    assert.equal(E.Transport.updateUnitWaterState(state, unit), true);
  }
  assert.equal(E.Transport.fleetStatus(state, village).available, 0);
  excess.position = range.min + 1;
  assert.equal(E.Transport.updateUnitWaterState(state, excess), false);
  assert.equal(excess.drowned, true);
  first.position = range.max + 1;
  E.Transport.updateUnitWaterState(state, first);
  const next = deploy(setup, 3);
  next.position = range.min + 1;
  assert.equal(E.Transport.updateUnitWaterState(state, next), true);
  second.hp = 0;
  assert.equal(E.Transport.fleetStatus(state, village).available, 1);
  const snapshot = JSON.parse(JSON.stringify(state));
  assert.deepEqual(E.Transport.fleetStatus(snapshot, snapshot.players.red.villages[0]),
    { barque: 1, voilier: 0, capacity: 2, occupied: 1, available: 1 });
});

test("automatic boarding uses only the origin village reserve, including after a lane change", () => {
  const setup = scenario();
  const { state, village } = setup;
  const unit = deploy(setup);
  unit.position = E.Config.maritime.waterRanges.blue.min + 1;
  state.players.blue.villages[0].maritime.barque = 1;
  state.players.red.villages[1].maritime.barque = 1;
  assert.equal(E.Transport.updateUnitWaterState(state, unit), false);
  unit.hp = unit.maxHp;
  unit.drowned = false;
  village.maritime.barque = 1;
  unit.lane = unit.lanePosition = 1;
  state.players.blue.villages[1].biome = "littoral";
  assert.equal(E.Transport.updateUnitWaterState(state, unit), true);
  assert.equal(unit.transportHomeId, village.id);
  assert.equal(E.Transport.fleetStatus(state, village).occupied, 1);
});
