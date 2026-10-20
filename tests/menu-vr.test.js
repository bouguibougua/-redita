"use strict";

// Vraie géométrie Three.js, sessions et DOM simulés. Aucun suivi Quest mesuré.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

async function run() {
  const core = await import(`data:text/javascript;base64,${Buffer.from(read("js/vendor/three.core.js")).toString("base64")}`);

  function fixture({ secure = true, support = true } = {}) {
    let time = 1000;
    const observers = [];
    const textures = [];
    const stats = { requests: 0, clicks: [], immersive: false, visible: true, sessions: [], denied: false, rendererFailure: false };
    const repaint = () => observers.forEach((observer) => observer.fn());
    class Element {
      constructor(id, text = "", parent = null, attributes = {}) {
        this.id = id; this.textContent = text; this.parent = parent; this.attributes = attributes;
        this.hidden = false; this.disabled = false; this.isConnected = true; this.handlers = {};
        this.classes = new Set();
        this.classList = { contains: (name) => this.classes.has(name), add: (name) => this.classes.add(name), remove: (name) => this.classes.delete(name) };
      }
      getAttribute(name) { return this.attributes[name] ?? null; }
      addEventListener(name, fn) { this.handlers[name] = fn; }
      closest(selector) {
        for (let current = this; current; current = current.parent) {
          if (selector === "[hidden]" && current.hidden) return current;
        }
        return null;
      }
      matches(selectors) {
        return selectors.split(",").some((selector) => {
          const value = selector.trim();
          if (value.startsWith("#")) return this.id === value.slice(1);
          if (value === "[data-open-xr]") return this.attributes["data-open-xr"] !== undefined;
          return value === '[data-menu-screen="tutorial"]' && this.attributes["data-menu-screen"] === "tutorial";
        });
      }
      click() { stats.clicks.push(this.id); this.handlers.click?.(); repaint(); }
      focus() { stats.focus = this.id; }
      querySelectorAll() { return this.buttons || []; }
      querySelector(selector) { return this.selectors?.[selector] || null; }
    }
    const elements = Object.fromEntries(["main-menu", "menu-subscreen", "connection-screen", "menu-subcontent", "menu-subtitle", "menu-back", "connection-back", "menu-enter-vr", "menu-status", "room-code"].map((id) => [id, new Element(id)]));
    const main = elements["main-menu"], sub = elements["menu-subscreen"], connection = elements["connection-screen"];
    sub.hidden = connection.hidden = true;
    elements["menu-subcontent"].parent = sub;
    elements["menu-back"].parent = sub;
    elements["connection-back"].parent = connection;
    elements["room-code"].parent = connection;
    const showMain = () => { main.hidden = false; sub.hidden = true; connection.hidden = true; sub.classes.delete("legends-screen"); };
    elements["menu-back"].handlers.click = showMain;
    elements["connection-back"].handlers.click = showMain;
    main.buttons = [
      new Element("jouer", "JOUER", main, { "data-menu-screen": "play" }),
      new Element("legends", "LÉGENDES", main, { "data-menu-screen": "legends" }),
      new Element("tutorial", "TUTORIEL", main, { "data-menu-screen": "tutorial" }),
      new Element("mr", "RÉALITÉ MIXTE · QUEST 3", main, { "data-open-xr": "" })
    ];
    const training = new Element("training-button", "ENTRAÎNEMENT", elements["menu-subcontent"]);
    training.handlers.click = () => { main.hidden = sub.hidden = connection.hidden = true; };
    main.buttons[0].handlers.click = () => {
      main.hidden = true; sub.hidden = false;
      elements["menu-subtitle"].textContent = "Choisissez votre voie";
      elements["menu-subcontent"].buttons = [training];
    };
    const legendButtons = Array.from({ length: 9 }, (_, index) => new Element(`legend-${index}`, `Légende ${index + 1}`, elements["menu-subcontent"]));
    main.buttons[1].handlers.click = () => {
      main.hidden = true; sub.hidden = false; sub.classes.add("legends-screen");
      elements["menu-subtitle"].textContent = "Les légendes de Corse";
      elements["menu-subcontent"].buttons = legendButtons;
    };
    const document = {
      baseURI: "https://example.test/-redita/",
      querySelector: (selector) => elements[selector.slice(1)] || null,
      createElement: () => ({ width: 0, height: 0, getContext: () => ({ clearRect() {}, fillRect() {}, strokeRect() {}, fillText() {} }) })
    };
    const THREE = { ...core, TextureLoader: class { load(url, loaded) { textures.push(url); loaded(new core.Texture()); } } };
    const scene = new core.Scene(), camera = new core.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    const nodes = [new core.Group(), new core.Group()];
    const referenceSpace = new EventTarget();
    const renderer = { xr: {
      enabled: true, getController: (index) => nodes[index],
      setReferenceSpaceType() {}, getReferenceSpace: () => referenceSpace,
      async setSession() { if (stats.rendererFailure) throw new Error("Renderer session failure"); }
    } };
    class Session extends EventTarget {
      constructor() { super(); this.visibilityState = "visible"; this.ended = false; }
      async end() { this.ended = true; this.dispatchEvent(new Event("end")); }
    }
    const navigator = { xr: {
      async isSessionSupported() { return support; },
      requestSession(mode) {
        stats.requests++; stats.requestMode = mode;
        if (stats.denied) return Promise.reject(Object.assign(new Error("Denied"), { name: "NotAllowedError" }));
        const session = new Session(); stats.sessions.push(session); return Promise.resolve(session);
      }, addEventListener() {}
    } };
    const context = vm.createContext({ window: { isSecureContext: secure }, navigator, document, URL, console,
      performance: { now: () => time }, setTimeout, clearTimeout,
      getComputedStyle: () => ({ display: "block", visibility: "visible" }),
      MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { observers.splice(observers.indexOf(this), 1); } }
    });
    vm.runInContext(read("js/config.js"), context);
    const E = context.window.Eredita;
    E.MenuScene = { getContext: () => ({ THREE, renderer, scene, camera }), setImmersive: (value) => { stats.immersive = value; }, setVisible: (value) => { stats.visible = value; } };
    E.XR = { active: false };
    vm.runInContext(read("js/menu-vr.js"), context);
    const sources = ["right", "left"].map((handedness) => ({ handedness, profiles: ["meta-quest-touch-plus"], targetRaySpace: {}, gamepad: { mapping: "xr-standard", buttons: Array.from({ length: 6 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] } }));
    let viewer = { position: new core.Vector3(0, 1.6, 0), orientation: new core.Quaternion() };
    const matrices = new Map();
    const frame = { getViewerPose: () => viewer ? { transform: viewer } : null, getPose: (space) => matrices.has(space) ? { transform: { matrix: matrices.get(space).toArray() } } : null };
    const group = () => scene.getObjectByName("eredita-menu-vr");
    const row = (text) => group()?.children.find((mesh) => mesh.userData.menuVR?.text === text);
    const connect = () => nodes.forEach((node, index) => node.dispatchEvent({ type: "connected", data: sources[index] }));
    const aim = (text, index = 0) => {
      const target = row(text); assert.ok(target, `VR row exists: ${text}`);
      group().updateMatrixWorld(true);
      const origin = new core.Vector3(0, 1.6, 0);
      const direction = target.getWorldPosition(new core.Vector3()).sub(origin).normalize();
      const orientation = new core.Quaternion().setFromUnitVectors(new core.Vector3(0, 0, -1), direction);
      matrices.set(sources[index].targetRaySpace, new core.Matrix4().compose(origin, orientation, new core.Vector3(1, 1, 1)));
    };
    const step = (milliseconds = 250) => { time += milliseconds; E.MenuVR.update(time, frame); };
    const select = (text, index = 0) => { aim(text, index); step(); nodes[index].dispatchEvent({ type: "select" }); };
    return { E, stats, elements, main, sub, training, legendButtons, scene, camera, nodes, sources, frame, group, row, connect, aim, step, select, repaint, referenceSpace, textures, setViewer: (value) => { viewer = value; } };
  }

  const f = fixture();
  await f.E.MenuVR.checkSupport();
  assert.equal(f.elements["menu-enter-vr"].disabled, false);
  const starting = f.E.MenuVR.start();
  assert.equal(f.stats.requests, 1, "requestSession starts synchronously before the first await");
  await f.E.MenuVR.start();
  await starting;
  assert.equal(f.stats.requests, 1, "Duplicate starts share no second immersive session");
  assert.equal(f.stats.requestMode, "immersive-vr");
  f.connect(); f.step();
  assert.equal(f.E.MenuVR.active, true);
  assert.equal(f.group().position.z, -2.4);
  assert.equal(f.group().position.y, 1.6);
  const position = f.group().position.clone();
  f.setViewer({ position: new core.Vector3(2, 1.6, 0), orientation: new core.Quaternion() });
  f.step();
  assert.ok(f.group().position.equals(position), "Menu remains stable while the viewer moves");
  assert.ok(f.textures.every((url) => url === "https://example.test/-redita/assets/eredita-logo.png"), "Logo honors the GitHub Pages subpath");
  f.select("JOUER", 1);
  assert.equal(f.E.MenuVR.diagnostics.scope, "play", "Left-controller ray opens existing play navigation");
  assert.equal(f.stats.clicks.at(-1), "jouer");
  f.select("ENTRAÎNEMENT");
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.E.MenuVR.active, false);
  assert.equal(f.stats.clicks.at(-1), "training-button", "Preparation starts through the HTML handler after leaving VR");
  assert.equal(f.stats.immersive, false);
  assert.equal(f.scene.children.length, 0, "Menu meshes and both controller nodes are removed");
  assert.equal(f.camera.position.z, 5, "Desktop camera is restored");

  f.elements["menu-back"].click();
  await f.E.MenuVR.start(); f.connect(); f.step();
  f.select("LÉGENDES");
  assert.equal(f.E.MenuVR.diagnostics.pages, 2);
  f.select("→");
  assert.equal(f.E.MenuVR.diagnostics.page, 2);
  f.select("Légende 7");
  assert.equal(f.stats.clicks.at(-1), "legend-6", "Legend button invokes its own HTML handler");
  f.select("Retour");
  f.aim("JOUER"); f.step();
  const firstRow = f.row("JOUER");
  assert.equal(firstRow.userData.menuVR.hovered, true, "Controller hover paints the gold state");
  const session = f.stats.sessions.at(-1);
  session.visibilityState = "visible-blurred"; session.dispatchEvent(new Event("visibilitychange"));
  const clicksBefore = f.stats.clicks.length;
  f.nodes[0].dispatchEvent({ type: "select" });
  assert.equal(f.stats.clicks.length, clicksBefore, "Blurred sessions reject a stale controller selection");
  assert.equal(f.group().visible, false);
  session.visibilityState = "visible";
  f.setViewer(null); f.step(); f.nodes[0].dispatchEvent({ type: "select" });
  assert.equal(f.stats.clicks.length, clicksBefore, "Missing head tracking rejects stale selection");
  f.setViewer({ position: new core.Vector3(0, 1.6, 0), orientation: new core.Quaternion() }); f.step();
  assert.equal(f.group().visible, true);
  f.select("LÉGENDES");
  f.aim("Légende 1"); f.step();
  const beforeDuplicate = f.stats.clicks.length;
  f.nodes[0].dispatchEvent({ type: "select" });
  f.sources[0].gamepad.buttons[4].pressed = true; f.step(1);
  assert.equal(f.stats.clicks.length, beforeDuplicate + 1, "Select and simultaneous A produce one action");
  await f.E.MenuVR.end();
  assert.equal(f.stats.sessions.filter((item) => item.ended).length, 2, "Repeated sessions end cleanly");
  assert.equal(f.stats.visible, true, "Leaving VR from legends keeps the menu scene active for the visible HTML submenu");

  f.stats.denied = true;
  await f.E.MenuVR.start();
  assert.equal(f.E.MenuVR.active, false);
  assert.match(f.elements["menu-status"].textContent, /refusée/);
  f.stats.denied = false; f.stats.rendererFailure = true;
  await f.E.MenuVR.start();
  assert.equal(f.E.MenuVR.active, false);
  assert.equal(f.scene.children.length, 0, "A renderer failure releases scene and controller resources");
  assert.equal(f.stats.sessions.at(-1).ended, true);
  const unavailable = fixture({ secure: false });
  await unavailable.E.MenuVR.checkSupport(); await unavailable.E.MenuVR.start();
  assert.equal(unavailable.stats.requests, 0, "Insecure contexts never request VR");
  assert.equal(unavailable.elements["menu-enter-vr"].disabled, true);
  console.log("Menu VR : sessions, refus, nettoyage, stabilité, rayons, navigation, pagination et perte de suivi validés.");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
