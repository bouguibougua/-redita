(function () {
  "use strict";
  // Végétation et rochers décoratifs : InstancedMesh regroupés par secteurs (frustum culling),
  // deux niveaux de détail (proche / lointain), couleurs et échelles variées par instance.
  // Placement déterministe depuis la graine ; rien n'est posé sur les régions jouables.
  const E = window.Eredita = window.Eredita || {};
  const SECTOR = 28;
  const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  function hash3(x, y, z) {
    let h = Math.imul(Math.round(x * 997), 374761393) ^ Math.imul(Math.round(y * 991), 668265263) ^ Math.imul(Math.round(z * 983), 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // Fusionne des primitives en une géométrie colorée (AO cuite : base plus sombre).
  function merge(THREE, parts, height) {
    const pos = [], nor = [], col = [];
    const tmp = new THREE.Vector3(), color = new THREE.Color();
    for (const part of parts) {
      let g = part.geo.index ? part.geo.toNonIndexed() : part.geo.clone();
      g.applyMatrix4(part.matrix);
      const p = g.attributes.position, n = g.attributes.normal;
      if (part.radial) {
        const center = new THREE.Vector3().setFromMatrixPosition(part.matrix);
        for (let i = 0; i < p.count; i++) { tmp.set(p.getX(i), p.getY(i), p.getZ(i)).sub(center).normalize(); n.setXYZ(i, tmp.x, tmp.y, tmp.z); }
      } else if (part.flat) { g.computeVertexNormals(); }
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
        const t = clamp(p.getY(i) / height);
        const ao = part.ao === false ? 1 : 0.5 + 0.5 * t;
        color.set(part.color);
        // Légère variation de teinte par sommet : pas d'aplat uniforme.
        const j = 0.92 + hash3(p.getX(i), p.getY(i), p.getZ(i)) * 0.16;
        col.push(color.r * ao * j, color.g * ao * j, color.b * ao * j);
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
    const trunkColor = 0x5b4632, pineColor = 0x2d4a34, pineLight = 0x3c5e3a;
    // Pin laricio : fût élancé, houppiers étagés.
    {
      const parts = [{ geo: new THREE.CylinderGeometry(0.035, 0.06, 1.0, 6), matrix: M(0, 0.5, 0), color: trunkColor }];
      [[0.62, 0.46, 0.5, pineColor], [0.92, 0.38, 0.5, pineLight], [1.2, 0.3, 0.46, pineColor], [1.46, 0.2, 0.4, pineLight]]
        .forEach(([y, r, h, c], i) => parts.push({ geo: new THREE.ConeGeometry(r, h, 7), matrix: M(0, y, 0, 1, 1, 1, i * 0.7), color: c }));
      lib.pineNear = merge(THREE, parts, 1.7);
      lib.pineFar = merge(THREE, [{ geo: new THREE.ConeGeometry(0.4, 1.5, 5), matrix: M(0, 0.85, 0), color: pineColor }], 1.7);
    }
    // Chêne : tronc court, couronne en boules.
    {
      const leaf = 0x4f6b2f, leafLight = 0x6d8438;
      const parts = [{ geo: new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6), matrix: M(0, 0.25, 0), color: trunkColor },
        { geo: blobGeometry(THREE, 0.44, 1, 0.35, 1), matrix: M(0, 0.78, 0, 1, 0.85, 1), color: leaf, radial: true },
        { geo: blobGeometry(THREE, 0.32, 1, 0.35, 2), matrix: M(0.28, 0.66, 0.1), color: leafLight, radial: true },
        { geo: blobGeometry(THREE, 0.3, 1, 0.35, 3), matrix: M(-0.24, 0.7, -0.14), color: leaf, radial: true },
        { geo: blobGeometry(THREE, 0.26, 1, 0.35, 4), matrix: M(0.02, 1.02, -0.06), color: leafLight, radial: true }];
      lib.oakNear = merge(THREE, parts, 1.3);
      lib.oakFar = merge(THREE, [{ geo: new THREE.IcosahedronGeometry(0.5, 0), matrix: M(0, 0.78, 0, 1, 0.9, 1), color: leaf, radial: true }], 1.3);
    }
    // Olivier : tronc noueux bas, feuillage argenté aplati.
    {
      const silver = 0x8b9a6d, silverDark = 0x6c7d58;
      const parts = [{ geo: new THREE.CylinderGeometry(0.05, 0.09, 0.4, 5), matrix: M(0, 0.2, 0, 1, 1, 1, 0, 0.12, 0.1), color: 0x6a5a45 },
        { geo: blobGeometry(THREE, 0.34, 1, 0.4, 5), matrix: M(0, 0.5, 0, 1.15, 0.7, 1.15), color: silver, radial: true },
        { geo: blobGeometry(THREE, 0.24, 1, 0.4, 6), matrix: M(0.24, 0.42, 0.1, 1, 0.7, 1), color: silverDark, radial: true },
        { geo: blobGeometry(THREE, 0.22, 1, 0.4, 7), matrix: M(-0.2, 0.46, -0.1, 1, 0.7, 1), color: silver, radial: true }];
      lib.olive = merge(THREE, parts, 0.8);
      lib.oliveFar = merge(THREE, [{ geo: new THREE.IcosahedronGeometry(0.4, 0), matrix: M(0, 0.45, 0, 1.2, 0.7, 1.2), color: silver, radial: true }], 0.8);
    }
    // Maquis : buissons bas, touffes sombres.
    {
      const a = 0x4a5e32, b = 0x6a7a3a, c = 0x3a4e2c;
      lib.bush = merge(THREE, [
        { geo: blobGeometry(THREE, 0.22, 1, 0.5, 8), matrix: M(0, 0.14, 0, 1.3, 0.75, 1.3), color: a, radial: true },
        { geo: blobGeometry(THREE, 0.15, 1, 0.5, 9), matrix: M(0.2, 0.11, 0.08, 1.1, 0.7, 1.1), color: b, radial: true },
        { geo: blobGeometry(THREE, 0.14, 1, 0.5, 10), matrix: M(-0.17, 0.1, -0.1, 1.1, 0.7, 1.1), color: c, radial: true }], 0.4);
      lib.bushFar = merge(THREE, [{ geo: new THREE.IcosahedronGeometry(0.26, 0), matrix: M(0, 0.12, 0, 1.4, 0.7, 1.4), color: a, radial: true }], 0.4);
    }
    // Rochers granitiques : facettes plates, dessus légèrement moussu.
    lib.rocks = [0, 1, 2].map((variant) => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const p = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.set(p.getX(i), p.getY(i), p.getZ(i));
        const f = 0.72 + hash3(v.x, v.y, v.z + variant * 7) * 0.5;
        p.setXYZ(i, v.x * f * (1 + variant * 0.12), v.y * f * 0.72, v.z * f);
      }
      const geo = merge(THREE, [{ geo: g, matrix: new THREE.Matrix4().makeTranslation(0, 0.22, 0), color: 0x8f8a80, flat: true, ao: false }], 1);
      const n = geo.attributes.normal, c = geo.attributes.color, moss = new THREE.Color(0x66763e);
      for (let i = 0; i < n.count; i++) {
        const top = smooth(0.65, 0.97, n.getY(i)) * 0.32, y = geo.attributes.position.getY(i);
        const shade = 0.78 + clamp(y, 0, 1.2) * 0.2;
        c.setXYZ(i, c.getX(i) * shade * (1 - top) + moss.r * top, c.getY(i) * shade * (1 - top) + moss.g * top, c.getZ(i) * shade * (1 - top) + moss.b * top);
      }
      return geo;
    });
    // Chaos granitique pour les crêtes : blocs empilés, facettes plates, tons gris-rosé.
    {
      const parts = [];
      [[0, 0.9, 0, 1.25, 1.1], [0.85, 0.55, 0.3, 0.8, 0.7], [-0.7, 0.6, -0.35, 0.85, 0.85], [0.1, 1.9, 0.05, 0.75, 0.8], [0.2, 0.4, -0.9, 0.6, 0.6]].forEach(([x, y, z, r, h], k) => {
        const g = new THREE.IcosahedronGeometry(r, 1), p2 = g.attributes.position, v = new THREE.Vector3();
        for (let i2 = 0; i2 < p2.count; i2++) {
          v.set(p2.getX(i2), p2.getY(i2), p2.getZ(i2));
          const f = 0.78 + hash3(v.x + k, v.y, v.z) * 0.45;
          p2.setXYZ(i2, v.x * f, v.y * f * h, v.z * f);
        }
        parts.push({ geo: g, matrix: new THREE.Matrix4().makeTranslation(x, y, z), color: k % 2 ? 0x8d857a : 0x9b9186, flat: true });
      });
      lib.crag = merge(THREE, parts, 3);
    }
    // Fleurs sauvages et touffes d'herbe.
    lib.flower = merge(THREE, [{ geo: new THREE.ConeGeometry(0.05, 0.12, 4), matrix: M(0, 0.07, 0), color: 0xffffff, ao: false }], 0.2);
    lib.tuft = merge(THREE, [
      { geo: new THREE.ConeGeometry(0.05, 0.28, 4), matrix: M(0, 0.14, 0, 1, 1, 1, 0, 0.1, 0.05), color: 0x7a8a3c },
      { geo: new THREE.ConeGeometry(0.045, 0.22, 4), matrix: M(0.06, 0.11, 0.02, 1, 1, 1, 1.2, -0.12), color: 0x93a04a },
      { geo: new THREE.ConeGeometry(0.04, 0.2, 4), matrix: M(-0.05, 0.1, -0.03, 1, 1, 1, 2.1, 0.1, -0.1), color: 0x6c7c36 }], 0.3);
    return lib;
  }

  function create(THREE, { field, extent, profile, models = null }) {
    // Aléatoire propre à la végétation : même placement avant et après l'arrivée des modèles Tripo.
    const T = E.TerrainGenerator, rng = T.mulberry32(T.hashString(`${field.seed}:vegetation`));
    const lib = buildLibrary(THREE);
    // Modèle Tripo s'il est chargé, sinon forme procédurale.
    const model = (key, lod) => models?.[key]?.[lod] || null;
    const pick = (keys, roll, lod, fallback) => {
      const found = keys.map((key) => model(key, lod)).filter(Boolean);
      return found.length ? found[Math.floor(roll * found.length) % found.length] : fallback;
    };
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92, metalness: 0 });
    const flowerMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8, metalness: 0 });
    const buckets = new Map();
    const stats = { instances: 0, triangles: 0, byType: {} };
    const density = profile.vegetation;
    const waterLevel = field.waterLevel;
    const sample = {}, probeA = {}, probeB = {};

    function add(type, geometry, x, y, z, sx, sy, sz, ry, tint, castShadow = false, tiltX = 0, tiltZ = 0, material_ = material) {
      const key = `${type}:${Math.floor(x / SECTOR)}:${Math.floor(z / SECTOR)}`;
      const geometryKey = geometry.uuid;
      const bucketKey = `${key}:${geometryKey}`;
      let bucket = buckets.get(bucketKey);
      if (!bucket) { bucket = { type, geometry, material: material_, castShadow, items: [] }; buckets.set(bucketKey, bucket); }
      bucket.items.push([x, y, z, sx, sy, sz, ry, tint, tiltX, tiltZ]);
    }

    const cell = 1.0 / Math.sqrt(Math.max(0.15, density));
    const bounds = field.bounds;
    const farDistance = E.Config.environment3d.vegetationFarDistance || 20;
    const noise = field.noise;
    for (let gz = extent.minZ; gz < extent.maxZ; gz += cell) {
      for (let gx = extent.minX; gx < extent.maxX; gx += cell) {
        const x = gx + rng() * cell, z = gz + rng() * cell;
        const roll = rng(), roll2 = rng(), roll3 = rng(), spin = rng() * Math.PI * 2;
        field.sample(x, z, sample);
        if (sample.inside) continue;
        const dist = sample.dist;
        if (dist < 0.9) continue;
        const h = sample.h;
        if (sample.path > 0.18) continue;
        field.sample(x + 0.5, z, probeA); field.sample(x, z + 0.5, probeB);
        const slope = Math.hypot(probeA.h - h, probeB.h - h) / 0.5;
        const forest = clamp(0.5 + 0.9 * noise.nB.fbm(x * 0.035 + 12, z * 0.035, 3));
        const grove = clamp(0.5 + 1.1 * noise.nC.fbm(x * 0.06 - 5, z * 0.06 + 9, 3));
        // Près du plateau, la végétation reste basse pour ne jamais masquer les unités ni les villages.
        const nearBoard = smooth(1.0, 7.5, dist);
        const far = dist > farDistance, lod = far ? "far" : "near";
        const underwater = h < waterLevel + 0.02;
        const P = sample.plain, C = sample.coast;
        // Le massif de fond se comporte comme une montagne, quel que soit le biome voisin.
        const Mo = Math.max(sample.mountain, smooth(1.6, 4.5, h) * (1 - C * 0.4));
        // Pourtour du plateau : rochers et maquis serrés, comme une lisière naturelle.
        const rim = 1 - smooth(1.5, 6, dist);
        const cameraSide = x < bounds.minX + 0.5;

        // Chaos granitiques en lisière (côté lointain et côtés seulement : jamais devant la caméra).
        if (!cameraSide && !underwater && dist > 1.6 && dist < 6 && sample.path < 0.05 && roll < 0.035 * density * (0.4 + Mo + P * 0.6)) {
          const s = 0.3 + roll2 * 0.32;
          add("crag", pick(["crag0", "crag1"], roll3, lod, lib.crag), x, h - 0.12, z, s, s * (0.75 + roll3 * 0.6), s, spin, 0.85 + roll2 * 0.3, true);
          continue;
        }

        // Rochers : partout, plus nombreux en montagne ; sur la côte, certains émergent de l'eau.
        const rockChance = (0.03 + Mo * 0.14 + C * 0.05 + rim * 0.09 + smooth(0.6, 1.4, slope) * 0.1) * density;
        const shallow = h > waterLevel - 0.42 && h < waterLevel + 0.55 && C > 0.45 && sample.sea > 0.2;
        if ((roll < rockChance && !underwater) || (shallow && roll < 0.11 * density)) {
          const big = Mo > 0.5 && roll2 < 0.18 && slope > 0.45 && h > 1.4;
          if (big) {
            const s = 0.8 + roll3 * 1.1;
            add("crag", pick(["crag0", "crag1"], roll2, lod, lib.crag), x, h - 0.2, z, s, s * (0.8 + roll2 * 1.4), s, spin, 0.85 + roll3 * 0.3, true);
          } else {
            const s = (0.1 + roll2 * roll2 * 0.5 + Mo * 0.14) * (0.45 + 0.55 * nearBoard);
            const variant = Math.floor(roll3 * 3) % 3;
            // Rochers polis par la mer sur le rivage, granites ailleurs.
            const coastal = shallow && model("coastRock0", lod);
            const geometry = coastal ? pick(["coastRock0", "coastRock1"], roll3, lod, lib.rocks[variant]) : model(`rock${variant}`, lod) || lib.rocks[variant];
            add(coastal ? "coastRock" : `rock${variant}`, geometry, x, h - s * 0.12, z, s * 1.2, s, s * 1.2, spin, 0.82 + roll3 * 0.36, !far, 0, 0);
          }
          continue;
        }
        if (underwater) continue;

        const scaleNear = 0.4 + 0.6 * nearBoard;
        // Montagne : forêts de pins laricio sur les pentes, jusqu'à la limite des arbres.
        if (Mo > 0.2 && h > 0.35 && h < 11 && slope < 2.3) {
          const pineChance = Mo * forest * smooth(0.2, 0.65, forest) * (1 - smooth(7.5, 11, h)) * (1 - smooth(1.2, 2.3, slope)) * 0.9 * density;
          if (roll < rockChance + pineChance) {
            const s = (0.75 + roll2 * 0.9) * scaleNear * (0.9 + (h > 2 ? 0.2 : 0));
            add(far ? "pineFar" : "pineNear", model("pine", lod) || (far ? lib.pineFar : lib.pineNear), x, h - 0.04, z, s, s * (0.9 + roll3 * 0.35), s, spin, 0.82 + roll3 * 0.3, !far);
            continue;
          }
        }
        // Plaines et collines : chênes, oliviers, maquis.
        if (P > 0.25 && slope < 1.2) {
          const oakChance = P * (0.08 + grove * (0.26 + rim * 0.12)) * density, oliveChance = P * (1 - grove) * 0.09 * density;
          if (roll2 < oakChance && nearBoard > 0.35) {
            const s = (0.8 + roll3 * 0.7) * scaleNear;
            add(far ? "oakFar" : "oakNear", pick(["oak0", "oak1"], roll, lod, far ? lib.oakFar : lib.oakNear), x, h - 0.03, z, s, s * (0.85 + roll * 0.4), s, spin, 0.78 + roll3 * 0.4, !far);
            continue;
          }
          if (roll2 > 1 - oliveChance && nearBoard > 0.3) {
            const s = (0.9 + roll3 * 0.6) * scaleNear;
            add(far ? "oliveFar" : "olive", model("olive", lod) || (far ? lib.oliveFar : lib.olive), x, h - 0.03, z, s, s, s, spin, 0.85 + roll * 0.3, !far);
            continue;
          }
        }
        // Maquis méditerranéen : buissons denses sur côtes, collines et lisières.
        const bushChance = (P * 0.3 * grove + C * 0.42 + Mo * 0.1 + rim * 0.22) * density * (h > 0.18 || P > 0.5 ? 1 : 0.2);
        if (roll3 < bushChance && slope < 1.2) {
          const s = (0.6 + roll * 0.9) * (0.55 + 0.45 * nearBoard);
          add(far ? "bushFar" : "bush", model("bush", lod) || (far ? lib.bushFar : lib.bush), x, h - 0.02, z, s, s * (0.8 + roll2 * 0.4), s, spin, 0.7 + roll2 * 0.6, false);
        }
        // Côte : pins parasols/pins maritimes épars sur les hauteurs.
        if (C > 0.4 && h > 0.5 && h < 3 && slope < 1.0 && roll2 < 0.035 * density && dist > 2.5) {
          const s = (0.7 + roll * 0.6) * scaleNear;
          add(far ? "pineFar" : "pineNear", model("pine", lod) || (far ? lib.pineFar : lib.pineNear), x, h - 0.04, z, s, s, s, spin, 0.9 + roll3 * 0.2, !far);
        }
        // Fleurs sauvages et touffes : seulement près de la caméra, sur les prairies.
        if (!far && P > 0.4 && slope < 0.6 && profile.flowers > 0 && dist < 26) {
          if (roll2 > 0.55 && roll < 0.55 * profile.flowers) {
            const palette = [0xf2e35a, 0xf4f2ea, 0xc88bd8, 0xe27b6a, 0xf0b33a];
            for (let k = 0; k < 3; k++) {
              const fx = x + (rng() - 0.5) * 0.5, fz = z + (rng() - 0.5) * 0.5;
              field.sample(fx, fz, probeA);
              if (probeA.path > 0.18 || probeA.h < waterLevel + 0.05 || probeA.inside) continue;
              add("flower", lib.flower, fx, probeA.h, fz, 0.8 + rng() * 0.6, 0.8 + rng() * 0.8, 0.8 + rng() * 0.6, rng() * 6, palette[Math.floor(rng() * palette.length)], false, 0, 0, flowerMaterial);
            }
          } else if (roll2 < 0.12 * profile.flowers + 0.05) {
            add("tuft", lib.tuft, x, h - 0.01, z, 0.8 + roll3 * 1.0, 0.8 + roll * 1.1, 0.8 + roll3 * 1.0, spin, 0.7 + roll * 0.6, false);
          }
        }
      }
    }

    // Instanciation : un InstancedMesh par type et par secteur.
    const group = new THREE.Group(); group.name = "vegetation";
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    const geometries = new Set();
    for (const bucket of buckets.values()) {
      const count = bucket.items.length;
      const mesh = new THREE.InstancedMesh(bucket.geometry, bucket.material, count);
      mesh.name = bucket.type; mesh.castShadow = bucket.castShadow; mesh.receiveShadow = bucket.castShadow || /rock|crag|cliff/i.test(bucket.type);
      bucket.items.forEach((item, i) => {
        const [x, y, z, sx, sy, sz, ry, tint, tiltX, tiltZ] = item;
        dummy.position.set(x, y, z); dummy.rotation.set(tiltX, ry, tiltZ); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (typeof tint === "number" && tint > 1000) color.setHex(tint); else color.setScalar(tint);
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

    function dispose() {
      group.removeFromParent();
      group.children.forEach((mesh) => mesh.dispose?.());
      geometries.forEach((geometry) => geometry.dispose());
      Object.values(lib).flat().forEach((geometry) => geometry?.dispose?.());
      material.dispose(); flowerMaterial.dispose(); group.clear();
    }
    return { group, stats, dispose };
  }

  E.VegetationManager = { create };
}());
