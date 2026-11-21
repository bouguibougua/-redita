(function () {
  'use strict';
  const E = window.Eredita;
  // Présentation uniquement. Les familles partagent leurs textures et ne portent
  // aucune donnée économique. Le grain du bois suit l'axe U de la géométrie.
  const DEFAULTS = Object.freeze({
    resolution: 1024,
    anisotropy: 4,
    assetPath: 'assets/shop/textures/',
    woodRelief: 2.1,
    stoneRelief: 3.4,
    metalRelief: 1.7,
    terracottaRelief: 2.0
  });

  function create(T, { track, textures, renderer, config = {} }) {
    const settings = { ...DEFAULTS, ...(config.materials || config) };
    const size = settings.resolution;
    const anisotropy = Math.min(settings.anisotropy, renderer.capabilities.getMaxAnisotropy());
    const loader = new T.TextureLoader();
    const pending = [];
    const tau = Math.PI * 2;
    const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
    let seed = 27629;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    // Bruit interpolé périodique : les motifs continuent à chaque bord de tuile.
    function noiseField(cells) {
      const grid = Float32Array.from({ length: cells * cells }, random);
      const field = new Float32Array(size * size);
      for (let y = 0; y < size; y++) {
        const gy = y / size * cells, iy = Math.floor(gy), fy = gy - iy;
        const sy = fy * fy * (3 - 2 * fy), row = iy * cells, next = ((iy + 1) % cells) * cells;
        for (let x = 0; x < size; x++) {
          const gx = x / size * cells, ix = Math.floor(gx), fx = gx - ix;
          const sx = fx * fx * (3 - 2 * fx), nx = (ix + 1) % cells;
          field[y * size + x] = (grid[row + ix] * (1 - sx) + grid[row + nx] * sx) * (1 - sy)
            + (grid[next + ix] * (1 - sx) + grid[next + nx] * sx) * sy;
        }
      }
      return field;
    }
    const clouds = noiseField(5), pores = noiseField(29), detail = noiseField(137);

    function configureTexture(texture, color = false) {
      texture.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.anisotropy = anisotropy;
      textures.add(texture);
      return texture;
    }
    function canvasTexture(pixels, color = false) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').putImageData(new ImageData(pixels, size, size), 0, 0);
      return configureTexture(new T.CanvasTexture(canvas), color);
    }
    function material(name, color, maps, options = {}) {
      const result = track(new T.MeshStandardMaterial({ color, ...maps, roughness: 1, ...options }));
      result.name = 'shop-' + name;
      return result;
    }

    // À partir d'une surface réelle (veines, pores, bosses), produire couleur,
    // normale tangentielle et rugosité. Le relief ne coûte aucun polygone.
    function surface(kind) {
      const colors = new Uint8ClampedArray(size * size * 4);
      const rough = new Uint8ClampedArray(size * size * 4);
      const heights = new Float32Array(size * size);
      const bases = {
        wood: [151, 113, 76], stone: [167, 158, 138],
        metal: [203, 204, 194], terracotta: [167, 105, 72]
      };
      const base = bases[kind];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const index = y * size + x, out = index * 4;
        const u = x / size, v = y / size;
        const cloud = clouds[index], pore = pores[index], micro = detail[index];
        let value, height, roughness, warmth = 0;
        if (kind === 'wood') {
          // Fibres longitudinales, cernes tardifs plus denses, deux nœuds
          // allongés et une décoloration irrégulière du bois ancien.
          const phase = v * 83 + Math.sin(u * tau) * .8 + (cloud - .5) * 3.7;
          const growth = Math.pow(.5 + .5 * Math.sin(phase * tau), 11);
          const fibre = Math.pow(.5 + .5 * Math.sin((v * 307 + pore * .85) * tau), 9);
          let knot = 0, knotRing = 0;
          for (const [kx, ky] of [[.28, .32], [.76, .79]]) {
            const dx = Math.min(Math.abs(u - kx), 1 - Math.abs(u - kx));
            const dy = Math.min(Math.abs(v - ky), 1 - Math.abs(v - ky));
            const radius = Math.sqrt(dx * dx * 8 + dy * dy * 100);
            const influence = Math.exp(-radius * 9);
            knot += influence;
            knotRing += Math.sin(radius * 145 + cloud * 5) * influence;
          }
          const worn = Math.max(0, cloud - .55) * .38;
          value = .85 + cloud * .30 + pore * .12 - growth * .19 - fibre * .055 - knot * .35 + knotRing * .13 + worn;
          height = .45 + pore * .15 + micro * .04 - growth * .12 - fibre * .045 + knotRing * .07;
          roughness = .72 + cloud * .15 + growth * .07 - worn * .25;
          warmth = (pore - .5) * 4;
        } else if (kind === 'stone') {
          // Calcaire/granite : zones minérales, fosses fines et traces de chaux.
          const chips = Math.max(0, .24 - micro) * 1.9;
          const mineral = Math.pow(Math.max(0, pore - .52), 2) * 2.8;
          const seam = Math.pow(Math.max(0, .5 + .5 * Math.sin((u * 3 + v * 2 + cloud * .7) * tau)), 24) * .025;
          value = .83 + cloud * .23 + pore * .12 + mineral * .22 - chips * .16 - seam;
          height = .35 + cloud * .20 + pore * .28 + micro * .09 - chips * .12;
          roughness = .84 + pore * .13;
          warmth = (cloud - .5) * 8;
        } else if (kind === 'metal') {
          // Bosses de forge et rayures fines ; aucun éclairage peint dans l'albedo.
          const hammer = Math.sin(pore * tau) * .06;
          const brushed = Math.sin((u * 211 + micro * .45) * tau) * .014;
          const oxidation = Math.max(0, cloud - .54) * .5;
          value = .91 + pore * .08 - oxidation * .25 + micro * .035;
          height = .45 + pore * .13 + hammer + brushed;
          roughness = .39 + pore * .19 + oxidation * .42 + Math.abs(brushed) * 3;
          warmth = oxidation * 8;
        } else {
          // Terre cuite non vernissée : cuisson nuancée et pores ouverts.
          value = .79 + cloud * .28 + pore * .14 + micro * .035;
          height = .35 + pore * .15 + micro * .08;
          roughness = .84 + pore * .12;
          warmth = (cloud - .5) * 12;
        }
        colors[out] = clamp(base[0] * value + warmth, 0, 255);
        colors[out + 1] = clamp(base[1] * value, 0, 255);
        colors[out + 2] = clamp(base[2] * value - warmth * .5, 0, 255);
        colors[out + 3] = 255;
        heights[index] = height;
        const r = Math.round(clamp(roughness) * 255);
        rough[out] = rough[out + 1] = rough[out + 2] = r;
        rough[out + 3] = 255;
      }
      const normals = new Uint8ClampedArray(size * size * 4);
      const relief = settings[kind + 'Relief'];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const left = heights[y * size + (x + size - 1) % size];
        const right = heights[y * size + (x + 1) % size];
        const above = heights[((y + size - 1) % size) * size + x];
        const below = heights[((y + 1) % size) * size + x];
        const nx = (left - right) * relief, ny = (below - above) * relief;
        const length = Math.sqrt(nx * nx + ny * ny + 1), out = (y * size + x) * 4;
        normals[out] = (nx / length * .5 + .5) * 255;
        normals[out + 1] = (ny / length * .5 + .5) * 255;
        normals[out + 2] = (.5 / length + .5) * 255;
        normals[out + 3] = 255;
      }
      return { map: canvasTexture(colors, true), normalMap: canvasTexture(normals), roughnessMap: canvasTexture(rough) };
    }

    function assetFamily(name) {
      const maps = {};
      for (const [slot, suffix] of [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'roughness']]) {
        // TextureLoader renvoie immédiatement le même objet Texture : les clones
        // de matériaux conservent donc les maps même avant la fin du chargement.
        const promise = new Promise((resolve, reject) => {
          maps[slot] = configureTexture(loader.load(settings.assetPath + name + '-' + suffix + '.png', resolve, undefined, reject), slot === 'map');
        });
        pending.push(promise);
      }
      return maps;
    }
    const maps = {
      wood: surface('wood'), stone: surface('stone'), metal: surface('metal'), terracotta: surface('terracotta'),
      linen: assetFamily('linen'), leather: assetFamily('leather'), wicker: assetFamily('wicker')
    };
    const metalOptions = { metalness: .80, envMapIntensity: .9, normalScale: new T.Vector2(.7, .7) };
    const result = {
      wood: material('chestnut-wood', '#f0d9bc', maps.wood),
      darkWood: material('aged-chestnut-wood', '#95806d', maps.wood),
      paleWood: material('worn-chestnut-wood', '#fff2d4', maps.wood),
      stoneBase: material('lime-mortar', '#bdb6a5', maps.stone, { normalScale: new T.Vector2(.5, .5) }),
      stoneVariants: ['#e0ddd0', '#bcb8ac', '#d2c9b5', '#c3c6ba', '#d9ceb8', '#b7b2a5'].map((color, i) =>
        material('masonry-' + i, color, maps.stone, { normalScale: new T.Vector2(1.25, 1.25) })),
      terracotta: material('fired-clay', '#e1b8a0', maps.terracotta),
      linen: material('woven-linen', '#fff5de', maps.linen, { side: T.DoubleSide, normalScale: new T.Vector2(.65, .65) }),
      rope: material('hemp-rope', '#e6d7b7', maps.wicker, { normalScale: new T.Vector2(.9, .9) }),
      wicker: material('woven-wicker', '#e4cba3', maps.wicker, { side: T.DoubleSide }),
      wickerDark: material('aged-wicker', '#ac9475', maps.wicker, { side: T.DoubleSide }),
      leather: material('grained-leather', '#f4e1cd', maps.leather, { normalScale: new T.Vector2(.75, .75) }),
      iron: material('forged-iron', '#656b68', maps.metal, { ...metalOptions, roughness: 1 }),
      brass: material('aged-bronze', '#c59b52', maps.metal, { ...metalOptions, metalness: .78, roughness: .90 }),
      silver: material('brushed-steel', '#b9c8c8', maps.metal, { ...metalOptions, metalness: .88, roughness: .78 }),
      green: material('olive-leaf', '#58684a', {}, { roughness: .82 }),
      leafLight: material('olive-leaf-reverse', '#899177', {}, { roughness: .90 }),
      maps,
      loaded: Promise.all(pending).then(() => true)
    };
    return result;
  }
  E.ShopMaterials = { create };
}());
