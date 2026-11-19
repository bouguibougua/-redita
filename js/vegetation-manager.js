(function () {
  "use strict";
  // Végétation et décor du paysage PC : bois denses, maquis fleuri, chaos granitiques, couvre-sol,
  // clôture le long de la piste périphérique. Tout est instancié (un InstancedMesh par type et par
  // secteur, secteurs plus larges au loin), placé de façon déterministe depuis la graine, jamais sur
  // les régions jouables ni sélectionnable. Les feuillages ondulent légèrement au vent.
  const E = window.Eredita = window.Eredita || {};
  const NEAR_SECTOR = 24, FAR_SECTOR = 80;
  const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  function hash3(x, y, z) {
    let h = Math.imul(Math.round(x * 997), 374761393) ^ Math.imul(Math.round(y * 991), 668265263) ^ Math.imul(Math.round(z * 983), 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // Fusionne des primitives en une géométrie colorée. Occlusion cuite (base plus sombre), dégradé
  // facultatif vers une couleur de sommet (part.top), légère variation de teinte par sommet.
  function merge(THREE, parts, height) {
    const pos = [], nor = [], col = [];
    const tmp = new THREE.Vector3(), color = new THREE.Color(), top = new THREE.Color(), bloom = new THREE.Color();
    for (const part of parts) {
      let g = part.geo.index ? part.geo.toNonIndexed() : part.geo.clone();
      g.applyMatrix4(part.matrix);
      const p = g.attributes.position;
      if (part.radial) {
        const center = new THREE.Vector3().setFromMatrixPosition(part.matrix);
        const n = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) { tmp.set(p.getX(i), p.getY(i), p.getZ(i)).sub(center).normalize(); n.set([tmp.x, tmp.y, tmp.z], i * 3); }
        g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
      } else if (part.flat || !g.attributes.normal) g.computeVertexNormals();
      const n = g.attributes.normal;
      g.computeBoundingBox();
      const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
      color.set(part.color); if (part.top !== undefined) top.set(part.top);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        pos.push(x, y, z); nor.push(n.getX(i), n.getY(i), n.getZ(i));
        const ao = part.ao === false ? 1 : 0.55 + 0.45 * clamp(y / height);
        const j = 1 + (hash3(x, y, z) - 0.5) * (part.jitter ?? 0.16);
        let r = color.r, gg = color.g, b = color.b;
        const t = (y - y0) / Math.max(1e-4, y1 - y0);
        if (part.top !== undefined) {
          const k = smooth(0.25, 1, t);
          r += (top.r - r) * k; gg += (top.g - gg) * k; b += (top.b - b) * k;
        }
        // Floraison : taches de fleurs sur le dessus du feuillage (ciste, genêt, bruyère).
        if (part.bloom !== undefined && t > 0.5 && hash3(x * 3.1, y * 2.7, z * 3.3) > 0.62) {
          bloom.set(part.bloom); const k = 0.72 * smooth(0.5, 0.85, t);
          r += (bloom.r - r) * k; gg += (bloom.g - gg) * k; b += (bloom.b - b) * k;
        }
        col.push(r * ao * j, gg * ao * j, b * ao * j);
      }
      g.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }

  function blobGeometry(THREE, radius, detail, wobble, seed) {
    const g = new THREE.IcosahedronGeometry(radius, detail);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      const f = 1 + (hash3(v.x + seed, v.y, v.z) - 0.5) * wobble;
      p.setXYZ(i, v.x * f, v.y * f, v.z * f);
    }
    return g;
  }

  function matrix(THREE, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    return m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  }

  function buildLibrary(THREE) {
    const M = (...a) => matrix(THREE, ...a);
    const lib = {};
    const trunk = 0x5b4632;
    // --- Arbres de secours (modèles Tripo absents) ---
    {
      const parts = [{ geo: new THREE.CylinderGeometry(0.035, 0.06, 1.0, 6), matrix: M(0, 0.5, 0), color: trunk }];
      [[0.62, 0.46, 0.5], [0.92, 0.38, 0.5], [1.2, 0.3, 0.46], [1.46, 0.2, 0.4]]
        .forEach(([y, r, h], i) => parts.push({ geo: new THREE.ConeGeometry(r, h, 7), matrix: M(0, y, 0, 1, 1, 1, i * 0.7), color: 0x2d4a34, top: 0x4a6b40 }));
      lib.pineNear = merge(THREE, parts, 1.7);
    }
    {
      const leaf = 0x3f5a2a, leafTop = 0x6d8a3c;
      lib.oakNear = merge(THREE, [{ geo: new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6), matrix: M(0, 0.25, 0), color: trunk },
        { geo: blobGeometry(THREE, 0.44, 1, 0.35, 1), matrix: M(0, 0.78, 0, 1, 0.85, 1), color: leaf, top: leafTop, radial: true },
        { geo: blobGeometry(THREE, 0.32, 1, 0.35, 2), matrix: M(0.28, 0.66, 0.1), color: leaf, top: leafTop, radial: true },
        { geo: blobGeometry(THREE, 0.3, 1, 0.35, 3), matrix: M(-0.24, 0.7, -0.14), color: leaf, top: leafTop, radial: true }], 1.3);
      lib.olive = merge(THREE, [{ geo: new THREE.CylinderGeometry(0.05, 0.09, 0.4, 5), matrix: M(0, 0.2, 0, 1, 1, 1, 0, 0.12, 0.1), color: 0x6a5a45 },
        { geo: blobGeometry(THREE, 0.34, 1, 0.4, 5), matrix: M(0, 0.5, 0, 1.15, 0.7, 1.15), color: 0x6c7d58, top: 0x9aa57a, radial: true }], 0.8);
    }
    // Lointains génériques (houppier simple), pour les arbres sans version lointaine dédiée.
    lib.pineFar = merge(THREE, [{ geo: new THREE.CylinderGeometry(0.03, 0.05, 1.0, 4), matrix: M(0, 0.5, 0), color: trunk },
      { geo: blobGeometry(THREE, 0.5, 0, 0.3, 11), matrix: M(0, 1.42, 0, 1, 0.45, 1), color: 0x2f4a30, top: 0x4d6a3e, radial: true }], 1.75);
    lib.oakFar = merge(THREE, [{ geo: blobGeometry(THREE, 0.55, 0, 0.3, 12), matrix: M(0, 0.78, 0, 1, 0.85, 1), color: 0x3d5629, top: 0x66803a, radial: true }], 1.3);
    lib.oliveFar = merge(THREE, [{ geo: blobGeometry(THREE, 0.45, 0, 0.3, 13), matrix: M(0, 0.48, 0, 1.15, 0.65, 1.15), color: 0x6c7d58, top: 0x98a479, radial: true }], 0.8);
    // --- Cyprès : flamme sombre et élancée, très méditerranéenne ---
    {
      const profile = (rings) => Array.from({ length: rings + 1 }, (_, i) => {
        const t = i / rings;
        return new THREE.Vector2(Math.max(0.004, 0.19 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85)), 0.1 + t * 1.8);
      });
      const near = new THREE.LatheGeometry(profile(8), 7), far = new THREE.LatheGeometry(profile(4), 5);
      [near, far].forEach((g, k) => {
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const f = 1 + (hash3(p.getX(i), p.getY(i) + k, p.getZ(i)) - 0.5) * 0.22; p.setXYZ(i, p.getX(i) * f, p.getY(i), p.getZ(i) * f); }
        g.computeVertexNormals();
      });
      lib.cypress = merge(THREE, [{ geo: new THREE.CylinderGeometry(0.025, 0.035, 0.14, 5), matrix: M(0, 0.07, 0), color: trunk }, { geo: near, matrix: M(0, 0, 0), color: 0x24402a, top: 0x3f6034 }], 1.9);
      lib.cypressFar = merge(THREE, [{ geo: far, matrix: M(0, 0, 0), color: 0x24402a, top: 0x3c5c32 }], 1.9);
    }
    // --- Maquis : buissons ronds (lentisque, myrte, arbousier) ; floraisons de ciste, genêt, bruyère ---
    // Volume principal lisse (icosaèdre subdivisé, normales radiales) et deux touffes secondaires.
    const bushBody = (seed, color, top, bloom) => [
      { geo: blobGeometry(THREE, 0.24, 1, 0.55, seed), matrix: M(0, 0.15, 0, 1.25, 0.8, 1.25), color, top, bloom, radial: true, jitter: 0.34 },
      { geo: blobGeometry(THREE, 0.17, 0, 0.45, seed + 1), matrix: M(0.19, 0.11, 0.08, 1.1, 0.75, 1.1), color, top, bloom, radial: true, jitter: 0.3 },
      { geo: blobGeometry(THREE, 0.15, 0, 0.45, seed + 2), matrix: M(-0.16, 0.1, -0.1, 1.1, 0.75, 1.1), color, top, bloom, radial: true, jitter: 0.3 }];
    lib.bushes = [
      merge(THREE, bushBody(21, 0x2f4426, 0x56703a), 0.4),
      merge(THREE, bushBody(24, 0x46522f, 0x7d8752), 0.4),
      merge(THREE, bushBody(27, 0x355629, 0x6c8b3c), 0.4)];
    lib.bloom = {
      pink: merge(THREE, bushBody(31, 0x44522f, 0x768550, 0xe7a0bf), 0.4),
      yellow: merge(THREE, bushBody(34, 0x4b5a2c, 0x7f8a40, 0xeec33c), 0.4),
      white: merge(THREE, bushBody(37, 0x3c4f2c, 0x6f8248, 0xefebdd), 0.4),
      purple: merge(THREE, bushBody(40, 0x3d4a2b, 0x667545, 0xb75c86), 0.4)
    };
    lib.bushFar = merge(THREE, [{ geo: blobGeometry(THREE, 0.27, 0, 0.35, 50), matrix: M(0, 0.13, 0, 1.35, 0.7, 1.35), color: 0x3a4b2a, top: 0x67773e, radial: true }], 0.4);
    lib.bloomFar = merge(THREE, [{ geo: blobGeometry(THREE, 0.27, 0, 0.35, 51), matrix: M(0, 0.13, 0, 1.35, 0.7, 1.35), color: 0x45522f, top: 0xb98a7a, radial: true }], 0.4);
    // --- Rochers et chaos de secours ---
    lib.rocks = [0, 1, 2].map((variant) => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const p = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.set(p.getX(i), p.getY(i), p.getZ(i));
        const f = 0.72 + hash3(v.x, v.y, v.z + variant * 7) * 0.5;
        p.setXYZ(i, v.x * f * (1 + variant * 0.12), v.y * f * 0.72, v.z * f);
      }
      return merge(THREE, [{ geo: g, matrix: new THREE.Matrix4().makeTranslation(0, 0.22, 0), color: 0x9a8f84, top: 0xa8a08c, flat: true, ao: false }], 1);
    });
    {
      const parts = [];
      [[0, 0.9, 0, 1.25, 1.1], [0.85, 0.55, 0.3, 0.8, 0.7], [-0.7, 0.6, -0.35, 0.85, 0.85], [0.1, 1.9, 0.05, 0.75, 0.8], [0.2, 0.4, -0.9, 0.6, 0.6]].forEach(([x, y, z, r, h], k) => {
        const g = new THREE.IcosahedronGeometry(r, 1), p2 = g.attributes.position, v = new THREE.Vector3();
        for (let i2 = 0; i2 < p2.count; i2++) {
          v.set(p2.getX(i2), p2.getY(i2), p2.getZ(i2));
          const f = 0.78 + hash3(v.x + k, v.y, v.z) * 0.45;
          p2.setXYZ(i2, v.x * f, v.y * f * h, v.z * f);
        }
        parts.push({ geo: g, matrix: new THREE.Matrix4().makeTranslation(x, y, z), color: k % 2 ? 0x9a8c80 : 0xa4968a, flat: true });
      });
      lib.crag = merge(THREE, parts, 3);
    }
    // --- Couvre-sol ---
    lib.flower = merge(THREE, [{ geo: new THREE.ConeGeometry(0.05, 0.12, 4), matrix: M(0, 0.07, 0), color: 0xffffff, ao: false }], 0.2);
    lib.tuft = merge(THREE, [
      { geo: new THREE.ConeGeometry(0.05, 0.28, 4), matrix: M(0, 0.14, 0, 1, 1, 1, 0, 0.1, 0.05), color: 0x5f6e30 },
      { geo: new THREE.ConeGeometry(0.045, 0.22, 4), matrix: M(0.06, 0.11, 0.02, 1, 1, 1, 1.2, -0.12), color: 0x75823a },
      { geo: new THREE.ConeGeometry(0.04, 0.2, 4), matrix: M(-0.05, 0.1, -0.03, 1, 1, 1, 2.1, 0.1, -0.1), color: 0x56652c }], 0.3);
    // --- Clôture : poteau et lisse (longueur unitaire le long de +x) ---
    lib.post = merge(THREE, [{ geo: new THREE.BoxGeometry(0.035, 0.24, 0.035), matrix: M(0, 0.12, 0), color: 0x6b4e33, flat: true, ao: false }], 0.24);
    lib.rail = merge(THREE, [{ geo: new THREE.BoxGeometry(1, 0.022, 0.018), matrix: M(0.5, 0, 0), color: 0x80603f, flat: true, ao: false }], 1);
    return lib;
  }

  function create(THREE, { field, extent, profile, models = null, light = null }) {
    const cfg = E.Config.environment3d;
    const T = E.TerrainGenerator;
    const rng = T.mulberry32(T.hashString(`${field.seed}:vegetation`));
    const lib = buildLibrary(THREE);
    const model = (key, lod) => models?.[key]?.[lod] || null;
    const pick = (keys, roll, lod, fallback) => {
      const found = keys.map((key) => model(key, lod)).filter(Boolean);
      return found.length ? found[Math.floor(roll * found.length) % found.length] : fallback;
    };
    // Feuillages : ondulation au vent dans le shader (aucun coût CPU). Rochers et bois : matériau fixe.
    const wind = { value: 0 };
    const foliage = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.96, metalness: 0, envMapIntensity: 0.7 });
    foliage.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = wind;
      shader.vertexShader = "uniform float uWindTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 windBase = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 windBase = vec2(0.0);
        #endif
        float windBend = max(transformed.y, 0.0); windBend *= windBend;
        float windPhase = uWindTime * 1.35 + windBase.x * 0.37 + windBase.y * 0.29;
        transformed.x += sin(windPhase) * 0.016 * windBend;
        transformed.z += cos(windPhase * 0.83 + 1.7) * 0.011 * windBend;`);
    };
    foliage.customProgramCacheKey = () => "eredita-foliage-wind";
    const solid = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92, metalness: 0 });
    const buckets = new Map();
    const stats = { instances: 0, triangles: 0, byType: {} };
    const density = profile.vegetation;
    const waterLevel = field.waterLevel, bounds = field.bounds;
    const farDistance = cfg.vegetationFarDistance || 20;
    const tanPitch = Math.tan(THREE.MathUtils.degToRad(E.Config.strategyCamera.pitchDeg));
    const shadowBushes = density >= 0.8;
    const sample = {}, probeA = {}, probeB = {};
    // Mouillé = dans la mer (masque), pas seulement sous le niveau de l'eau : le sol autour du plateau est bas sans être marin.
    const wet = (point, margin = 0.06) => point.sea > 0.12 && point.h < waterLevel + margin;
    const shore = (point, margin) => point.sea > 0.05 && point.h < waterLevel + margin;

    function add(type, geometry, material, far, x, y, z, sx, sy, sz, ry, tint, castShadow = false, tiltX = 0, tiltZ = 0) {
      const sector = far ? FAR_SECTOR : NEAR_SECTOR;
      const key = `${type}:${geometry.uuid}:${Math.floor(x / sector)}:${Math.floor(z / sector)}`;
      let bucket = buckets.get(key);
      if (!bucket) { bucket = { type, geometry, material, castShadow, items: [] }; buckets.set(key, bucket); }
      bucket.items.push([x, y, z, sx, sy, sz, ry, tint, tiltX, tiltZ]);
    }
    const slopeAt = (x, z, h) => { field.sample(x + 0.5, z, probeA); field.sample(x, z + 0.5, probeB); return Math.hypot(probeA.h - h, probeB.h - h) / 0.5; };
    // Devant le plateau (côté caméra), un décor ne doit jamais en masquer le bord : hauteur bornée.
    const heightLimit = (x, dist) => x < bounds.minX ? 0.8 * dist * tanPitch : Infinity;
    const fitScale = (x, dist, height, scale) => Math.min(scale, heightLimit(x, dist) / height);
    // Teinte par instance : luminosité et léger glissement jaune/bleu.
    const hue = (b, k) => [b * (1 + k * 0.07), b, b * (1 - k * 0.09)];
    const sizes = cfg.models || {};
    const treeHeight = (key, fallback) => sizes[key]?.fit === "height" ? sizes[key].size : fallback;

    // 1. Arbres : bois denses (masque de forêt), arbres isolés, forêts de pins laricio sur les pentes.
    const treeCell = 1.05 / Math.sqrt(Math.max(0.15, density));
    for (let gz = extent.minZ; gz < extent.maxZ; gz += treeCell) {
      for (let gx = extent.minX; gx < extent.maxX; gx += treeCell) {
        const x = gx + rng() * treeCell, z = gz + rng() * treeCell;
        const r1 = rng(), r2 = rng(), r3 = rng(), spin = rng() * Math.PI * 2;
        field.sample(x, z, sample);
        if (sample.inside || sample.dist < 1.3 || sample.path > 0.1) continue;
        const h = sample.h, dist = sample.dist, C = sample.coast;
        if (wet(sample) || shore(sample, 0.25) || h > 11) continue;
        const Mo = Math.max(sample.mountain, smooth(1.6, 4.5, h) * (1 - C * 0.4));
        const forest = sample.forest;
        const cover = smooth(0.36, 0.7, forest) * (0.62 + 0.38 * Mo) + 0.03 + Mo * 0.18 * smooth(0.2, 0.45, forest);
        if (r1 > cover * (1 - smooth(8.5, 11, h)) * (C > 0.6 ? 0.6 : 1)) continue;
        const slope = slopeAt(x, z, h);
        if (slope > 2.3 || r3 > 1 - smooth(1.4, 2.3, slope) + 0.02) continue;
        const far = dist > farDistance, lod = far ? "far" : "near";
        const boardScale = 0.6 + 0.4 * smooth(1.3, 7.5, dist);
        const tone = 0.82 + r3 * 0.3, k = (r2 * 2 - 1);
        let species;
        if (Mo > 0.45 || h > 2.4) species = r2 < 0.88 ? "pine" : "oak";
        else if (C > 0.5) species = r2 < 0.35 ? "umbrella" : r2 < 0.68 ? "olive" : "oak";
        else species = r2 < 0.52 ? "oak" : r2 < 0.78 ? "olive" : "cypress";
        if (species === "pine" || species === "umbrella") {
          const umbrella = species === "umbrella", base = treeHeight("pine", 1.75);
          let s = (0.78 + r3 * 0.55) * boardScale * (h > 2 ? 1.12 : 1);
          s = fitScale(x, dist, base * (umbrella ? 0.78 : 1), s); if (s < 0.3) continue;
          const geometry = model("pine", lod) || (far ? lib.pineFar : lib.pineNear);
          add(far ? "pineFar" : "pineNear", geometry, foliage, far, x, h - 0.04, z, s * (umbrella ? 1.3 : 1), s * (umbrella ? 0.78 : 0.92 + r1 * 0.3), s * (umbrella ? 1.3 : 1), spin, hue(tone, k), !far);
        } else if (species === "oak") {
          let s = (0.82 + r3 * 0.6) * boardScale;
          s = fitScale(x, dist, treeHeight("oak0", 1.3), s); if (s < 0.3) continue;
          add(far ? "oakFar" : "oakNear", pick(["oak0", "oak1"], r1, lod, far ? lib.oakFar : lib.oakNear), foliage, far, x, h - 0.03, z, s, s * (0.88 + r1 * 0.3), s, spin, hue(tone, k), !far);
        } else if (species === "olive") {
          let s = (0.9 + r3 * 0.55) * boardScale;
          s = fitScale(x, dist, treeHeight("olive", 0.85), s); if (s < 0.3) continue;
          add(far ? "oliveFar" : "olive", model("olive", lod) || (far ? lib.oliveFar : lib.olive), foliage, far, x, h - 0.03, z, s, s, s, spin, hue(tone, k * 0.5), !far);
        } else {
          let s = (0.75 + r3 * 0.5) * boardScale;
          s = fitScale(x, dist, 1.9, s); if (s < 0.3) continue;
          add(far ? "cypressFar" : "cypress", far ? lib.cypressFar : lib.cypress, foliage, far, x, h - 0.03, z, s, s * (0.9 + r1 * 0.35), s, spin, hue(tone, k * 0.5), !far);
        }
      }
    }

    // 2. Maquis : couverture serrée de buissons (plus clairsemée au loin), floraisons par taches.
    const bushCell = 0.62 / Math.sqrt(Math.max(0.15, density)), reach = 46;
    const bloomNoise = field.noise.nD;
    for (let gz = Math.max(extent.minZ, bounds.minZ - reach); gz < Math.min(extent.maxZ, bounds.maxZ + reach); gz += bushCell) {
      for (let gx = Math.max(extent.minX, bounds.minX - reach); gx < Math.min(extent.maxX, bounds.maxX + reach); gx += bushCell) {
        const x = gx + rng() * bushCell, z = gz + rng() * bushCell;
        const r1 = rng(), r2 = rng(), r3 = rng(), spin = rng() * Math.PI * 2;
        field.sample(x, z, sample);
        if (sample.inside || sample.dist < 1.05 || sample.path > 0.08) continue;
        const h = sample.h, dist = sample.dist, C = sample.coast, P = sample.plain;
        if (wet(sample) || shore(sample, 0.12) || h > 9) continue;
        const rim = 1 - smooth(1.5, 5.5, dist);
        const chance = (smooth(0.26, 0.64, sample.maquis) * (0.48 + 0.32 * C + 0.2 * P) + rim * 0.3 + 0.05 + smooth(0.45, 0.8, sample.forest) * 0.22)
          * (1 - smooth(6, 9, h)) * (dist > 32 ? 0.55 : 1);
        if (r1 > chance) continue;
        if ((sample.mountain > 0.2 || h > 1.5) && slopeAt(x, z, h) > 1.7) continue;
        const far = dist > farDistance * 0.7;
        let s = (0.55 + r3 * 0.8) * (0.65 + 0.35 * smooth(1.05, 6, dist));
        s = fitScale(x, dist, 0.42, s); if (s < 0.25) continue;
        const patch = bloomNoise.fbm(x * 0.09 + 31, z * 0.09 - 7, 2);
        const blooming = patch > 0.18 && r2 < 0.42;
        const tint = hue(0.82 + r2 * 0.35, r3 * 2 - 1);
        if (far) add(blooming ? "bloomFar" : "bushFar", blooming ? lib.bloomFar : lib.bushFar, foliage, true, x, h - 0.02, z, s, s * (0.8 + r2 * 0.4), s, spin, tint, false);
        else if (blooming) {
          const kind = patch > 0.3 ? (C > 0.4 ? "pink" : "yellow") : bloomNoise.fbm(x * 0.05 - 3, z * 0.05 + 11, 1) > 0 ? "white" : "purple";
          add(`bloom-${kind}`, lib.bloom[kind], foliage, false, x, h - 0.02, z, s, s * (0.8 + r2 * 0.4), s, spin, tint, shadowBushes);
        } else {
          const variant = Math.floor(r3 * 3) % 3;
          add(`bush${variant}`, lib.bushes[variant], foliage, false, x, h - 0.02, z, s, s * (0.8 + r2 * 0.4), s, spin, tint, shadowBushes);
        }
      }
    }

    // 3. Rochers : granites épars, chaos en grappes sur les pentes et en lisière, rochers côtiers.
    const rockCell = 1.3 / Math.sqrt(Math.max(0.15, density));
    for (let gz = extent.minZ; gz < extent.maxZ; gz += rockCell) {
      for (let gx = extent.minX; gx < extent.maxX; gx += rockCell) {
        const x = gx + rng() * rockCell, z = gz + rng() * rockCell;
        const r1 = rng(), r2 = rng(), r3 = rng(), spin = rng() * Math.PI * 2;
        field.sample(x, z, sample);
        if (sample.inside || sample.dist < 1.15 || sample.path > 0.08) continue;
        const h = sample.h, dist = sample.dist, C = sample.coast;
        const Mo = Math.max(sample.mountain, smooth(1.6, 4.5, h) * (1 - C * 0.4));
        const far = dist > farDistance, lod = far ? "far" : "near";
        const rim = 1 - smooth(1.6, 6, dist);
        const shallow = h > waterLevel - 0.42 && h < waterLevel + 0.55 && C > 0.45 && sample.sea > 0.2;
        const slope = slopeAt(x, z, h);
        const rockChance = (0.035 + Mo * 0.16 + C * 0.05 + rim * 0.12 + smooth(0.6, 1.4, slope) * 0.12) * density;
        if (!(r1 < rockChance && !wet(sample)) && !(shallow && r1 < 0.14 * density)) continue;
        const big = (Mo > 0.45 && slope > 0.45 && h > 1.4 && r2 < 0.24) || (rim > 0.2 && x > bounds.minX && dist > 1.8 && r2 < 0.18);
        if (big) {
          let s = (rim > 0.2 && Mo < 0.45 ? 0.32 + r3 * 0.34 : 0.75 + r3 * 1.1);
          s = fitScale(x, dist, 3, s); if (s < 0.2) continue;
          add("crag", pick(["crag0", "crag1"], r3, lod, lib.crag), solid, far, x, h - 0.15, z, s, s * (0.78 + r2 * 0.9), s, spin, hue(0.88 + r3 * 0.25, 0.4), !far);
          // Éboulis autour du chaos : quelques blocs plus petits.
          for (let c = 0; c < 3; c++) {
            const a = spin + c * 2.1 + r1, d = s * (0.9 + c * 0.35);
            const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
            field.sample(cx, cz, probeA);
            if (probeA.inside || probeA.dist < 1.1 || wet(probeA)) continue;
            const cs = fitScale(cx, probeA.dist, 1.2, s * (0.25 + 0.15 * c));
            const variant = (c + Math.floor(r2 * 3)) % 3;
            add(`rock${variant}`, model(`rock${variant}`, lod) || lib.rocks[variant], solid, far, cx, probeA.h - cs * 0.15, cz, cs * 1.2, cs, cs * 1.2, a, hue(0.85 + c * 0.06, 0.3), !far);
          }
          continue;
        }
        let s = (0.12 + r2 * r2 * 0.5 + Mo * 0.15) * (0.5 + 0.5 * smooth(1.15, 7, dist));
        s = fitScale(x, dist, 1.3, s);
        const variant = Math.floor(r3 * 3) % 3;
        const coastal = shallow && model("coastRock0", lod);
        const geometry = coastal ? pick(["coastRock0", "coastRock1"], r3, lod, lib.rocks[variant]) : model(`rock${variant}`, lod) || lib.rocks[variant];
        add(coastal ? "coastRock" : `rock${variant}`, geometry, solid, far, x, h - s * 0.12, z, s * 1.2, s, s * 1.2, spin, hue(0.84 + r3 * 0.3, 0.3), !far);
      }
    }

    // 4. Couvre-sol près de la caméra : touffes d'herbe et fleurs des prairies.
    if (profile.flowers > 0) {
      const groundCell = 0.8 / Math.sqrt(Math.max(0.15, profile.flowers));
      const palette = [0xf2e35a, 0xf4f2ea, 0xc88bd8, 0xe27b6a, 0xf0b33a];
      for (let gz = Math.max(extent.minZ, bounds.minZ - 24); gz < Math.min(extent.maxZ, bounds.maxZ + 24); gz += groundCell) {
        for (let gx = Math.max(extent.minX, bounds.minX - 24); gx < Math.min(extent.maxX, bounds.maxX + 24); gx += groundCell) {
          const x = gx + rng() * groundCell, z = gz + rng() * groundCell, r1 = rng(), r2 = rng(), r3 = rng();
          field.sample(x, z, sample);
          if (sample.inside || sample.dist < 0.95 || sample.path > 0.15 || wet(sample) || shore(sample, 0.12) || sample.plain < 0.3 || sample.maquis > 0.7) continue;
          if (r1 < 0.16) {
            for (let k = 0; k < 3; k++) {
              const fx = x + (rng() - 0.5) * 0.5, fz = z + (rng() - 0.5) * 0.5;
              field.sample(fx, fz, probeA);
              if (probeA.path > 0.15 || wet(probeA) || probeA.inside) continue;
              add("flower", lib.flower, foliage, false, fx, probeA.h, fz, 0.45 + rng() * 0.3, 0.5 + rng() * 0.4, 0.45 + rng() * 0.3, rng() * 6, palette[Math.floor(r2 * palette.length) % palette.length], false);
            }
          } else if (r1 < 0.42) add("tuft", lib.tuft, foliage, false, x, sample.h - 0.01, z, 0.7 + r3 * 0.6, 0.7 + r2 * 0.8, 0.7 + r3 * 0.6, r2 * 6, 0.75 + r3 * 0.35, false);
        }
      }
    }

    // 5. Clôture en bois le long de la piste périphérique (côté extérieur), interrompue par l'eau.
    {
      const offset = 1.02, spacing = 0.62, dense = [];
      const line = (x0, z0, x1, z1) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.05)); for (let i = 0; i < n; i++) dense.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]); };
      const arc = (cx, cz, a0) => { for (let i = 0; i < 16; i++) { const a = a0 + i / 16 * Math.PI / 2; dense.push([cx + Math.cos(a) * offset, cz + Math.sin(a) * offset]); } };
      const { minX, maxX, minZ, maxZ } = bounds;
      line(maxX + offset, minZ, maxX + offset, maxZ); arc(maxX, maxZ, 0);
      line(maxX, maxZ + offset, minX, maxZ + offset); arc(minX, maxZ, Math.PI / 2);
      line(minX - offset, maxZ, minX - offset, minZ); arc(minX, minZ, Math.PI);
      line(minX, minZ - offset, maxX, minZ - offset); arc(maxX, minZ, Math.PI * 1.5);
      let travelled = 0, previous = null;
      for (let i = 0; i < dense.length; i++) {
        if (i > 0) travelled += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
        if (i > 0 && travelled < spacing) continue;
        travelled = 0;
        const [x, z] = dense[i];
        field.sample(x, z, sample);
        if (sample.sea > 0.1 || sample.inside) { previous = null; continue; }
        const tilt = (rng() - 0.5) * 0.08, y = sample.h - 0.02;
        add("post", lib.post, solid, false, x, y, z, 1, 0.9 + rng() * 0.25, 1, rng() * 6, 0.85 + rng() * 0.3, true, tilt, tilt);
        if (previous && Math.hypot(x - previous[0], z - previous[2]) < spacing * 1.8) {
          const dx = x - previous[0], dz = z - previous[2], length = Math.hypot(dx, dz), angle = -Math.atan2(dz, dx);
          for (const rail of [0.09, 0.18]) add("rail", lib.rail, solid, false, previous[0], previous[1] + rail, previous[2], length, 1, 1, angle, 0.9, true, 0, Math.atan2(y - previous[1], length));
        }
        previous = [x, y, z];
      }
    }

    // Instanciation : un InstancedMesh par type, géométrie et secteur.
    const group = new THREE.Group(); group.name = "vegetation";
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    const geometries = new Set();
    for (const bucket of buckets.values()) {
      const count = bucket.items.length;
      const mesh = new THREE.InstancedMesh(bucket.geometry, bucket.material, count);
      mesh.name = bucket.type; mesh.castShadow = bucket.castShadow;
      mesh.receiveShadow = bucket.castShadow || /rock|crag|post|rail/i.test(bucket.type);
      bucket.items.forEach((item, i) => {
        const [x, y, z, sx, sy, sz, ry, tint, tiltX, tiltZ] = item;
        dummy.position.set(x, y, z); dummy.rotation.set(tiltX, ry, tiltZ); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (Array.isArray(tint)) color.setRGB(tint[0], tint[1], tint[2]);
        else if (typeof tint === "number" && tint > 1000) color.setHex(tint); else color.setScalar(tint);
        // Même éclairage cuit que le sol : la végétation à l'ombre d'une crête s'assombrit avec elle.
        if (light) {
          const shade = light.shadowAt(x, z, y + 0.4), basin = light.basinAt(x, z, y);
          color.r *= (1 - shade * 0.3) * (1 - basin * 0.5); color.g *= (1 - shade * 0.27) * (1 - basin * 0.5); color.b *= (1 - shade * 0.18) * (1 - basin * 0.4);
        }
        mesh.setColorAt(i, color);
      });
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.userData.decorative = true; mesh.raycast = () => {};
      group.add(mesh);
      const tris = (bucket.geometry.index ? bucket.geometry.index.count : bucket.geometry.attributes.position.count) / 3;
      stats.instances += count; stats.triangles += tris * count; stats.byType[bucket.type] = (stats.byType[bucket.type] || 0) + count;
      if (!bucket.geometry.userData.sharedModel) geometries.add(bucket.geometry);
    }
    stats.draws = group.children.length;
    stats.models = models ? Object.keys(models).length : 0;

    function update(time) { wind.value = profile.animatedWater ? time : 0; }

    function dispose() {
      group.removeFromParent();
      group.children.forEach((mesh) => mesh.dispose?.());
      geometries.forEach((geometry) => geometry.dispose());
      const all = [lib.pineNear, lib.oakNear, lib.olive, lib.pineFar, lib.oakFar, lib.oliveFar, lib.cypress, lib.cypressFar, lib.bushFar, lib.bloomFar,
        lib.crag, lib.flower, lib.tuft, lib.post, lib.rail, ...lib.bushes, ...lib.rocks, ...Object.values(lib.bloom)];
      all.forEach((geometry) => geometry?.dispose?.());
      foliage.dispose(); solid.dispose(); group.clear();
    }
    return { group, stats, update, dispose };
  }

  E.VegetationManager = { create };
}());
