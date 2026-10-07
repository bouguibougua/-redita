"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");

function createGame(mode = "local") {
  let now = 0, frame, controller, handlers, snapshot;
  const sounds = [];
  const context = vm.createContext({
    window: {}, console, performance: { now: () => now },
    document: { querySelector: () => null }, requestAnimationFrame() {}
  });
  for (const name of ["config", "biomes", "crops", "livestock", "equipment", "units", "buildings", "transport", "animals", "economy", "board", "combat", "ai", "game-view"]) {
    vm.runInContext(fs.readFileSync(path.join(root, "js", name + ".js"), "utf8"), context);
  }
  const E = context.window.Eredita;
  E.Network = {
    mode, playerId: mode === "guest" ? "blue" : mode === "host" || mode === "solo" ? "red" : null,
    init(callbacks) { handlers = callbacks; },
    sendState(state) { snapshot = JSON.parse(JSON.stringify(state)); },
    sendCommand() { return true; }
  };
  E.UI = { init(value) { controller = value; }, render() {}, renderFrame() {} };
  E.Audio = { play(name) { sounds.push(name); } };
  E.Board3D = { ready: true, init(options) { frame = options.onFrame; }, update() {} };
  if (mode === "tutorial") E.Tutorial = { init() {}, allow: () => true, afterAction() {}, update() {}, render() {} };
  vm.runInContext(fs.readFileSync(path.join(root, "js", "game.js"), "utf8"), context);
  if (mode === "solo") handlers.onReady({ mode });
  const game = {
    E, controller, handlers, sounds,
    get state() { return E.GameView.getState(); },
    get snapshot() { return snapshot; },
    // Pas exact en binaire, inférieur au plafond de simulation de 0,1 s.
    advance(seconds) { for (let i = 0; i < seconds * 16; i++) { now += 62.5; frame(now); } },
    start() {
      controller.confirmBiomes("red", "keep");
      if (mode === "host") handlers.onCommand({ method: "confirmBiomes", args: ["blue", "keep"], playerId: "blue", view: { selectedVillage: { playerId: "blue", lane: 0 } } });
      else if (mode !== "solo") controller.confirmBiomes("blue", "keep");
      controller.start();
    }
  };
  return game;
}

const game = createGame(), { E, controller } = game;
assert.equal(E.Config.preparation.duration, 60);
assert.equal(controller.start(), false, "Les deux territoires doivent être confirmés");
game.start();
assert.equal(game.state.phase, "running");
assert.equal(game.state.preparationRemaining, 60);
assert.equal(game.state.elapsed, 0);
assert.equal(controller.start(), false, "Relancer ne réinitialise pas la minute");
const village = game.state.players.red.villages[0];
village.biome = "plaine"; village.slots = E.Biomes.createSlots("plaine");
const [farmer, soldier] = village.residents;
controller.build("bergerie");
controller.placeCrop("ble", 0);
controller.setProfession(farmer.id, "agriculteur");
controller.assignResidentMission(farmer.id, "agriculture");
controller.assignResidentMission(soldier.id, "attaque");
controller.assignAllResidents("chasse");
const unit = game.state.units.find(item => item.residentId === soldier.id);
assert.ok(unit); assert.equal(farmer.profession, "agriculteur");
E.Combat.update(game.state, 1);
assert.equal(unit.position, 0, "Le combat refuse aussi les mises à jour directes pendant la préparation");
game.advance(1);
assert.equal(game.state.preparationRemaining, 59);
assert.equal(village.residents.filter(item => item.mission === "chasse").length, 3, "Les commandes groupées avancent toutes les 0,5 seconde");
game.advance(58);
assert.equal(game.state.preparationRemaining, 1); assert.equal(game.state.elapsed, 0);
assert.equal(unit.position, 0); assert.equal(farmer.workPosition, 0);
assert.equal(village.resources.ble, 0); assert.equal(village.resources.viande, 0);
assert.equal(village.population, 5); assert.equal(village.populationTimer, 0);
assert.equal(game.state.overtimeAccumulator, 0);
assert.equal(game.state.players.blue.villages[0].hp, 200);
controller.togglePause(); game.advance(5);
assert.equal(game.state.preparationRemaining, 1, "La pause suspend le compte à rebours");
controller.togglePause(); game.advance(1);
assert.equal(game.state.preparationRemaining, 0); assert.equal(game.state.elapsed, 0);
assert.ok(game.sounds.includes("game"), "La musique de combat commence à la transition");
game.advance(0.0625);
assert.equal(game.state.elapsed, 0.0625);
assert.ok(unit.position > 0); assert.ok(farmer.workPosition > 0);
assert.equal(village.populationTimer, 0.0625);
assert.equal(E.Config.normalDuration, 750); assert.equal(E.Config.overtime.start, 750);

