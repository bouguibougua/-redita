"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
async function run() {
  const read = name => fs.readFileSync(path.join(__dirname, "..", "js", `${name}.js`), "utf8");
  const THREE = await import(`data:text/javascript;base64,${Buffer.from(read("vendor/three.core")).toString("base64")}`);
  const ctx = vm.createContext({ window: {}, console });
  for (const name of ["config", "biomes", "crops", "livestock", "units", "buildings", "transport", "equipment", "animals", "economy", "board", "combat", "cards", "card-effects", "card-game"]) vm.runInContext(read(name), ctx);
  const source = read("board3d").replace("  E.Board3D = {", "  E.CardRenderTest = { prepare(module, state) { THREE = module; latestState = state; unitGroup = new THREE.Group(); terrainGroup = new THREE.Group(); }, terrainTile, updateUnits, get terrain() { return terrainGroup; }, get models() { return unitModels; } };\n  E.Board3D = {");
  vm.runInContext(source, ctx);
  const E = ctx.window.Eredita, state = E.Board.createState("classic");
  state.phase = "running"; E.CardGame.start(state);
  E.Network = { mode: "host", playerId: "red" };
  const v = state.players.red.villages[0], enemy = state.players.blue.villages[0];
  v.biome = "montagne"; enemy.biome = "plaine";
  v.terrain = { river: { type: "riviere" }, mill: { type: "moulin", hp: 250 }, tower: { type: "tour-genoise", hp: 300 }, trail: { type: "sentier" }, traps: [{ position: 25 }] };
  v.burnUntil = 120; v.curseUntil = 120;
  const renderer = E.CardRenderTest; renderer.prepare(THREE, state);
  renderer.terrainTile(v); renderer.terrainTile(enemy);
  for (const name of ["card-river", "card-mill", "card-genoese-tower", "card-trail", "card-trap", "card-burned-terrain", "card-cursed-terrain", "card-fog"]) assert.ok(renderer.terrain.getObjectByName(name), name);
  renderer.terrain.traverse(part => {
    assert.ok([part.position.x, part.position.y, part.position.z].every(Number.isFinite));
    if (part.geometry) { part.geometry.computeBoundingSphere(); assert.ok(Number.isFinite(part.geometry.boundingSphere.radius)); }
  });
  v.burnUntil = v.curseUntil = 0;
  const enemyUnit = E.Units.create("blue", 0, "habitant"); enemyUnit.position = 90;
  state.units.push(enemyUnit); renderer.updateUnits(state);
  assert.equal(renderer.models.has(`unit-${enemyUnit.id}`), false, "A hidden enemy is not rendered");
  enemyUnit.position = 55; renderer.updateUnits(state);
  assert.equal(renderer.models.has(`unit-${enemyUnit.id}`), true, "The tower reveals the enemy near the frontier");
  enemy.biome = "littoral"; state.players.red.revealCoasts = true; enemyUnit.position = 90;
  renderer.updateUnits(state); assert.equal(renderer.models.has(`unit-${enemyUnit.id}`), true);
  E.CardEffects.apply(state, "red", "charrette", { lane: 0, residentIds: v.residents.slice(0, 2).map(person => person.id) });
  const cart = state.units.find(unit => unit.isCart); renderer.updateUnits(state);
  assert.equal(renderer.models.get(`unit-${cart.id}`).name, "charrette");
  console.log("Cartes 3D : rivière, moulin, tour, sentier, pièges, incendie, malédiction, vision, charrette et géométries validés.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
