(function () {
  "use strict";
  // Environnement extérieur décoratif de la version PC : terrain en chunks, eau, végétation.
  // Il ne contient aucune règle de jeu : les unités ne le traversent pas et le raycast de
  // sélection ne le voit jamais (il n'est pas dans terrainGroup ni dans unitGroup).
  const E = window.Eredita = window.Eredita || {};
  const CHUNK = 12;

  const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  function terrainMaterial(THREE, textures, profile, waterLevel) {
    const simple = profile.textureSize <= 128;
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true });
    const uniforms = {
      tGrass: { value: textures.grass.albedo }, tRock: { value: textures.rock.albedo }, tSand: { value: textures.sand.albedo }, tDirt: { value: textures.dirt.albedo },
      nGrass: { value: textures.grass.normal }, nRock: { value: textures.rock.normal }, nSand: { value: textures.sand.normal }, nDirt: { value: textures.dirt.normal },
      uWater: { value: waterLevel }, uNormalStrength: { value: 0.85 }
    };
    material.userData.uniforms = uniforms;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>
          attribute vec4 splat; varying vec4 vSplat; varying vec3 vTerrainPos; varying vec3 vTerrainN;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vSplat = splat; vTerrainPos = position; vTerrainN = normal;`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>
          uniform sampler2D tGrass, tRock, tSand, tDirt, nGrass, nRock, nSand, nDirt;
          uniform float uWater, uNormalStrength;
          varying vec4 vSplat; varying vec3 vTerrainPos; varying vec3 vTerrainN;
          float terrainRough = 0.9; vec3 terrainTN = vec3(0.0, 0.0, 1.0);
          vec3 decodeN(vec4 t) { return t.xyz * 2.0 - 1.0; }
          vec3 rockTriplanar(vec3 p, vec3 n, float scale) {
            vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
            vec3 a = texture2D(tRock, p.zy * scale).rgb, b = texture2D(tRock, p.xz * scale + 0.31).rgb, c = texture2D(tRock, p.xy * scale + 0.67).rgb;
            return a * w.x + b * w.y + c * w.z;
          }`)
        .replace("#include <map_fragment>", `
          vec4 sp = vSplat; sp = sp * sp * (3.0 - 2.0 * sp); sp /= max(dot(sp, vec4(1.0)), 1e-3);
          vec2 uvA = vTerrainPos.xz * 0.21; vec2 uvB = vTerrainPos.xz * 1.9 + 0.37;
          float farMix = smoothstep(16.0, 64.0, length(vViewPosition));
          ${simple ? `
          vec3 cG = texture2D(tGrass, uvA).rgb, cS = texture2D(tSand, uvA).rgb, cD = texture2D(tDirt, uvA).rgb;` : `
          vec3 cG = mix(texture2D(tGrass, uvA).rgb, texture2D(tGrass, uvB).rgb, 0.5 * (1.0 - farMix));
          vec3 cS = mix(texture2D(tSand, uvA).rgb, texture2D(tSand, uvB).rgb, 0.3 * (1.0 - farMix));
          vec3 cD = mix(texture2D(tDirt, uvA).rgb, texture2D(tDirt, uvB).rgb, 0.4 * (1.0 - farMix));`}
          vec3 cR = rockTriplanar(vTerrainPos, normalize(vTerrainN), 0.17);
          ${simple ? "" : "cR = mix(cR, rockTriplanar(vTerrainPos, normalize(vTerrainN), 0.63), 0.35 * (1.0 - farMix));"}
          vec3 terrainAlbedo = cG * sp.x + cR * sp.y + cS * sp.z + cD * sp.w;
          float wet = 1.0 - smoothstep(uWater - 0.2, uWater - 0.08, vTerrainPos.y);
          terrainAlbedo *= mix(1.0, 0.55, wet * (sp.z + 0.3));
          diffuseColor.rgb *= terrainAlbedo;
          terrainRough = texture2D(tGrass, uvA).a * sp.x + texture2D(tRock, uvA).a * sp.y + texture2D(tSand, uvA).a * sp.z + texture2D(tDirt, uvA).a * sp.w;
          terrainRough = mix(terrainRough, 1.0, wet * 0.0);
          vec3 tn = decodeN(texture2D(nGrass, uvA)) * sp.x + decodeN(texture2D(nRock, uvA)) * sp.y + decodeN(texture2D(nSand, uvA)) * sp.z + decodeN(texture2D(nDirt, uvA)) * sp.w;
          ${simple ? "" : "tn.xy += decodeN(texture2D(nRock, uvB)).xy * sp.y * 0.6 * (1.0 - farMix);"}
          tn.xy *= uNormalStrength * (1.0 - farMix * 0.7);
          terrainTN = normalize(vec3(tn.xy, max(tn.z, 0.2)));
        `)
        .replace("#include <roughnessmap_fragment>", "float roughnessFactor = terrainRough;")
        .replace("#include <normal_fragment_maps>", `
          {
            vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
            vec2 st0 = dFdx(vTerrainPos.xz * 0.21), st1 = dFdy(vTerrainPos.xz * 0.21);
            vec3 N = normal;
            vec3 q1p = cross(q1, N), q0p = cross(N, q0);
            vec3 T = q1p * st0.x + q0p * st1.x, B = q1p * st0.y + q0p * st1.y;
            float det = max(dot(T, T), dot(B, B)); float sc = (det == 0.0) ? 0.0 : inversesqrt(det);
            normal = normalize(T * (terrainTN.x * sc) + B * (terrainTN.y * sc) + N * terrainTN.z);
          }
        `);
    };
    material.customProgramCacheKey = () => `eredita-terrain-${simple ? "s" : "f"}`;
    return material;
  }

  // Éclairage cuit du relief (le soleil est fixe) : ombres portées des crêtes et fonds de vallée,
  // calculés sur une grille grossière de hauteurs. Partagé par le sol et la végétation : un bois à
  // l'ombre d'une crête est plus sombre, ce qui donne leur modelé aux montagnes en vue plongeante.
  const BASIN_RING = [[3, 0], [-3, 0], [0, 3], [0, -3], [2.1, 2.1], [-2.1, 2.1], [2.1, -2.1], [-2.1, -2.1]];
  function buildTerrainLight(field, lim, sun) {
    const STEP = 1.25, margin = 5;
    const minX = lim.minX - margin, minZ = lim.minZ - margin;
    const W = Math.ceil((lim.maxX - lim.minX + 2 * margin) / STEP) + 1, D = Math.ceil((lim.maxZ - lim.minZ + 2 * margin) / STEP) + 1;
    const grid = new Float32Array(W * D);
    for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) grid[j * W + i] = field.heightAt(minX + i * STEP, minZ + j * STEP);
    function height(x, z) {
      const fx = clamp((x - minX) / STEP, 0, W - 1.001), fz = clamp((z - minZ) / STEP, 0, D - 1.001);
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * W + i;
      return (grid[k] * (1 - u) + grid[k + 1] * u) * (1 - v) + (grid[k + W] * (1 - u) + grid[k + W + 1] * u) * v;
    }
    const flat = Math.hypot(sun.x, sun.z) || 1, dx = sun.x / flat, dz = sun.z / flat, rise = sun.y / flat;
    // 0 = plein soleil, 1 = à l'ombre d'un relief ; pénombre plus large pour les reliefs lointains.
    function shadowAt(x, z, h) {
      let block = 0;
      for (let t = 0.8; t < 46; t += t < 8 ? 0.8 : 1.6) {
        const above = height(x + dx * t, z + dz * t) - (h + rise * t + 0.15);
        if (above > 0) { block = Math.max(block, above / (0.4 + t * 0.07)); if (block >= 1) return 1; }
      }
      return block;
    }
    function basinAt(x, z, h) {
      let sum = 0;
      for (const [ox, oz] of BASIN_RING) sum += height(x + ox, z + oz);
      return clamp((sum / BASIN_RING.length - h) * 0.085, 0, 0.32);
    }
    return { shadowAt, basinAt, height };
  }

  // Construit un chunk de terrain ; la grille est étendue d'un anneau pour calculer des normales
  // identiques sur les arêtes partagées. Une jupe masque les fissures entre niveaux de détail.
  function buildChunk(THREE, field, ix, iz, segments, light) {
    const x0 = ix * CHUNK, z0 = iz * CHUNK, step = CHUNK / segments, N = segments + 1, P = N + 2;
    const H = new Float32Array(P * P);
    const attrs = new Float32Array(P * P * 8); // plain, mountain, coast, sea, path, cliff, forest, maquis
    const out = {};
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
      field.sample(x0 + (i - 1) * step, z0 + (j - 1) * step, out);
      const k = j * P + i; H[k] = out.h;
      attrs.set([out.plain, out.mountain, out.coast, out.sea, out.path, out.cliff, out.forest || 0, out.maquis || 0], k * 8);
    }
    const skirt = 4 * N, total = N * N + skirt;
    const positions = new Float32Array(total * 3), normals = new Float32Array(total * 3), colors = new Float32Array(total * 3), splats = new Float32Array(total * 4);
    const noise = field.noise, water = field.waterLevel;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = (j + 1) * P + (i + 1), v = j * N + i;
      const x = x0 + i * step, z = z0 + j * step, h = H[k];
      const dx = (H[k + 1] - H[k - 1]) / (2 * step), dz = (H[k + P] - H[k - P]) / (2 * step);
      const slope = Math.hypot(dx, dz);
      let nx = -dx, ny = 1, nz = -dz; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const plain = attrs[k * 8], coast = attrs[k * 8 + 2], sea = attrs[k * 8 + 3], path = attrs[k * 8 + 4], cliff = attrs[k * 8 + 5];
      const forest = smooth(0.38, 0.74, attrs[k * 8 + 6]), maquis = smooth(0.26, 0.64, attrs[k * 8 + 7]);
      // Le massif de fond prend l'aspect d'une montagne (roche, éboulis) même hors biome montagne.
      const mountain = Math.max(attrs[k * 8 + 1], smooth(1.4, 4.5, h) * (1 - coast * 0.4));
      const jitter = noise.nB.fbm(x * 0.09 + 40, z * 0.09, 2);
      const rock = clamp(smooth(0.5, 1.05, slope) + mountain * smooth(1.8, 5.5, h + jitter * 1.4) * 0.9 + coast * cliff * smooth(0.5, 1.6, h) * 0.8);
      const underwater = sea * smooth(water - 0.02, water - 0.12, h);
      // Plage : une frange au ras de l'eau seulement, près de la mer.
      const beach = coast * smooth(water + 0.22 + jitter * 0.08, water + 0.03, h) * smooth(0.02, 0.25, sea + coast * 0.15);
      let sand = clamp(Math.max(beach, underwater) * (1 - rock * 0.9));
      let dirt = clamp(path * 0.95 + plain * smooth(0.12, 0.55, noise.nD.fbm(x * 0.16 + 9, z * 0.16, 2)) * 0.6 + mountain * 0.25 * (1 - rock));
      dirt *= 1 - sand;
      let grass = clamp(1 - rock - sand - dirt, 0.0, 1);
      if (h > 7.5) { grass *= 1 - smooth(7.5, 10, h); }
      const sum = grass + rock + sand + dirt || 1;
      splats.set([grass / sum, rock / sum, sand / sum, dirt / sum], v * 4);
      // Occlusion ambiante cuite : creux plus sombres, sommets légèrement éclaircis.
      const concavity = (H[k - 1] + H[k + 1] + H[k - P] + H[k + P]) / 4 - h;
      const ao = clamp(1 - concavity * 1.6 / (1 + slope * 0.8), 0.68, 1.08);
      // Variations naturelles de teinte : maquis sombre, herbes sèches, ocres.
      const tone = noise.nB.fbm(x * 0.045 + 50, z * 0.045 - 20, 3), fine = noise.nC.fbm(x * 0.35, z * 0.35, 2);
      // Herbes dorées (tone > 0) et vertes plus sombres (tone < 0), comme une prairie de fin d'été.
      let r = (1 + tone * 0.3 + fine * 0.06) * ao * (1 - mountain * 0.04), g = (1 + tone * 0.12 + fine * 0.05) * ao, b = (1 - tone * 0.3 + fine * 0.03) * ao * (1 + mountain * 0.05);
      // Sous-bois sombre et frais sous les forêts, teinte olive sous le maquis : la végétation tient au sol.
      const under = forest * (1 - rock * 0.7) * (1 - sand), scrub = maquis * (1 - forest) * (1 - rock * 0.7) * (1 - sand);
      r *= 1 - under * 0.34 - scrub * 0.14; g *= 1 - under * 0.22 - scrub * 0.08; b *= 1 - under * 0.3 - scrub * 0.16;
      // Relief à contre-jour : ombre bleutée des crêtes, fonds de vallée assombris.
      if (light && h > water - 0.3) {
        const shade = light.shadowAt(x, z, h), basin = light.basinAt(x, z, h);
        r *= (1 - shade * 0.42) * (1 - basin); g *= (1 - shade * 0.38) * (1 - basin); b *= (1 - shade * 0.24) * (1 - basin * 0.8);
      }
      colors.set([r, g, b], v * 3);
      positions.set([x, h, z], v * 3); normals.set([nx, ny, nz], v * 3);
    }
    // Jupes sur les quatre bords.
    let s = N * N;
    const edge = (vertexAt) => {
      for (let i = 0; i < N; i++) {
        const src = vertexAt(i), dst = s++;
        positions[dst * 3] = positions[src * 3]; positions[dst * 3 + 1] = positions[src * 3 + 1] - 2.2; positions[dst * 3 + 2] = positions[src * 3 + 2];
        normals.copyWithin(dst * 3, src * 3, src * 3 + 3); colors.copyWithin(dst * 3, src * 3, src * 3 + 3); splats.copyWithin(dst * 4, src * 4, src * 4 + 4);
      }
    };
    edge((i) => i); edge((i) => (N - 1) * N + i); edge((i) => i * N); edge((i) => i * N + N - 1);
    const indices = [];
    for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
    const base = N * N;
    const skirtQuads = (offset, top, flip) => {
      for (let i = 0; i < segments; i++) {
        const a = top(i), b = top(i + 1), c = base + offset * N + i, d = c + 1;
        if (flip) indices.push(a, b, c, b, d, c); else indices.push(a, c, b, b, c, d);
      }
    };
    skirtQuads(0, (i) => i, false); skirtQuads(1, (i) => (N - 1) * N + i, true); skirtQuads(2, (i) => i * N, true); skirtQuads(3, (i) => i * N + N - 1, false);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("splat", new THREE.BufferAttribute(splats, 4));
    geometry.setIndex(indices);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  }

  // Les régions arrivent en coordonnées du jeu. Avec une échelle de présentation k, le paysage est
  // construit autour de régions k fois plus grandes puis son groupe est réduit de 1/k : les villages
  // paraissent plus grands face au décor sans toucher au plateau ni aux coordonnées du jeu.
  // `tile` (repères du décor, grille du sol) et `slots` restent en unités de la tuile : `scale` les convertit.
  function scaleRegions(regions, k) {
    return (regions || []).map((r) => ({ ...r, cx: r.cx * k, cz: r.cz * k, hw: r.hw * k, hd: r.hd * k, scale: k,
      water: r.water ? { z0: r.water.z0 * k, z1: r.water.z1 * k } : r.water }));
  }

  function create(THREE, options) {
    const { renderer, seed, profile, camera } = options;
    const cfg = E.Config.environment3d;
    const k = options.presentationScale || 1, extent = options.extent * k;
    const regions = scaleRegions(options.regions, k);
    const waterLevel = cfg.waterLevel * k;
    const field = E.TerrainGenerator.create({ regions, seed, waterLevel, boardScale: k });
    const group = new THREE.Group(); group.name = "environnement-corse";
    group.scale.setScalar(1 / k);
    const disposables = [];
    const textures = E.EnvironmentTextures.build(THREE, profile.textureSize, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
    const material = terrainMaterial(THREE, textures, profile, waterLevel);
    disposables.push(material);

    const bounds = field.bounds;
    const lim = { minX: bounds.minX - extent, maxX: bounds.maxX + extent, minZ: bounds.minZ - extent, maxZ: bounds.maxZ + extent };
    const sunVector = (cfg.sunDirection || [-0.36, 0.64, 0.56]), sunLength = Math.hypot(...sunVector);
    const light = buildTerrainLight(field, lim, { x: sunVector[0] / sunLength, y: sunVector[1] / sunLength, z: sunVector[2] / sunLength });
    const terrain = new THREE.Group(); terrain.name = "terrain-chunks"; group.add(terrain);
    let triangles = 0, chunks = 0;
    const started = performance.now();
    for (let ix = Math.floor(lim.minX / CHUNK); ix < Math.ceil(lim.maxX / CHUNK); ix++) {
      for (let iz = Math.floor(lim.minZ / CHUNK); iz < Math.ceil(lim.maxZ / CHUNK); iz++) {
        const cx = ix * CHUNK + CHUNK / 2, cz = iz * CHUNK + CHUNK / 2;
        const d = field.distanceToBoard(cx, cz) - CHUNK * 0.7;
        const full = profile.chunkSegments;
        const segments = d < 6 ? full : d < 26 ? Math.max(8, full >> 1) : Math.max(5, full >> 2);
        const geometry = buildChunk(THREE, field, ix, iz, segments, light);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true; mesh.castShadow = false; mesh.matrixAutoUpdate = false; mesh.userData.decorative = true;
        mesh.raycast = () => {};
        terrain.add(mesh); disposables.push(geometry);
        triangles += geometry.index.count / 3; chunks++;
      }
    }
    const buildMs = performance.now() - started;

    const water = E.WaterRenderer?.create(THREE, { field, extent: lim, profile, textures, scene: options.scene });
    if (water) { group.add(water.mesh); }
    let vegetation = E.VegetationManager?.create(THREE, { field, extent: lim, profile, models: options.models || null, light });
    if (vegetation) group.add(vegetation.group);

    // Régions brûlées : leur végétation disparaît (les rochers restent), comme sur les modèles d'origine.
    const burnedRegions = new Map();
    function applyBurned() {
      for (const [key, meshes] of vegetation?.regions || []) {
        const burned = burnedRegions.get(key) || false;
        meshes.forEach((mesh) => { if (mesh.userData.burnable) mesh.visible = !burned; });
      }
    }
    function setRegionBurned(owner, lane, burned) {
      const key = `${owner}:${lane}`;
      if ((burnedRegions.get(key) || false) === Boolean(burned)) return;
      burnedRegions.set(key, Boolean(burned)); applyBurned();
    }
    // Habillage d'une région : décor du paysage à la place de celui du modèle, mer du paysage sur le littoral.
    function regionDressing(owner, lane) {
      const region = field.regions.find((r) => r.owner === owner && r.lane === lane);
      if (!region?.tile) return null;
      return { decor: Boolean(vegetation?.regions?.has(`${owner}:${lane}`)), water: region.biome === "littoral" && Boolean(water) };
    }

    // Les modèles Tripo arrivent après la première image : seule la végétation est reconstruite.
    // L'ancienne reste (masquée) deux images de plus : ses matériaux gardent les programmes de shaders,
    // que la nouvelle réutilise au lieu de les recompiler.
    let retired = null;
    function setModels(models) {
      if (!E.VegetationManager || !models || !Object.keys(models).length) return;
      const next = E.VegetationManager.create(THREE, { field, extent: lim, profile, models, light });
      if (retired) retired.vegetation.dispose();
      if (vegetation) { vegetation.group.visible = false; retired = { vegetation, frames: 2 }; }
      vegetation = next; group.add(next.group); applyBurned();
    }

    function update(time, view) {
      water?.update(time, view);
      vegetation?.update?.(time);
      if (retired && --retired.frames <= 0) { retired.vegetation.dispose(); retired = null; }
    }

    function dispose() {
      group.removeFromParent();
      water?.dispose(); vegetation?.dispose(); retired?.vegetation.dispose(); retired = null;
      disposables.forEach((item) => item.dispose?.());
      Object.values(textures).forEach((pair) => { pair.albedo.dispose(); pair.normal.dispose(); });
      group.clear();
    }

    // Interface en coordonnées de scène ; `field` et `localExtent` restent en unités du paysage.
    const sceneExtent = { minX: lim.minX / k, maxX: lim.maxX / k, minZ: lim.minZ / k, maxZ: lim.maxZ / k };
    return { group, field, extent: sceneExtent, localExtent: lim, presentationScale: k, update, dispose, setModels, setRegionBurned, regionDressing,
      heightAt: (x, z) => field.heightAt(x * k, z * k) / k,
      get diagnostics() { return { chunks, triangles: triangles + (vegetation?.stats.triangles || 0), terrainTriangles: triangles, buildMs, vegetation: vegetation?.stats || null, seed: field.seed, quality: profile.label }; } };
  }

  E.Environment = { create, CHUNK };
}());
