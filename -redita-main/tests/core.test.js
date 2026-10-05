"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = global;

const root = path.resolve(__dirname, "..");
[
  "config.js",
  "biomes.js",
  "crops.js",
  "livestock.js",
  "units.js",
  "buildings.js",
  "transport.js",
  "equipment.js",
  "animals.js",
  "economy.js",
  "board.js",
  "combat.js"
].forEach((file) => {
  const source = fs.readFileSync(path.join(root, "js", file), "utf8");
  vm.runInThisContext(source, { filename: file });
});

const E = global.Eredita;
assert.equal(E.Config.startingGold, 5000);
assert.equal(E.Board.createState().players.red.gold, 5000);
assert.equal(E.Board.createState().players.blue.gold, 5000);

for (let attempt = 0; attempt < 500; attempt += 1) {
  const draw = E.Biomes.createInitialDraw();
  assert.equal(draw.length, 4);
  E.Config.biomes.forEach((biome) => assert.ok(draw.includes(biome)));
}

assert.equal(E.Biomes.createSlots("plaine").length, 4);
assert.deepEqual(E.Biomes.createSlots("montagne").map((slot) => slot.type), ["free", "free", "animal", "animal"]);
assert.equal(E.Biomes.createSlots("littoral").length, 2);

const cropState = E.Board.createState();
cropState.phase = "running";
const cropVillage = cropState.players.red.villages[0];
cropVillage.biome = "montagne";
cropVillage.slots = E.Biomes.createSlots("montagne");
assert.equal(E.Crops.canPlace(cropState, "red", 0, 0, "chataignier"), true);
assert.equal(E.Crops.canPlace(cropState, "red", 0, 0, "ble"), false);
assert.equal(E.Crops.canPlace(cropState, "red", 0, 2, "chataignier"), false);
assert.equal(E.Crops.place(cropState, "red", 0, 0, "chataignier"), true);
assert.equal(cropVillage.slots[0].content.hp, 200);
assert.equal(E.Crops.place(cropState, "red", 0, 0, "chataignier"), false);
assert.equal(E.Crops.place(cropState, "red", 0, 0, "vignoble"), true);
assert.equal(cropVillage.slots[0].content.type, "vignoble");
assert.equal(cropVillage.slots[0].content.hp, E.Config.crops.vignoble.hp);

const freeHerdState = E.Board.createState();
freeHerdState.phase = "running";
const freeHerdVillage = freeHerdState.players.red.villages[0];
freeHerdVillage.biome = "montagne";
freeHerdVillage.slots = E.Biomes.createSlots("montagne");
assert.equal(E.Livestock.canPlace(freeHerdState, "red", 0, 2, "chevre"), true);
assert.equal(E.Livestock.place(freeHerdState, "red", 0, 2, "chevre"), true);
assert.equal(freeHerdVillage.slots[2].content.count, E.Config.startingLivestockCount);
assert.equal(E.Livestock.purchaseQuote(freeHerdState, "red", 0, "chevre").allowed, false);

const missionState = E.Board.createState();
missionState.phase = "running";
const missionVillage = missionState.players.red.villages[0];
missionVillage.biome = "montagne";
missionVillage.slots = E.Biomes.createSlots("montagne");
assert.equal(E.Buildings.buildT1(missionState, "red", 0, "bergerie"), true);
assert.equal(E.Crops.place(missionState, "red", 0, 0, "chataignier"), true);
assert.equal(E.Livestock.place(missionState, "red", 0, 2, "chevre"), true);
assert.equal(missionVillage.slots[2].content.count, 1);
assert.equal(missionVillage.slots[2].content.hp, 25);
const farmer = missionVillage.residents[0];
const shepherd = missionVillage.residents[1];
assert.equal(E.Economy.assignResidentJob(missionState, "red", 0, farmer.id, "agriculture"), true);
assert.equal(farmer.mission, "agriculture");
assert.equal(E.Economy.assignResidentJob(missionState, "red", 0, shepherd.id, "elevage"), true);
assert.equal(shepherd.mission, "elevage");
assert.equal(E.Economy.getAvailableResidents(missionState, "red", 0), 3);
for (let tick = 0; tick < 50; tick += 1) E.Economy.updateProduction(missionState, 0.1);
assert.equal(missionVillage.resources.chataigne, 0);
assert.ok(farmer.workPosition > 0);
for (let tick = 0; tick < 950; tick += 1) E.Economy.updateProduction(missionState, 0.1);
assert.ok(missionVillage.resources.chataigne > 0);
assert.ok(missionVillage.resources.lait > 0);
assert.ok(missionVillage.slots[2].content.count > 1);
assert.equal(E.Economy.unassignResidentJob(missionState, "red", 0, farmer.id), true);
assert.equal(farmer.mission, "disponible");
assert.equal(E.Economy.getAvailableResidents(missionState, "red", 0), 4);

