"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function run() {
  const rootPath = path.resolve(__dirname, "..");
  const read = (file) => fs.readFileSync(path.join(rootPath, file), "utf8");
  const THREE = await import(`data:text/javascript;base64,${Buffer.from(read("js/vendor/three.core.js")).toString("base64")}`);
  const context = vm.createContext({ window: {}, console, performance,
    XRRigidTransform: class { constructor(position, orientation) { this.position = position; this.orientation = orientation; } }
  });
  ["config", "biomes", "board", "transport", "game-view", "xr-input", "xr-placement", "xr-interactions"].forEach((name) => vm.runInContext(read(`js/${name}.js`), context));
  const E = context.window.Eredita;
  const cfg = E.Config.xr;
  let state = E.Board.createState();
  const calls = [];
  E.Network = { playerId: "blue" };
  E.GameView.init({ getState: () => state, controller: { selectVillage: (...args) => calls.push(args) } });
  assert.equal(E.GameView.getPlayerId(), "blue");
  state.players.blue.villages[1].resources.lait = 17;
  assert.equal(E.GameView.villageInfo("blue", 1).resources.find((r) => r.label === "Lait").amount, 17);
  state = E.Board.createState(); // Le réseau remplace réellement sa référence d'état.
  state.players.blue.villages[1].hp = 123;
  assert.equal(E.GameView.villageInfo("blue", 1).hp, 123);
  assert.equal(E.GameView.selectVillage("blue", 1), true);
  assert.equal(E.GameView.selectVillage("missing", 1), false);
  assert.deepEqual(calls, [["blue", 1]]);
  const cards = E.GameView.createCardTargeting();
  assert.equal(cards.activate("ble"), false, "Aucune règle de carte inventée");
  assert.equal(cards.confirm({}), false);

  const source = (hand, profiles = ["meta-quest-touch-plus"], mapping = "xr-standard") => ({
    handedness: hand, profiles, targetRayMode: "tracked-pointer", targetRaySpace: {}, gripSpace: {},
    gamepad: { mapping, axes: [0, 0, 0, 0], buttons: Array.from({ length: 8 }, () => ({ pressed: false })) }
  });
  assert.equal(E.XRInput.mapping(source("right")).confirm, 4);
  assert.equal(E.XRInput.mapping(source("right")).cancel, 5);
  assert.equal(E.XRInput.mapping(source("left")).confirm, null);
  assert.equal(E.XRInput.mapping(source("right", ["unknown"])).confirm, null);
  assert.equal(E.XRInput.mapping(source("right", [], "standard")), null);

  const poseAt = (position, quaternion = new THREE.Quaternion()) => ({ transform: {
    position, orientation: quaternion, matrix: new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1)).toArray()
  } });
  const scene = new THREE.Scene();
  const nodes = [new THREE.Group(), new THREE.Group()];
  const session = { visibilityState: "visible" };
  const input = E.XRInput.create({ THREE, scene, renderer: { xr: { getController: (index) => nodes[index] } }, session });
  const right = source("right"); const left = source("left");
  // Inversion volontaire de l'ordre des connexions : les mains viennent de handedness.
  nodes[0].dispatchEvent({ type: "connected", data: right });
  nodes[1].dispatchEvent({ type: "connected", data: left });
  const trackingFrame = { getPose: () => poseAt(new THREE.Vector3(0, 1, 0)) };
  input.update(trackingFrame, {});
  right.gamepad.buttons[4].pressed = true;
  input.update(trackingFrame, {});
  assert.equal(input.drain()[0].record.source.handedness, "right");
  input.update(trackingFrame, {});
  assert.equal(input.drain().length, 0, "A maintenu ne répète pas la commande");
  left.gamepad.buttons[7].pressed = true;
  input.update(trackingFrame, {});
  assert.equal(input.drain().length, 0, "Le bouton système n'est jamais lié");
  nodes[1].dispatchEvent({ type: "select" });
  assert.equal(input.drain().length, 1, "La gâchette fonctionne sur la main gauche");
  nodes[1].dispatchEvent({ type: "select" });
  nodes[1].dispatchEvent({ type: "disconnected" });
  assert.equal(input.drain().length, 0, "Aucune action d'un contrôleur disparu");
  session.visibilityState = "hidden";
  nodes[0].dispatchEvent({ type: "select" });
  assert.equal(input.drain().length, 0);
  input.dispose();

  const viewer = { position: new THREE.Vector3(0, 1.2, 0), quaternion: new THREE.Quaternion() };
  const point = new THREE.Vector3(0, 0.65, -0.85);
  const record = { source: right, tracked: true, position: new THREE.Vector3(0.2, 1, -0.1), gripPosition: new THREE.Vector3(0.2, 1, -0.1), axes: [0, 0], squeezing: false };
  record.direction = point.clone().sub(record.position).normalize();
  function placement(playerId, manualOnly, extra = {}) {
    const root = new THREE.Group(); scene.add(root);
    const messages = [];
    const api = E.XRPlacement.create({ THREE, scene, root, session: extra, playerId, manualOnly, status: (message) => messages.push(message) });
    return { api, root, messages };
  }
  const manual = placement("red", true);
  manual.api.update({}, {}, [record], viewer, 0);
  assert.equal(manual.root.visible, true);
  assert.ok(manual.root.position.distanceTo(point) < 1e-9);
  assert.equal(manual.api.width, cfg.initialWidth);
  const redSide = new THREE.Vector3(0, 0, -1).applyQuaternion(manual.root.quaternion);
  assert.ok(redSide.z > 0.99, "Les villages rouges sont du côté initial du joueur rouge");
  assert.equal(manual.api.confirm(record), true);
  manual.api.beginManipulation();
  for (let i = 0; i < 80; i++) manual.api.adjust("grow", viewer);
  assert.ok(Math.abs(manual.api.width - cfg.maxWidth) < 1e-9);
  for (let i = 0; i < 100; i++) manual.api.adjust("shrink", viewer);
  assert.ok(Math.abs(manual.api.width - cfg.minWidth) < 1e-9);
  for (let i = 0; i < 100; i++) manual.api.adjust("back", viewer);
  assert.ok(Math.hypot(manual.root.position.x, manual.root.position.z) >= cfg.minDistance - 1e-9);
  for (let i = 0; i < 100; i++) manual.api.adjust("forward", viewer);
  assert.ok(Math.hypot(manual.root.position.x, manual.root.position.z) <= cfg.maxDistance + 1e-9);
  record.squeezing = true;
  manual.api.manipulate([record], viewer, 0.02);
  const oldX = manual.root.position.x;
  record.gripPosition.x += 0.1;
  manual.api.manipulate([record], viewer, 0.02);
  assert.ok(manual.root.position.x > oldX, "Une préhension déplace le groupe");
  record.squeezing = false;
  manual.root.position.copy(point); manual.root.scale.setScalar(cfg.initialWidth / cfg.boardWidth);
  const second = { ...record, source: left, squeezing: true, gripPosition: new THREE.Vector3(-0.2, 1, -0.1) };
  record.squeezing = true; record.gripPosition.set(0.2, 1, -0.1);
  manual.api.manipulate([record, second], viewer, 0.02);
  record.gripPosition.x = 0.3; second.gripPosition.x = -0.3;
  manual.api.manipulate([record, second], viewer, 0.02);
  assert.ok(Math.abs(manual.api.width - 1.2) < 1e-9, "Deux préhensions redimensionnent proportionnellement");
  record.squeezing = false; second.squeezing = false;
  const oldRotation = manual.root.quaternion.clone();
  record.axes = [1, 0];
  manual.api.manipulate([record, second], viewer, 0.1);
  assert.ok(manual.root.quaternion.angleTo(oldRotation) > 0, "Le joystick droit tourne le plateau");
  record.axes = [0, 0];
  const saved = manual.root.position.clone();
  manual.api.beginPlacement();
  assert.equal(manual.api.cancelPlacement(), true);
  assert.ok(manual.root.position.equals(saved));
  manual.api.resetReference();
  assert.equal(manual.api.placed, false);
  assert.equal(manual.api.cancelPlacement(), false, "L'ancien repère n'est pas réutilisé après un reset");
  manual.api.dispose();

  let cancelled = 0; let deleted = 0; let anchorTransform;
  let hitPoint = point.clone(); let normal = new THREE.Quaternion(); let anchorPose = null;
  const hitSource = { cancel() { cancelled++; } };
  const detected = placement("blue", false, {
    enabledFeatures: ["hit-test", "anchors"], requestHitTestSource: async (options) => {
      assert.equal(options.space, right.targetRaySpace); return hitSource;
    }
  });
  const hitFrame = {
    getHitTestResults: () => [{ getPose: () => poseAt(hitPoint, normal) }],
    getPose: () => anchorPose,
    createAnchor: async (transform) => { anchorTransform = transform; return { anchorSpace: {}, delete() { deleted++; } }; }
  };
  detected.api.update(hitFrame, {}, [record], viewer, 0);
  await Promise.resolve();
  normal.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  detected.api.update(hitFrame, {}, [record], viewer, 16);
  assert.equal(detected.root.visible, false, "Un mur ne peut pas accueillir le plateau");
  normal.identity(); hitPoint.set(0, 0.65, -10);
  detected.api.update(hitFrame, {}, [record], viewer, 32);
  assert.equal(detected.root.visible, false, "Un résultat éloigné est rejeté");
  hitPoint.copy(point);
  detected.api.update(hitFrame, {}, [record], viewer, 48);
  assert.equal(detected.root.visible, true);
  const blueSide = new THREE.Vector3(0, 0, 1).applyQuaternion(detected.root.quaternion);
  assert.ok(blueSide.z > 0.99, "Les villages bleus sont proches du joueur invité");
  assert.equal(detected.api.confirm(record), true);
  detected.api.update(hitFrame, {}, [record], viewer, 64);
  await Promise.resolve();
  assert.ok(anchorTransform, "Une ancre est demandée dans l'image suivante");
  anchorPose = poseAt(point.clone().add(new THREE.Vector3(0.01, 0, 0)), detected.root.quaternion.clone());
  detected.api.update(hitFrame, {}, [record], viewer, 80);
  assert.equal(detected.api.anchorTracked, true);
  assert.ok(Math.abs(detected.root.position.x - 0.01) < 1e-9);
  anchorPose = null;
  detected.api.update(hitFrame, {}, [record], viewer, 96);
  assert.equal(detected.root.visible, false, "Une ancre perdue masque le plateau au lieu de le téléporter");
  detected.api.dispose();
  assert.equal(cancelled, 1); assert.equal(deleted, 1);

  let lateResolve; let lateCancelled = false;
  const late = placement("red", false, { requestHitTestSource: () => new Promise((resolve) => { lateResolve = resolve; }) });
  late.api.update(hitFrame, {}, [record], viewer, 0);
  late.api.dispose(); lateResolve({ cancel() { lateCancelled = true; } });
  await Promise.resolve(); assert.equal(lateCancelled, true, "Une source arrivée après la fermeture est libérée");

  // Géométrie du véritable plateau, pas une seconde carte de test.
  vm.runInContext(read("js/board3d.js").replace("  E.Board3D = {", `
    E.XRBoardTest = { build(module, state) {
      THREE = module; scene = new THREE.Scene(); world = new THREE.Group(); terrainGroup = new THREE.Group();
      world.add(terrainGroup); scene.add(world); addBoardBase();
      Object.values(state.players).forEach(p => p.villages.forEach(terrainTile));
      return { scene, world, terrainGroup };
    } };
    E.Board3D = {`), context);
  const board = E.XRBoardTest.build(THREE, state);
  assert.equal(board.terrainGroup.children.length, 8);
  assert.equal(board.world.children.length, 3, "Socle, bordure et terrains partagent world");
  const panels = { group: new THREE.Group(), targets: [], highlight() {} }; panels.group.visible = false;
  const interactions = E.XRInteractions.create({ THREE, ...board, panels });
  interactions.sync(); assert.equal(interactions.targets.length, 8);
  board.world.scale.setScalar(cfg.initialWidth / cfg.boardWidth);
  board.world.rotation.y = 0.7;
  board.scene.updateMatrixWorld(true);
  const target = interactions.targets[0];
  const center = target.getWorldPosition(new THREE.Vector3());
  const hit = interactions.hit({ position: center.clone().add(new THREE.Vector3(0, 1, 0)), direction: new THREE.Vector3(0, -1, 0) }, true);
  assert.equal(hit.object.userData.xrTarget.playerId, "red");
  assert.equal(interactions.hit({ position: center.clone().add(new THREE.Vector3(0, 1, 0)), direction: new THREE.Vector3(0, -1, 0) }, false), null);
  let slotCount = 0;
  board.terrainGroup.traverse((item) => { if (item.userData.xrTarget?.kind === "slot") slotCount++; });
  assert.equal(slotCount, Object.values(state.players).flatMap((p) => p.villages).reduce((count, v) => count + v.slots.length, 0));
  interactions.dispose();
  console.log("XR : état partagé, profils, gâchettes, limites, orientation, hit-test, ancres, nettoyage et Raycaster validés (API XR simulée, Three.js réel).");
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
