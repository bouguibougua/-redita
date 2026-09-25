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
let state = E.Board.createState(); state.phase = "running";
E.Network = { mode: "local", playerId: "red" };
E.GameView.init({ getState: () => state, controller: {
  selectResident(id) { state.selectedResidentId = id; },
  setProfession(id, profession) { const { playerId, lane } = state.selectedVillage; return E.Economy.setProfession(state, playerId, lane, id, profession); },
  build(type) { const { playerId, lane } = state.selectedVillage; return E.Buildings.buildT1(state, playerId, lane, type); },
  selectVillage(playerId, lane) { state.selectedVillage = { playerId, lane }; }
} });
const painted = new Map(), feedback = [];
const dashboard = { targets: [], textSize: "normal",
  paint(id, title, lines, rows, visible = true, options = {}) { painted.set(id, { title, lines, rows, visible, options }); },
  syncTargets() {
    this.targets = [...painted].flatMap(([panelId, p]) => p.visible ? [
      ...p.rows.flat().map(([label, action, enabled, meta]) => ({ userData: { xrTarget: { kind: "dashboard-button", panelId, label, action, enabled, ...meta } } })),
      ...(p.options.action ? [{ userData: { xrTarget: { kind: "dashboard-button", panelId, action: p.options.action, enabled: true } } }] : [])
    ] : []);
  },
  setTextSize(size) { this.textSize = size; }, setFeedback(message, kind) { feedback.push({ message, kind }); }, navigate() { return true; }
};
const ui = E.XRUI.create(dashboard); ui.render();
const find = predicate => dashboard.targets.find(t => predicate(t.userData.xrTarget))?.userData.xrTarget;
for (const id of ["jobs", "info", "tasks", "buildings", "residents"]) assert.equal(painted.get(id).visible, true);
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
assert.equal(ui.activate(find(t => t.action?.name === "text-size")), true);
assert.equal(ui.activate(find(t => t.action?.size === "xlarge")), true); assert.equal(dashboard.textSize, "xlarge");
ui.close();
target = find(t => t.action?.method === "build" && t.action.args[0] === "artisanat");
red.gold = 0; assert.equal(ui.activate(target), false, "Une dépense visée avant une baisse d'or est revalidée");
assert.match(feedback.at(-1).message, /or global/);
E.Network.mode = "solo"; state.selectedVillage = { playerId: "blue", lane: 0 }; ui.render();
assert.equal(ui.activate(find(t => t.action?.method === "build")), false); assert.match(feedback.at(-1).message, /adversaire/);
state = E.Board.createState(); state.phase = "running"; state.players.red.villages[0].resources.ble = 321; ui.render();
assert.ok(painted.get("info").lines.some(line => line.label === "Blé" && line.value === "321"), "Les panneaux relisent le nouvel état réseau");
assert.ok(painted.get("residents").rows[0][0][3].portrait.src.endsWith("characters-atlas.png"));
ui.toggle(); assert.equal(painted.get("jobs").visible, false); assert.equal(painted.get("gear").visible, true);
console.log("UI XR : vraies professions, tâches distinctes, coûts moteur, permissions, revalidation, snapshots, portraits et réglages validés.");
