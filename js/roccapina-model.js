(function () {
  'use strict';
  const E = window.Eredita;
  let THREE, clone, template, loading, error = null, instances = 0;
  const config = () => E.Config.characterModels.roccapina;
  function init(three) {
    if (loading) return loading;
    THREE = three;
    loading = Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/SkeletonUtils.js')]).then(async ([loader, skeleton]) => {
      clone = skeleton.clone;
      template = (await new loader.GLTFLoader().loadAsync(new URL(config().src, document.baseURI).href)).scene;
      return true;
    }).catch(reason => { error = String(reason); return false; });
    return loading;
  }
  function create(owner) {
    if (!template) return null;
    const group = new THREE.Group(), model = clone(template), materials = new Map(), skeletons = new Set();
    model.name = 'lion-roccapina-modele';
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const scale = config().height / size.y;
    model.scale.multiplyScalar(scale);
    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    group.add(model);
    model.traverse(part => {
      if (!part.isMesh) return;
      part.castShadow = part.receiveShadow = true;
      part.userData.sharedGeometry = true;
      const copy = source => { if (!materials.has(source)) materials.set(source, source.clone()); return materials.get(source); };
      part.material = Array.isArray(part.material) ? part.material.map(copy) : copy(part.material);
      if (part.isSkinnedMesh) { skeletons.add(part.skeleton); part.frustumCulled = false; }
    });
    const marker = new THREE.Mesh(new THREE.TorusGeometry(config().markerRadius, .009, 5, 20), new THREE.MeshStandardMaterial({color: owner === 'red' ? 0x9e4039 : 0x3f7298}));
    marker.name = 'equipe-roccapina'; marker.rotation.x = Math.PI / 2; marker.position.y = .012; group.add(marker);
    let moving = false, time = 0, strike = 0, sequence = 0, dying = false, deathTime = 0, disposed = false;
    const baseY = model.position.y;
    instances++;
    group.userData.preserveMythologyMaterial = true;
    // Le GLB fourni n'a pas de clips : mouvements de groupe provisoires, sans toucher au squelette source.
    group.userData.roccapina = {
      setMoving(value) { moving = Boolean(value); },
      attack(value) { if (!dying && value !== sequence) { sequence = value; strike = config().attackDuration; } },
      die() { dying = true; },
      tick(delta, paused, dead = false) {
        if (disposed || paused) return;
        const dt = Math.min(delta, config().maxFrameDelta); time += dt;
        if (dead) dying = true;
        if (dying) { deathTime += dt; model.rotation.z = -Math.min(1, deathTime / E.Config.visualEffects.unitDeathDuration) * Math.PI / 2; return; }
        strike = Math.max(0, strike - dt);
        model.position.y = baseY + (moving ? Math.abs(Math.sin(time * config().walkFrequency)) * config().walkBob : 0);
        model.rotation.x = strike ? -Math.sin(Math.PI * strike / config().attackDuration) * config().attackLean : 0;
      },
      dispose() { if (disposed) return; disposed = true; instances--; skeletons.forEach(s => s.dispose()); },
      get time() { return time; }, get dying() { return dying; },
      get deathProgress() { return Math.min(1, deathTime / E.Config.visualEffects.unitDeathDuration); }
    };
    return group;
  }
  E.RoccapinaModel = {init, create, get ready() { return Boolean(template); }, get diagnostics() { return {ready:Boolean(template), error, instances}; }};
}());
