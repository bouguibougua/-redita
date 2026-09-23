"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = global;
const root = path.resolve(__dirname, "..");
["config", "biomes", "crops", "livestock", "equipment", "units", "buildings", "transport", "animals", "economy", "board", "combat"]
  .forEach((file) => vm.runInThisContext(fs.readFileSync(path.join(root, "js", `${file}.js`), "utf8"), { filename: file }));
const E = global.Eredita;
const state = E.Board.createState();
state.phase = "running";
state.selectedVillage = { playerId: "red", lane: 0 };
state.selectedResidentId = state.players.red.villages[0].residents[0].id;
assert.equal(E.Buildings.buildT1(state, "blue", 0, "bergerie"), true);
assert.equal(E.Buildings.buildT1(state, "blue", 0, "artisanat"), true);
// Les achats adverses seraient possibles économiquement : seul le contrôle réseau doit les refuser.
assert.equal(E.Buildings.buildT1(state, "red", 0, "bergerie"), true);

const view = () => JSON.stringify([state.selectedVillage, state.selectedResidentId, state.pendingPlacement]);
const hostView = view();
E.Board.createState = () => state;
let handlers;
let sentSnapshots = 0;
E.Network = {
  mode: "host",
  playerId: "red",
  init: (callbacks) => { handlers = callbacks; },
  sendState: () => { sentSnapshots += 1; }
};
E.UI = { init() {}, render() {}, renderFrame() {} };
global.document = { querySelector: () => null };
global.requestAnimationFrame = () => {};
vm.runInThisContext(fs.readFileSync(path.join(root, "js", "game.js"), "utf8"), { filename: "game.js" });

function remote(method, args, playerId = "blue", lane = 0) {
  handlers.onCommand({ method, args, playerId: "blue", view: { selectedVillage: { playerId, lane } } });
  assert.equal(view(), hostView, "Une commande invitée doit préserver la sélection de l'hôte");
}

const blueVillage = state.players.blue.villages[0];
const blueResident = blueVillage.residents[0];
const redResident = state.players.red.villages[0].residents[0];

// Le moteur de l'hôte effectue le tirage, paie l'achat et publie le nouvel état.
let initialGold = state.players.blue.gold;
remote("buyAnimal", ["chevre"]);
assert.equal(state.players.blue.gold, initialGold - E.Config.livestock.chevre.purchaseGold);
assert.equal(blueVillage.slots.filter((slot) => slot.content?.type === "chevre").length, 1);
assert.equal(blueVillage.slots.find((slot) => slot.content?.type === "chevre").content.count, 1);
assert.equal(sentSnapshots, 1);

// Un invité ne peut pas changer le propriétaire de sa commande pour acheter chez Rouge.
const previousState = JSON.stringify(state);
remote("buyAnimal", ["chevre"], "red");
assert.equal(JSON.stringify(state), previousState);
assert.equal(sentSnapshots, 1, "La commande interdite est rejetée avant toute publication");

// Le village ciblé doit réellement contenir le résident à équiper.
initialGold = state.players.blue.gold;
remote("buyEquipment", [redResident.id, "tools", "bois"]);
assert.equal(state.players.blue.gold, initialGold);
assert.equal(redResident.tool, null);
const neighboringResident = state.players.blue.villages[1].residents[0];
remote("buyEquipment", [neighboringResident.id, "tools", "bois"]);
assert.equal(state.players.blue.gold, initialGold);
assert.equal(neighboringResident.tool, null);

remote("buyEquipment", [blueResident.id, "tools", "bois"]);
assert.equal(blueResident.tool, "bois");
assert.equal(state.players.blue.gold, initialGold - E.Config.equipment.tools.bois.gold);

// Les prérequis sont revérifiés par l'hôte, même si le bouton invité était déverrouillé.
initialGold = state.players.blue.gold;
remote("buyEquipment", [blueResident.id, "armors", "fer"]);
assert.equal(state.players.blue.gold, initialGold);
assert.equal(blueResident.armor, null);
state.paused = true;
const herdBefore = JSON.stringify(blueVillage.slots);
remote("buyAnimal", ["chevre"]);
assert.equal(state.players.blue.gold, initialGold);
assert.equal(JSON.stringify(blueVillage.slots), herdBefore);

// Compagnons : tiers, association à son habitant et ordres validés par l'hôte.
state.paused = false;
state.players.blue.gold = 5000;
blueVillage.resources.ble = 1000;
const sheepfold = blueVillage.buildings.findIndex((building) => building.type === "bergerie");
assert.equal(E.Buildings.upgrade(state, "blue", 0, sheepfold, "ble"), true);
initialGold = state.players.blue.gold;
remote("buySpecialAnimal", ["ane", redResident.id]);
assert.equal(state.players.blue.gold, initialGold);
remote("buySpecialAnimal", ["ane", blueResident.id]);
assert.equal(blueResident.donkey, true);
assert.equal(state.players.blue.gold, initialGold - E.Config.specialAnimals.ane.gold);
initialGold = state.players.blue.gold;
remote("buySpecialAnimal", ["chien"]);
assert.equal(state.players.blue.gold, initialGold, "Le Chien requiert Bergerie T3");
assert.equal(E.Buildings.upgrade(state, "blue", 0, sheepfold, "ble"), true);
remote("buySpecialAnimal", ["chien"]);
remote("buySpecialAnimal", ["sanglier"]);
assert.equal(blueVillage.animals.length, 2);
const dog = blueVillage.animals.find((animal) => animal.type === "chien");
const boar = blueVillage.animals.find((animal) => animal.type === "sanglier");
remote("orderAnimal", [dog.id, "defense"]);
assert.ok(dog.unitId);
assert.equal(state.units.find((unit) => unit.id === dog.unitId).ownerId, "blue");
const meat = blueVillage.resources.viande;
remote("slaughterSpecialAnimal", [boar.id]);
assert.equal(blueVillage.resources.viande, meat + 8);
const protectedState = JSON.stringify(state);
remote("buySpecialAnimal", ["chien"], "red");
remote("orderAnimal", [dog.id, "attaque"], "red");
remote("slaughterSpecialAnimal", [dog.id], "red");
assert.equal(JSON.stringify(state), protectedState);

console.log("Shop network command tests passed.");
