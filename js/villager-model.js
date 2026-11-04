(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  let THREE, template, loading, error = null, triangles = 0;
  const config = () => E.Config.characterModels.villager;

  function init(three) {
    if (loading) return loading;
    THREE = three;
    loading = import('./vendor/GLTFLoader.js').then(async ({ GLTFLoader }) => {
      const asset = await new GLTFLoader().loadAsync(new URL(config().src, document.baseURI).href);
      let meshCount = 0;
      asset.scene.traverse(part => {
        if (!part.isMesh) return;
        meshCount++;
        triangles += (part.geometry.index?.count || part.geometry.attributes.position.count) / 3;
      });
      if (!meshCount) throw new Error('Le modèle des habitants ne contient aucun maillage');
      template = asset.scene;
      return true;
    }).catch(reason => { error = String(reason?.stack || reason); return false; });
    return loading;
  }

  function create(owner, tool = null, armor = null) {
    if (!template) return null;
    const group = new THREE.Group();
    const model = template.clone(true);
    model.name = 'habitant-sans-metier';
    model.scale.setScalar(config().scale);
    // Une seule géométrie et les mêmes textures pour toute la population.
    // Les matériaux restent propres à chaque habitant pour la sélection et les impacts.
    const materials = new Map();
    model.traverse(part => {
      if (!part.isMesh) return;
      part.castShadow = part.receiveShadow = true;
      part.userData.sharedGeometry = true;
      const clone = source => {
        if (!materials.has(source)) materials.set(source, source.clone());
        return materials.get(source);
      };
      part.material = Array.isArray(part.material) ? part.material.map(clone) : clone(part.material);
    });
    group.add(model);

    const part = (name, geometry, color, x, y, z, options = {}) => {
      const item = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .85, ...options }));
      item.name = name;
      item.position.set(x, y, z);
      item.castShadow = item.receiveShadow = true;
      group.add(item);
      return item;
    };
    const box = (name, size, color, x, y, z, options) => part(name, new THREE.BoxGeometry(...size), color, x, y, z, options);
    const marker = part('equipe-habitant', new THREE.TorusGeometry(.11, .009, 5, 16),
      owner === 'red' ? 0x9e4039 : 0x3f7298, 0, .012, 0);
    marker.rotation.x = Math.PI / 2;

    if (tool) {
      const color = { bois: 0xb98542, bronze: 0xc28b43, fer: 0xd2e0e4 }[tool] || 0x816347;
      const metalness = tool === 'bois' ? 0 : .65;
      const options = { metalness, roughness: metalness ? .38 : .85 };
      box('outil-manche', [.027, .29, .027], color, .16, .29, .04, options);
      box('outil-tete', [.125, .07, .055], color, .16, .44, .04, options);
    }
    if (armor) {
      const color = { cuir: 0x87532f, maille: 0x919ca0, fer: 0xcbd8df }[armor] || 0x87532f;
      const metalness = armor === 'cuir' ? 0 : armor === 'maille' ? .45 : .75;
      box(`armure-${armor}`, [.18, .19, .19], color, 0, .29, 0,
        { metalness, roughness: armor === 'cuir' ? .95 : .37 });
      if (armor === 'cuir') box('sangle-cuir', [.026, .2, .016], 0xd1a05d, 0, .29, .105);
      else if (armor === 'maille') {
        for (let row = 0; row < 3; row++) box('rang-maille', [.177, .015, .013], 0x49585c, 0, .235 + row * .053, .103);
      } else {
        box('epauliere-fer-gauche', [.08, .065, .13], color, -.12, .37, 0, { metalness: .75 });
        box('epauliere-fer-droite', [.08, .065, .13], color, .12, .37, 0, { metalness: .75 });
        box('casque-fer-nuque', [.13, .11, .055], color, 0, .46, -.05, { metalness: .75 });
      }
    }
    return group;
  }

  E.VillagerModel = { init, create,
    get ready() { return Boolean(template); },
    get diagnostics() { return { ready: Boolean(template), error, triangles }; }
  };
}());
