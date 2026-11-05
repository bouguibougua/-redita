(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  const templates = new Map(), status = {};
  let THREE, loading;

  function init(three) {
    if (loading) return loading;
    THREE = three;
    loading = import('./vendor/GLTFLoader.js').then(async ({ GLTFLoader }) => {
      const loader = new GLTFLoader();
      await Promise.all(Object.entries(E.Config.villageModels).map(async ([key, config]) => {
        try {
          const asset = await loader.loadAsync(new URL(config.src, document.baseURI).href);
          let triangles = 0;
          asset.scene.traverse(p => { if (p.isMesh) triangles += (p.geometry.index?.count || p.geometry.attributes.position.count) / 3; });
          if (!triangles) throw new Error('Maillage vide');
          templates.set(key, asset.scene); status[key] = { ready: true, triangles, error: null };
        } catch (error) { status[key] = { ready: false, error: String(error?.message || error) }; }
      }));
      return templates.size > 0;
    }).catch(error => { status.loader = { error: String(error) }; return false; });
    return loading;
  }

  function create(key) {
    const template = templates.get(key);
    if (!template) return null;
    const group = template.clone(true), materials = new Map();
    group.name = key; group.userData.villageAsset = key;
    group.traverse(part => {
      if (!part.isMesh) return;
      part.castShadow = part.receiveShadow = true;
      part.userData.sharedGeometry = true;
      const copy = source => {
        if (!materials.has(source)) materials.set(source, source.clone());
        return materials.get(source);
      };
      part.material = Array.isArray(part.material) ? part.material.map(copy) : copy(part.material);
    });
    return group;
  }

  function createRampart(tier, width, destroyed = false) {
    const wall = create(`remparts_t${tier}`);
    if (!wall) return null;
    wall.name = 'remparts'; wall.scale.x = width;
    wall.userData.level = tier; wall.userData.destroyed = destroyed;
    if (destroyed) wall.traverse(part => {
      const section = part.userData.rampart_section;
      if (section?.startsWith('avant') || section === 'porte') {
        part.rotation.x = -Math.PI / 2.3;
        part.position.y = section === 'porte' ? .035 : part.position.y + .025;
      }
      if (part.material?.color) part.material.color.multiplyScalar(.55);
    });
    return wall;
  }

  E.VillageModels = { init, create, createRampart,
    get ready() { return templates.size === Object.keys(E.Config.villageModels).length; },
    get diagnostics() { return structuredClone(status); } };
}());
