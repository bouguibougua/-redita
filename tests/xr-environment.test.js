"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

async function run() {
  const core = await import(`data:text/javascript;base64,${Buffer.from(read('js/vendor/three.core.js')).toString('base64')}`);
  const requests = [];
  const THREE = { ...core, TextureLoader: class { load(url, done, progress, fail) { requests.push({url, done, fail}); } } };
  const context = vm.createContext({ window: {}, document: { createElement: () => ({ width: 512, height: 512,
    getContext: () => ({ fillRect() {}, strokeRect() {} }) }) } });
  vm.runInContext(read('js/config.js'), context); vm.runInContext(read('js/xr-environment.js'), context);
  const E = context.window.Eredita, cfg = E.Config.xr.environment;
  const scene = new THREE.Scene();
  const env = E.XREnvironment.create({ THREE, scene });
  const viewer = { position: new THREE.Vector3(0, 1.65, 0), quaternion: new THREE.Quaternion() };
  env.update(viewer, true, 1);
  assert.equal(env.diagnostics.visible, false, 'No empty environment before texture readiness');
  requests.find(request => request.url === cfg.panorama).done(new THREE.Texture());
  requests.find(request => request.url === cfg.groundTexture).done(new THREE.Texture());
  env.update(viewer, false, 1);
  assert.equal(env.diagnostics.visible, false, 'Passthrough stays visible during placement');
  env.update(viewer, true, cfg.fadeSeconds / 2);
  assert.equal(env.diagnostics.opacity, .5, 'Environment fades in during preparation');
  assert.equal(env.diagnostics.floorY, 0, 'Fallback ground is below the feet, not at eye height');
  env.update(viewer, true, cfg.fadeSeconds);
  assert.equal(env.diagnostics.opacity, 1);
  scene.updateMatrixWorld(true);
  const sky = scene.getObjectByName('xr-panorama');
  const ray = new THREE.Raycaster(viewer.position, new THREE.Vector3(0, 0, -1));
  const front = ray.intersectObject(sky)[0];
  assert.ok(Math.abs(front.uv.x - .5) < .001 && Math.abs(front.uv.y - .5) < .001, 'Panorama is correctly oriented and upright');
  const ground = scene.getObjectByName('xr-stone-ground');
  assert.ok(sky.renderOrder < ground.renderOrder && ground.renderOrder < 0, 'Transparent floor renders after sky and before UI');
  const down = new THREE.Raycaster(viewer.position, new THREE.Vector3(0, -1, 0));
  assert.ok(down.intersectObject(ground).length, 'A stone floor is visible directly beneath the viewer');
  viewer.position.x = 2; env.update(viewer, true, .1);
  assert.equal(env.group.position.x, 0, 'Environment stays anchored when the head moves');
  env.update(viewer, false, .1); assert.equal(env.diagnostics.visible, false, 'Passthrough returns immediately for replacement');
  env.dispose(); assert.equal(scene.children.length, 0, 'End of session disposes both background and ground');

  const floorSpace = {}, referenceSpace = {};
  const seated = E.XREnvironment.create({ THREE, scene, session: { requestReferenceSpace: async () => floorSpace }, panorama: false });
  seated.setReferenceSpace(referenceSpace); await Promise.resolve();
  seated.update({ position: new THREE.Vector3(0, .95, 0), orientation: new THREE.Quaternion() }, true, 0, { getPose: () => null });
  assert.equal(seated.diagnostics.floorKnown, false);
  seated.update({ position: new THREE.Vector3(0, .95, 0), orientation: new THREE.Quaternion() }, true, 0,
    { getPose: (a, b) => a === floorSpace && b === referenceSpace ? { transform: { position: { y: -.05 } } } : null });
  assert.equal(seated.diagnostics.floorY, -.05, 'Native floor reference supports a seated player');
  assert.equal(seated.diagnostics.floorKnown, true);
  seated.dispose();

  const boardScene = new THREE.Scene(), placed = new THREE.Group(), world = new THREE.Group();
  placed.position.set(.3, .65, -1.1); placed.rotation.y = .4; placed.scale.setScalar(.08);
  world.position.y = -E.Config.xr.boardBottom; placed.add(world); boardScene.add(placed);
  const support = E.XREnvironment.create({ THREE, scene: boardScene, world, panorama: false, getBoardDimensions: () => ({width: 13.65, depth: 11.05}) });
  viewer.position.set(0, 1.65, 0); support.update(viewer, true, 1);
  const altar = boardScene.getObjectByName('xr-stone-altar');
  assert.equal(support.diagnostics.altarVisible, true);
  assert.ok(Math.abs(support.diagnostics.altarTop - placed.position.y) < .00001, 'Altar touches the underside of the board');
  assert.ok(Math.abs(altar.scale.x - (13.65 * .08 + cfg.altar.widthMargin)) < .00001);
  assert.ok(Math.abs(altar.position.z - placed.position.z) < .00001);
  placed.position.set(-.6, .9, -.7); placed.rotation.y = 1.2; placed.scale.setScalar(.1);
  support.update(viewer, true, .1);
  assert.ok(Math.abs(support.diagnostics.altarTop - .9) < .00001, 'The pedestal follows height changes');
  assert.ok(Math.abs(altar.scale.x - (13.65 * .1 + cfg.altar.widthMargin)) < .00001, 'The pedestal follows resizing');
  assert.ok(altar.quaternion.angleTo(placed.quaternion) < .00001, 'The pedestal follows rotation');
  support.update(viewer, false, .1); assert.equal(support.diagnostics.altarVisible, false, 'No virtual altar in passthrough');
  support.dispose(); assert.equal(boardScene.getObjectByName('xr-stone-altar'), undefined);

  const late = E.XREnvironment.create({ THREE, scene }); late.dispose();
  const image = new THREE.Texture(); let released = false; image.addEventListener('dispose', () => { released = true; });
  requests.at(-1).done(image); assert.equal(released, true, 'Late image load is disposed after session end');
  assert.equal(scene.children.length, 0);
  console.log('Environnement XR : projection, sol, repère assis, transition, passthrough et nettoyage validés.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
