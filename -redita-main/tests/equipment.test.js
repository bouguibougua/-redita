"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = global;
for (const file of ["config", "biomes", "crops", "livestock", "equipment", "units", "buildings", "transport", "economy", "board"]) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js", `${file}.js`), "utf8"), { filename: `${file}.js` });
}
const E = global.Eredita;

function setup(biome = "plaine") {
  const state = E.Board.createState();
  state.phase = "running";
  const village = state.players.red.villages[0];
  village.biome = biome;
  village.slots = E.Biomes.createSlots(biome);
  return { state, village, resident: village.residents[0] };
}

const { state, village, resident } = setup();
assert.equal(resident.tool, null);
assert.equal(resident.armor, null);
assert.equal(E.Economy.addResident(village).tool, null);
const quote = (kind, type, residentId = resident.id) => E.Equipment.quote(state, "red", 0, residentId, kind, type);
const buy = (kind, type, residentId = resident.id) => E.Equipment.buy(state, "red", 0, residentId, kind, type);
assert.equal(quote("tools", "bois").allowed, false, "No purchase before Artisanat");
assert.equal(E.Buildings.buildT1(state, "red", 0, "artisanat"), true);
assert.equal(quote("tools", "bronze").allowed, false);
assert.equal(quote("armors", "maille").allowed, false);
assert.equal(quote("tools", "bois").allowed, true);
const beforePurchase = state.players.red.gold;
assert.ok(buy("tools", "bois"));
assert.equal(state.players.red.gold, beforePurchase - E.Config.equipment.tools.bois.gold);
assert.equal(resident.tool, "bois");
assert.equal(buy("tools", "bois"), false);
assert.equal(state.players.red.gold, beforePurchase - E.Config.equipment.tools.bois.gold, "Repeated purchase never charges twice");
assert.equal(buy("tools", "fer"), false);
assert.ok(buy("armors", "cuir"));
village.buildings[0].level = 2;
assert.equal(quote("tools", "bronze").allowed, true);
assert.equal(quote("armors", "maille").allowed, true);
assert.equal(quote("armors", "fer").allowed, false);
village.buildings[0].level = 3;
assert.ok(buy("tools", "bronze"));
assert.ok(buy("tools", "fer"));
assert.ok(buy("armors", "fer"));
assert.deepEqual(E.Equipment.bonuses(resident), { damage: 20, hp: 50, productionSpeed: 0, productionYield: 0.5 }, "Replacements do not stack previous tiers");
assert.equal(resident.mission, "disponible");
assert.equal(resident.profession, "habitant");

for (const [kind, type] of [["invalid", "fer"], ["tools", "missing"], ["__proto__", "fer"], ["tools", "constructor"]]) {
  assert.equal(buy(kind, type), false);
}
assert.equal(buy("tools", "bois", state.players.blue.villages[0].residents[0].id), false, "Cannot equip another village's resident");
state.paused = true;
assert.equal(buy("tools", "bois"), false);
state.paused = false;
state.phase = "setup";
assert.equal(buy("tools", "bois"), false);
state.phase = "running";
village.destroyed = true;
assert.equal(buy("tools", "bois"), false);
village.destroyed = false;
state.players.red.gold = 0;
assert.equal(buy("tools", "bois"), false);
state.players.red.gold = E.Config.startingGold;

resident.profession = "agriculteur";
assert.equal(E.Economy.deployResident(state, "red", 0, resident.id, "attaque"), true);
const unit = state.units[0];
assert.equal(unit.role, "habitant", "Non-combat profession grants no combat specialty");
assert.equal(unit.profession, "agriculteur", "Visual profession survives combat deployment");
assert.equal(unit.tool, "fer");
assert.equal(unit.armor, "fer");
assert.equal(unit.hp, E.Config.units.habitant.hp + 50);
assert.equal(unit.maxHp, unit.hp);
assert.equal(unit.damage, E.Config.units.habitant.damage + 20);
assert.equal(buy("armors", "cuir"), false, "Equipment cannot change during combat");
const warrior = E.Units.create("red", 0, "guerrier", { tool: "bronze", armor: "maille" });
assert.equal(warrior.hp, E.Config.units.guerrier.hp + 35);
assert.equal(warrior.damage, E.Config.units.guerrier.damage + 10);

const fishing = setup("littoral");
fishing.resident.tool = "bois";
for (const fisher of fishing.village.residents.slice(0, 2)) {
  assert.equal(E.Economy.assignResidentJob(fishing.state, "red", 0, fisher.id, "peche"), true);
}
E.Economy.updateProduction(fishing.state, 25);
assert.equal(fishing.village.resources.poisson, 1, "Wood speeds only the equipped fisher");
E.Economy.updateProduction(fishing.state, 5);
assert.equal(fishing.village.resources.poisson, 2);
assert.equal(E.Economy.unassignResidentJob(fishing.state, "red", 0, fishing.resident.id), true);
assert.equal(fishing.resident.tool, "bois", "Equipment survives a mission change");

for (const tool of ["bois", "bronze", "fer"]) {
  for (const mission of ["agriculture", "elevage", "peche", "chasse"]) {
    const work = setup(mission === "peche" ? "littoral" : "plaine");
    work.resident.tool = tool;
    E.Buildings.buildT1(work.state, "red", 0, "bergerie");
    if (mission === "agriculture") assert.equal(E.Crops.place(work.state, "red", 0, 0, "ble"), true);
    if (mission === "elevage") assert.equal(E.Livestock.place(work.state, "red", 0, 0, "chevre"), true);
    assert.equal(E.Economy.assignResidentJob(work.state, "red", 0, work.resident.id, mission), true);
    const bonus = E.Equipment.bonuses(work.resident);
    if (["agriculture", "elevage"].includes(mission)) {
      work.resident.workPhase = "harvesting";
      work.resident.targetSlotIndex = 0;
      work.resident.workPosition = E.Config.temporaryProduction.agricultureFieldPositionByOwner.red;
      const duration = mission === "agriculture" ? E.Config.temporaryProduction.agricultureHarvestDuration / 1.1 : 30;
      E.Economy.updateProduction(work.state, duration / (1 + bonus.productionSpeed) + 0.0001);
      assert.equal(work.resident.workPhase, "toVillage", `${tool}: ${mission} completes its production cycle`);
      const expected = (mission === "elevage" ? 1.1 : 1) * (1 + bonus.productionYield);
      assert.equal(work.resident.carrying.amount, expected);
      const resource = work.resident.carrying.resource;
      assert.equal(work.village.resources[resource], 0, "Cargo must still return home before storage");
      E.Economy.updateProduction(work.state, 5);
      assert.equal(work.village.resources[resource], expected);
    } else {
      E.Economy.updateProduction(work.state, 30 / (1 + bonus.productionSpeed) + 0.0001);
      const resource = mission === "peche" ? "poisson" : "viande";
      assert.equal(work.village.resources[resource], (mission === "peche" ? 1 : 3) * (1 + bonus.productionYield));
    }
  }
}

console.log("Equipment tests passed.");
