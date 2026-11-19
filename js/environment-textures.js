(function () {
  "use strict";
  // Textures PBR procédurales du paysage : albédo + rugosité (alpha) et normal maps, toutes sans couture.
  // Aucun fichier image n'est requis ; les textures sont générées une fois par session et partagées.
  const E = window.Eredita = window.Eredita || {};
  const G = () => E.TerrainGenerator;

  function periodicFbm(u, v, base, octaves, seed) {
    let amplitude = 1, sum = 0, norm = 0, period = base;
    for (let i = 0; i < octaves; i++) {
      sum += G().gradientNoise(u * period, v * period, seed + i * 13, period) * amplitude;
      norm += amplitude; amplitude *= 0.5; period *= 2;
    }
    return sum / norm;
  }

  const hex = (value) => [(value >> 16 & 255), (value >> 8 & 255), (value & 255)];
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;

  // Chaque matériau est décrit par une fonction (u, v) → { color:[r,g,b], rough, height }.
  const materials = {
    grass(u, v) {
      const broad = periodicFbm(u, v, 3, 4, 11) * 0.5 + 0.5;
      const patch = periodicFbm(u, v, 7, 3, 23) * 0.5 + 0.5;
      const blade = periodicFbm(u, v, 48, 2, 41) * 0.5 + 0.5;
      // Prairie corse : vert franc, plaques dorées d'herbe sèche, touffes sombres.
      const dry = [170, 146, 72], green = [92, 116, 46], dark = [50, 70, 32];
      let c = lerp3(green, dry, clamp((broad - 0.44) * 1.5));
      c = lerp3(c, dark, clamp((patch - 0.55) * 2.2));
      const shade = 0.82 + blade * 0.36;
      return { color: [c[0] * shade, c[1] * shade, c[2] * shade], rough: 0.93, height: blade * 0.7 + patch * 0.3 };
    },
    rock(u, v) {
      const broad = periodicFbm(u, v, 3, 4, 71) * 0.5 + 0.5;
      const crack = 1 - Math.abs(periodicFbm(u, v, 5, 4, 83));
      const grain = periodicFbm(u, v, 64, 2, 97) * 0.5 + 0.5;
      const strata = Math.sin((v * 9 + periodicFbm(u, v, 4, 2, 5) * 1.2) * Math.PI * 2) * 0.5 + 0.5;
      const light = [168, 160, 148], dark = [96, 92, 86], pink = [158, 134, 122];
      let c = lerp3(dark, light, clamp(broad * 0.9 + grain * 0.25 - 0.1));
      c = lerp3(c, pink, clamp((periodicFbm(u, v, 5, 3, 3) + 0.2) * 0.45));
      const crevice = clamp((crack - 0.78) * 4.5);
      const shade = 1 - crevice * 0.55 - strata * 0.06;
      return { color: [c[0] * shade, c[1] * shade, c[2] * shade], rough: 0.82 + crevice * 0.1, height: (1 - crevice) * 0.7 + grain * 0.3 };
    },
    sand(u, v) {
      const broad = periodicFbm(u, v, 3, 3, 301) * 0.5 + 0.5;
      const grain = periodicFbm(u, v, 96, 1, 311) * 0.5 + 0.5;
      const ripple = Math.sin((u * 18 + periodicFbm(u, v, 3, 2, 321) * 2.2) * Math.PI * 2) * 0.5 + 0.5;
      let c = lerp3([206, 188, 142], [226, 210, 164], broad);
      const shade = 0.93 + grain * 0.12 - ripple * 0.04;
      return { color: [c[0] * shade, c[1] * shade, c[2] * shade], rough: 0.96, height: ripple * 0.35 + grain * 0.35 };
    },
    dirt(u, v) {
      const broad = periodicFbm(u, v, 4, 4, 401) * 0.5 + 0.5;
      const pebbles = clamp((periodicFbm(u, v, 40, 2, 419) * 0.5 + 0.5 - 0.55) * 4);
      let c = lerp3([112, 84, 54], [160, 128, 88], broad);
      c = lerp3(c, [186, 168, 134], pebbles * 0.55);
      return { color: c, rough: 0.94, height: broad * 0.4 + pebbles * 0.6 };
    },
    // Petite normale tuilable pour les vagues.
    water(u, v) {
      const a = periodicFbm(u, v, 6, 4, 601) * 0.5 + 0.5;
      return { color: [128, 128, 128], rough: 0.2, height: a };
    }
  };

  function build(THREE, size, anisotropy) {
    const result = {};
    for (const [name, fn] of Object.entries(materials)) {
      const albedo = new Uint8Array(size * size * 4), heights = new Float32Array(size * size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const s = fn(x / size, y / size), i = y * size + x;
        albedo[i * 4] = clamp(s.color[0], 0, 255); albedo[i * 4 + 1] = clamp(s.color[1], 0, 255); albedo[i * 4 + 2] = clamp(s.color[2], 0, 255);
        albedo[i * 4 + 3] = clamp(s.rough * 255, 0, 255); heights[i] = s.height;
      }
      const normals = new Uint8Array(size * size * 4);
      const strength = name === "rock" ? 3.4 : name === "water" ? 2.2 : name === "sand" ? 1.2 : 2.0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const l = heights[y * size + (x + size - 1) % size], r = heights[y * size + (x + 1) % size];
        const d = heights[((y + size - 1) % size) * size + x], u = heights[((y + 1) % size) * size + x];
        let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
        const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
        const i = (y * size + x) * 4;
        normals[i] = (nx * 0.5 + 0.5) * 255; normals[i + 1] = (ny * 0.5 + 0.5) * 255; normals[i + 2] = (nz * 0.5 + 0.5) * 255; normals[i + 3] = 255;
      }
      const make = (data, srgb) => {
        const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true; texture.anisotropy = anisotropy;
        texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.needsUpdate = true; return texture;
      };
      result[name] = { albedo: make(albedo, true), normal: make(normals, false) };
    }
    return result;
  }

  E.EnvironmentTextures = { build, periodicFbm, hex };
}());