const bulkWorkState = E.Board.createState();
bulkWorkState.phase = "running";
const bulkWorkVillage = bulkWorkState.players.red.villages[0];
bulkWorkVillage.biome = "plaine";
bulkWorkVillage.slots = E.Biomes.createSlots("plaine");
assert.equal(E.Crops.place(bulkWorkState, "red", 0, 0, "ble"), true);
assert.equal(E.Economy.assignAllAvailableResidents(bulkWorkState, "red", 0, "agriculture"), E.Config.startingPopulation);
assert.equal(bulkWorkVillage.residents.every((resident) => resident.mission === "agriculture"), true);
assert.equal(bulkWorkVillage.jobs.agriculture, E.Config.startingPopulation);
assert.equal(E.Economy.getAvailableResidents(bulkWorkState, "red", 0), 0);

const bulkCombatState = E.Board.createState();
bulkCombatState.phase = "running";
assert.equal(E.Economy.assignAllAvailableResidents(bulkCombatState, "blue", 0, "defense"), E.Config.startingPopulation);
assert.equal(bulkCombatState.players.blue.villages[0].residents.every((resident) => resident.mission === "defense"), true);
assert.equal(bulkCombatState.units.length, E.Config.startingPopulation);
assert.equal(E.Economy.getAvailableResidents(bulkCombatState, "blue", 0), 0);

const bulkProfessionState = E.Board.createState();
bulkProfessionState.phase = "running";
const bulkProfessionVillage = bulkProfessionState.players.red.villages[0];
bulkProfessionVillage.biome = "plaine";
bulkProfessionVillage.slots = E.Biomes.createSlots("plaine");
assert.equal(E.Crops.place(bulkProfessionState, "red", 0, 0, "ble"), true);
assert.equal(E.Buildings.buildT1(bulkProfessionState, "red", 0, "bergerie"), true);
assert.equal(E.Economy.assignResidentJob(bulkProfessionState, "red", 0, bulkProfessionVillage.residents[0].id, "agriculture"), true);
assert.equal(E.Economy.assignProfessionToAll(bulkProfessionState, "red", 0, "agriculteur"), E.Config.startingPopulation);
assert.equal(bulkProfessionVillage.residents.every((resident) => resident.profession === "agriculteur"), true);
assert.equal(bulkProfessionVillage.residents[0].mission, "agriculture");
assert.equal(bulkProfessionVillage.residents.slice(1).every((resident) => resident.mission === "disponible"), true);
assert.equal(E.Economy.assignProfessionToAll(bulkProfessionState, "red", 0, "agriculteur"), 0);
assert.equal(E.Economy.assignProfessionToAll(bulkProfessionState, "red", 0, "chasseur"), 0);
bulkProfessionVillage.residents[0].mission = "attaque";
bulkProfessionVillage.residents[0].unitId = "combat-test";
assert.equal(E.Economy.assignProfessionToAll(bulkProfessionState, "red", 0, "habitant"), E.Config.startingPopulation - 1);
assert.equal(bulkProfessionVillage.residents[0].profession, "agriculteur", "Le retrait groupé conserve le métier d’un attaquant engagé.");
assert.equal(bulkProfessionVillage.residents.slice(1).every((resident) => resident.profession === "habitant"), true);

assert.deepEqual(E.Config.villageShops.bergerie.tiers[1].map((item) => item.label), ["Chèvre", "Cochon", "Vache"]);
assert.deepEqual(E.Config.villageShops.artisanat.tiers[1].map((item) => item.label), ["Barque", "Outil en bois", "Armure de cuir"]);
assert.deepEqual(E.Config.villageShops.boucherie.tiers[3].map((item) => item.label), ["Voilier"]);

