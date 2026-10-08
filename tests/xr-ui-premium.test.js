"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ctx = vm.createContext({ window: {}, console });
for (const name of ["config", "biomes", "crops", "livestock", "units", "buildings", "transport", "equipment", "animals", "economy", "board", "game-view", "xr-ui"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", `${name}.js`), "utf8"), ctx);
}
const E = ctx.window.Eredita;
let state = E.Board.createState("classic"); state.phase = "running";
E.Network = { mode: "local", playerId: "red" };
E.GameView.init({ getState: () => state, controller: {
  selectResident(id) { state.selectedResidentId = id; },
  setProfession(id, profession) { const { playerId, lane } = state.selectedVillage; return E.Economy.setProfession(state, playerId, lane, id, profession); },
  build(type) { const { playerId, lane } = state.selectedVillage; return E.Buildings.buildT1(state, playerId, lane, type); },
  selectVillage(playerId, lane) { state.selectedVillage = { playerId, lane }; state.selectedResidentId = state.players[playerId].villages[lane].residents[0]?.id || null; },
  confirmBiomes(playerId, action) {
    const player = state.players[playerId]; if (player.setupConfirmed) return false;
    if (action === "exchange") player.setupSelection.forEach(lane => { player.villages[lane].biome = E.Biomes.randomBiome(player.villages[lane].biome); });
    player.setupSelection = []; player.setupConfirmed = true;
  },
  start() { if (!state.players.red.setupConfirmed || !state.players.blue.setupConfirmed) return false; state.phase = "running"; },
  sell(resource) { const { playerId, lane } = state.selectedVillage; return E.Economy.sell(state, playerId, lane, resource); }
} });
const painted = new Map(), feedback = [];
const dashboard = { targets: [], textSize: "normal",
  paint(id, title, lines, rows, visible = true, options = {}) { painted.set(id, { title, lines, rows, visible, options }); },
  syncTargets() {
    this.targets = [...painted].flatMap(([panelId, p]) => p.visible ? [
      ...[...p.rows.flat(), ...(p.options.footer || [])].map(([label, action, enabled, meta]) => ({ userData: { xrTarget: { kind: "dashboard-button", panelId, label, action, enabled, ...meta } } })),
      ...(p.options.action ? [{ userData: { xrTarget: { kind: "dashboard-button", panelId, action: p.options.action, enabled: true } } }] : [])
    ] : []);
  },
  setTextSize(size) { this.textSize = size; }, setFeedback(message, kind) { feedback.push({ message, kind }); }, navigate() { return true; }
};
const ui = E.XRUI.create(dashboard); ui.render();
const find = predicate => dashboard.targets.find(t => predicate(t.userData.xrTarget))?.userData.xrTarget;
for (const id of ["jobs", "tasks", "buildings", "residents"]) assert.equal(painted.get(id).visible, true);
assert.equal(dashboard.targets.filter(t => t.userData.xrTarget.action?.type === "select-village").length, 8);
assert.ok(painted.get("jobs").rows.flat().some(entry => entry[1]?.args?.[1] === "agriculteur"));
assert.equal(painted.get("jobs").rows.flat().some(entry => entry[1]?.method === "changeJob"), false, "Métiers et tâches ne sont plus confondus");
const red = state.players.red, v = red.villages[0], person = v.residents[0];
let target = find(t => t.action?.method === "setProfession" && t.action.args[1] === "agriculteur");
assert.equal(ui.activate(target), false); assert.match(feedback.at(-1).message, /Bergerie/);
const gold = red.gold;
assert.equal(ui.activate(find(t => t.action?.method === "build" && t.action.args[0] === "bergerie")), true);
assert.equal(red.gold, gold - E.Config.building.T1.gold);
const mission = person.mission;
assert.equal(ui.activate(find(t => t.action?.method === "setProfession" && t.action.args[1] === "agriculteur")), true);
assert.equal(person.profession, "agriculteur"); assert.equal(person.mission, mission, "Attribuer un métier préserve la tâche");
assert.ok(painted.get("buildings").rows.flat().some(entry => entry[3]?.detail.includes("200 or + 100 ressources")), "Le coût moteur d'amélioration est affiché");
assert.equal(ui.activate(find(t => t.action?.name === "settings")), true);
assert.equal(painted.get("modal").options.variant, "settings");
assert.equal(JSON.stringify(ui.activate(find(t => t.action?.type === "panels-scale" && t.action.direction === "grow"))), JSON.stringify({ type: "panels-scale", direction: "grow" }));
assert.equal(JSON.stringify(ui.activate(find(t => t.action?.type === "recenter"))), JSON.stringify({ type: "recenter" }));
assert.equal(painted.get("modal").options.footer[0][0], "Retour");
assert.equal(painted.get("modal").options.footer[1][0], "Quitter le mode VR");
assert.equal(ui.activate(find(t => t.action?.name === "text-size")), true);
assert.equal(ui.activate(find(t => t.action?.size === "xlarge")), true); assert.equal(dashboard.textSize, "xlarge");
ui.close();
target = find(t => t.action?.method === "build" && t.action.args[0] === "artisanat");
red.gold = 0; assert.equal(ui.activate(target), false, "Une dépense visée avant une baisse d'or est revalidée");
assert.match(feedback.at(-1).message, /or global/);
E.Network.mode = "solo"; state.selectedVillage = { playerId: "blue", lane: 0 }; ui.render();
assert.equal(ui.activate(find(t => t.action?.method === "build")), false); assert.match(feedback.at(-1).message, /adversaire/);
state = E.Board.createState("classic"); state.phase = "running"; state.players.red.villages[0].resources.ble = 321; ui.render();
assert.ok(painted.get("buildings").lines.some(line => line.includes("Blé : 321")), "La gestion relit le nouvel état réseau");
assert.ok(painted.get("residents").rows[0][0][3].portrait.src.endsWith("characters-atlas.png"));
ui.toggle(); assert.equal(painted.get("jobs").visible, false); assert.equal(painted.get("gear").visible, true);
// Les raccourcis fonctionnent sans viser une fenêtre et conservent le bon village.
ui.toggle();
const firstVillage = state.selectedVillage.lane;
ui.stick("left", 1, "jobs", "vertical");
assert.equal(state.selectedResidentId, state.players.red.villages[firstVillage].residents[1].id);
ui.stick("right", 1, "tasks", "horizontal");
assert.equal(state.selectedVillage.lane, (firstVillage + 1) % 4);
ui.stick("right", -1, "residents", "horizontal"); assert.equal(state.selectedVillage.lane, firstVillage);
const selected = state.selectedResidentId;
assert.equal(ui.stick("left", 1, undefined, "horizontal"), false); assert.equal(state.selectedResidentId, selected);
ui.shop(); assert.equal(ui.modal.name, "shop");
ui.stick("left", 1, undefined, "vertical");
assert.equal(state.selectedResidentId, state.players.red.villages[firstVillage].residents[1].id, "La boutique suit l’habitant choisi");
ui.shop(); assert.equal(ui.modal, null);
state.players.red.villages[firstVillage].resources.ble = 30;
ui.execute({ type: "open", name: "sell" }); ui.render();
assert.equal(ui.activate(find(t => t.action?.method === "sell" && t.action.args[0] === "ble")), true);
assert.equal(ui.modal.name, "sell", "La vente conserve la boutique ouverte pour une deuxième action");
assert.equal(state.players.red.villages[firstVillage].resources.ble, 20);
ui.shop(); assert.equal(ui.modal, null, "Y ferme aussi un sous-menu de boutique");
ui.toggle(); ui.selectVillage("red", 2); assert.equal(painted.get("jobs").visible, true, "Un clic village réaffiche les quatre fenêtres");
assert.equal([...painted.values()].filter(p => p.visible && ["Habitants", "Métiers", "Tâches", "Gestion"].some(prefix => p.title.startsWith(prefix))).length, 4);

// Préparation sur un seul écran et lancement explicite en une action.
state = E.Board.createState("classic"); E.Network.mode = "solo"; state.players.blue.setupConfirmed = true;
ui.close(); ui.render();
assert.equal(painted.get("modal").options.variant, "setup");
assert.equal(painted.get("modal").rows[0].length, 3);
assert.equal(painted.get("modal").rows[1].length, 2);
assert.equal(painted.get("modal").rows[2].length, 2);
assert.equal(painted.get("modal").options.footer[0][0], "Retour");
assert.equal(painted.get("modal").options.footer[1][0], "Lancer la partie");
assert.equal(painted.get("red0").visible, false);
const originalBiomes = state.players.red.villages.map(v => v.biome);
assert.equal(ui.activate(find(t => t.action?.type === "setup-launch")), true);
assert.equal(state.phase, "running"); assert.equal(state.players.red.setupConfirmed, true);
assert.deepEqual(state.players.red.villages.map(v => v.biome), originalBiomes, "Lancer sans sélection conserve le tirage");

// Une sélection de biomes est appliquée avant de lancer, dans la limite du moteur.
state = E.Board.createState("classic"); state.players.blue.setupConfirmed = true;
state.players.red.setupSelection = [0, 1];
const before = state.players.red.villages.map(v => v.biome);
ui.close(); assert.equal(ui.activate(find(t => t.action?.type === "setup-launch")), true);
assert.equal(state.phase, "running");
assert.notEqual(state.players.red.villages[0].biome, before[0]); assert.notEqual(state.players.red.villages[1].biome, before[1]);
assert.equal(state.players.red.villages[2].biome, before[2]);

state = E.Board.createState("classic"); E.Network.mode = "local"; ui.close();
assert.equal(ui.activate(find(t => t.action?.type === "setup-launch")), true);
assert.equal(state.phase, "setup"); assert.equal(ui.modal.data, "blue");
ui.execute({ type: "open", name: "settings" }); ui.close();
assert.match(painted.get("modal").lines[0], /Joueur Bleu/, "Retour des réglages préserve la préparation du deuxième camp");
assert.equal(ui.activate(find(t => t.action?.type === "setup-launch")), true); assert.equal(state.phase, "running");

state = E.Board.createState("classic"); state.phase = "running"; state.preparationRemaining = E.Config.preparation.duration;
ui.close(); ui.render();
assert.equal(painted.get("clock").title, "1:00"); assert.equal(painted.get("clock").lines[0], "PRÉPARATION");
assert.equal(painted.get("tasks").visible, true, "L’attribution reste accessible pendant la préparation");
state.preparationRemaining = 0.0625; ui.render(); assert.equal(painted.get("clock").title, "0:01");
state.preparationRemaining = 0; ui.render(); assert.equal(painted.get("clock").title, "12:30");

state = E.Board.createState("classic"); E.Network.mode = "pending"; ui.close();
assert.equal(painted.get("modal").options.variant, "mode");
assert.deepEqual(Array.from(painted.get("modal").rows[0], entry => entry[0]), ["2 camps", "4 camps"]);
assert.equal(painted.get("modal").rows[0][0][3].selected, true);
assert.equal(painted.get("modal").rows[0][1][3].selected, false);
assert.equal(ui.activate(find(t => t.action?.name === "settings")), true, "Paramètres accessibles avant le choix du mode");
assert.ok(find(t => t.action?.type === "recenter")?.enabled);
assert.equal(ui.activate(find(t => t.action?.name === "panel-layout")), true);
assert.ok(find(t => t.action?.name === "panel-adjust" && t.action.data === "modal"), "Le menu peut être ajusté dès le début");
ui.close();
assert.equal(painted.get("modal").options.footer[0][0], "Quitter le mode VR");
assert.equal(painted.get("modal").options.footer[0][1].type, "exit");
assert.ok(painted.get("modal").rows.filter(row => row[0][1]?.type === "mode").every(row => row[0][3].centered && row[0][3].large));
console.log("UI XR : quatre fenêtres, commandes métier, permissions, stocks, joysticks, boutique Y et préparation en une action validés.");

state = E.Board.createState("simplified"); E.Network.mode = "local"; ui.close();
assert.equal(painted.get("modal").rows[1].length, 2);
assert.equal(painted.get("modal").rows.length, 3, "Pas de ligne de biomes vide en format simplifié");
assert.match(painted.get("modal").lines[0], /0\/1 biomes/);
state.phase = "running"; ui.close();
assert.equal(dashboard.targets.filter(t => t.userData.xrTarget.action?.type === "select-village").length, 4);
assert.equal(painted.get("red2").visible, false);
ui.execute({type:"open", name:"panel-layout"}); ui.render();
assert.equal(find(t => t.action?.data === "red2"), undefined);
console.log("UI simplifiée : deux biomes, un échange, quatre fiches et fenêtres existantes uniquement.");
