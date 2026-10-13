"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const ctx = vm.createContext({ window: {}, console });
for (const name of ["config", "biomes", "crops", "livestock", "units", "buildings", "transport", "equipment", "animals", "economy", "board", "combat", "cards", "card-effects", "card-game", "card-ui", "game-view", "xr-ui"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", `${name}.js`), "utf8"), ctx);
const E = ctx.window.Eredita;
let state = E.Board.createState("classic"); state.phase = "running";
state.players.red.villages.forEach(v => { v.biome = "plaine"; v.slots = E.Biomes.createSlots("plaine"); });
state.players.red.matchDeck = { quantities: { artisanat: 1, "champ-ble": 4 }, mythological: ["u-mazzeru", "a-stregha", "squadra-arozza"] };
E.CardGame.start(state, () => 0.999999);
E.Network = { mode: "local", playerId: "red" };
E.GameView.init({ getState: () => state, controller: {
  selectVillage(playerId, lane) { state.selectedVillage = { playerId, lane }; },
  playCard(id, target) { return E.CardGame.play(state, state.selectedVillage.playerId, id, target); }
} });
const painted = new Map(), feedback = [];
const dashboard = { targets: [],
  paint(id, title, lines, rows, visible = true, options = {}) { painted.set(id, { title, lines, rows, visible, options }); },
  syncTargets() { this.targets = [...painted].flatMap(([panelId, p]) => p.visible ? p.rows.flat().map(([label, action, enabled, meta]) => ({ userData: { xrTarget: { panelId, label, action, enabled, ...meta } } })) : []); },
  setFeedback(message) { feedback.push(message); }, navigate() { return true; }
};
const ui = E.XRUI.create(dashboard); ui.render();
const find = predicate => dashboard.targets.find(item => predicate(item.userData.xrTarget))?.userData.xrTarget;
assert.ok(find(target => target.action?.name === "cards"));
ui.execute({ type: "open", name: "cards" }); ui.render();
assert.equal(painted.get("modal").rows.flat().filter(entry => entry[1]?.name === "card-play").length, 7);
const held = state.players.red.cards.hand.find(card => card.cardId === "artisanat");
assert.ok(find(target => target.action?.data === held.id).portrait.src.endsWith("artisanat.webp"));
assert.equal(ui.activate(find(target => target.action?.data === held.id)), true);
const target = find(target => target.action?.type === "play-card" && target.action.target.lane === 0);
const gold = state.players.red.gold;
assert.equal(ui.activate(target), true);
assert.equal(state.players.red.gold, gold - 200);
assert.equal(state.players.red.cards.hand.length, 4);
assert.equal(ui.modal.name, "cards");
assert.equal(ui.activate(target), false, "The stale spatial target cannot replay the card");
state = JSON.parse(JSON.stringify(state)); ui.render();
assert.ok(painted.get("modal").lines[0].includes("4/15"), "The spatial hand reads the new snapshot");
const crop = state.players.red.cards.hand[0];
ui.execute({ type: "open", name: "card-play", data: crop.id }); state.paused = true; ui.render();
assert.equal(find(target => target.action?.type === "play-card").enabled, false);
state.paused = false; E.Network.mode = "host";
assert.equal(ui.execute({ type: "play-card", playerId: "blue", instanceId: state.players.blue.cards.hand[0].id, target: { lane: 0 } }), false);
console.log("Cartes XR : illustrations, main, cibles spatiales, confirmation, coût, rejeu, pause, droits et snapshots validés.");
