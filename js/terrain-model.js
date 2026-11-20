(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  // Écart rouge − vert (sRGB) de la texture du sol : herbe ≈ −0,04, chemins et sable au-dessus.
  const PATH_RANGE = { plaine: [0.03, 0.09], montagne: [0.012, 0.042], littoral_rouge: [0.02, 0.06], littoral_bleu: [0.02, 0.06] };
  function create(biome) {
    let THREE, mergeGeometries, template, loading, error = null;
    const variants = new Map();

    function init(three) {
      if (loading) return loading;
      THREE = three;
      loading = Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/BufferGeometryUtils.js')])
        .then(async ([loader, utils]) => {
          mergeGeometries = utils.mergeGeometries;
          const asset = await new loader.GLTFLoader().loadAsync(new URL(E.Config.terrainModels[biome].src, document.baseURI).href);
          const parts = [];
          asset.scene.updateMatrixWorld(true);
          asset.scene.traverse(part => { if (part.isMesh) parts.push(part); });
          if (!parts.some(p => p.userData.terrainRole === 'ground') ||
              !parts.some(p => p.userData.terrainRole === 'base') ||
              parts.some(p => !['ground', 'base', 'rock', 'decoration', 'water'].includes(p.userData.terrainRole))) {
            throw new Error(`Les volumes du terrain ${biome} sont incomplets`);
          }
          template = parts;
          // Deux formats seulement : géométries fusionnées une fois, partagées entre régions.
          for (const width of new Set([1, E.Config.board.simplifiedWidthScale])) buildVariant(width);
          return true;
        }).catch(reason => { template = null; error = String(reason?.stack || reason); return false; });
      return loading;
    }

    function buildVariant(width, owner) {
      const variantKey = owner ? `${width}:${owner}` : width;
      if (variants.has(variantKey)) return variants.get(variantKey);
      const batches = new Map();
      for (const part of template) {
        const role = part.userData.terrainRole;
        const matrix = part.matrixWorld.clone();
        if (role === 'decoration' || role === 'rock') {
          // Écarter les touffes/rochers sans déformer leur volume en format Simplifié.
          matrix.elements[12] *= width;
        } else {
          matrix.premultiply(new THREE.Matrix4().makeScale(width, 1, 1));
        }
        if (owner && (role === 'decoration' || role === 'rock')) {
          // Le décor naturel reste hors de la cour : ni rocher dans un hôtel,
          // ni buisson au milieu des habitants. Le sol et l’eau restent intacts.
          part.geometry.computeBoundingBox();
          const bounds = part.geometry.boundingBox.clone().applyMatrix4(matrix);
          const cfg = E.Config.villagePresentation;
          const front = (owner === 'red' ? 1 : -1) * (cfg.front + .10);
          const inCourtyard = owner === 'red' ? bounds.min.z < front : bounds.max.z > front;
          if (inCourtyard && bounds.max.x > -cfg.wallHalfWidth * width && bounds.min.x < cfg.wallHalfWidth * width) continue;
        }
        const geometry = part.geometry.clone().applyMatrix4(matrix);
        const key = `${role}:${part.material.uuid}`;
        if (!batches.has(key)) batches.set(key, { role, material: part.material, sources: [] });
        batches.get(key).sources.push(geometry);
      }
      const result = [];
      for (const { role, material, sources } of batches.values()) {
        const geometry = mergeGeometries(sources, false);
        sources.forEach(g => g.dispose());
        if (!geometry) throw new Error(`Fusion impossible pour ${biome} : ${role}`);
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        result.push({ role, material, geometry });
      }
      variants.set(variantKey, result);
      return result;
    }

    // Le décor naturel reste hors de la cour (même règle que buildVariant).
    function inCourtyard(bounds, width, owner) {
      if (!owner) return false;
      const cfg = E.Config.villagePresentation;
      const front = (owner === 'red' ? 1 : -1) * (cfg.front + .10);
      const inside = owner === 'red' ? bounds.min.z < front : bounds.max.z > front;
      return inside && bounds.max.x > -cfg.wallHalfWidth * width && bounds.min.x < cfg.wallHalfWidth * width;
    }

    // Grille du sol en coordonnées locales de la tuile : hauteur (y du modèle) et « chemin »
    // (terre des chemins, sable des plages) lu dans la texture du sol par ses UV.
    function groundGrid(width) {
      const step = 0.04, grounds = template.filter(p => p.userData.terrainRole === 'ground');
      const box = new THREE.Box3(), tmp = new THREE.Box3();
      const scale = new THREE.Matrix4().makeScale(width, 1, 1);
      const sources = grounds.map(part => {
        const matrix = part.matrixWorld.clone().premultiply(scale);
        part.geometry.computeBoundingBox(); tmp.copy(part.geometry.boundingBox).applyMatrix4(matrix); box.union(tmp);
        return { part, matrix };
      });
      const minX = box.min.x, minZ = box.min.z, nx = Math.ceil((box.max.x - minX) / step) + 1, nz = Math.ceil((box.max.z - minZ) / step) + 1;
      const height = new Float32Array(nx * nz).fill(-Infinity), path = new Float32Array(nx * nz);
      const us = new Float32Array(nx * nz).fill(-1), vs = new Float32Array(nx * nz);
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      let pixels = null, size = 0, range = PATH_RANGE[biome] || PATH_RANGE.plaine;
      for (const { part, matrix } of sources) {
        const g = part.geometry, pos = g.attributes.position, uv = g.attributes.uv, index = g.index;
        const image = part.material.map?.image;
        if (image && !pixels) {
          try {
            size = 256; const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
            const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, size, size);
            pixels = context.getImageData(0, 0, size, size).data;
          } catch { pixels = null; }
        }
        const count = index ? index.count : pos.count;
        for (let t = 0; t < count; t += 3) {
          const ia = index ? index.getX(t) : t, ib = index ? index.getX(t + 1) : t + 1, ic = index ? index.getX(t + 2) : t + 2;
          a.fromBufferAttribute(pos, ia).applyMatrix4(matrix); b.fromBufferAttribute(pos, ib).applyMatrix4(matrix); c.fromBufferAttribute(pos, ic).applyMatrix4(matrix);
          const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
          if (Math.abs(det) < 1e-9) continue;
          const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - minX) / step)), i1 = Math.min(nx - 1, Math.ceil((Math.max(a.x, b.x, c.x) - minX) / step));
          const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) - minZ) / step)), j1 = Math.min(nz - 1, Math.ceil((Math.max(a.z, b.z, c.z) - minZ) / step));
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const x = minX + i * step, z = minZ + j * step;
            const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / det, l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / det, l3 = 1 - l1 - l2;
            if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
            const y = l1 * a.y + l2 * b.y + l3 * c.y, k = j * nx + i;
            if (y <= height[k]) continue;
            height[k] = y;
            if (uv) { us[k] = l1 * uv.getX(ia) + l2 * uv.getX(ib) + l3 * uv.getX(ic); vs[k] = l1 * uv.getY(ia) + l2 * uv.getY(ib) + l3 * uv.getY(ic); }
          }
        }
      }
      for (let k = 0; k < height.length; k++) {
        if (height[k] === -Infinity) height[k] = 0.02;
        if (!pixels || us[k] < 0) continue;
        // glTF : UV (0,0) = coin supérieur gauche de l'image (flipY = false).
        const px = Math.min(size - 1, Math.max(0, Math.floor((us[k] - Math.floor(us[k])) * size)));
        const py = Math.min(size - 1, Math.max(0, Math.floor((vs[k] - Math.floor(vs[k])) * size)));
        const o = (py * size + px) * 4, warm = (pixels[o] - pixels[o + 1]) / 255;
        path[k] = Math.max(0, Math.min(1, (warm - range[0]) / (range[1] - range[0])));
      }
      const read = (data, x, z) => {
        const fx = Math.max(0, Math.min(nx - 1.001, (x - minX) / step)), fz = Math.max(0, Math.min(nz - 1.001, (z - minZ) / step));
        const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * nx + i;
        return (data[k] * (1 - tx) + data[k + 1] * tx) * (1 - tz) + (data[k + nx] * (1 - tx) + data[k + nx + 1] * tx) * tz;
      };
      return { minX, minZ, maxX: minX + (nx - 1) * step, maxZ: minZ + (nz - 1) * step, step, nx, nz, height, path,
        heightAt: (x, z) => read(height, x, z), pathAt: (x, z) => read(path, x, z) };
    }

    // Disposition pour l'habillage PC : emplacements et volumes du décor (repères), grille du sol.
    // Coordonnées locales de la tuile, calculées une fois par variante.
    const layouts = new Map();
    function layout(width, owner) {
      if (!template) return null;
      const key = `${width}:${owner || ''}`;
      if (layouts.has(key)) return layouts.get(key);
      const anchors = [], box = new THREE.Box3(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(), euler = new THREE.Euler();
      for (const part of template) {
        const role = part.userData.terrainRole;
        if (role !== 'decoration' && role !== 'rock') continue;
        const matrix = part.matrixWorld.clone(); matrix.elements[12] *= width;
        part.geometry.computeBoundingBox(); box.copy(part.geometry.boundingBox).applyMatrix4(matrix);
        if (inCourtyard(box, width, owner)) continue;
        matrix.decompose(position, rotation, scale); euler.setFromQuaternion(rotation, 'YXZ');
        anchors.push({ kind: part.name.replace(/_\d+$/, ''), role, x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2,
          y: box.min.y, top: box.max.y, w: box.max.x - box.min.x, d: box.max.z - box.min.z, yaw: euler.y });
      }
      const result = { biome, anchors, grid: groundGrid(width) };
      layouts.set(key, result);
      return result;
    }

    function createInstance(width, burned = false, owner) {
      if (!template) return null;
      const group = new THREE.Group(); group.name = `terrain-${biome}`;
      for (const part of buildVariant(width, owner)) {
        const material = part.material.clone();
        if (burned && part.role !== 'water') material.color.setHex(0x514035);
        const mesh = new THREE.Mesh(part.geometry, material);
        mesh.name = `${biome}-${part.role}`;
        mesh.userData.sharedGeometry = true;
        mesh.userData.terrainRole = part.role;
        mesh.castShadow = part.role === 'decoration' || part.role === 'rock';
        mesh.receiveShadow = true;
        // Le calque de terre brûlée du jeu reste visible, sans végétation verte au-dessus.
        mesh.visible = !(burned && part.role === 'decoration');
        mesh.userData.baseVisible = mesh.visible;
        // Version PC : sol détaillé (textures du paysage) ; le plateau VR/MR garde le matériau d'origine.
        if (part.role === 'ground' && E.RegionGround) {
          mesh.userData.boardMaterial = material;
          mesh.userData.strategyMaterial = E.RegionGround.material(THREE, material, biome);
        }
        group.add(mesh);
      }
      return group;
    }

    return { init, create: createInstance, layout,
      get ready() { return Boolean(template); },
      get diagnostics() {
        const variant = variants.get(1) || [];
        return { ready: Boolean(template), error, batches: variant.length,
          triangles: variant.reduce((sum, p) => sum + (p.geometry.index?.count || p.geometry.attributes.position.count) / 3, 0),
          cachedWidths: [...variants.keys()].filter(key => typeof key === "number") };
      }
    };
  }
  E.TerrainModel = { create };
}());