// Magasin maritime : déblocages du GDD, limites par Littoral et Filets.
const maritimeState = E.Board.createState();
maritimeState.phase = "running";
maritimeState.players.red.gold = 5000;
const maritimeVillage = maritimeState.players.red.villages[0];
maritimeVillage.biome = "littoral";
maritimeVillage.slots = E.Biomes.createSlots("littoral");
assert.equal(E.Transport.shopQuote(maritimeState, "red", 0, "barque").allowed, false);
assert.equal(E.Buildings.buildT1(maritimeState, "red", 0, "artisanat"), true);
for (let count = 0; count < 4; count++) assert.ok(E.Transport.buy(maritimeState, "red", 0, "barque"));
assert.equal(E.Transport.buy(maritimeState, "red", 0, "barque"), false);
assert.equal(maritimeVillage.maritime.barque, 4);
assert.equal(E.Transport.fleetCapacity(maritimeVillage), 8);
assert.equal(E.Transport.shopQuote(maritimeState, "red", 0, "filet").allowed, false);
assert.equal(E.Buildings.buildT1(maritimeState, "red", 0, "boucherie"), true);
assert.ok(E.Transport.buy(maritimeState, "red", 0, "filet"));
E.Transport.updateFishingNets(maritimeVillage, 30);
assert.equal(maritimeVillage.resources.poisson, 1);
assert.equal(E.Transport.shopQuote(maritimeState, "red", 0, "voilier").allowed, false);
maritimeVillage.resources.ble = 1000;
const butcherIndex = maritimeVillage.buildings.findIndex((building) => building.type === "boucherie");
assert.equal(E.Buildings.upgrade(maritimeState, "red", 0, butcherIndex, "ble"), true);
assert.equal(E.Buildings.upgrade(maritimeState, "red", 0, butcherIndex, "ble"), true);
assert.ok(E.Transport.buy(maritimeState, "red", 0, "voilier"));
assert.ok(E.Transport.buy(maritimeState, "red", 0, "voilier"));
assert.equal(E.Transport.buy(maritimeState, "red", 0, "voilier"), false);
assert.equal(E.Transport.fleetCapacity(maritimeVillage), 38);

// Une seule Barque protège deux personnes ; la troisième se noie immédiatement.
const waterState = E.Board.createState();
waterState.phase = "running";
const waterVillage = waterState.players.red.villages[0];
waterVillage.biome = "littoral";
waterVillage.slots = E.Biomes.createSlots("littoral");
waterState.players.blue.villages[0].biome = "plaine";
waterState.players.blue.villages[0].slots = E.Biomes.createSlots("plaine");
waterVillage.maritime.barque = 1;
for (const resident of waterVillage.residents.slice(0, 3)) assert.equal(E.Economy.deployResident(waterState, "red", 0, resident.id, "attaque"), true);
waterState.units.forEach((unit) => { unit.position = E.Config.maritime.waterRanges.red.min - 0.05; });
E.Combat.update(waterState, 0.1);
assert.equal(waterState.units.length, 2);
assert.equal(waterState.units.every((unit) => unit.waterTransport === "barque"), true);
assert.equal(waterVillage.population, E.Config.startingPopulation - 1);
waterState.units.forEach((unit) => { unit.position = E.Config.maritime.waterRanges.red.max + 0.1; });
E.Combat.update(waterState, 0.1);
assert.equal(waterState.units.every((unit) => unit.waterTransport === null), true);

const drowningState = E.Board.createState();
drowningState.phase = "running";
const drowningVillage = drowningState.players.red.villages[0];
drowningVillage.biome = "littoral";
drowningVillage.slots = E.Biomes.createSlots("littoral");
drowningState.players.blue.villages[0].biome = "plaine";
drowningState.players.blue.villages[0].slots = E.Biomes.createSlots("plaine");
assert.equal(E.Economy.deployResident(drowningState, "red", 0, drowningVillage.residents[0].id, "attaque"), true);
drowningState.units[0].position = E.Config.maritime.waterRanges.red.min - 0.05;
E.Combat.update(drowningState, 0.1);
assert.equal(drowningState.units.length, 0);
assert.equal(drowningVillage.population, E.Config.startingPopulation - 1);

const fishingState = E.Board.createState();
fishingState.phase = "running";
const fishingVillage = fishingState.players.red.villages[0];
fishingVillage.biome = "littoral";
fishingVillage.slots = E.Biomes.createSlots("littoral");
assert.equal(E.Buildings.buildT1(fishingState, "red", 0, "artisanat"), true);
assert.equal(E.Economy.assignJob(fishingState, "red", 0, "peche"), true);
E.Economy.updateProduction(fishingState, 30);
assert.equal(fishingVillage.resources.poisson, 1);
assert.equal(E.Economy.setProfession(fishingState, "red", 0, fishingVillage.residents[0].id, "pecheur"), true);
E.Economy.updateProduction(fishingState, 30);
assert.equal(fishingVillage.resources.poisson, 2.3);

