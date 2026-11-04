(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  let THREE, cloneSkeleton, template, clips, loading, error = null, triangles = 0, instances = 0;
  const config = () => E.Config.characterModels.farmer;

  function init(three) {
    if (loading) return loading;
    THREE = three;
    loading = Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/SkeletonUtils.js')])
      .then(async ([loader, skeleton]) => {
        cloneSkeleton = skeleton.clone;
        const asset = await new loader.GLTFLoader().loadAsync(new URL(config().src, document.baseURI).href);
        if (!Object.values(config().clips).every(name => asset.animations.some(clip => clip.name === name))) {
          throw new Error('Animations de l’agriculteur manquantes');
        }
        asset.scene.traverse(part => {
          if (part.isMesh) triangles += (part.geometry.index?.count || part.geometry.attributes.position.count) / 3;
        });
        if (!triangles) throw new Error('Le modèle de l’agriculteur ne contient aucun maillage');
        template = asset.scene; clips = asset.animations;
        return true;
      }).catch(reason => { error = String(reason?.stack || reason); return false; });
    return loading;
  }

  function create(owner, tool = null, armor = null) {
    if (!template) return null;
    const group = new THREE.Group(), model = cloneSkeleton(template);
    model.name = 'agriculteur-modele'; model.scale.setScalar(config().scale); group.add(model);
    const materials = new Map(), skeletons = new Set();
    model.traverse(part => {
      if (!part.isMesh) return;
      part.castShadow = part.receiveShadow = true;
      part.userData.sharedGeometry = true;
      const copy = source => {
        if (!materials.has(source)) materials.set(source, source.clone());
        return materials.get(source);
      };
      part.material = Array.isArray(part.material) ? part.material.map(copy) : copy(part.material);
      if (part.isSkinnedMesh) { skeletons.add(part.skeleton); part.frustumCulled = false; }
    });
    const marker = new THREE.Mesh(new THREE.TorusGeometry(.11, .009, 5, 16),
      new THREE.MeshStandardMaterial({ color: owner === 'red' ? 0x9e4039 : 0x3f7298, roughness: .9 }));
    marker.name = 'equipe-agriculteur'; marker.rotation.x = Math.PI / 2; marker.position.y = .012; group.add(marker);

    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map(clips.map(clip => [clip.name, mixer.clipAction(clip)]));
    let active = null, moving = false, harvesting = false, disposed = false, dying = false, attacking = false, lastAttack = null;
    function change(name, once = false, duration = 1) {
      if (active?.getClip().name === name && !once) return;
      const next = actions.get(name), previous = active;
      if (!next) return;
      previous?.fadeOut(config().crossFade);
      next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
      next.clampWhenFinished = once;
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      if (once) next.setDuration(duration);
      if (previous) next.fadeIn(config().crossFade);
      next.play(); active = next;
    }
    const locomotion = () => change(harvesting ? config().clips.harvest : moving ? config().clips.walk : config().clips.idle);
    function die() {
      if (disposed || dying) return;
      dying = true; moving = harvesting = attacking = false;
      change(config().clips.death, true, E.Config.visualEffects.unitDeathDuration);
    }
    mixer.addEventListener('finished', event => {
      if (!dying && event.action === active) { attacking = false; locomotion(); }
    });
    change(config().clips.idle); mixer.update(0); group.updateMatrixWorld(true);
    addEquipment(model, tool, armor);
    instances++;
    group.userData.farmer = {
      setMoving(value) { moving = Boolean(value); },
      // The economy owns the work phase. This flag only selects a visual animation.
      setHarvest(value) { harvesting = Boolean(value); },
      attack(sequence) {
        if (disposed || dying || sequence === lastAttack) return;
        lastAttack = sequence; attacking = true;
        change(config().clips.attack, true, config().attackDuration);
      },
      die,
      tick(delta, paused, dead = false) {
        if (disposed || paused) return;
        if (dead) die();
        if (!dying && !attacking) locomotion();
        mixer.update(Math.min(delta, config().maxFrameDelta));
      },
      dispose() {
        if (disposed) return;
        disposed = true; instances--; mixer.stopAllAction(); mixer.uncacheRoot(model);
        skeletons.forEach(skeleton => skeleton.dispose());
      },
      get action() { return active?.getClip().name; },
      get time() { return active?.time || 0; },
      get harvesting() { return harvesting; },
      get dying() { return dying; },
      get deathProgress() { return dying ? Math.min(1, active.time / active.getClip().duration) : 0; },
      get mixer() { return mixer; }
    };
    return group;
  }

  function addEquipment(model, tool, armor) {
    // Equipment follows the hands and chest through the crouch instead of floating at standing height.
    const bone = name => model.getObjectByName(name);
    const box = (parent, name, size, color, position, metalness = 0) => {
      const part = new THREE.Mesh(new THREE.BoxGeometry(...size),
        new THREE.MeshStandardMaterial({ color, metalness, roughness: metalness ? .38 : .85 }));
      part.name = name; part.position.set(...position); part.castShadow = part.receiveShadow = true; parent.add(part);
      return part;
    };
    if (tool && bone('handR')) {
      const hand = bone('handR'), color = { bois: 0xb98542, bronze: 0xc28b43, fer: 0xd2e0e4 }[tool] || 0x816347;
      box(hand, 'outil-manche', [.045, .34, .045], 0x91623e, [0, 0, 0]);
      box(hand, 'outil-tete', [.27, .055, .10], color, [0, .16, .015], tool === 'bois' ? 0 : .65);
    }
    if (armor && bone('chest')) {
      const chest = bone('chest'), color = { cuir: 0x87532f, maille: 0x919ca0, fer: 0xcbd8df }[armor] || 0x87532f;
      const metalness = armor === 'cuir' ? 0 : armor === 'maille' ? .45 : .75;
      box(chest, `armure-${armor}`, [.52, .40, .37], color, [0, -.04, 0], metalness);
    }
  }

  E.FarmerModel = { init, create,
    get ready() { return Boolean(template); },
    get diagnostics() { return { ready: Boolean(template), error, triangles, instances, clips: clips?.map(clip => clip.name) || [] }; }
  };
}());
