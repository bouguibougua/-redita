(function () {
  "use strict";
  // Sol des régions en version PC. La texture du modèle de région sert de plan de masse
  // (chemins, plage, variations lentes) ; la matière vient des textures détaillées du paysage
  // (herbe, terre, sable, roche), aux mêmes échelles que le terrain voisin : le raccord entre
  // le plateau et le paysage disparaît. Le plateau VR/MR garde le matériau d'origine
  // (voir TerrainModel.createInstance et Board3D.applyTerrainVisibility).
  const E = window.Eredita = window.Eredita || {};
  const BIOMES = { plaine: 0, montagne: 1, littoral: 2 };
  // Écart rouge − vert (sRGB) de la texture du sol entre l'herbe et la terre/le sable.
  const PATH_RANGE = [[0.03, 0.09], [0.012, 0.042], [0.02, 0.06]];
  // Luminance moyenne de l'herbe de chaque texture (sRGB) : référence du plan de masse.
  const MACRO_LUM = [0.43, 0.37, 0.42];
  let textures = null;

  function shared(THREE) {
    if (!textures) {
      const size = Math.max(256, Math.min(512, E.GraphicsSettings?.profile?.textureSize || 512));
      textures = E.EnvironmentTextures.build(THREE, size, 8);
    }
    return textures;
  }

  // Un matériau partagé par biome, texture et teinte (brûlée ou non) : les reconstructions fréquentes
  // des tuiles ne le libèrent pas, son programme n'est donc jamais détruit puis recompilé.
  const materials = new Map();
  function material(THREE, base, biome) {
    if (!E.EnvironmentTextures || !base?.map) return null;
    const id = String(biome).startsWith("littoral") ? 2 : (BIOMES[biome] ?? 0);
    const key = `${id}|${base.map.uuid}|${base.color.getHexString()}|${base.side}`;
    if (materials.has(key)) return materials.get(key);
    const t = shared(THREE);
    const result = new THREE.MeshStandardMaterial({ map: base.map, color: base.color.clone(), roughness: 0.95, metalness: 0, side: base.side });
    result.name = `${base.name || "sol"}-pc`;
    result.defines = { REGION_BIOME: id };
    result.userData.shared = true;
    materials.set(key, result);
    const uniforms = {
      tGrass: { value: t.grass.albedo }, tRock: { value: t.rock.albedo }, tSand: { value: t.sand.albedo }, tDirt: { value: t.dirt.albedo },
      nGrass: { value: t.grass.normal }, nRock: { value: t.rock.normal }, nSand: { value: t.sand.normal }, nDirt: { value: t.dirt.normal },
      uPath: { value: new THREE.Vector2(...PATH_RANGE[id]) }, uMacroLum: { value: MACRO_LUM[id] },
      // Unités du paysage (construit boardScale fois plus grand) : mêmes fréquences de texture que le terrain voisin.
      uScale: { value: E.Config.environment3d.boardScale || 1 }, uWater: { value: E.Config.environment3d.waterLevel }
    };
    result.userData.uniforms = uniforms;
    result.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>
          uniform float uScale; varying vec3 vRegionPos;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          { vec4 rw = modelMatrix * vec4(transformed, 1.0); vRegionPos = vec3(rw.x * uScale, rw.y, rw.z * uScale); }`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>
          uniform sampler2D tGrass, tRock, tSand, tDirt, nGrass, nRock, nSand, nDirt;
          uniform vec2 uPath; uniform float uMacroLum, uScale, uWater;
          varying vec3 vRegionPos;
          float regionRough = 0.93; vec3 regionTN = vec3(0.0, 0.0, 1.0);
          float rgHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float rgNoise(vec2 p) {
            vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
            return mix(mix(rgHash(i), rgHash(i + vec2(1.0, 0.0)), u.x), mix(rgHash(i + vec2(0.0, 1.0)), rgHash(i + vec2(1.0, 1.0)), u.x), u.y);
          }
          float rgFbm(vec2 p) { return 0.55 * rgNoise(p) + 0.3 * rgNoise(p * 2.03 + 7.1) + 0.15 * rgNoise(p * 4.1 - 3.7); }
          vec3 rgDecode(vec4 t) { return t.xyz * 2.0 - 1.0; }`)
        .replace("#include <map_fragment>", `
          vec4 macro = texture2D(map, vMapUv);
          vec3 srgb = pow(max(macro.rgb, vec3(0.0)), vec3(1.0 / 2.2));
          vec2 P = vRegionPos.xz;
          vec2 uvA = P * 0.21, uvB = P * 1.9 + 0.37;
          float farMix = smoothstep(16.0, 64.0, length(vViewPosition) * uScale), near = 1.0 - farMix;
          // Chemins et plages : lus dans le plan de masse, bords irréguliers comme de la terre battue.
          float path = smoothstep(uPath.x, uPath.y, srgb.r - srgb.g);
          path = smoothstep(0.3, 0.7, path + (rgFbm(P * 2.3) - 0.5) * 0.5);
          // Seules les couches utiles au biome sont lues : herbe + terre (plaine, montagne) ou sable (littoral).
          vec4 gA = texture2D(tGrass, uvA);
          vec3 cG = mix(gA.rgb, texture2D(tGrass, uvB).rgb, 0.5 * near);
          #if REGION_BIOME == 2
            vec4 bA = texture2D(tSand, uvA); vec3 cB = mix(bA.rgb, texture2D(tSand, uvB).rgb, 0.3 * near);
            vec3 nB = rgDecode(texture2D(nSand, uvA));
          #else
            vec4 bA = texture2D(tDirt, uvA); vec3 cB = mix(bA.rgb, texture2D(tDirt, uvB).rgb, 0.4 * near);
            vec3 nB = rgDecode(texture2D(nDirt, uvA));
          #endif
          // Prairie de fin d'été : taches dorées et vertes plus sombres, comme le terrain voisin.
          float tone = rgFbm(P * 0.09 + 3.0) * 2.4 - 1.2, fine = rgFbm(P * 0.35 + 9.0) - 0.5;
          vec3 grass = cG * vec3(1.0 + tone * 0.3 + fine * 0.12, 1.0 + tone * 0.12 + fine * 0.1, 1.0 - tone * 0.3 + fine * 0.06);
          float wB = 0.0, wR = 0.0;
          #if REGION_BIOME == 1
            // Montagne : herbe rase et grise, affleurements de granite clair (gris rosé), chemins de gravier.
            grass *= vec3(0.9, 0.95, 0.92);
            vec4 rA = texture2D(tRock, uvA * 0.8);
            vec3 cR = mix(rA.rgb, texture2D(tRock, uvB * 0.33).rgb, 0.35 * near) * vec3(1.32, 1.26, 1.14);
            float outcrop = smoothstep(0.62, 0.8, rgFbm(P * 0.5 + 11.0)) * (1.0 - path);
            wR = outcrop * 0.7 + path * 0.35; wB = path * 0.65;
          #elif REGION_BIOME == 2
            // Littoral : sable des plages et des chemins.
            wB = path;
          #else
            // Plaine : terre battue des chemins, quelques plaques de terre nue dans l'herbe.
            wB = max(path, smoothstep(0.66, 0.82, rgFbm(P * 0.42 - 5.0)) * 0.45 * (1.0 - path));
          #endif
          float wG = 1.0 - wB - wR;
          vec3 regionAlbedo = grass * wG + cB * wB;
          regionRough = gA.a * wG + bA.a * wB;
          vec3 tn = rgDecode(texture2D(nGrass, uvA)) * wG + nB * wB;
          #if REGION_BIOME == 1
            regionAlbedo += cR * wR; regionRough += rA.a * wR; tn += rgDecode(texture2D(nRock, uvA * 0.8)) * wR;
          #endif
          #if REGION_BIOME == 2
            // Sable mouillé au ras de l'eau.
            regionAlbedo *= mix(1.0, 0.66, (1.0 - smoothstep(uWater - 0.01, uWater + 0.05, vRegionPos.y)) * wB);
          #endif
          // Variations lentes du modèle (zones plus claires ou plus sombres) conservées.
          float macroLum = dot(srgb, vec3(0.3, 0.59, 0.11)) / mix(uMacroLum, uMacroLum * 1.35, path);
          regionAlbedo *= mix(1.0, clamp(macroLum, 0.8, 1.2), 0.45);
          diffuseColor.rgb *= regionAlbedo;
          tn.xy += rgDecode(texture2D(nGrass, uvB)).xy * wG * 0.5 * near;
          tn.xy *= 0.9 * (1.0 - farMix * 0.7);
          regionTN = normalize(vec3(tn.xy, max(tn.z, 0.2)));
        `)
        .replace("#include <roughnessmap_fragment>", "float roughnessFactor = regionRough;")
        .replace("#include <normal_fragment_maps>", `
          {
            vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
            vec2 st0 = dFdx(vRegionPos.xz * 0.21), st1 = dFdy(vRegionPos.xz * 0.21);
            vec3 N = normal;
            vec3 q1p = cross(q1, N), q0p = cross(N, q0);
            vec3 T = q1p * st0.x + q0p * st1.x, B = q1p * st0.y + q0p * st1.y;
            float det = max(dot(T, T), dot(B, B)); float sc = (det == 0.0) ? 0.0 : inversesqrt(det);
            normal = normalize(T * (regionTN.x * sc) + B * (regionTN.y * sc) + N * regionTN.z);
          }
        `);
    };
    result.customProgramCacheKey = () => `eredita-region-ground-${id}`;
    return result;
  }

  // --- Emplacements (version PC) : carré potager bordé de pierres sèches, enclos de paille clôturé ---
  // Le marqueur cylindrique du jeu reste l'objet cliquable ; seuls ses matériaux changent en version PC.
  const slotCache = new Map();
  function canvas(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); draw(g, w, h); return c;
  }
  function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function texture(THREE, image, srgb = true) {
    const t = new THREE.CanvasTexture(image);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  }
  // Mur de pierres sèches (flanc du cylindre : u autour, v en hauteur).
  function stoneWall(g, w, h, rnd, dark) {
    g.fillStyle = dark ? "#2c241f" : "#5b544b"; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 2; row++) {
      let x = -rnd() * 20;
      while (x < w) {
        const sw = 22 + rnd() * 26, y = row * h / 2 + 2, sh = h / 2 - 4, shade = dark ? 40 + rnd() * 25 : 120 + rnd() * 70;
        g.fillStyle = `rgb(${shade * 1.05 | 0},${shade | 0},${shade * 0.9 | 0})`;
        g.beginPath(); g.ellipse(x + sw / 2, y + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2); g.fill();
        x += sw + 2;
      }
    }
  }
  function slotTop(g, w, h, rnd, kind) {
    const cx = w / 2, cy = h / 2, r = w / 2;
    if (kind === "crop") {
      // Terre labourée : sillons parallèles, mottes, quelques pousses.
      g.fillStyle = "#4e3a2a"; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 14) {
        g.fillStyle = "#3a2a1f"; g.fillRect(0, y, w, 5);
        g.fillStyle = "#6a5039"; g.fillRect(0, y + 7, w, 3);
      }
      for (let i = 0; i < 900; i++) { const v = 50 + rnd() * 60; g.fillStyle = `rgba(${v + 30 | 0},${v + 10 | 0},${v | 0},0.5)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
      for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(118,150,62,0.85)"; g.fillRect(rnd() * w, Math.floor(rnd() * h / 14) * 14 + 8, 3, 2); }
    } else if (kind === "animal") {
      // Enclos : terre battue au centre, paille éparse, herbe sur le pourtour.
      const ground = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      ground.addColorStop(0, "#7d6743"); ground.addColorStop(0.7, "#8c7848"); ground.addColorStop(1, "#6c7a3c");
      g.fillStyle = ground; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) {
        const a = rnd() * Math.PI, l = 6 + rnd() * 10, x = rnd() * w, y = rnd() * h, v = 170 + rnd() * 60;
        g.strokeStyle = `rgba(${v | 0},${v * 0.85 | 0},${v * 0.45 | 0},0.7)`; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
    } else {
      g.fillStyle = "#2a211c"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 600; i++) { const v = 25 + rnd() * 40; g.fillStyle = `rgb(${v | 0},${v * 0.9 | 0},${v * 0.85 | 0})`; g.fillRect(rnd() * w, rnd() * h, 3, 3); }
    }
    // Bordure de pierres sur le pourtour du dessus (UV planaires du disque).
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * Math.PI * 2 + rnd() * 0.05, d = r * (0.93 + rnd() * 0.03), s = 6 + rnd() * 4, shade = kind === "burned" ? 45 + rnd() * 20 : 125 + rnd() * 60;
      g.fillStyle = `rgb(${shade * 1.05 | 0},${shade | 0},${shade * 0.9 | 0})`;
      g.beginPath(); g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, s * 0.8, a, 0, Math.PI * 2); g.fill();
    }
  }
  function slotLook(THREE, kind) {
    if (slotCache.has(kind)) return slotCache.get(kind);
    const rnd = seeded(kind === "crop" ? 11 : kind === "animal" ? 23 : 37);
    const top = new THREE.MeshStandardMaterial({ map: texture(THREE, canvas(256, 256, (g, w, h) => slotTop(g, w, h, rnd, kind))), roughness: 0.96, metalness: 0 });
    const side = new THREE.MeshStandardMaterial({ map: texture(THREE, canvas(512, 32, (g, w, h) => stoneWall(g, w, h, rnd, kind === "burned"))), roughness: 0.92, metalness: 0 });
    [top, side].forEach((m) => { m.userData.shared = true; });
    let fence = null;
    if (kind === "animal") {
      // Clôture de l'enclos : piquets et deux lisses circulaires (géométrie partagée).
      const parts = [], wood = 0x6b4e33;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2, post = new THREE.CylinderGeometry(0.011, 0.013, 0.2, 5);
        post.translate(Math.cos(a) * 0.43, 0.1 + 0.025, Math.sin(a) * 0.43); parts.push(post);
      }
      for (const y of [0.11, 0.18]) { const rail = new THREE.TorusGeometry(0.43, 0.0065, 4, 48); rail.rotateX(Math.PI / 2); rail.translate(0, y + 0.025, 0); parts.push(rail); }
      // Fusion simple (positions + normales) : une seule géométrie, un seul appel de dessin par enclos.
      const flat = parts.map((p) => p.toNonIndexed());
      const total = flat.reduce((n, p) => n + p.attributes.position.count, 0);
      const positions = new Float32Array(total * 3), normals = new Float32Array(total * 3);
      let offset = 0;
      for (const p of flat) { positions.set(p.attributes.position.array, offset * 3); normals.set(p.attributes.normal.array, offset * 3); offset += p.attributes.position.count; }
      [...parts, ...flat].forEach((p) => p.dispose());
      const merged = new THREE.BufferGeometry();
      merged.setAttribute("position", new THREE.BufferAttribute(positions, 3)); merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      merged.computeBoundingSphere();
      const material = new THREE.MeshStandardMaterial({ color: wood, roughness: 0.9, metalness: 0 }); material.userData.shared = true;
      fence = { geometry: merged, material };
    }
    // Groupes du cylindre : flanc, dessus, dessous.
    const look = { materials: [side, top, side], fence };
    slotCache.set(kind, look);
    return look;
  }

  E.RegionGround = { material, slotLook };
}());
