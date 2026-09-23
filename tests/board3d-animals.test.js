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
  const source = fs.readFileSync(path.join(root, "js/board3d.js"), "utf8").replace(
    "  E.Board3D = {",
    "  E.AnimalAppearanceTest = { useThree(module) { THREE = module; unitGroup = new THREE.Group(); }, animalModel, updateUnits, get models() { return unitModels; } };\n  E.Board3D = {"
  );
  vm.runInContext(source, context);
  const renderer = context.window.Eredita.AnimalAppearanceTest;
  renderer.useThree(THREE);

  for (const owner of ["red", "blue"]) {
    for (const type of ["chien", "sanglier", "ane"]) {
      const model = renderer.animalModel(owner, type);
      assert.equal(model.children.filter((part) => part.name.startsWith(`${type}-patte-`)).length, 4, `${type} possède quatre pattes.`);
      assert.ok(model.getObjectByName(`${type}-museau`));
      assert.ok(model.getObjectByName(`${type}-queue`));
      assert.ok(!model.getObjectByName("visage"), "Un animal ne réutilise pas la silhouette humaine.");
      if (type === "sanglier") {
        assert.ok(model.getObjectByName("sanglier-defense--1"));
        assert.ok(model.getObjectByName("sanglier-defense-1"));
        assert.ok(model.getObjectByName("sanglier-corps").scale.x > 0.1, "Le sanglier a une silhouette large.");
      }
      if (type === "ane") {
        assert.ok(model.getObjectByName("ane-panier--1"));
        assert.ok(model.getObjectByName("ane-panier-1"));
        assert.ok(model.getObjectByName("ane-oreille-1").geometry.parameters.height > 0.2, "L'âne possède de longues oreilles.");
      }
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

  const resident = { id: 1, profession: "agriculteur", mission: "disponible", donkey: false, unitId: null };
  const dog = { id: 1, type: "chien", mission: "disponible", hp: 40, unitId: null };
  const boar = { id: 2, type: "sanglier", mission: "disponible", hp: 80, unitId: null };
  const village = { lane: 0, biome: "littoral", residents: [resident], animals: [dog, boar] };
  const state = { units: [], players: { red: { id: "red", villages: [village] } } };
  renderer.updateUnits(state);
  assert.equal(renderer.models.size, 3, "Les animaux disponibles apparaissent au village avec les habitants.");
  assert.equal(renderer.models.get("animal-red-1").userData.animalType, "chien");
  assert.equal(renderer.models.get("animal-red-2").userData.animalType, "sanglier");

  const withoutDonkey = renderer.models.get("resident-red-1");
  resident.donkey = true;
  renderer.updateUnits(state);
  const withDonkey = renderer.models.get("resident-red-1");
  assert.notEqual(withDonkey, withoutDonkey, "Acheter l'âne renouvelle immédiatement l'apparence.");
  assert.ok(withDonkey.getObjectByName("animal-ane"));
  assert.equal(renderer.models.size, 3, "L'âne accompagne une personne sans créer une unité indépendante.");
  resident.mission = "agriculture";
  resident.workPosition = 23;
  renderer.updateUnits(state);
  assert.equal(renderer.models.get("resident-red-1"), withDonkey, "L'âne suit son habitant au travail.");
  assert.ok(Math.abs(withDonkey.position.z - (-4.35 + 23 / 100 * 8.7)) < 0.00001);

  resident.profession = "guerrier";
  resident.armor = "fer";
  resident.mission = "attaque";
  resident.unitId = 10;
  dog.unitId = 11;
  dog.mission = "attaque";
  boar.unitId = 12;
  boar.mission = "attaque";
  const unit = (id, extra) => ({ id, ownerId: "red", originLane: 0, lanePosition: 0, position: 42, hp: 40, ...extra });
  state.units = [
    unit(10, { residentId: 1, donkey: true, role: "guerrier" }),
    unit(11, { animalId: 1, animalType: "chien", role: "chien", waterTransport: "barque" }),
    unit(12, { animalId: 2, animalType: "sanglier", role: "sanglier", waterOwner: "red", hp: 80 })
  ];
  renderer.updateUnits(state);
  assert.equal(renderer.models.size, 3, "Les compagnons déployés ne sont pas dupliqués au village.");
  assert.ok(!renderer.models.has("animal-red-1"));
  assert.ok(!renderer.models.has("resident-red-1"));
  assert.ok(renderer.models.get("unit-10").getObjectByName("animal-ane"));
  assert.ok(renderer.models.get("unit-10").getObjectByName("bouclier"));
  assert.ok(renderer.models.get("unit-10").getObjectByName("armure-fer"));
  assert.ok(renderer.models.get("unit-11").getObjectByName("transport-barque"), "Le chien traverse dans une barque.");
  const swimmingBoar = renderer.models.get("unit-12");
  assert.ok(swimmingBoar.getObjectByName("sillage-nage"));
  assert.ok(!swimmingBoar.getObjectByName("transport-barque"));
  assert.equal(swimmingBoar.userData.swimming, true);
  assert.ok(swimmingBoar.position.y < renderer.models.get("unit-11").position.y, "Le sanglier est immergé pendant sa nage.");

  // A snapshot can arrive before the companion's local mission/unit link updates.
  dog.unitId = null;
  dog.mission = "disponible";
  renderer.updateUnits(state);
  assert.equal(renderer.models.size, 3);
  assert.ok(!renderer.models.has("animal-red-1"));
  dog.unitId = 11;
  dog.mission = "attaque";

  state.units[1].waterTransport = null;
  state.units[2].waterOwner = null;
  renderer.updateUnits(state);
  assert.ok(!renderer.models.get("unit-11").getObjectByName("transport-barque"));
  assert.notEqual(renderer.models.get("unit-12"), swimmingBoar);
  assert.ok(!renderer.models.get("unit-12").getObjectByName("sillage-nage"));
  assert.equal(renderer.models.get("unit-12").position.y, 0.2);

  village.residents = [];
  renderer.updateUnits(state);
  assert.ok(renderer.models.get("unit-10").getObjectByName("animal-ane"), "Le snapshot de l'unité conserve l'âne sans la fiche locale.");
  const doomed = renderer.models.get("unit-10");
  let companionDisposed = false;
  doomed.getObjectByName("ane-corps").geometry.addEventListener("dispose", () => { companionDisposed = true; });
  state.units[0].hp = 0;
  state.units[1].hp = 0;
  state.units[2].hp = 0;
  renderer.updateUnits(state);
  assert.equal(renderer.models.size, 0, "Les morts retirent habitants, ânes et animaux déployés.");
  assert.equal(doomed.parent, null);
  assert.ok(companionDisposed, "La géométrie de l'âne est libérée avec son habitant.");

  state.units = [];
  village.residents = [resident];
  resident.unitId = null;
  resident.mission = "disponible";
  dog.unitId = null;
  dog.mission = "disponible";
  boar.unitId = null;
  boar.mission = "disponible";
  renderer.updateUnits(state);
  assert.equal(renderer.models.size, 3, "Un retour vivant au village restaure les figurines locales.");
  village.animals = [dog];
  renderer.updateUnits(state);
  assert.ok(!renderer.models.has("animal-red-2"), "L'abattage retire la figurine du sanglier.");
  village.destroyed = true;
  renderer.updateUnits(state);
  assert.equal(renderer.models.size, 0, "La destruction du village retire ses habitants et compagnons locaux.");
  console.log("3D animal tests passed (quadrupeds, donkey attachment, deployment, transport, swimming, death).");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