const huntingState = E.Board.createState();
huntingState.phase = "running";
const huntingVillage = huntingState.players.red.villages[0];
huntingVillage.biome = "littoral";
huntingVillage.slots = E.Biomes.createSlots("littoral");
assert.equal(E.Buildings.buildT1(huntingState, "red", 0, "boucherie"), true);
const hunter = huntingVillage.residents[0];
assert.equal(E.Economy.setProfession(huntingState, "red", 0, hunter.id, "chasseur"), true);
assert.equal(E.Economy.assignResidentJob(huntingState, "red", 0, hunter.id, "chasse"), true);
E.Economy.updateProduction(huntingState, 1);
assert.equal(hunter.workPosition, E.Config.movement.hunterSpeed);
assert.ok(hunter.huntTargetPosition >= E.Config.temporaryProduction.huntingAreaByOwner.red.min);
assert.ok(hunter.huntTargetPosition <= E.Config.temporaryProduction.huntingAreaByOwner.red.max);
assert.equal(E.Transport.waterOwnerAt(huntingState, 0, hunter.huntTargetPosition), null);
assert.ok(Math.abs(hunter.huntTargetLaneOffset) <= E.Config.temporaryProduction.huntingLaneOffset);
E.Economy.updateProduction(huntingState, E.Config.temporaryProduction.huntingInterval);
assert.equal(huntingVillage.resources.viande, E.Config.temporaryProduction.huntingSpecialistAmount);

const state = E.Board.createState();
assert.equal(state.players.red.villages.length, 4);
assert.equal(state.players.blue.villages.length, 4);
assert.equal(state.players.red.villages[0].hp, 200);
assert.equal(state.players.red.villages[0].populationMax, 15);

state.phase = "running";
const redVillage = state.players.red.villages[0];
const originalGold = state.players.red.gold;
assert.equal(E.Buildings.buildT1(state, "red", 0, "artisanat"), true);
assert.equal(state.players.red.gold, originalGold - 200);
assert.equal(redVillage.maxHp, 275);
assert.equal(redVillage.hp, 275);

const populationBefore = state.players.red.villages.map((village) => village.population);
E.Economy.updatePopulation(state, 45);
state.players.red.villages.forEach((village, index) => {
  assert.equal(village.population, populationBefore[index] + 1);
});

const attacker = E.Units.create("red", 0, "habitant");
attacker.position = 97;
state.units.push(attacker);
const blueVillage = state.players.blue.villages[0];
const hpBefore = blueVillage.hp;
E.Combat.update(state, 0.1);
assert.equal(blueVillage.hp, hpBefore - 5);
assert.equal(blueVillage.damageSmoke, E.Config.visualEffects.structureSmokeDuration);
assert.equal(E.Economy.getAvailableResidents(state, "red", 0), redVillage.population - 1);
const populationBeforeDeath = redVillage.population;
attacker.hp = 0;
E.Combat.update(state, 0.1);
assert.equal(redVillage.population, populationBeforeDeath - 1);

const defenseState = E.Board.createState();
defenseState.phase = "running";
assert.equal(E.Buildings.buildT1(defenseState, "red", 0, "artisanat"), true);
const defenderResident = defenseState.players.red.villages[0].residents[0];
const defender = E.Units.create("red", 0, "guerrier", { residentId: defenderResident.id, stance: "defense" });
defenderResident.mission = "defense";
defenderResident.unitId = defender.id;
const intruder = E.Units.create("blue", 0, "guerrier");
intruder.position = defender.position + 2;
defenseState.units.push(defender, intruder);
const guardPosition = defender.position;
E.Combat.update(defenseState, 0.1);
assert.equal(defender.position, guardPosition);
assert.equal(intruder.hp, intruder.maxHp - defender.damage);

const redirectState = E.Board.createState();
redirectState.phase = "running";
redirectState.players.blue.villages[1].hp = 0;
redirectState.players.blue.villages[1].destroyed = true;
const redirectedUnit = E.Units.create("red", 1, "habitant");
redirectState.units.push(redirectedUnit);
E.Combat.update(redirectState, 0.1);
assert.equal(redirectState.pendingRedirects.length, 1);
const request = redirectState.pendingRedirects[0];
assert.deepEqual(request.candidates, [0, 2]);
assert.equal(E.Combat.chooseRedirect(redirectState, request.key, 0), true);
E.Combat.update(redirectState, 0.1);
assert.ok(redirectedUnit.lanePosition < 1 && redirectedUnit.lanePosition > 0);

const victoryState = E.Board.createState();
victoryState.phase = "running";
victoryState.players.blue.villages.forEach((village) => { village.hp = 0; });
E.Combat.update(victoryState, 0.1);
assert.equal(victoryState.phase, "ended");
assert.equal(victoryState.result, "red");

