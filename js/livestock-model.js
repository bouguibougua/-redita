(function () {
  'use strict';
  const E = window.Eredita;
  let THREE, mergeGeometries, loading;
  const models = new Map(), errors = {};

  function variantFor(type, count) {
    const variants = E.Config.livestockModels[type]?.variants;
    if (!variants?.length) return null;
    return variants.reduce((chosen, variant) => count >= variant.minAnimals &&
      variant.minAnimals > chosen.minAnimals ? variant : chosen, variants[0]);
  }

  function init(three) {
    if (loading) return loading;
    THREE = three;
    loading = Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/BufferGeometryUtils.js')])
      .then(async ([loader, utils]) => {
        mergeGeometries = utils.mergeGeometries;
        const assets = Object.entries(E.Config.livestockModels).flatMap(([type, config]) =>
          config.variants.map(variant => [`${type}:${variant.id}`, variant]));
        await Promise.all(assets.map(async ([key, config]) => {
          const temporary = [], sourceGeometries = new Set();
          try {
            const asset = await new loader.GLTFLoader().loadAsync(new URL(config.src, document.baseURI).href);
            asset.scene.updateMatrixWorld(true);
            const parts = new Map();
            asset.scene.traverse(part => {
              if (!part.isMesh) return;
              sourceGeometries.add(part.geometry);
              const role = part.userData.livestockRole;
              // Les GLB complets incluent plusieurs animaux pour leur aperçu. Le jeu
              // garde le premier animal comme prototype, puis reproduit l'effectif vivant.
              if (role !== 'enclosure' && !(role === 'animal' && part.userData.animalIndex === 0)) return;
              if (Array.isArray(part.material)) throw new Error('Un matériau par mesh d’élevage est nécessaire');
              if (!parts.has(role)) parts.set(role, { material: part.material, geometries: [] });
              if (parts.get(role).material !== part.material) throw new Error('Un matériau par rôle est nécessaire');
              const geometry = part.geometry.clone().applyMatrix4(part.matrixWorld);
              temporary.push(geometry); parts.get(role).geometries.push(geometry);
            });
            if (!parts.has('animal') || !parts.has('enclosure')) throw new Error('Enclos ou prototype animal manquant');
            const record = { cache: new Map() };
            for (const [role, part] of parts) {
              const geometry = mergeGeometries(part.geometries, false);
              if (!geometry) throw new Error(`Fusion impossible : ${key}/${role}`);
              geometry.computeBoundingBox(); geometry.computeBoundingSphere();
              record[role] = { material: part.material, geometry };
            }
            models.set(key, record);
          } catch (error) { errors[key] = String(error?.stack || error); }
          finally {
            temporary.forEach(g => g.dispose()); sourceGeometries.forEach(g => g.dispose());
          }
        }));
        return models.size > 0;
      }).catch(error => { errors.loader = String(error?.stack || error); return false; });
    return loading;
  }

  function create(type, count) {
    if (!Number.isFinite(count) || count <= 0) return null;
    const config = E.Config.livestockModels[type], variant = variantFor(type, count);
    if (!variant) return null;
    const record = models.get(`${type}:${variant.id}`);
    if (!record) return null;
    const shown = Math.min(Math.floor(count), config.maxVisualAnimals, variant.positions.length);
    if (!record.cache.has(shown)) {
      const instances = variant.positions.slice(0, shown).map(([x, z, angle]) => {
        const geometry = record.animal.geometry.clone();
        geometry.rotateY(angle); geometry.translate(x, 0, z); return geometry;
      });
      const geometry = mergeGeometries(instances, false);
      instances.forEach(g => g.dispose());
      geometry.computeBoundingBox(); geometry.computeBoundingSphere(); record.cache.set(shown, geometry);
    }
    const group = new THREE.Group(); group.name = `elevage-${type}`;
    group.userData = { herdVariant: variant.id, displayedAnimals: shown };
    for (const [name, geometry, material] of [
      ['enclos', record.enclosure.geometry, record.enclosure.material],
      ['animaux', record.cache.get(shown), record.animal.material]
    ]) {
      const mesh = new THREE.Mesh(geometry, material.clone()); mesh.name = name;
      mesh.userData.sharedGeometry = true; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    }
    return group;
  }

  E.LivestockModels = { init, create, variantFor,
    get ready() {
      return Object.entries(E.Config.livestockModels).every(([type, config]) =>
        config.variants.every(variant => models.has(`${type}:${variant.id}`)));
    },
    get diagnostics() {
      return { errors: { ...errors }, models: Object.fromEntries([...models].map(([key, record]) => [key, {
        batches: 2, cachedCounts: [...record.cache.keys()],
        enclosureTriangles: (record.enclosure.geometry.index?.count || record.enclosure.geometry.attributes.position.count) / 3,
        animalTriangles: (record.animal.geometry.index?.count || record.animal.geometry.attributes.position.count) / 3
      }])) };
    }
  };
}());
