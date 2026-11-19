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
          terrainAlbedo *= mix(1.0, 0.72, wet * (sp.z + 0.2));
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

  // Construit un chunk de terrain ; la grille est étendue d'un anneau pour calculer des normales
  // identiques sur les arêtes partagées. Une jupe masque les fissures entre niveaux de détail.
  function buildChunk(THREE, field, ix, iz, segments) {
    const x0 = ix * CHUNK, z0 = iz * CHUNK, step = CHUNK / segments, N = segments + 1, P = N + 2;
    const H = new Float32Array(P * P);
    const attrs = new Float32Array(P * P * 6); // plain, mountain, coast, sea, path, cliff
    const out = {};
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
      field.sample(x0 + (i - 1) * step, z0 + (j - 1) * step, out);
      const k = j * P + i; H[k] = out.h;
      attrs[k * 6] = out.plain; attrs[k * 6 + 1] = out.mountain; attrs[k * 6 + 2] = out.coast; attrs[k * 6 + 3] = out.sea; attrs[k * 6 + 4] = out.path; attrs[k * 6 + 5] = out.cliff;
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
      const plain = attrs[k * 6], mountain = attrs[k * 6 + 1], coast = attrs[k * 6 + 2], sea = attrs[k * 6 + 3], path = attrs[k * 6 + 4], cliff = attrs[k * 6 + 5];
      const jitter = noise.nB.fbm(x * 0.09 + 40, z * 0.09, 2);
      const rock = clamp(smooth(0.5, 1.05, slope) + mountain * smooth(1.8, 5.5, h + jitter * 1.4) * 0.9 + coast * cliff * smooth(0.5, 1.6, h) * 0.8);
      const underwater = sea * smooth(water - 0.02, water - 0.12, h);
      const beach = coast * smooth(water + 0.55 + jitter * 0.12, water + 0.05, h);
      let sand = clamp(Math.max(beach, underwater) * (1 - rock * 0.9));
      let dirt = clamp(path * 0.95 + plain * smooth(0.25, 0.6, noise.nD.fbm(x * 0.16 + 9, z * 0.16, 2)) * 0.45 + mountain * 0.25 * (1 - rock));
      dirt *= 1 - sand;
      let grass = clamp(1 - rock - sand - dirt, 0.0, 1);
      if (h > 7.5) { grass *= 1 - smooth(7.5, 10, h); }
      const sum = grass + rock + sand + dirt || 1;
      splats.set([grass / sum, rock / sum, sand / sum, dirt / sum], v * 4);
      // Occlusion ambiante cuite : creux plus sombres, sommets légèrement éclaircis.
      const concavity = (H[k - 1] + H[k + 1] + H[k - P] + H[k + P]) / 4 - h;
      const ao = clamp(1 - concavity * 1.6, 0.55, 1.08);
      // Variations naturelles de teinte : maquis sombre, herbes sèches, ocres.
      const tone = noise.nB.fbm(x * 0.045 + 50, z * 0.045 - 20, 3), fine = noise.nC.fbm(x * 0.35, z * 0.35, 2);
      const r = (1 + tone * 0.16 + fine * 0.05) * ao * (1 - mountain * 0.04), g = (1 + tone * 0.07 + fine * 0.04) * ao, b = (1 - tone * 0.18 + fine * 0.03) * ao * (1 + mountain * 0.05);
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

  function create(THREE, options) {
    const { renderer, regions, seed, profile, extent, camera } = options;
    const cfg = E.Config.environment3d;
    const field = E.TerrainGenerator.create({ regions, seed, waterLevel: cfg.waterLevel });
    const group = new THREE.Group(); group.name = "environnement-corse";
    const disposables = [];
    const textures = E.EnvironmentTextures.build(THREE, profile.textureSize, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
    const material = terrainMaterial(THREE, textures, profile, cfg.waterLevel);
    disposables.push(material);

    const bounds = field.bounds;
    const lim = { minX: bounds.minX - extent, maxX: bounds.maxX + extent, minZ: bounds.minZ - extent, maxZ: bounds.maxZ + extent };
    const terrain = new THREE.Group(); terrain.name = "terrain-chunks"; group.add(terrain);
    let triangles = 0, chunks = 0;
    const started = performance.now();
    for (let ix = Math.floor(lim.minX / CHUNK); ix < Math.ceil(lim.maxX / CHUNK); ix++) {
      for (let iz = Math.floor(lim.minZ / CHUNK); iz < Math.ceil(lim.maxZ / CHUNK); iz++) {
        const cx = ix * CHUNK + CHUNK / 2, cz = iz * CHUNK + CHUNK / 2;
        const d = field.distanceToBoard(cx, cz) - CHUNK * 0.7;
        const full = profile.chunkSegments;
        const segments = d < 6 ? full : d < 26 ? Math.max(8, full >> 1) : Math.max(5, full >> 2);
        const geometry = buildChunk(THREE, field, ix, iz, segments);
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
    let vegetation = E.VegetationManager?.create(THREE, { field, extent: lim, profile, models: options.models || null });
    if (vegetation) group.add(vegetation.group);

    // Les modèles Tripo arrivent après la première image : seule la végétation est reconstruite.
    function setModels(models) {
      if (!E.VegetationManager || !models || !Object.keys(models).length) return;
      const next = E.VegetationManager.create(THREE, { field, extent: lim, profile, models });
      vegetation?.dispose(); vegetation = next; group.add(next.group);
    }

    function update(time, view) {
      water?.update(time, view);
    }

    function dispose() {
      group.removeFromParent();
      water?.dispose(); vegetation?.dispose();
      disposables.forEach((item) => item.dispose?.());
      Object.values(textures).forEach((pair) => { pair.albedo.dispose(); pair.normal.dispose(); });
      group.clear();
    }

    return { group, field, extent: lim, update, dispose, setModels, heightAt: field.heightAt,
      get diagnostics() { return { chunks, triangles: triangles + (vegetation?.stats.triangles || 0), terrainTriangles: triangles, buildMs, vegetation: vegetation?.stats || null, seed: field.seed }; } };
  }

  E.Environment = { create, CHUNK };
}());
