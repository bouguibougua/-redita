"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = global;
for (const file of ["config", "biomes", "crops", "livestock", "equipment", "units", "buildings", "transport", "animals", "economy", "board", "combat"]) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js", `${file}.js`), "utf8"), { filename: `${file}.js` });
}
const E = global.Eredita;

function setup(biome = "plaine") {
  const state = E.Board.createState();
  state.phase = "running";
  const village = state.players.red.villages[0];
  village.biome = biome;
  village.slots = E.Biomes.createSlots(biome);
  village.buildings.push({ type: "bergerie", level: 2 });
  return { state, village, resident: village.residents[0] };
}

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);
}

// Chaque voie de création part sans compagnon ; les animaux sont hors population.
{
  const { state, village } = setup();
  assert.ok(village.residents.every((resident) => resident.donkey === false));
  assert.deepEqual(village.animals, []);
  assert.equal(village.nextAnimalNumber, 1);
  assert.equal(E.Economy.addResident(village).donkey, false);
  village.resources.ble = E.Config.residentPurchase.resourceAmount;
  assert.equal(E.Economy.buyResident(state, "red", 0, "ble").donkey, false);
  const previousCount = village.residents.length;
  E.Economy.updatePopulation(state, E.Config.population.generationByLivingVillages[4]);
  assert.equal(village.residents.length, previousCount + 1);
  assert.equal(village.residents.at(-1).donkey, false);
  const available = E.Economy.getAvailableResidents(state, "red", 0);
  state.units.push(E.Units.create("red", 0, "chien"), E.Units.create("red", 0, "sanglier"));
  assert.equal(E.Economy.getAvailableResidents(state, "red", 0), available);
}

// Le déploiement garde le compagnon et applique la vitesse après la spécialisation.
for (const profession of ["habitant", "guerrier", "ravageur"]) {
  const { state, village, resident } = setup();
  resident.profession = profession;
  resident.donkey = true;
  resident.tool = "fer";
  resident.armor = "maille";
  assert.equal(E.Economy.deployResident(state, "red", 0, resident.id, "attaque"), true);
  const unit = state.units[0];
  assert.equal(unit.donkey, true);
  assert.equal(unit.animalType, null);
  close(unit.speed, E.Config.units[profession].speed * 1.2, "Vitesse militaire avec âne");
  assert.equal(unit.damage, E.Config.units[profession].damage + 20);
  assert.equal(unit.hp, E.Config.units[profession].hp + 35);
  unit.hp = 0;
  E.Combat.update(state, 0.1);
  assert.equal(village.residents.some((candidate) => candidate.id === resident.id), false);
  assert.equal(state.units.length, 0, "La mort supprime aussi le compagnon porté par l'unité");
  assert.equal(village.animals.length, 0, "L'âne ne devient pas une unité indépendante");
}

// Les statistiques des animaux viennent de specialAnimals et ignorent l'équipement humain.
for (const type of ["chien", "sanglier"]) {
  const stats = E.Config.specialAnimals[type];
  const original = { hp: stats.hp, damage: stats.damage, speed: stats.speed };
  try {
    stats.hp += 1;
    stats.damage += 1;
    stats.speed += 1;
    const animal = E.Units.create("red", 0, type, { animalType: type, animalId: "animal-1", donkey: true, tool: "fer", armor: "fer" });
    assert.equal(animal.animalId, "animal-1");
    assert.equal(animal.animalType, type);
    assert.equal(animal.hp, stats.hp);
    assert.equal(animal.maxHp, stats.hp);
    assert.equal(animal.damage, stats.damage);
    assert.equal(animal.speed, stats.speed);
    assert.equal(animal.donkey, false);
    assert.equal(animal.tool, null);
    assert.equal(animal.armor, null);
  } finally {
    Object.assign(stats, original);
  }
}

const professions = { agriculture: "agriculteur", elevage: "berger", peche: "pecheur", chasse: "chasseur" };

function worker(mission, donkey, tool = null) {
  const result = setup(mission === "peche" ? "littoral" : mission === "elevage" ? "montagne" : "plaine");
  const { state, resident } = result;
  resident.donkey = donkey;
  resident.tool = tool;
  resident.profession = professions[mission];
  if (mission === "agriculture") assert.equal(E.Crops.place(state, "red", 0, 0, "ble"), true);
  if (mission === "elevage") assert.equal(E.Livestock.place(state, "red", 0, 0, "chevre"), true);
  assert.equal(E.Economy.assignResidentJob(state, "red", 0, resident.id, mission), true);
  return result;
}

