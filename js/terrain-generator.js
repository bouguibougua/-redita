(function () {
  "use strict";
  // Terrain procédural décoratif autour des régions jouables (version PC uniquement).
  // Module sans dépendance à Three.js : un champ de hauteur déterministe à partir d'une
  // graine et de la disposition des biomes. Aucune règle de jeu n'en dépend.
  const E = window.Eredita = window.Eredita || {};

  const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  function hashString(text) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Bruit de gradient 2D (valeurs ≈ [-1, 1]) et sa variante périodique pour les textures.
  const GRADIENTS = (() => {
    const table = new Float32Array(512);
    for (let i = 0; i < 256; i++) { const a = i / 256 * Math.PI * 2; table[i * 2] = Math.cos(a); table[i * 2 + 1] = Math.sin(a); }
    return table;
  })();
  function lattice(ix, iz, seed) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) & 255;
  }
  function gradientNoise(x, z, seed, period) {
    const x0 = Math.floor(x), z0 = Math.floor(z);
    const fx = x - x0, fz = z - z0;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
    let ix0 = x0, iz0 = z0, ix1 = x0 + 1, iz1 = z0 + 1;
    if (period) { ix0 = ((ix0 % period) + period) % period; ix1 = ((ix1 % period) + period) % period; iz0 = ((iz0 % period) + period) % period; iz1 = ((iz1 % period) + period) % period; }
    const g00 = lattice(ix0, iz0, seed) * 2, g10 = lattice(ix1, iz0, seed) * 2, g01 = lattice(ix0, iz1, seed) * 2, g11 = lattice(ix1, iz1, seed) * 2;
    const n00 = GRADIENTS[g00] * fx + GRADIENTS[g00 + 1] * fz;
    const n10 = GRADIENTS[g10] * (fx - 1) + GRADIENTS[g10 + 1] * fz;
    const n01 = GRADIENTS[g01] * fx + GRADIENTS[g01 + 1] * (fz - 1);
    const n11 = GRADIENTS[g11] * (fx - 1) + GRADIENTS[g11 + 1] * (fz - 1);
    return (mix(mix(n00, n10, u), mix(n01, n11, u), v)) * 1.41;
  }

  function createNoise(seed) {
    const s = seed | 0;
    const n2 = (x, z) => gradientNoise(x, z, s);
    function fbm(x, z, octaves = 4) {
      let amplitude = 1, frequency = 1, sum = 0, norm = 0;
      for (let i = 0; i < octaves; i++) {
        // Légère rotation entre octaves : évite l'alignement visible sur les axes.
        const rx = x * frequency * 0.9397 - z * frequency * 0.3420, rz = x * frequency * 0.3420 + z * frequency * 0.9397;
        sum += gradientNoise(rx + i * 17.3, rz - i * 9.1, s + i * 31) * amplitude; norm += amplitude;
        amplitude *= 0.5; frequency *= 2.03;
      }
      return sum / norm;
    }
    function ridged(x, z, octaves = 4) {
      let amplitude = 1, frequency = 1, sum = 0, norm = 0;
      for (let i = 0; i < octaves; i++) {
        const rx = x * frequency * 0.9397 + z * frequency * 0.3420, rz = -x * frequency * 0.3420 + z * frequency * 0.9397;
        let n = 1 - Math.abs(gradientNoise(rx + i * 13.7, rz + i * 5.3, s + 7 + i * 29));
        n = n * n; sum += n * amplitude; norm += amplitude; amplitude *= 0.5; frequency *= 2.1;
      }
      return sum / norm;
    }
    return { n2, fbm, ridged };
  }

  const BIOMES = { plaine: 0, montagne: 1, littoral: 2 };

  // regions : [{ cx, cz, hw, hd, biome, owner, lane, water?: {z0, z1} }]
  // Les zones d'eau déclarées (littoral) sont prolongées vers l'extérieur aux extrémités du plateau.
  function create({ regions, seed = "eredita", waterLevel = 0.045 }) {
    const rootSeed = hashString(String(seed));
    const rng = mulberry32(rootSeed);
    const nA = createNoise(rootSeed ^ 0x1234567), nB = createNoise(rootSeed ^ 0x2345678),
      nC = createNoise(rootSeed ^ 0x3456789), nD = createNoise(rootSeed ^ 0x4567890), nE = createNoise(rootSeed ^ 0x5678901);
    const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const r of regions) {
      bounds.minX = Math.min(bounds.minX, r.cx - r.hw); bounds.maxX = Math.max(bounds.maxX, r.cx + r.hw);
      bounds.minZ = Math.min(bounds.minZ, r.cz - r.hd); bounds.maxZ = Math.max(bounds.maxZ, r.cz + r.hd);
    }
    const centerX = (bounds.minX + bounds.maxX) / 2, centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const boardHalfX = (bounds.maxX - bounds.minX) / 2;
    const TAU = 2.7, FLOOR = waterLevel;

    // Bandes d'eau des littoraux (prolongées au-delà des bords latéraux du plateau).
    const bands = [];
    for (const r of regions) {
      if (r.biome !== "littoral" || !r.water) continue;
      const left = r.cx - r.hw <= bounds.minX + 0.05, right = r.cx + r.hw >= bounds.maxX - 0.05;
      if (left) bands.push({ side: -1, edge: bounds.minX, z0: r.water.z0, z1: r.water.z1 });
      if (right) bands.push({ side: 1, edge: bounds.maxX, z0: r.water.z0, z1: r.water.z1 });
    }

    // Chemins de terre : une piste par région de plaine, depuis le bord extérieur de la région.
    const paths = [];
    for (const r of regions) {
      if (r.biome !== "plaine") continue;
      const northRow = r.cz < centerZ;
      const atLeft = r.cx - r.hw <= bounds.minX + 0.05, atRight = r.cx + r.hw >= bounds.maxX - 0.05;
      const lateral = (atLeft || atRight) && rng() < 0.5;
      let x, z, heading;
      if (lateral) { x = atLeft ? bounds.minX : bounds.maxX; z = r.cz + (rng() - 0.5) * r.hd; heading = atLeft ? Math.PI : 0; }
      else { x = r.cx + (rng() - 0.5) * r.hw * 1.2; z = northRow ? bounds.minZ : bounds.maxZ; heading = northRow ? -Math.PI / 2 : Math.PI / 2; }
      const points = [[x, z]];
      const steps = 9 + Math.floor(rng() * 4);
      for (let i = 0; i < steps; i++) {
        heading += (rng() - 0.5) * 0.9;
        x += Math.cos(heading) * 3.1; z += Math.sin(heading) * 3.1;
        points.push([x, z]);
      }
      paths.push({ points, width: 0.34 + rng() * 0.12 });
    }

    function distanceToBoard(x, z) {
      const dx = Math.max(bounds.minX - x, 0, x - bounds.maxX), dz = Math.max(bounds.minZ - z, 0, z - bounds.maxZ);
      return Math.hypot(dx, dz);
    }

    function pathMask(x, z) {
      let best = 0;
      for (const path of paths) {
        const pts = path.points;
        for (let i = 0; i < pts.length - 1; i++) {
          const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
          const vx = bx - ax, vz = bz - az, len2 = vx * vx + vz * vz;
          let t = ((x - ax) * vx + (z - az) * vz) / len2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
          const width = path.width * (1 + 0.35 * Math.sin((i + t) * 2.1));
          if (d > width * 1.6) continue;
          const along = (i + t) / (pts.length - 1);
          const mask = (1 - smooth(width * 0.45, width * 1.15, d)) * (1 - smooth(0.7, 1, along));
          if (mask > best) best = mask;
        }
      }
      return best;
    }

    // Poids de biome (plaine, montagne, littoral) autour d'un point, fondus sur quelques unités.
    function biomeWeights(x, z, out) {
      const wx = x + 5.5 * nB.fbm(x * 0.05, z * 0.05, 2), wz = z + 5.5 * nB.fbm(x * 0.05 + 31.7, z * 0.05 - 17.3, 2);
      let minDistance = Infinity;
      const distances = regions.map((r) => {
        const dx = Math.max(Math.abs(wx - r.cx) - r.hw, 0), dz = Math.max(Math.abs(wz - r.cz) - r.hd, 0);
        const d = Math.hypot(dx, dz); if (d < minDistance) minDistance = d; return d;
      });
      let a = 0, b = 0, c = 0;
      regions.forEach((r, i) => {
        const w = Math.exp(-(distances[i] - minDistance) / TAU);
        if (r.biome === "plaine") a += w; else if (r.biome === "montagne") b += w; else c += w;
      });
      const total = a + b + c || 1;
      out.plain = a / total; out.mountain = b / total; out.coast = c / total;
      return out;
    }

    const wtmp = { plain: 1, mountain: 0, coast: 0 };
    const innerOut = { h: 0, sea: 0 };
    // Sous les régions jouables : le sol reste caché sous les modèles de terrain ; seule la
    // bande étroite de la frontière est visible (mer continue si un des deux côtés est littoral).
    function interior(x, z) {
      if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return null;
      if (Math.abs(z - centerZ) < 0.19) {
        const sea = regions.some((r) => r.biome === "littoral" && x >= r.cx - r.hw && x <= r.cx + r.hw);
        innerOut.h = sea ? FLOOR - 0.3 : 0.02; innerOut.sea = sea ? 1 : 0; return innerOut;
      }
      const region = regions.find((r) => Math.abs(x - r.cx) <= r.hw && Math.abs(z - r.cz) <= r.hd);
      innerOut.h = region && region.biome === "littoral" ? -0.3 : 0.008; innerOut.sea = 0; return innerOut;
    }

    // Hauteur et caractéristiques d'un point. `out` est réutilisé pour éviter les allocations.
    function sample(x, z, out = {}) {
      const inner = interior(x, z);
      if (inner) { out.h = inner.h; out.plain = 1; out.mountain = 0; out.coast = 0; out.sea = inner.sea; out.dist = 0; out.path = 0; out.cliff = 0; out.inside = true; return out; }
      out.inside = false;
      const w = biomeWeights(x, z, wtmp);
      const db = distanceToBoard(x, z);
      const dd = Math.max(0, db + 1.3 * nC.fbm(x * 0.08, z * 0.08, 2) * smooth(0, 2.5, db));
      // Plaine : collines légères, presque plat près des régions.
      const hillEnv = smooth(0.5, 7, dd);
      const plainH = hillEnv * (1.1 * nD.fbm(x * 0.05, z * 0.05, 3) + 0.25 * nD.fbm(x * 0.2 + 5, z * 0.2, 2) + 0.35);
      // Montagne : massif de crêtes. La pente reste douce côté caméra pour ne pas masquer le plateau.
      const near = smooth(0, 9, centerX - boardHalfX - x);
      const occlusion = 1 - 0.82 * near;
      const mEnv = Math.pow(smooth(0.6, 15, dd), 0.95);
      const ridge = nE.ridged(x * 0.03, z * 0.03, 5);
      const massif = 0.5 + 0.5 * nE.fbm(x * 0.014 + 3.1, z * 0.014 - 8.2, 2);
      const mountainH = mEnv * occlusion * (2.6 + 15 * (0.35 * massif + 0.65 * ridge)) + 0.7 * mEnv * nD.fbm(x * 0.28, z * 0.28, 3) + 0.35 * smooth(0.4, 5, dd);
      // Littoral : plages, criques, falaises puis mer.
      const cliffZone = smooth(0.12, 0.42, nA.fbm(x * 0.032 + 7.7, z * 0.032, 2));
      const shoreDistance = 4.4 + 2.8 * nB.fbm(x * 0.05 + 2.1, z * 0.05, 3);
      const t = dd - shoreDistance;
      // Terre littorale : collines de maquis qui ne redescendent vers l'eau qu'au rivage (plage étroite).
      const rise = smooth(0.3, 3.2, dd) * (1 - smooth(-2.4, -0.2, t));
      const land = FLOOR + 0.06 + rise * (0.32 + 0.5 * (0.5 + 0.5 * nD.fbm(x * 0.1, z * 0.1, 2))) + cliffZone * 2.1 * smooth(-4.6, -1.4, t);
      const seaT = smooth(-0.35 - 1.7 * (1 - cliffZone), 0.8 + 1.1 * (1 - cliffZone), t) * smooth(0.38, 0.68, w.coast);
      const seabed = FLOOR - 0.23 - 2.8 * smooth(0, 13, t) + 0.25 * nC.fbm(x * 0.15, z * 0.15, 2);
      let coastH = mix(land, seabed, seaT);
      let sea = seaT;

      // Prolongement des mers des régions littorales vers l'extérieur du plateau.
      let bandMask = 0, bandBed = 0;
      for (const band of bands) {
        const e = band.side < 0 ? band.edge - x : x - band.edge;
        if (e <= -0.2) continue;
        const open = smooth(2, 16, e);
        const z0 = band.z0 - open * 6 - 0.6 * nC.fbm(x * 0.2, z * 0.2, 2), z1 = band.z1 + open * 6 + 0.6 * nC.fbm(x * 0.2 + 9, z * 0.2, 2);
        const soft = 0.7 + 6 * open;
        const inside = smooth(z0, z0 + soft, z) * (1 - smooth(z1 - soft, z1, z)) * smooth(-0.3, 0.0, e);
        if (inside > bandMask) {
          bandMask = inside;
          bandBed = FLOOR - 0.23 - 0.35 * smooth(0, 5, e) - 2.2 * smooth(3, 18, e) + 0.18 * nC.fbm(x * 0.17, z * 0.17, 2);
        }
      }

      let h = plainH * w.plain + mountainH * w.mountain + coastH * w.coast;
      if (bandMask > 0) { h = mix(h, bandBed, bandMask); sea = Math.max(sea, bandMask); }
      // Berge basse de part et d'autre des mers prolongées : l'eau (surface à 0,11) ne déborde pas sur la prairie.
      for (const band of bands) {
        const e = band.side < 0 ? band.edge - x : x - band.edge;
        if (e < -0.2 || e > 40) continue;
        const outside = Math.max(band.z0 - z, z - band.z1, 0) / Math.max(1, 1 + smooth(2, 16, e) * 6);
        const bank = (1 - bandMask) * (1 - smooth(0, 1.7, outside)) * smooth(-0.2, 0.6, e);
        if (bank > 0) h = mix(h, Math.max(h, FLOOR + 0.05), bank);
      }
      // Toile de fond : un massif corse ferme l'horizon côté lointain et sur les côtés, quels que soient les biomes.
      // Côté caméra il reste bas (occlusion) pour ne jamais masquer le plateau.
      const backDistance = Math.max(x - bounds.maxX - 3, Math.abs(z - centerZ) - (bounds.maxZ - centerZ) - 6) + 3 * nC.fbm(x * 0.04 + 3, z * 0.04, 2);
      // Les mers prolongées percent le massif (golfe) au lieu de buter dessus.
      const ring = smooth(0, 10, backDistance) * occlusion * (1 - 0.95 * bandMask);
      if (ring > 0) {
        const peaks = 0.5 + 0.5 * nA.fbm(x * 0.02 - 4.4, z * 0.02 + 1.9, 2);
        h += ring * (1 - 0.65 * w.mountain) * (2 + 21 * (0.3 * peaks + 0.7 * ridge) * (0.55 + 0.45 * peaks));
      }
      h = mix(h, 0.02, (1 - smooth(0, 0.5, db)) * (1 - w.coast));
      const path = pathMask(x, z) * w.plain;
      h -= path * 0.035;
      out.h = h; out.plain = w.plain; out.mountain = w.mountain; out.coast = w.coast;
      out.sea = sea; out.dist = db; out.path = path; out.cliff = cliffZone;
      return out;
    }

    const probe = {};
    function heightAt(x, z) { return sample(x, z, probe).h; }

    // Rayon à couvrir pour que les bords du monde restent hors champ.
    return { seed: String(seed), bounds, centerX, centerZ, waterLevel, regions, paths, bands, sample, heightAt, distanceToBoard, pathMask, biomeWeights,
      noise: { nA, nB, nC, nD, nE }, random: mulberry32(rootSeed ^ 0x9e3779b9) };
  }

  E.TerrainGenerator = { create, createNoise, gradientNoise, hashString, mulberry32, smooth, mix, BIOMES };
}());
