(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
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
        group.add(mesh);
      }
      return group;
    }

    return { init, create: createInstance,
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
