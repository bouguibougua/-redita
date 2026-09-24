"use strict";
// Intégration navigateur avec vrai WebGL/Three.js et périphérique XR simulé.
// Ce test ne valide ni le passthrough réel ni le suivi physique du Quest.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const browserPath = process.env.EREDITA_BROWSER || (process.platform === "win32"
  ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  : process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "/usr/bin/chromium");
const root = path.resolve(__dirname, "..");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "eredita-xr-test-"));
const debugPort = 9447;
const port = 8787;
const server = spawn(process.execPath, ["server.js"], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: "ignore", windowsHide: true });
const browser = spawn(browserPath, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--window-size=1440,1100", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sockets = [];
let spawnError;
browser.on("error", (error) => { spawnError = error; });
server.on("error", (error) => { spawnError = error; });

async function connection(page) {
  const socket = new WebSocket(page.webSocketDebuggerUrl); sockets.push(socket);
  const pending = new Map(); const errors = []; let id = 0;
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id); pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id; pending.set(messageId, { resolve, reject }); socket.send(JSON.stringify({ id: messageId, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(`Condition non atteinte : ${expression}\n${JSON.stringify(errors)}`);
  };
  const click = async (selector) => {
    const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Bouton absent'); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
  };
  await send("Runtime.enable"); await send("Page.enable");
  return { send, evaluate, click, waitFor, errors };
}

// Injecté seulement dans la page de test, aucun faux support livré dans l'application.
function installXRFixture() {
  const E = window.Eredita;
  const { THREE, renderer } = E.Board3D.getXRContext();
  const fixture = window.xrFixture = { fail: null, sessions: [], sources: [], matrices: new Map(), cancelled: 0, anchorsDeleted: 0, requests: [], time: performance.now() };
  fixture.space = new EventTarget();
  fixture.viewer = new THREE.Vector3(0, 1.2, 0);
  const pose = (matrix) => {
    const position = new THREE.Vector3(), orientation = new THREE.Quaternion(); matrix.decompose(position, orientation, new THREE.Vector3());
    return { transform: { position, orientation, matrix: matrix.toArray() } };
  };
  fixture.frame = {
    getViewerPose: () => pose(new THREE.Matrix4().makeTranslation(...fixture.viewer.toArray())),
    getPose: (space) => fixture.matrices.has(space) ? pose(fixture.matrices.get(space)) : null,
    getHitTestResults: (hit) => {
      if (fixture.noHits) return [];
      const matrix = fixture.matrices.get(hit.space);
      if (!matrix) return [];
      const origin = new THREE.Vector3().setFromMatrixPosition(matrix);
      const direction = new THREE.Vector3(0, 0, -1).transformDirection(matrix);
      const point = new THREE.Ray(origin, direction).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.65), new THREE.Vector3());
      return point ? [{ getPose: () => pose(new THREE.Matrix4().makeTranslation(...point.toArray())) }] : [];
    },
    createAnchor: async (transform) => {
      const anchorSpace = {};
      fixture.matrices.set(anchorSpace, new THREE.Matrix4().compose(new THREE.Vector3().copy(transform.position), new THREE.Quaternion().copy(transform.orientation), new THREE.Vector3(1, 1, 1)));
      return { anchorSpace, delete() { fixture.anchorsDeleted++; fixture.matrices.delete(anchorSpace); } };
    }
  };
  fixture.step = () => { E.XR.update(fixture.time += 300, fixture.frame); };
  fixture.aim = (index, target) => {
    const origin = new THREE.Vector3(index ? -0.2 : 0.2, 1, -0.1);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(...target).sub(origin).normalize());
    const matrix = new THREE.Matrix4().compose(origin, quaternion, new THREE.Vector3(1, 1, 1));
    fixture.matrices.set(fixture.sources[index].targetRaySpace, matrix);
    fixture.matrices.set(fixture.sources[index].gripSpace, matrix);
    const node = renderer.xr.getController(index); node.position.copy(origin); node.quaternion.copy(quaternion); node.updateMatrixWorld(true);
  };
  fixture.trigger = (index = 0) => { fixture.step(); renderer.xr.getController(index).dispatchEvent({ type: "select" }); fixture.step(); };
  fixture.button = (action, index = 0) => {
    fixture.step();
    const mesh = fixture.panels.targets.find((target) => target.userData.xrTarget.action === action);
    if (!mesh) throw new Error(`Bouton XR absent : ${action}`);
    fixture.panels.group.updateMatrixWorld(true);
    fixture.aim(index, mesh.getWorldPosition(new THREE.Vector3()).toArray()); fixture.trigger(index);
  };
  const panelsCreate = E.XRPanels.create;
  E.XRPanels.create = (options) => (fixture.panels = panelsCreate(options));
  const interactionsCreate = E.XRInteractions.create;
  E.XRInteractions.create = (options) => (fixture.interactions = interactionsCreate(options));
  const placementCreate = E.XRPlacement.create;
  E.XRPlacement.create = (options) => (fixture.placement = placementCreate(options));
  renderer.xr.getReferenceSpace = () => fixture.space;
  renderer.xr.setSession = async () => {
    fixture.sources = ["right", "left"].map((handedness, index) => {
      const source = { handedness, targetRayMode: "tracked-pointer", profiles: ["meta-quest-touch-plus"], targetRaySpace: {}, gripSpace: {}, gamepad: { mapping: "xr-standard", axes: [0, 0, 0, 0], buttons: Array.from({length: 8}, () => ({pressed:false})) } };
      renderer.xr.getController(index).dispatchEvent({ type: "connected", data: source }); return source;
    });
    fixture.sources.forEach((_, index) => fixture.aim(index, [0, 0.65, -0.85]));
  };
  class Session extends EventTarget {
    constructor(options) { super(); this.mode = "immersive-ar"; this.visibilityState = "visible"; this.enabledFeatures = ["local", ...options.optionalFeatures]; }
    async requestHitTestSource(options) { return { space: options.space, cancel() { fixture.cancelled++; } }; }
    async end() {
      if (this.ended) return; this.ended = true;
      fixture.sources.forEach((_, index) => renderer.xr.getController(index).dispatchEvent({ type: "disconnected" }));
      this.dispatchEvent(new Event("end"));
    }
  }
  Object.defineProperty(navigator, "xr", { configurable: true, value: {
    isSessionSupported: async (mode) => mode === "immersive-ar", addEventListener() {},
    requestSession: async (mode, options) => {
      fixture.requests.push({ mode, options, activated: navigator.userActivation.isActive });
      if (fixture.fail) throw new DOMException("Test du refus", fixture.fail);
      const session = new Session(options); fixture.sessions.push(session); return session;
    }
  } });
}

