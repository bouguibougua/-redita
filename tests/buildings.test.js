"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");

function fixture() {
  const context = vm.createContext({ window: {}, console });
  for (const name of ["config", "biomes", "crops", "livestock", "units", "buildings", "transport", "equipment", "animals", "economy", "board", "combat"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", name + ".js"), "utf8"), context);
  }
  const E = context.window.Eredita, state = E.Board.createState("classic");
  state.phase = "running";
  state.preparationRemaining = 0;
  const village = state.players.red.villages[0];
  const resident = village.residents[0];
  E.Economy.deployResident(state, "red", 0, resident.id, "attaque");
  const unit = state.units.find(item => item.residentId === resident.id);
  return { E, state, village, unit };
}

test("Artisanat works without the retired card engine, preserves wounds and does not stack", () => {
  const { E, state, unit } = fixture();
  const base = { hp: unit.maxHp, damage: unit.damage }, bonus = E.Config.building.artisanatBonus;
  assert.equal(E.CardEffects, undefined);
  assert.equal(E.Buildings.buildT1(state, "red", 0, "artisanat"), true);
  assert.equal(unit.hp, base.hp + bonus.hp);
  assert.equal(unit.damage, base.damage + bonus.damage);
  unit.hp -= 10;
  assert.equal(E.Buildings.buildT1(state, "red", 0, "artisanat"), true);
  E.Buildings.updateArtisanatBonuses(state);
  assert.equal(unit.hp, base.hp + bonus.hp - 10);
  assert.equal(unit.damage, base.damage + bonus.damage);
  unit.lane = unit.lanePosition = 1;
  E.Buildings.updateArtisanatBonuses(state);
  assert.equal(unit.maxHp, base.hp);
  assert.equal(unit.hp, base.hp - 10);
  assert.equal(unit.damage, base.damage);
  unit.lane = unit.lanePosition = 0;
  E.Buildings.updateArtisanatBonuses(state);
  assert.equal(unit.hp, base.hp + bonus.hp - 10);
  const snapshot = JSON.parse(JSON.stringify(state));
  E.Buildings.updateArtisanatBonuses(snapshot);
  assert.equal(snapshot.units[0].hp, unit.hp);
  snapshot.players.red.villages[0].destroyed = true;
  E.Buildings.updateArtisanatBonuses(snapshot);
  assert.equal(snapshot.units[0].hp, base.hp - 10);
});

test("Artisanat respects Magu's multiplier and excludes enemies, animals and legends", () => {
  const { E, state, unit } = fixture();
  const bonus = E.Config.building.artisanatBonus;
  const base = { hp: unit.maxHp, damage: unit.damage };
  unit.mythologyStatMultiplier = 2;
  unit.hp = unit.maxHp *= 2;
  unit.damage *= 2;
  const dog = E.Units.create("red", 0, "chien");
  const enemy = E.Units.create("blue", 0, "habitant");
  const legend = E.Units.create("red", 0, "habitant");
  legend.isLegend = true;
  const excluded = [dog, enemy, legend];
  const before = excluded.map(item => ({ hp: item.hp, damage: item.damage }));
  state.units.push(...excluded);
  E.Buildings.buildT1(state, "red", 0, "artisanat");
  assert.equal(unit.maxHp, (base.hp + bonus.hp) * 2);
  assert.equal(unit.damage, (base.damage + bonus.damage) * 2);
  excluded.forEach((item, i) => assert.deepEqual({ hp: item.hp, damage: item.damage }, before[i]));
  unit.lane = 1;
  E.Buildings.updateArtisanatBonuses(state);
  assert.equal(unit.maxHp, base.hp * 2);
  assert.equal(unit.damage, base.damage * 2);
});