// Un métier n'est ni une obligation pour agir ni un bonus universel.
const roleState = E.Board.createState();
roleState.phase = "running";
const roleVillage = roleState.players.red.villages[0];
roleVillage.biome = "plaine";
roleVillage.slots = E.Biomes.createSlots("plaine");
const [novice, specialist, fighter] = roleVillage.residents;
assert.equal(E.Crops.place(roleState, "red", 0, 0, "ble"), true);
assert.equal(E.Economy.assignResidentJob(roleState, "red", 0, novice.id, "agriculture"), true);
assert.equal(novice.profession, "habitant");
assert.equal(E.Economy.workBonus(roleVillage, novice, "agriculture"), 0);
assert.equal(E.Economy.setProfession(roleState, "red", 0, specialist.id, "agriculteur"), false);
assert.equal(E.Economy.deployResident(roleState, "red", 0, fighter.id, "attaque"), true);
assert.equal(roleState.units[0].role, "habitant");
assert.equal(roleState.units[0].hp, 50);
assert.equal(E.Buildings.buildT1(roleState, "red", 0, "bergerie"), true);
assert.equal(E.Economy.setProfession(roleState, "red", 0, specialist.id, "agriculteur"), true);
assert.equal(E.Economy.assignResidentJob(roleState, "red", 0, specialist.id, "agriculture"), true);
assert.equal(E.Economy.workBonus(roleVillage, specialist, "agriculture"), 0.3);
assert.equal(E.Economy.workBonus(roleVillage, specialist, "peche"), 0);
for (let tick = 0; tick < 44; tick++) E.Economy.updateProduction(roleState, 0.1);
assert.equal(specialist.workPhase, "harvesting");
assert.equal(novice.workPhase, "toField");
assert.equal(E.Economy.unassignResidentJob(roleState, "red", 0, specialist.id), true);
assert.equal(specialist.profession, "agriculteur");
assert.equal(E.Economy.assignResidentJob(roleState, "red", 0, specialist.id, "chasse"), true);
E.Economy.updateProduction(roleState, 30);
assert.equal(roleVillage.resources.viande, 3);
assert.equal(E.Economy.setProfession(roleState, "red", 0, specialist.id, "chasseur"), false);
assert.equal(E.Buildings.buildT1(roleState, "red", 0, "boucherie"), true);
assert.equal(E.Economy.setProfession(roleState, "red", 0, specialist.id, "chasseur"), true);
E.Economy.updateProduction(roleState, 30);
assert.equal(roleVillage.resources.viande, 8);
assert.equal(E.Buildings.buildT1(roleState, "red", 0, "artisanat"), true);
const warrior = roleVillage.residents[3];
const raider = roleVillage.residents[4];
assert.equal(E.Economy.setProfession(roleState, "red", 0, fighter.id, "guerrier"), false);
assert.equal(E.Economy.setProfession(roleState, "red", 0, warrior.id, "guerrier"), true);
assert.equal(E.Economy.deployResident(roleState, "red", 0, warrior.id, "defense"), true);
assert.equal(roleState.units[1].hp, 70);
assert.equal(roleState.units[1].damage, 10);
assert.equal(E.Economy.setProfession(roleState, "red", 0, raider.id, "ravageur"), true);
assert.equal(E.Economy.deployResident(roleState, "red", 0, raider.id, "attaque"), true);
roleState.units[2].position = 97;
E.Combat.update(roleState, 0.1);
assert.equal(roleState.players.blue.villages[0].hp, 200 - 7 - 5);

// Vente : banque locale, lot borné, bonus, stock fractionnaire, aucune duplication.
const tradeState = E.Board.createState();
tradeState.phase = "running";
const tradeVillage = tradeState.players.red.villages[0];
tradeVillage.resources.chataigne = 12.5;
const startingGold = tradeState.players.red.gold;
assert.deepEqual(E.Economy.sell(tradeState, "red", 0, "chataigne"), { amount: 10, gold: 15 });
assert.deepEqual(E.Economy.sell(tradeState, "red", 0, "chataigne"), { amount: 2.5, gold: 3.75 });
assert.equal(E.Economy.sell(tradeState, "red", 0, "chataigne"), false);
assert.equal(E.Economy.sell(tradeState, "red", 0, "inconnue"), false);
assert.equal(tradeState.players.red.gold, startingGold + 18.75);
assert.equal(tradeVillage.resources.chataigne, 0);
assert.equal(tradeState.players.red.villages[1].resources.chataigne, 0);
assert.equal(tradeState.players.blue.gold, E.Config.startingGold);