async function run() {
  let pages;
  for (let i = 0; i < 100; i++) {
    if (spawnError) throw spawnError;
    try { pages = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((r) => r.json()); if (pages.length) break; } catch (_) {}
    await delay(100);
  }
  assert.ok(pages?.length, "Le navigateur sans fenêtre n'a pas ouvert son port de débogage.");
  const host = await connection(pages.find((page) => page.type === "page"));
  const { evaluate, click, waitFor } = host;
  await host.send("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  await waitFor("window.Eredita?.Board3D.ready");
  await click("#main-menu [data-open-xr]");
  await waitFor("document.querySelector('#xr-start').disabled && document.querySelector('#xr-status').textContent.includes('immersive-ar')");
  await click("#xr-close");
  assert.equal(await evaluate("document.querySelectorAll('[data-menu-screen]').length"), 3);
  await click('[data-menu-screen="play"]'); await click("#open-multiplayer"); await click("#create-online");
  await waitFor("Eredita.Network.mode === 'host'");
  const room = await evaluate("Eredita.Network.roomCode");
  const newPage = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
  const guest = await connection(newPage);
  await guest.send("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  await guest.waitFor("window.Eredita?.Board3D.ready");
  await guest.click('[data-menu-screen="play"]'); await guest.click("#open-multiplayer");
  await guest.evaluate(`document.querySelector('#room-code').value = '${room}'`); await guest.click("#join-online");
  await guest.waitFor("Eredita.Network.mode === 'guest'");
  await host.send("Page.bringToFront");
  await click("#continue-online");
  await click('[data-setup-action="keep"][data-player="red"]');
  await guest.click('[data-setup-action="keep"][data-player="blue"]');
  await waitFor("!document.querySelector('#start-game').disabled"); await click("#start-game");
  await guest.waitFor("Eredita.GameView.getState().phase === 'running'");
  assert.equal(await evaluate("document.querySelectorAll('[data-village-select]').length"), 8);
  await click("#pause-game");
  await guest.waitFor("Eredita.GameView.getState().paused");
  const originalState = await evaluate("JSON.stringify(Eredita.GameView.getState())");
  await evaluate(`(${installXRFixture.toString()})()`);
  await click("#game-screen [data-open-xr]");
  await waitFor("!document.querySelector('#xr-start').disabled");
  await evaluate("xrFixture.fail = 'NotAllowedError'"); await click("#xr-start");
  await waitFor("document.querySelector('#xr-status').textContent.includes('Autorisation refusée')");
  assert.equal(await evaluate("Eredita.XR.active"), false);
  await evaluate("xrFixture.fail = null"); await click("#xr-start");
  await waitFor("Eredita.XR.active && !document.querySelector('#xr-dialog').open");
  await evaluate("xrFixture.step()"); await delay(50); await evaluate("xrFixture.step()");
  assert.equal(await evaluate("Eredita.Board3D.getXRContext().scene.background"), null);
  assert.equal(await evaluate("xrFixture.requests.at(-1).activated"), true);
  assert.equal(await evaluate("xrFixture.requests.at(-1).mode"), "immersive-ar");
  assert.equal(await evaluate("xrFixture.placement.candidate !== null"), true);
  await evaluate("xrFixture.trigger(0)");
  assert.equal(await evaluate("Eredita.XR.diagnostics.placed"), true);
  assert.equal(await evaluate("Eredita.XR.diagnostics.width"), 0.8);
  assert.equal(await evaluate("JSON.stringify(Eredita.GameView.getState())"), originalState, "Placer le plateau ne modifie pas la simulation");
  await evaluate("xrFixture.step()"); await delay(20); await evaluate("xrFixture.step()");
  assert.equal(await evaluate("Eredita.XR.diagnostics.anchored"), true);
  await evaluate(`(() => { const {THREE,scene} = Eredita.Board3D.getXRContext(); scene.updateMatrixWorld(true); const target=xrFixture.interactions.targets.find(t=>t.userData.xrTarget.playerId==='red'&&t.userData.xrTarget.lane===2); xrFixture.aim(1,target.getWorldPosition(new THREE.Vector3()).toArray()); xrFixture.trigger(1); })()`);
  assert.deepEqual(await evaluate("Eredita.GameView.getState().selectedVillage"), {playerId:"red",lane:2});
  assert.deepEqual(await evaluate("Eredita.XR.diagnostics.selected"), {playerId:"red",lane:2});
  await evaluate("xrFixture.button('close', 1)");
  assert.equal(await evaluate("Eredita.XR.diagnostics.selected"), null);
  await evaluate("xrFixture.button('move')");
  assert.equal(await evaluate("Eredita.XR.diagnostics.manipulation"), "move");
  const before = await evaluate("Eredita.Board3D.getXRContext().world.parent.position.toArray()");
  await evaluate("xrFixture.button('right')");
  assert.notDeepEqual(await evaluate("Eredita.Board3D.getXRContext().world.parent.position.toArray()"), before);
  await evaluate("xrFixture.button('rotate'); xrFixture.button('rotate-right')");
  await evaluate("xrFixture.button('size'); xrFixture.button('grow')");
  assert.ok(await evaluate("Eredita.XR.diagnostics.width > 0.8"));
  await evaluate("xrFixture.button('done')");
  assert.equal(await evaluate("Eredita.XR.diagnostics.manipulation"), null);
  // B ferme le panneau ; aucun index système n'est lu.
  await evaluate(`(() => { const {THREE,scene}=Eredita.Board3D.getXRContext(); scene.updateMatrixWorld(true); xrFixture.aim(0,xrFixture.interactions.targets[0].getWorldPosition(new THREE.Vector3()).toArray()); xrFixture.trigger(); xrFixture.sources[0].gamepad.buttons[5].pressed=true; xrFixture.step(); })()`);
  assert.equal(await evaluate("Eredita.XR.diagnostics.selected"), null);
  await evaluate("xrFixture.sources[0].gamepad.buttons[5].pressed=false; xrFixture.step(); xrFixture.button('recenter'); xrFixture.button('manual'); xrFixture.aim(0,[0,0.65,-0.85]); xrFixture.step(); xrFixture.trigger()");
  assert.equal(await evaluate("Eredita.XR.diagnostics.placed && Eredita.XR.diagnostics.manual"), true);
  await evaluate("xrFixture.button('exit')"); await waitFor("!Eredita.XR.active");
  assert.equal(await evaluate("Eredita.Board3D.getXRContext().world.parent === Eredita.Board3D.getXRContext().scene"), true);
  assert.equal(await evaluate("Eredita.Board3D.getXRContext().world.scale.x"), 1);
  assert.equal(await evaluate("Eredita.Board3D.getXRContext().scene.children.some(c=>c.name.startsWith('xr-'))"), false);
  assert.ok(await evaluate("xrFixture.cancelled >= 2 && xrFixture.anchorsDeleted >= 1"));
  await click("#toggle-board-view"); assert.equal(await evaluate("Eredita.Board3D.enabled"), false);
  await click("#toggle-board-view"); assert.equal(await evaluate("Eredita.Board3D.enabled"), true);
  // Simulation et synchronisation restent actives pendant AR.
  await click("#pause-game");
  await click("#game-screen [data-open-xr]"); await waitFor("!document.querySelector('#xr-start').disabled");
  await evaluate("document.querySelector('#xr-manual-only').checked = true"); await click("#xr-start");
  await waitFor("Eredita.XR.active");
  const time = await evaluate("Eredita.GameView.getState().elapsed");
  assert.equal(await evaluate("Eredita.GameView.getState().paused"), false);
  await waitFor(`Eredita.GameView.getState().elapsed > ${time}`);
  await guest.waitFor(`Eredita.GameView.getState().elapsed > ${time}`);
  await evaluate("xrFixture.step(); xrFixture.button('exit')"); await waitFor("!Eredita.XR.active");
  assert.equal(await evaluate("Eredita.Network.roomCode"), room);
  assert.equal(await guest.evaluate("Eredita.Network.roomCode"), room);
  // Le joueur invité peut également entrer en AR et observe toujours les snapshots hôte.
  await guest.evaluate(`(${installXRFixture.toString()})()`);
  await guest.send("Page.bringToFront");
  await guest.click("#game-screen [data-open-xr]"); await guest.waitFor("!document.querySelector('#xr-start').disabled");
  await guest.evaluate("document.querySelector('#xr-manual-only').checked = true"); await guest.click("#xr-start");
  await guest.waitFor("Eredita.XR.active");
  await guest.evaluate("xrFixture.step(); xrFixture.trigger()");
  assert.equal(await guest.evaluate("Eredita.XR.diagnostics.placed"), true);
  assert.ok(await guest.evaluate("Math.abs(Eredita.Board3D.getXRContext().world.parent.rotation.y) < 0.01"), "Orientation initiale du joueur Bleu");
  await host.send("Page.bringToFront");
  await evaluate("Eredita.GameView.selectVillage('red',0)");
  await click('[data-build="bergerie"]');
  await guest.waitFor("Eredita.GameView.villageInfo('red',0).buildings.includes('bergerie T1')");
  await guest.evaluate("xrFixture.step(); xrFixture.button('exit')"); await guest.waitFor("!Eredita.XR.active");
  assert.deepEqual(host.errors, []); assert.deepEqual(guest.errors, []);
  console.log("Navigateur : menu, refus WebXR, vrais raycasts/boutons 3D, placement, manipulation, deux mains, fermeture, 2D/3D et salon hôte/invité valides. Périphérique XR simulé.");
}
run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  sockets.forEach((socket) => socket.close()); browser.kill(); server.kill();
  await delay(500);
  const tempRoot = path.resolve(os.tmpdir()); const resolved = path.resolve(profile);
  if (resolved.startsWith(`${tempRoot}${path.sep}`) && path.basename(resolved).startsWith("eredita-xr-test-")) {
    try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (_) { /* Profil encore verrouillé par le navigateur. */ }
  }
});
