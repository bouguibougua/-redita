"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
async function run() {
  const read = name => fs.readFileSync(path.join(__dirname, "..", "js", name), "utf8");
  const THREE = await import(`data:text/javascript;base64,${Buffer.from(read("vendor/three.core.js")).toString("base64")}`);
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  function load(localStorage = storage) {
    const context = vm.createContext({ window: { localStorage }, performance,
      document: { createElement: () => ({ width: 0, height: 0, getContext: () => canvasContext() }) },
      Image: class { constructor() { this.complete = false; } } });
    ["config.js", "xr-design.js", "xr-dashboard.js"].forEach(name => vm.runInContext(read(name), context));
    return context.window.Eredita;
  }
  function canvasContext() {
    const noop = () => {}, c = { font: "32px sans-serif" };
    for (const name of ["beginPath", "roundRect", "fill", "stroke", "save", "restore", "setTransform", "clearRect", "moveTo", "lineTo", "arc", "translate", "scale", "bezierCurveTo", "quadraticCurveTo", "closePath", "clip", "drawImage", "fillText"]) c[name] = noop;
    c.measureText = text => ({ width: String(text).length * Number(c.font.match(/([\d.]+)px/)?.[1] || 32) * 0.52 });
    return c;
  }
  const E = load(), scene = new THREE.Scene(), renderer = { capabilities: { maxTextureSize: 2048, getMaxAnisotropy: () => 4 } };
  const dashboard = E.XRDashboard.create({ THREE, scene, renderer });
  const placement = E.XRDashboard.create({ THREE, scene, renderer });
  dashboard.paint("info", "Village Rouge 1", [
    "Montagne · Niveau 2",
    ...Array.from({ length: 9 }, (_, i) => ({ label: i < 3 ? "Population disponible" : "Ressource locale", value: "400 / 600", kind: "stat" }))
  ], [[["Échoppes du village", { type: "shop" }, true], ["Cultures et élevages", { type: "slots" }, true]]]);
  dashboard.paint("jobs", "Métiers à attribuer", ["Habitant 1"], [
    ...Array.from({ length: 8 }, (_, i) => [[`Métier ${i + 1}`, { type: "profession", index: i }, i !== 0, { icon: "person", detail: i ? "Attribuer · Disponible" : "Construisez d’abord le bâtiment requis dans ce village pour attribuer ce métier." }]])
  ], true, { pinnedRows: [[["À tous", { type: "all" }, true], ["Aux prochains", { type: "next" }, true]]] });
  dashboard.paint("buildings", "Bâtiments du village", ["1250 or global"], [
    [["Village principal", { type: "upgrade" }, true, { icon: "building", detail: "Améliorer · 200 or + 100 unités d’une même ressource locale" }],
     ["Bergerie", { type: "build" }, false, { icon: "building", detail: "Il faut 200 or global et un emplacement disponible pour construire cette bergerie." }]]
  ]);
  dashboard.paint("residents", "Habitants disponibles", [], [[
    ...Array.from({ length: 5 }, (_, i) => [`Habitant ${i + 1}`, { type: "resident", index: i }, true, { portrait: { src: "portrait.png" }, profession: "Agriculteur", status: "En défense", detail: "#123" }])
  ]]);
  placement.paint("placement", "Placement du plateau", ["Alignez le plateau sur votre vraie table."], [[["Confirmer", { type: "confirm" }, true]]]);
  assert.equal(dashboard.textScale, 1.2, "Le texte est plus grand dès la première entrée");
  const info = dashboard.getPanel("info").node;
  info.position.set(0.9, -0.1, 0.2); info.rotation.y = 0.4; info.scale.setScalar(1.3); info.userData.customLayout = true;
  const pose = info.matrix.clone(); info.updateMatrix(); pose.copy(info.matrix);
  for (let percent = 100; percent <= 180; percent += 10) {
    dashboard.setTextScale(percent / 100);
    assert.equal(placement.textScale, percent / 100, "Le placement applique aussi le réglage");
    info.updateMatrix(); assert.deepEqual(info.matrix, pose, "La taille du texte ne déplace ni n’agrandit la fenêtre");
    const found = new Set();
    for (const id of ["info", "jobs", "buildings", "residents"]) {
      const panel = dashboard.getPanel(id);
      do {
        assert.ok(panel.contentBottom <= panel.contentLimit + 1, `${id} à ${percent} % : contenu accessible sans déborder`);
        for (const rect of panel.visibleRects) {
          assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= panel.logicalWidth + 1 && rect.y + rect.h <= panel.logicalHeight + 1, "Chaque cible reste dans sa fenêtre");
          assert.ok(rect.h / panel.density >= 0.06, "Cible suffisamment haute pour le rayon");
        }
        if (id === "jobs") for (const mesh of panel.buttons) {
          const action = mesh.userData.xrTarget.action;
          if (action?.type === "profession") found.add(action.index);
        }
        assert.equal(panel.texture.minFilter, THREE.LinearMipmapLinearFilter);
        assert.ok(panel.canvas.width <= 2048 && panel.canvas.height <= 2048);
      } while (dashboard.navigate(id, 1));
    }
    assert.equal(found.size, 8, "Tous les métiers restent accessibles à chaque taille");
    const firstJobs = dashboard.getPanel("jobs");
    while (dashboard.navigate("jobs", -1)) {}
    assert.ok(firstJobs.buttons.some(mesh => mesh.userData.xrTarget.action?.type === "all"), "Action collective toujours visible");
    dashboard.syncTargets(); scene.updateMatrixWorld(true);
    const target = firstJobs.buttons.find(mesh => mesh.userData.xrTarget.action?.type === "all");
    const center = target.getWorldPosition(new THREE.Vector3());
    const ray = new THREE.Raycaster(center.clone().add(new THREE.Vector3(0, 0, 1)), new THREE.Vector3(0, 0, -1));
    assert.ok(ray.intersectObject(target).length, "La cible suit le bouton après changement de taille");
  }
  dashboard.setHighContrast(false); assert.equal(placement.highContrast, false);
  const restored = load(); assert.equal(restored.XRDesign.getPreferences().textScale, 1.8); assert.equal(restored.XRDesign.getPreferences().highContrast, false);
  dashboard.setTextScale(999); assert.equal(dashboard.textScale, 1.8);
  dashboard.setTextScale(NaN); assert.equal(dashboard.textScale, 1.8);
  const blocked = load({ getItem() { throw Error("refus"); }, setItem() { throw Error("refus"); } });
  assert.equal(blocked.XRDesign.getPreferences().textScale, 1.2);
  blocked.XRDesign.setPreferences({ textScale: 1.6 }); assert.equal(blocked.XRDesign.getPreferences().textScale, 1.6);
  const corrupt = load({ getItem: () => '{"textScale":null,"highContrast":"false"}', setItem() {} });
  assert.equal(corrupt.XRDesign.getPreferences().textScale, 1.2); assert.equal(corrupt.XRDesign.getPreferences().highContrast, true);
  const before = dashboard.getPanel("jobs").drawCount;
  const jobData = dashboard.getPanel("jobs").data;
  dashboard.paint("jobs", jobData.title, jobData.lines, jobData.rows, true, jobData.options);
  assert.equal(dashboard.getPanel("jobs").drawCount, before, "Un état inchangé ne redessine pas les textures");
  dashboard.dispose(); placement.dispose();
  assert.equal(scene.children.length, 0);
  console.log("Lisibilité XR : 100–180 %, pagination, grandes cibles, poses stables, réglage partagé, mémorisation et stockage refusé validés.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