// T1→T2→T3 : coûts exacts, dégâts conservés, aucune dépense après le plafond.
tradeState.players.red.gold = 10000;
tradeVillage.resources.ble = 1000;
assert.equal(E.Buildings.buildT1(tradeState, "red", 0, "bergerie"), true);
tradeVillage.hp -= 30;
let gold = tradeState.players.red.gold;
assert.equal(E.Buildings.upgrade(tradeState, "red", 0, 0, "ble"), true);
assert.equal(tradeVillage.maxHp, 350);
assert.equal(tradeVillage.hp, 320);
assert.equal(tradeVillage.resources.ble, 900);
assert.equal(tradeState.players.red.gold, gold - 200);
assert.equal(E.Buildings.upgrade(tradeState, "red", 0, 0, "ble"), true);
assert.equal(tradeVillage.maxHp, 425);
assert.equal(tradeVillage.resources.ble, 750);
assert.equal(E.Buildings.upgrade(tradeState, "red", 0, 0, "ble"), false);
assert.equal(E.Buildings.upgrade(tradeState, "red", 0, "village"), true);
assert.equal(tradeVillage.maxHp, 625);
assert.equal(tradeVillage.populationMax, 25);
assert.equal(E.Buildings.upgrade(tradeState, "red", 0, "village"), true);
assert.equal(tradeVillage.maxHp, 825);
assert.equal(tradeVillage.hp, 795);
assert.equal(tradeVillage.populationMax, 35);
assert.equal(E.Buildings.upgrade(tradeState, "red", 0, "village"), false);
assert.ok(Math.abs(E.Economy.saleQuote(tradeVillage, "ble").gold - 11.5) < 1e-9);
assert.equal(E.Buildings.buildT1(tradeState, "red", 0, "artisanat"), true);
gold = tradeState.players.red.gold;
assert.equal(E.Buildings.upgrade(tradeState, "red", 0, 1, "poisson"), false);
assert.equal(tradeState.players.red.gold, gold);
tradeState.paused = true;
assert.equal(E.Buildings.upgrade(tradeState, "red", 0, 1, "ble"), false);
assert.equal(E.Economy.sell(tradeState, "red", 0, "ble"), false);
tradeState.paused = false;
tradeVillage.destroyed = true;
assert.equal(E.Buildings.upgrade(tradeState, "red", 0, 1, "ble"), false);
assert.equal(E.Economy.sell(tradeState, "red", 0, "ble"), false);

function produceUntil(testState, condition) {
  for (let tick = 0; tick < 2000 && !condition(); tick++) E.Economy.updateProduction(testState, 0.1);
  assert.ok(condition(), "Le travailleur doit terminer cette étape du trajet");
}

// Une autre culture ou un autre village ne multiplie pas la cargaison de blé.
for (const fieldCount of [1, 2]) {
  const harvest = E.Board.createState();
  harvest.phase = "running";
  const home = harvest.players.red.villages[0];
  home.biome = "plaine";
  home.slots = E.Biomes.createSlots("plaine");
  for (let i = 0; i < fieldCount; i++) assert.equal(E.Crops.place(harvest, "red", 0, i, "ble"), true);
  assert.equal(E.Crops.place(harvest, "red", 0, 2, "chataignier"), true);
  const remote = harvest.players.red.villages[1];
  remote.biome = "plaine";
  remote.slots = E.Biomes.createSlots("plaine");
  E.Crops.place(harvest, "red", 1, 0, "ble");
  const worker = home.residents[0];
  E.Economy.assignResidentJob(harvest, "red", 0, worker.id, "agriculture");
  produceUntil(harvest, () => worker.workPhase === "toVillage");
  assert.deepEqual(worker.carrying, { resource: "ble", amount: fieldCount });
  assert.equal(home.resources.ble, 0);
  // Un champ planté après chargement n'augmente pas la cargaison en route.
  E.Crops.place(harvest, "red", 0, 3, "ble");
  produceUntil(harvest, () => worker.workPhase === "villageStop");
  assert.equal(home.resources.ble, fieldCount);
  assert.equal(remote.resources.ble, 0);
  assert.equal(home.resources.chataigne, 0);
  assert.equal(worker.carrying, null);
}

