"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function run() {
  const root = path.resolve(__dirname, "..");
  const threeSource = fs.readFileSync(path.join(root, "js/vendor/three.core.js"), "utf8");
  const THREE = await import(`data:text/javascript;base64,${Buffer.from(threeSource).toString("base64")}`);
  const context = vm.createContext({ window: {}, console });
  vm.runInContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), context);
  // Exercise the real renderer's model lifecycle without a WebGL/browser dependency.
  const source = fs.readFileSync(path.join(root, "js/board3d.js"), "utf8").replace(
    "  E.Board3D = {",
    "  E.AppearanceTest = { useThree(module) { THREE = module; unitGroup = new THREE.Group(); }, personModel, updateUnits, get models() { return unitModels; } };\n  E.Board3D = {"
  );
  vm.runInContext(source, context);
  const renderer = context.window.Eredita.AppearanceTest;
  renderer.useThree(THREE);

  const professionParts = {
    habitant: "sac-habitant", agriculteur: "chapeau-paille", berger: "houlette-courbe",
    pecheur: "canne-peche", chasseur: "arc", guerrier: "bouclier", ravageur: "hache-lame"
  };
  for (const [profession, identifier] of Object.entries(professionParts)) {
    for (const tool of [null, "bois", "bronze", "fer"]) {
      for (const armor of [null, "cuir", "maille", "fer"]) {
        const model = renderer.personModel("red", profession, tool, armor);
        assert.ok(model.getObjectByName(identifier), `Silhouette absente : ${profession}`);
        if (armor) assert.ok(model.getObjectByName(`armure-${armor}`));
        model.traverse((part) => {
          assert.ok([part.position.x, part.position.y, part.position.z].every(Number.isFinite));
          if (part.geometry) {
            part.geometry.computeBoundingSphere();
            assert.ok(Number.isFinite(part.geometry.boundingSphere.radius));
            part.geometry.dispose();
            part.material.dispose();
          }
        });
      }
    }
  }

  const resident = (id, profession, mission, extra = {}) => ({ id, profession, mission, tool: null, armor: null, ...extra });
  const farmer = resident(1, "agriculteur", "disponible");
  const fighter = resident(2, "berger", "attaque", { unitId: 7, tool: "bronze", armor: "cuir" });
  const fisher = resident(3, "pecheur", "peche");
  const hunter = resident(4, "habitant", "chasse", { workPosition: 20, workLaneOffset: 0.2 });
  const state = {
    units: [{ id: 7, residentId: 2, ownerId: "red", originLane: 0, lanePosition: 0, position: 45, hp: 50, role: "habitant", waterTransport: "barque" }],
    players: { red: { id: "red", villages: [{ lane: 0, biome: "littoral", residents: [farmer, fighter, fisher, hunter] }] } }
  };
  renderer.updateUnits(state);
  assert.equal(renderer.models.size, 4, "Chaque habitant apparaît une seule fois, combat compris.");
  assert.equal(renderer.models.get("unit-7").userData.profession, "berger", "La profession reste visible pendant une mission de combat non spécialisée.");
  assert.equal(renderer.models.get("unit-7").userData.waterTransport, "barque");
  assert.equal(renderer.models.get("resident-red-4").userData.profession, "habitant", "Une mission chasse ne crée pas le métier Chasseur.");
  assert.ok(renderer.models.get("resident-red-3").position.z < -2, "Le pêcheur reste sur le rivage terrestre.");

  const idleModel = renderer.models.get("resident-red-1");
  farmer.mission = "agriculture";
  farmer.workPosition = 10;
  renderer.updateUnits(state);
  assert.equal(renderer.models.get("resident-red-1"), idleModel, "Changer de mission conserve le modèle du métier.");
  farmer.tool = "fer";
  renderer.updateUnits(state);
  const equippedModel = renderer.models.get("resident-red-1");
  assert.notEqual(equippedModel, idleModel, "Le modèle est renouvelé à l'équipement d'un outil.");
  farmer.armor = "maille";
  renderer.updateUnits(state);
  assert.notEqual(renderer.models.get("resident-red-1"), equippedModel, "Le modèle est renouvelé à l'équipement d'une armure.");
  assert.ok(renderer.models.get("resident-red-1").getObjectByName("armure-maille"));

  const boatModel = renderer.models.get("unit-7");
  state.units[0].waterTransport = null;
  renderer.updateUnits(state);
  assert.notEqual(renderer.models.get("unit-7"), boatModel, "Débarquer enlève le bateau du modèle.");
  state.units = [];
  fighter.unitId = null;
  fighter.mission = "disponible";
  renderer.updateUnits(state);
  assert.equal(renderer.models.size, 4);
  assert.ok(!renderer.models.has("unit-7"));
  assert.equal(renderer.models.get("resident-red-2").userData.tool, "bronze");

  state.players.red.villages[0].destroyed = true;
  renderer.updateUnits(state);
  assert.equal(renderer.models.size, 0, "Les figurines locales sont retirées après destruction du village.");
  console.log("3D appearance tests passed (profession silhouettes, equipment, transports, local residents).");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
