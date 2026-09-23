"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

global.window = global;
const root = path.resolve(__dirname, "..", "js");
for (const file of ["config.js", "biomes.js", "crops.js", "livestock.js", "units.js", "buildings.js",
  "transport.js", "equipment.js", "animals.js", "economy.js", "board.js", "combat.js", "ai.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
}

const E = global.Eredita;
const state = E.Board.createState();
E.AI.prepareSetup(state);
assert.equal(state.players.red.setupConfirmed, false);
assert.equal(state.players.blue.setupConfirmed, true);
assert.equal(state.players.blue.name, "IA (Bleu)");
state.phase = "running";

const step = E.Config.ai.decisionInterval;
assert.equal(E.AI.update(state, step), true);
assert.ok(state.players.blue.villages.every((village) => village.slots.some((slot) => slot.content?.category === "crop")));
assert.equal(E.AI.update(state, step), true);
assert.ok(state.players.blue.villages.every((village) => E.Buildings.has(village, "artisanat")));
assert.equal(E.AI.update(state, step), true);
assert.ok(state.players.blue.villages.every((village) => village.jobs.agriculture === 1));
assert.equal(E.AI.update(state, step), true);
assert.equal(state.units.filter((unit) => unit.ownerId === "blue" && unit.stance === "attack").length, 4);
assert.ok(state.units.filter((unit) => unit.ownerId === "blue").every((unit) => unit.role === "guerrier"));
assert.ok(state.players.red.villages.every((village) => village.population === E.Config.startingPopulation));
assert.deepEqual(state.selectedVillage, { playerId: "red", lane: 0 });

state.paused = true;
const unitCount = state.units.length;
assert.equal(E.AI.update(state, step), false);
assert.equal(state.units.length, unitCount);

const defense = E.Board.createState();
E.AI.prepareSetup(defense);
defense.phase = "running";
const intruder = E.Units.create("red", 0, "habitant");
intruder.position = E.Config.combat.defensePositionByOwner.blue;
defense.units.push(intruder);
assert.equal(E.AI.update(defense, step), true);
assert.ok(defense.units.some((unit) => unit.ownerId === "blue" && unit.stance === "defense" && unit.lane === 0));
assert.ok(defense.players.red.villages.every((village) => village.population === E.Config.startingPopulation));

const redirect = E.Board.createState();
E.AI.prepareSetup(redirect);
redirect.phase = "running";
redirect.players.red.villages[1].hp = 150;
redirect.players.red.villages[2].hp = 50;
redirect.pendingRedirects.push({ key: "blue-0", playerId: "blue", fromLane: 0, candidates: [1, 2] });
assert.equal(E.AI.update(redirect, 0.1), true);
assert.equal(redirect.redirectDecisions["blue-0"], 2);

console.log("IA solo valide : préparation, économie, attaque, défense, pause et redirection.");