// Chaque chèvre/vache compte, pas les cochons ; le lait n'est versé qu'au retour.
for (const dairyCount of [1, 2]) {
  const dairy = E.Board.createState();
  dairy.phase = "running";
  const home = dairy.players.blue.villages[0];
  home.biome = "plaine";
  home.slots = E.Biomes.createSlots("plaine");
  E.Buildings.buildT1(dairy, "blue", 0, "bergerie");
  E.Livestock.place(dairy, "blue", 0, 0, "chevre");
  if (dairyCount === 2) E.Livestock.place(dairy, "blue", 0, 1, "vache");
  E.Livestock.place(dairy, "blue", 0, 2, "cochon");
  assert.equal(E.Economy.dairyAnimalCount(home), dairyCount);
  assert.equal(E.Economy.animalCounts(home).cochon, 1);
  const worker = home.residents[0];
  E.Economy.assignResidentJob(dairy, "blue", 0, worker.id, "elevage");
  produceUntil(dairy, () => worker.workPhase === "toVillage");
  assert.equal(worker.carrying.resource, "lait");
  assert.ok(Math.abs(worker.carrying.amount - dairyCount * 1.1) < 1e-9); // Bergerie T1.
  assert.equal(home.resources.lait, 0);
  produceUntil(dairy, () => worker.workPhase === "villageStop");
  assert.ok(Math.abs(home.resources.lait - dairyCount * 1.1) < 1e-9);
  assert.equal(worker.workPosition, 100);
  assert.equal(dairy.players.red.villages[0].resources.lait, 0);
  const beforeBirth = E.Economy.animalCounts(home).chevre;
  produceUntil(dairy, () => E.Economy.animalCounts(home).chevre > beforeBirth);
  assert.equal(E.Economy.dairyAnimalCount(home), dairyCount + 1);
}

// Riposte : 5 PV/s pour chaque assaillant, indépendamment du pas de simulation.
for (const step of [1, 0.25, 0.1]) {
  const siege = E.Board.createState();
  siege.phase = "running";
  const home = siege.players.red.villages[0];
  const resident = home.residents[0];
  E.Economy.deployResident(siege, "red", 0, resident.id, "attaque");
  const unit = siege.units[0];
  E.Combat.update(siege, step);
  assert.equal(unit.hp, 50, "Aucune riposte sur le trajet");
  unit.position = 97;
  for (let tick = 0; tick < Math.round(1 / step); tick++) E.Combat.update(siege, step);
  assert.ok(Math.abs(unit.hp - 45) < 1e-9);
  siege.paused = true;
  E.Combat.update(siege, 1);
  assert.ok(Math.abs(unit.hp - 45) < 1e-9);
  siege.paused = false;
  // Le dernier coup peut tuer l'assaillant : disparition et population cohérentes.
  unit.hp = 5;
  E.Combat.update(siege, 1);
  assert.equal(siege.units.length, 0);
  assert.equal(home.population, E.Config.startingPopulation - 1);
  assert.equal(home.residents.some((item) => item.id === resident.id), false);
}
const siege = E.Board.createState();
siege.phase = "running";
for (const resident of siege.players.blue.villages[0].residents.slice(0, 2)) E.Economy.deployResident(siege, "blue", 0, resident.id, "attaque");
siege.units.forEach((unit) => { unit.position = 3; });
E.Combat.update(siege, 1);
assert.ok(siege.units.every((unit) => unit.hp === 45));
siege.players.red.villages[0].hp = 0;
E.Combat.update(siege, 0.1);
assert.ok(siege.units.every((unit) => unit.hp === 45), "Pas de riposte d'un village mort");

// Achat d'un habitant : 50 or et 50 unités de la ressource locale choisie.
const purchase = E.Board.createState();
purchase.phase = "running";
const purchaseVillage = purchase.players.red.villages[0];
purchaseVillage.resources.raisin = 50;
const purchaseGold = purchase.players.red.gold;
const purchasedResident = E.Economy.buyResident(purchase, "red", 0, "raisin");
assert.ok(purchasedResident);
assert.equal(purchase.players.red.gold, purchaseGold - E.Config.residentPurchase.gold);
assert.equal(purchaseVillage.resources.raisin, 0);
assert.equal(purchaseVillage.population, E.Config.startingPopulation + 1);
assert.equal(purchasedResident.profession, "habitant");
assert.equal(E.Economy.buyResident(purchase, "red", 0, "raisin"), false);

