(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  let THREE, cloneSkeleton, template, clips, loading, error = null, instances = 0;
  const config = () => E.Config.characterModels.fullettu;

  function init(three) {
    if (loading) return loading;
    THREE = three;
    loading = Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/SkeletonUtils.js')])
      .then(async ([loader, skeleton]) => {
        cloneSkeleton = skeleton.clone;
        const asset = await new loader.GLTFLoader().loadAsync(new URL(config().src, document.baseURI).href);
        if (!Object.values(config().clips).every(name => asset.animations.some(clip => clip.name === name))) {
          throw new Error('Animations de U Fullettu manquantes');
        }
        template = asset.scene; clips = asset.animations;
        return true;
      }).catch(reason => { error = String(reason?.stack || reason); return false; });
    return loading;
  }

  function create(owner) {
    if (!template) return null;
    const group = new THREE.Group(), model = cloneSkeleton(template);
    model.name = 'u-fullettu-modele';
    model.scale.setScalar(config().scale);
    group.add(model);
    const ownedMaterials = new Map(), skeletons = new Set();
    let canonicalSkeleton;
    model.traverse(part => {
      if (!part.isMesh) return;
      part.castShadow = part.receiveShadow = true;
      // Les cinq follets partagent géométrie et textures ; pose et matériaux sont indépendants.
      part.userData.sharedGeometry = true;
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      const copies = materials.map(source => {
        if (ownedMaterials.has(source)) return ownedMaterials.get(source);
        const result = source.clone(); ownedMaterials.set(source, result); return result;
      });
      part.material = Array.isArray(part.material) ? copies : copies[0];
      if (part.isSkinnedMesh) {
        const skeleton = part.skeleton;
        if (canonicalSkeleton && skeleton.bones.length === canonicalSkeleton.bones.length &&
          skeleton.bones.every((bone, i) => bone === canonicalSkeleton.bones[i] &&
            skeleton.boneInverses[i].equals(canonicalSkeleton.boneInverses[i]))) {
          part.skeleton = canonicalSkeleton;
        } else if (!canonicalSkeleton) canonicalSkeleton = skeleton;
        skeletons.add(part.skeleton);
        part.frustumCulled = false;
      }
    });
    const marker = new THREE.Mesh(new THREE.TorusGeometry(.15, .009, 5, 16),
      new THREE.MeshStandardMaterial({ color: owner === 'red' ? 0x9e4039 : 0x3f7298, roughness: .9 }));
    marker.name = 'equipe-fullettu'; marker.rotation.x = Math.PI / 2; marker.position.y = .012;
    group.add(marker);

    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map(clips.map(clip => [clip.name, mixer.clipAction(clip)]));
    let active = null, moving = false, harvesting = false, harvestInterval = 1, disposed = false, dying = false;
    function change(name, once = false, duration = 1) {
      if (active?.getClip().name === name && !once) return;
      const next = actions.get(name);
      if (!next) return;
      const previous = active;
      active?.fadeOut(config().crossFade);
      next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
      next.clampWhenFinished = once;
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      if (once) next.setDuration(duration);
      if (previous) next.fadeIn(config().crossFade);
      next.play(); active = next;
    }
    function die() {
      if (disposed || dying) return;
      dying = true; moving = harvesting = false;
      change(config().clips.death, true, E.Config.visualEffects.unitDeathDuration);
    }
    change(config().clips.idle); mixer.update(0); instances++;
    group.userData.preserveMythologyMaterial = true;
    group.userData.fullettu = {
      setMoving(value) { moving = Boolean(value); },
      // La récolte illustre le vol existant ; elle ne modifie ni cible ni ressources.
      setHarvest(value, timer, interval) {
        if (disposed || dying) return;
        harvesting = Boolean(value);
        if (!harvesting) return;
        harvestInterval = interval;
        change(config().clips.harvest);
        const duration = active.getClip().duration;
        active.time = ((timer % interval) + interval) % interval / interval * duration;
        active.setEffectiveTimeScale(duration / interval);
        mixer.update(0);
      },
      // U Fullettu inflige zéro dégât ; son geste suit le cycle de vol, pas les frappes du combat.
      attack() {},
      die,
      tick(delta, paused, dead = false) {
        if (disposed || paused) return;
        if (dead) die();
        if (!dying && !harvesting) change(moving ? config().clips.walk : config().clips.idle);
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
      get harvestPhase() { return harvesting ? active.time / active.getClip().duration : 0; },
      get harvestInterval() { return harvestInterval; },
      get dying() { return dying; },
      get deathProgress() { return dying ? Math.min(1, active.time / active.getClip().duration) : 0; },
      get mixer() { return mixer; }
    };
    return group;
  }

  E.FullettuModel = { init, create,
    get ready() { return Boolean(template); },
    get diagnostics() { return { ready: Boolean(template), error, instances, clips: clips?.map(clip => clip.name) || [] }; }
  };
}());
