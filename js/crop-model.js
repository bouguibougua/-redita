(function () {
  'use strict';
  const E = window.Eredita;
  let THREE, loading;
  const models = new Map(), errors = {};

  function variantFor(type, content) {
    const variants = E.Config.cropModels[type]?.variants;
    if (!variants?.length) return null;
    const level = E.Crops.levelOf(content);
    return variants.find(variant => variant.level === level) || variants[0];
  }

  function init(three) {
    if (loading) return loading;
    THREE = three;
    loading = Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/BufferGeometryUtils.js')])
      .then(async ([loader, utils]) => {
        const assets = Object.entries(E.Config.cropModels).flatMap(([type, config]) =>
          config.variants ? config.variants.map(variant => [`${type}:${variant.id}`, variant]) : [[type, config]]);
        await Promise.all(assets.map(async ([type, config]) => {
          try {
            const asset = await new loader.GLTFLoader().loadAsync(new URL(config.src, document.baseURI).href);
            asset.scene.updateMatrixWorld(true);
            const batches = new Map(), sources = new Set();
            asset.scene.traverse(part => {
              if (!part.isMesh) return;
              if (Array.isArray(part.material)) throw new Error('Le modèle de culture doit avoir un matériau par mesh');
              if (!batches.has(part.material)) batches.set(part.material, []);
              batches.get(part.material).push(part.geometry.clone().applyMatrix4(part.matrixWorld));
              sources.add(part.geometry);
            });
            if (!batches.size) throw new Error('Modèle de culture vide');
            const result = [];
            for (const [material, geometries] of batches) {
              const geometry = utils.mergeGeometries(geometries, false);
              geometries.forEach(g => g.dispose());
              if (!geometry) throw new Error(`Fusion impossible pour la culture ${type}`);
              geometry.computeBoundingBox(); geometry.computeBoundingSphere();
              result.push({ material, geometry });
            }
            sources.forEach(g => g.dispose());
            models.set(type, result);
          } catch (error) { errors[type] = String(error?.stack || error); }
        }));
        return models.size > 0;
      }).catch(error => { errors.loader = String(error?.stack || error); return false; });
    return loading;
  }

  function create(type, content) {
    const variant = variantFor(type, content);
    const model = models.get(variant ? `${type}:${variant.id}` : type);
    if (!model) return null;
    const group = new THREE.Group(); group.name = `culture-${type}`;
    if (variant) group.userData.cropVariant = variant.id;
    for (const part of model) {
      const mesh = new THREE.Mesh(part.geometry, part.material.clone());
      mesh.name = part.material.name;
      mesh.userData.sharedGeometry = true;
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  E.CropModels = { init, create, variantFor,
    get ready() {
      return Object.entries(E.Config.cropModels).every(([type, config]) => config.variants
        ? config.variants.every(variant => models.has(`${type}:${variant.id}`)) : models.has(type));
    },
    get diagnostics() {
      return { errors: { ...errors }, models: Object.fromEntries([...models].map(([type, parts]) => [type, {
        batches: parts.length,
        triangles: parts.reduce((sum, p) => sum + (p.geometry.index?.count || p.geometry.attributes.position.count) / 3, 0)
      }])) };
    }
  };
}());