// L'image qui dépasse la fin de la préparation n'applique que son reste au combat.
const crossing = createGame(); crossing.start();
crossing.state.preparationRemaining = 0.03125;
crossing.advance(0.0625);
assert.equal(crossing.state.preparationRemaining, 0); assert.equal(crossing.state.elapsed, 0.03125);

// Un redémarrage efface le compte à rebours et les anciennes attributions en attente.
const restarted = createGame(); restarted.start();
restarted.controller.assignAllResidents("chasse");
restarted.controller.restart();
assert.equal(restarted.state.phase, "setup"); assert.equal(restarted.state.preparationRemaining, 0);
restarted.start(); restarted.advance(1);
assert.equal(restarted.state.preparationRemaining, 59);
assert.ok(restarted.state.players.red.villages[0].residents.every(item => item.mission === "disponible"));

// L'option provisoire permet la production, sans avancer le combat ni la génération.
const production = createGame(); production.E.Config.preparation.productionDuringPreparation = true;
production.start();
const productionVillage = production.state.players.red.villages[0];
productionVillage.biome = "plaine"; productionVillage.slots = production.E.Biomes.createSlots("plaine");
production.controller.placeCrop("ble", 0);
production.controller.assignResidentMission(productionVillage.residents[0].id, "agriculture");
production.advance(1);
assert.ok(productionVillage.residents[0].workPosition > 0);
assert.equal(productionVillage.populationTimer, 0); assert.equal(production.state.elapsed, 0);

// L'IA prépare son économie avec le même compteur et sans faire avancer ses troupes.
const solo = createGame("solo"); solo.start(); solo.advance(15);
assert.equal(solo.state.preparationRemaining, 45);
assert.ok(solo.state.players.blue.villages.every(item => item.buildings.some(building => building.type === "artisanat")));
assert.equal(solo.state.elapsed, 0);
assert.ok(solo.state.units.every(item => item.position === (item.ownerId === "blue" ? 100 : 0) || item.stance === "defense"));

// Le réseau conserve un compteur autoritaire et les droits locaux de l'invité.
const host = createGame("host"); host.start();
const hostView = JSON.stringify(host.state.selectedVillage);
const blueResident = host.state.players.blue.villages[0].residents[0];
host.handlers.onCommand({
  method: "assignResidentMission", args: [blueResident.id, "chasse"], playerId: "blue",
  view: { selectedVillage: { playerId: "blue", lane: 0 } }
});
assert.equal(blueResident.mission, "chasse");
assert.equal(JSON.stringify(host.state.selectedVillage), hostView);
assert.equal(host.snapshot.preparationRemaining, 60);
host.advance(0.5);
const guest = createGame("guest");
guest.state.selectedVillage = { playerId: "blue", lane: 0 };
guest.handlers.onState(host.snapshot);
assert.equal(guest.state.preparationRemaining, host.state.preparationRemaining);
const remaining = guest.state.preparationRemaining;
guest.advance(3);
assert.equal(guest.state.preparationRemaining, remaining, "L'invité attend les snapshots de l'hôte");
assert.equal(guest.state.elapsed, 0);
assert.equal(guest.state.selectedVillage.playerId, "blue");

const tutorial = createGame("tutorial"); tutorial.start();
assert.equal(tutorial.state.preparationRemaining, 0, "Le tutoriel conserve sa préparation scénarisée");
tutorial.advance(0.0625); assert.equal(tutorial.state.elapsed, 0.0625);
console.log("Préparation : 60 s, tâches et métiers, groupes, pause, production, IA, transition précise, reprise, réseau et tutoriel validés.");
