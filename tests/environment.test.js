"use strict";
// Génération procédurale du paysage PC : déterminisme, cohérence et raccords. Sans Three.js ni navigateur.
const assert = require("node:assert/strict");
global.window = {};
require("../js/config.js");
require("../js/terrain-generator.js");
const E = window.Eredita, G = E.TerrainGenerator, cfg = E.Config.environment3d;

function layout(red, blue, lanes = red.length, scale = lanes === 2 ? 1.15 : 1) {
  const regions = [], spacing = E.Config.board.laneSpacing * scale;
  for (let lane = 0; lane < lanes; lane++) {
    const cx = (lane - (lanes - 1) / 2) * spacing;
    regions.push({ cx, cz: -cfg.regionZ, hw: cfg.tileHalfWidth * scale, hd: cfg.tileHalfDepth, biome: red[lane], owner: "red", lane,
      water: { z0: -cfg.regionZ + cfg.waterStart, z1: -cfg.regionZ + cfg.waterEnd } });
    regions.push({ cx, cz: cfg.regionZ, hw: cfg.tileHalfWidth * scale, hd: cfg.tileHalfDepth, biome: blue[lane], owner: "blue", lane,
      water: { z0: cfg.regionZ - cfg.waterEnd, z1: cfg.regionZ - cfg.waterStart } });
  }
  return regions;
}
const field = (red, blue, seed = "s") => G.create({ regions: layout(red, blue), seed, waterLevel: cfg.waterLevel });

// 1. Même configuration + même graine = même relief ; une autre graine change le relief.
{
  const a = field(["plaine", "montagne"], ["littoral", "plaine"], "graine"), b = field(["plaine", "montagne"], ["littoral", "plaine"], "graine");
  const c = field(["plaine", "montagne"], ["littoral", "plaine"], "autre");
  let different = 0;
  for (let i = 0; i < 200; i++) {
    const x = -30 + i * 0.3, z = -25 + (i * 7 % 50);
    assert.equal(a.heightAt(x, z), b.heightAt(x, z), "terrain reproductible");
    if (Math.abs(a.heightAt(x, z) - c.heightAt(x, z)) > 0.01) different++;
  }
  assert.ok(different > 60, "la graine modifie le paysage");
  assert.equal(G.hashString("a"), G.hashString("a"));
  assert.notEqual(G.hashString("a"), G.hashString("b"));
}

// 2. Aucune valeur invalide sur une grande zone, pour de nombreuses configurations (biomes identiques côte à côte inclus).
const configs = [
  [["plaine", "plaine"], ["plaine", "plaine"]], [["montagne", "montagne"], ["montagne", "montagne"]], [["littoral", "littoral"], ["littoral", "littoral"]],
  [["plaine", "montagne"], ["littoral", "plaine"]], [["littoral", "montagne"], ["montagne", "littoral"]],
  [["plaine", "plaine", "montagne", "littoral"], ["littoral", "montagne", "plaine", "plaine"]], [["montagne", "montagne", "montagne", "montagne"], ["littoral", "littoral", "littoral", "littoral"]]
];
for (const [red, blue] of configs) {
  const f = field(red, blue, `${red}|${blue}`), out = {};
  for (let x = -70; x <= 70; x += 3.7) for (let z = -60; z <= 60; z += 3.9) {
    f.sample(x, z, out);
    assert.ok(Number.isFinite(out.h), `hauteur finie ${red}/${blue} @${x},${z}`);
    const sum = out.plain + out.mountain + out.coast;
    if (!out.inside) assert.ok(Math.abs(sum - 1) < 1e-6, "poids de biome normalisés");
    assert.ok(out.h > -4 && out.h < 48, `relief borné (${out.h})`);
  }
}

// 3. Les régions jouables restent cachées sous leurs modèles ; seule la frontière est visible.
{
  const f = field(["plaine", "littoral"], ["montagne", "plaine"]), out = {};
  f.sample(0, -2.5, out); assert.equal(out.inside, true); assert.ok(out.h < 0.05, "sol sous le modèle de région");
  f.sample(1.7, -0.02, out); assert.equal(out.inside, true);
}

