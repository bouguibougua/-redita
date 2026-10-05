"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function run() {
  const root = path.resolve(__dirname, "..");
  let clock = 1000;
  const context = vm.createContext({ window: null, console, Date, performance: { now: () => clock } });
  context.window = context;
  for (const file of ["config", "biomes", "crops", "livestock", "equipment", "units", "buildings", "transport", "animals", "economy", "board", "combat"]) {
    vm.runInContext(fs.readFileSync(path.join(root, "js", `${file}.js`), "utf8"), context, { filename: `${file}.js` });
  }
  const E = context.Eredita;
  const colorDistance = (left, right) => Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);

  // Le combat produit des impulsions visuelles sans modifier ses dégâts.
  const battle = E.Board.createState();
  battle.phase = "running";
  battle.players.red.villages[0].biome = "plaine";
  battle.players.blue.villages[0].biome = "plaine";
  const redResident = battle.players.red.villages[0].residents[0];
  const blueResident = battle.players.blue.villages[0].residents[0];
  const red = E.Units.create("red", 0, "habitant", { residentId: redResident.id });
  const blue = E.Units.create("blue", 0, "habitant", { residentId: blueResident.id });
  redResident.unitId = red.id;
  blueResident.unitId = blue.id;
  red.position = 50;
  blue.position = 52;
  battle.units.push(red, blue);
  E.Combat.update(battle, 0.1);
  assert.equal(red.visualAttackSequence, 1);
  assert.equal(blue.visualAttackSequence, 1);
  assert.equal(red.visualHitSequence, 1);
  assert.equal(blue.visualHitSequence, 1);
  blue.hp = 1;
  red.attackCooldown = 0;
  red.visualAttackTimer = 0;
  E.Combat.update(battle, 0.1);
  assert.equal(battle.units.some((unit) => unit.id === blue.id), false);
  assert.equal(battle.unitDeathEffects.length, 1);
  assert.equal(battle.unitDeathEffects[0].unitId, blue.id);

  const THREE = await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync(path.join(root, "js/vendor/three.core.js"), "utf8")).toString("base64")}`);
  const source = fs.readFileSync(path.join(root, "js/board3d.js"), "utf8").replace(
    "  E.Board3D = {",
    "  E.CombatAnimationTest = { useThree(module) { THREE = module; unitGroup = new THREE.Group(); }, updateUnits, animateUnitEffects, get models() { return unitModels; } };\n  E.Board3D = {"
  );
  vm.runInContext(source, context, { filename: "board3d.js" });
  const visual = E.CombatAnimationTest;
  visual.useThree(THREE);
  const unit = {
    id: 91, ownerId: "red", originLane: 0, lane: 0, lanePosition: 0, position: 30,
    role: "habitant", profession: "habitant", hp: 50, visualAttackTimer: 0.3,
    visualAttackSequence: 1, visualHitTimer: 0, visualHitSequence: 0
  };
  const village = { lane: 0, biome: "plaine", destroyed: false, residents: [], animals: [] };
  const state = { units: [unit], unitDeathEffects: [], players: { red: { id: "red", villages: [village] } } };
  visual.updateUnits(state);
  let figure = visual.models.get("unit-91");
  const attackStart = figure.userData.attackStartedAt;
  visual.animateUnitEffects(attackStart + E.Config.visualEffects.unitAttackDuration * 500);
  assert.ok(figure.rotation.x > E.Config.visualEffects.unitAttackTilt * 0.95, "La figurine bascule vers l'avant au milieu de l'attaque.");
  visual.animateUnitEffects(attackStart + E.Config.visualEffects.unitAttackDuration * 1000 + 1);
  assert.equal(figure.rotation.x, 0, "La figurine revient debout après le coup.");

  clock = 2000;
  unit.visualHitTimer = E.Config.visualEffects.unitHitFlashDuration;
  unit.visualHitSequence = 1;
  visual.updateUnits(state);
  figure = visual.models.get("unit-91");
  const coloredMesh = figure.children.find((part) => part.material?.color);
  const original = coloredMesh.material.color.clone();
  const hitStart = figure.userData.hitStartedAt;
  visual.animateUnitEffects(hitStart + E.Config.visualEffects.unitHitFlashDuration * 100);
  assert.ok(coloredMesh.material.color.r > original.r, "Un coup augmente visiblement la composante rouge.");
  visual.animateUnitEffects(hitStart + E.Config.visualEffects.unitHitFlashDuration * 1000 + 1);
  assert.ok(colorDistance(coloredMesh.material.color, original) < 1e-9, "La couleur d'origine revient après le flash.");

  clock = 3000;
  state.units = [];
  state.unitDeathEffects = [{ ...unit, id: 7, unitId: 91, waterTransport: null, waterOwner: null }];
  visual.updateUnits(state);
  figure = visual.models.get("death-7");
  assert.ok(figure, "Le dernier modèle reste présent pour jouer la mort.");
  const deathStart = figure.userData.deathStartedAt;
  visual.animateUnitEffects(deathStart + E.Config.visualEffects.unitDeathDuration * 800);
  assert.ok(Math.abs(figure.rotation.z) > E.Config.visualEffects.unitDeathFallAngle * 0.95, "Le modèle tombe sur le côté.");
  const corpseMesh = figure.children.find((part) => part.material?.color);
  const base = new THREE.Color(corpseMesh.material.userData.visualBaseColor);
  const expected = base.clone().lerp(new THREE.Color(0xff1717), 0.7);
  assert.ok(colorDistance(corpseMesh.material.color, expected) < 1e-9, "Le cadavre est teinté à 70 % de rouge.");
  visual.animateUnitEffects(deathStart + E.Config.visualEffects.unitDeathDuration * 1000 + 1);
  assert.equal(visual.models.has("death-7"), false, "Le cadavre disparaît après l'animation.");

  console.log("3D combat animation tests passed (attack tilt, hit flash, red falling death).");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