// Trajets de travail et chasse, y compris le mouvement latéral.
for (const mission of ["agriculture", "elevage", "chasse"]) {
  const plain = worker(mission, false);
  const mounted = worker(mission, true);
  for (const sample of [plain, mounted]) {
    sample.resident.huntTargetPosition = 30;
    sample.resident.huntTargetLaneOffset = 0.3;
    E.Economy.updateProduction(sample.state, 0.5);
  }
  close(mounted.resident.workPosition, plain.resident.workPosition * 1.2, `${mission} : vitesse après le métier`);
  if (mission === "chasse") close(mounted.resident.workLaneOffset, plain.resident.workLaneOffset * 1.2, "Vitesse latérale de chasse");
}

// Le bonus de rendement se cumule avec métier, biome, Bergerie et chaque outil.
for (const mission of Object.keys(professions)) {
  for (const tool of [null, "bois", "bronze", "fer"]) {
    const plain = worker(mission, false, tool);
    const mounted = worker(mission, true, tool);
    for (const sample of [plain, mounted]) {
      if (["agriculture", "elevage"].includes(mission)) {
        sample.resident.workPhase = "harvesting";
        sample.resident.targetSlotIndex = 0;
        sample.resident.workPosition = E.Config.temporaryProduction.agricultureFieldPositionByOwner.red;
      }
      E.Economy.updateProduction(sample.state, 30);
    }
    if (["agriculture", "elevage"].includes(mission)) {
      close(mounted.resident.carrying.amount, plain.resident.carrying.amount * 1.1, `${mission}/${tool} : rendement de l'âne`);
      const resource = mounted.resident.carrying.resource;
      const amount = mounted.resident.carrying.amount;
      assert.equal(mounted.village.resources[resource], 0, "Le chargement doit être rapporté au village");
      E.Economy.updateProduction(mounted.state, 5);
      close(mounted.village.resources[resource], amount, "Dépôt de la récolte avec bonus");
    } else {
      const resource = mission === "peche" ? "poisson" : "viande";
      close(mounted.village.resources[resource], plain.village.resources[resource] * 1.1, `${mission}/${tool} : rendement de l'âne`);
    }
    assert.equal(E.Economy.unassignResidentJob(mounted.state, "red", 0, mounted.resident.id), true);
    assert.equal(E.Economy.setProfession(mounted.state, "red", 0, mounted.resident.id, "habitant"), true);
    assert.equal(mounted.resident.donkey, true, "Le compagnon persiste lors des changements de métier et de tâche");
  }
}

// Aucune accélération des Filets ni de la reproduction par l'âne.
{
  const plain = worker("elevage", false);
  const mounted = worker("elevage", true);
  for (const sample of [plain, mounted]) E.Economy.updateProduction(sample.state, 10);
  assert.equal(mounted.village.slots[0].content.reproductionProgress, plain.village.slots[0].content.reproductionProgress);
  for (const donkey of [false, true]) {
    const { state, village, resident } = setup("littoral");
    resident.donkey = donkey;
    village.maritime.filet = 2;
    E.Economy.updateProduction(state, E.Config.maritime.shop.filet.interval);
    assert.equal(village.resources.poisson, 2 * E.Config.maritime.shop.filet.fishAmount);
  }
}

// Le harcèlement ralentit seulement la progression de l'enclos ciblé, sans la remettre à zéro.
{
  const { state, village } = setup();
  E.Livestock.place(state, "red", 0, 0, "chevre");
  E.Livestock.place(state, "red", 0, 1, "cochon");
  const goat = village.slots[0].content;
  const pig = village.slots[1].content;
  goat.reproductionProgress = 7;
  pig.reproductionProgress = 11;
  const originalAnimals = E.Animals;
  try {
    E.Animals = { harassment: (currentState, targetVillage, slotIndex) => {
      assert.equal(currentState, state);
      assert.equal(targetVillage, village);
      return { stacks: slotIndex === 0 ? 4 : 1, penalty: slotIndex === 0 ? 0.28 : 0.05 };
    } };
    E.Economy.updateProduction(state, 20);
    close(goat.reproductionProgress, 7 + 20 * 0.72, "Progression chèvre avec 4 chiens");
    close(pig.reproductionProgress, 11 + 20 * 0.95, "Progression cochon avec 1 chien");
    E.Animals = undefined;
    E.Economy.updateProduction(state, 5);
    close(goat.reproductionProgress, 7 + 20 * 0.72 + 5, "Progression conservée sans harcèlement");
    close(pig.reproductionProgress, 11 + 20 * 0.95 + 5, "Compatibilité sans module Animals");
  } finally {
    E.Animals = originalAnimals;
  }
}

console.log("Donkey and herd production tests passed.");