// 4. Montagnes : massif plus haut qu'une plaine ; pente douce côté caméra (le plateau n'est jamais masqué).
{
  const mountain = field(["montagne", "montagne"], ["montagne", "montagne"], "m"), plain = field(["plaine", "plaine"], ["plaine", "plaine"], "m");
  let maxMountain = 0, maxPlain = 0, maxNear = 0;
  for (let x = -40; x <= 40; x += 1.5) for (let z = -40; z <= 40; z += 1.5) {
    maxMountain = Math.max(maxMountain, mountain.heightAt(x, z));
    if (plain.distanceToBoard(x, z) < 4) maxPlain = Math.max(maxPlain, plain.heightAt(x, z));
    if (Math.abs(z) < 6 && x < mountain.bounds.minX - 2 && x > mountain.bounds.minX - 6) maxNear = Math.max(maxNear, mountain.heightAt(x, z));
  }
  assert.ok(maxMountain > 6, `massif visible (${maxMountain.toFixed(1)})`);
  assert.ok(maxPlain < 3, `plaine presque plate (${maxPlain.toFixed(1)})`);
  assert.ok(maxNear < 2.2, `relief proche côté caméra limité (${maxNear.toFixed(1)})`);
}

// 4 bis. Toile de fond : un massif ferme l'horizon côté lointain, même sans région de montagne ; jamais côté caméra.
{
  const f = field(["plaine", "littoral"], ["plaine", "littoral"], "fond");
  let back = 0, front = 0;
  for (let z = -20; z <= 20; z += 2) {
    back = Math.max(back, f.heightAt(f.bounds.maxX + 28, z));
    if (Math.abs(z) < f.bounds.maxZ + 3) front = Math.max(front, f.heightAt(f.bounds.minX - 4, z));
  }
  assert.ok(back > 6, `massif de fond visible (${back.toFixed(1)})`);
  assert.ok(front < 2.2, `côté caméra dégagé (${front.toFixed(1)})`);
}

// 5. Littoral : l'eau se prolonge hors du plateau (bandes aux extrémités) et au large.
{
  const f = field(["littoral", "plaine"], ["littoral", "plaine"], "l"), out = {};
  const edge = f.bounds.minX;
  f.sample(edge - 1, -1.1, out); assert.ok(out.sea > 0.5 && out.h < cfg.waterLevel - 0.05, "mer prolongée hors du plateau côté rouge");
  f.sample(edge - 1, 1.1, out); assert.ok(out.sea > 0.5 && out.h < cfg.waterLevel - 0.05, "mer prolongée côté bleu");
  f.sample(edge - 1, -4.2, out); assert.ok(out.h >= cfg.waterLevel, "la berge reste émergée hors de la bande");
  let sea = 0;
  for (let z = -45; z <= 45; z += 2) { f.sample(-4, z, out); if (out.sea > 0.5) sea++; }
  assert.ok(sea > 8, "mer ouverte autour du littoral");
}

// 6. Transitions : pas de saut brutal de relief entre points voisins (hors falaises réelles).
{
  const f = field(["plaine", "montagne"], ["montagne", "littoral"], "t");
  let worst = 0;
  for (let x = -40; x < 40; x += 0.5) for (let z = -38; z < 38; z += 0.5) {
    if (f.distanceToBoard(x, z) < 0.01) continue;
    worst = Math.max(worst, Math.abs(f.heightAt(x + 0.5, z) - f.heightAt(x, z)) / 0.5, Math.abs(f.heightAt(x, z + 0.5) - f.heightAt(x, z)) / 0.5);
  }
  assert.ok(worst < 7, `pas de falaise verticale parasite (pente max ${worst.toFixed(2)})`);
}

// 7. Pistes : au moins une piste de terre par région de plaine, qui part du bord du plateau.
{
  const f = field(["plaine", "plaine"], ["plaine", "montagne"], "p");
  assert.equal(f.paths.length, 3);
  for (const path of f.paths) {
    const [x, z] = path.points[0];
    assert.ok(f.distanceToBoard(x, z) < 0.6, "la piste commence au bord du plateau");
    assert.ok(f.pathMask(x, z) > 0.5, "le masque de piste couvre son tracé");
  }
}

// 8. Graphismes : quatre niveaux, du plus léger au plus détaillé.
{
  const levels = E.Config.graphics.levels, names = Object.keys(levels);
  assert.deepEqual(names, ["low", "medium", "high", "ultra"]);
  for (let i = 1; i < names.length; i++) {
    assert.ok(levels[names[i]].shadowMap >= levels[names[i - 1]].shadowMap);
    assert.ok(levels[names[i]].vegetation > levels[names[i - 1]].vegetation);
    assert.ok(levels[names[i]].chunkSegments > levels[names[i - 1]].chunkSegments);
  }
}

// 9. Configuration de la caméra : angle fixe unique et bornes de zoom cohérentes.
{
  const cam = E.Config.strategyCamera;
  assert.ok(cam.pitchDeg >= 40 && cam.pitchDeg <= 60);
  assert.ok(cam.zoomMin > 0 && cam.zoomMin < cam.zoomFit && cam.zoomFit <= cam.zoomMax);
}

console.log("Environnement procédural : graine, biomes identiques et mixtes, raccords, mers prolongées, pistes, qualités et caméra validés.");