// Les choix pour les nouveaux habitants restent locaux et actifs jusqu'à modification.
const nextResidentState = E.Board.createState();
nextResidentState.phase = "running";
const nextVillage = nextResidentState.players.red.villages[0];
assert.equal(nextVillage.nextResidentMission, "disponible");
assert.equal(nextVillage.nextResidentProfession, "habitant");
assert.equal(E.Buildings.buildT1(nextResidentState, "red", 0, "bergerie"), true);
assert.equal(E.Economy.setNextResidentProfession(nextResidentState, "red", 0, "agriculteur"), true);
assert.equal(E.Economy.setNextResidentMission(nextResidentState, "red", 0, "chasse"), true);
nextVillage.resources.ble = E.Config.residentPurchase.resourceAmount * 2;
const reservedResident = E.Economy.buyResident(nextResidentState, "red", 0, "ble");
assert.equal(reservedResident.profession, "agriculteur");
assert.equal(reservedResident.mission, "chasse");
assert.equal(nextVillage.jobs.chasse, 1);
assert.equal(nextVillage.nextResidentMission, "chasse");
assert.equal(nextVillage.nextResidentProfession, "agriculteur");
const ordinaryResident = E.Economy.buyResident(nextResidentState, "red", 0, "ble");
assert.equal(ordinaryResident.mission, "chasse");
assert.equal(ordinaryResident.profession, "agriculteur");
assert.equal(E.Economy.setNextResidentMission(nextResidentState, "red", 0, "disponible"), true);
assert.equal(E.Economy.setNextResidentProfession(nextResidentState, "red", 0, "habitant"), true);
assert.equal(nextVillage.nextResidentMission, "disponible");
assert.equal(nextVillage.nextResidentProfession, "habitant");
assert.equal(nextResidentState.players.red.villages[1].nextResidentMission, "disponible");

const naturalState = E.Board.createState();
naturalState.phase = "running";
const naturalVillage = naturalState.players.red.villages[0];
naturalVillage.biome = "littoral";
naturalVillage.slots = E.Biomes.createSlots("littoral");
assert.equal(E.Buildings.buildT1(naturalState, "red", 0, "artisanat"), true);
assert.equal(E.Economy.setNextResidentProfession(naturalState, "red", 0, "pecheur"), true);
assert.equal(E.Economy.setNextResidentMission(naturalState, "red", 0, "peche"), true);
E.Economy.updatePopulation(naturalState, E.Config.population.generationByLivingVillages[4]);
assert.equal(naturalVillage.residents.at(-1).profession, "pecheur");
assert.equal(naturalVillage.residents.at(-1).mission, "peche");
assert.equal(naturalVillage.nextResidentMission, "peche");
assert.equal(naturalVillage.nextResidentProfession, "pecheur");

const unmetState = E.Board.createState();
unmetState.phase = "running";
const unmetVillage = unmetState.players.red.villages[0];
unmetVillage.biome = "montagne";
unmetVillage.slots = E.Biomes.createSlots("montagne");
assert.equal(E.Economy.setNextResidentProfession(unmetState, "red", 0, "pecheur"), true);
assert.equal(E.Economy.setNextResidentMission(unmetState, "red", 0, "peche"), true);
const unmetResident = E.Economy.addResident(unmetVillage, unmetState);
assert.equal(unmetResident.profession, "habitant");
assert.equal(unmetResident.mission, "disponible");
assert.equal(unmetVillage.nextResidentMission, "peche");
assert.equal(unmetVillage.nextResidentProfession, "pecheur");

// Abattage manuel : rendement par espèce, troupeau recalculé et viande locale.
for (const [type, expectedMeat] of [["chevre", 4], ["cochon", 8], ["vache", 8]]) {
  const slaughterState = E.Board.createState();
  slaughterState.phase = "running";
  const slaughterVillage = slaughterState.players.red.villages[0];
  slaughterVillage.biome = "plaine";
  slaughterVillage.slots = E.Biomes.createSlots("plaine");
  assert.equal(E.Buildings.buildT1(slaughterState, "red", 0, "bergerie"), true);
  assert.equal(E.Livestock.place(slaughterState, "red", 0, 0, type), true);
  const herd = slaughterVillage.slots[0].content;
  herd.count = 3;
  E.Livestock.refreshHp(herd);
  const partial = E.Livestock.slaughter(slaughterState, "red", 0, 0, 2);
  assert.deepEqual(partial, { quantity: 2, meat: expectedMeat * 2, type });
  assert.equal(herd.count, 1);
  assert.equal(herd.hp, E.Config.livestock[type].hpPerAnimal);
  assert.equal(slaughterVillage.resources.viande, expectedMeat * 2);
  assert.equal(E.Livestock.slaughter(slaughterState, "red", 0, 0, 1).meat, expectedMeat);
  assert.equal(slaughterVillage.slots[0].content, null);
  assert.equal(slaughterVillage.resources.viande, expectedMeat * 3);
  assert.equal(E.Livestock.slaughter(slaughterState, "red", 0, 0, 1), false);
}

console.log("Tous les tests du noyau Eredità sont valides (remplacement, chasse, récoltes, élevage, abattage, achat, fumée et riposte inclus).");
