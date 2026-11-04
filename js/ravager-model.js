(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  let THREE, cloneSkeleton, template, clips, loading, error = null, instances = 0;
  const config = () => E.Config.characterModels.ravager;

  function init(three) {
    if (loading) return loading;
    THREE = three;
    loading = Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/SkeletonUtils.js')])
      .then(async ([loader, skeleton]) => {
        cloneSkeleton = skeleton.clone;
        const asset = await new loader.GLTFLoader().loadAsync(new URL(config().src, document.baseURI).href);
        const names = [config().clips.idle, config().clips.walk, ...config().clips.attacks, config().clips.death];
        if (!names.every(name => asset.animations.some(clip => clip.name === name))) throw new Error('Animations du ravageur manquantes');
        template = asset.scene; clips = asset.animations;
        return true;
      }).catch(reason => { error = String(reason?.stack || reason); return false; });
    return loading;
  }

  function create(owner, tool, armor) {
    if (!template) return null;
    const group = new THREE.Group();
    const model = cloneSkeleton(template);
    model.name = 'ravageur-modele';
    model.scale.setScalar(config().scale);
    group.add(model);
    const ownedMaterials = new Map(), skeletons = new Set();
    let canonicalSkeleton;
    model.traverse(part => {
      if (!part.isMesh) return;
      part.castShadow = part.receiveShadow = true;
      // La géométrie et les textures appartiennent au cache ; seuls les matériaux
      // et le squelette varient d'une figurine à l'autre.
      part.userData.sharedGeometry = true;
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      const copies = materials.map(source => {
        if (ownedMaterials.has(source)) return ownedMaterials.get(source);
        const result = source.clone();
        ownedMaterials.set(source, result);
        if (/^Hache_Acier/.test(source.name) && tool) {
          result.color.setHex({ bois: 0xb98542, bronze: 0xc28b43, fer: 0xd2e0e4 }[tool] || 0xd2e0e4);
          result.metalness = tool === 'bois' ? 0 : 0.75;
          result.roughness = tool === 'bois' ? 0.85 : 0.35;
        }
        return result;
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
        // L'animation peut déplacer l'épée au-delà du volume de la pose initiale.
        part.frustumCulled = false;
      }
    });
    const marker = new THREE.Mesh(new THREE.TorusGeometry(.11, .009, 5, 16),
      new THREE.MeshStandardMaterial({ color: owner === 'red' ? 0x9e4039 : 0x3f7298, roughness: .9 }));
    marker.name = 'equipe-ravageur'; marker.rotation.x = Math.PI / 2; marker.position.y = .012;
    group.add(marker);

    if (armor) {
      const chest = model.getObjectByName('spine_03');
      if (chest) {
        const color = {cuir:0x87532f,maille:0x919ca0,fer:0xcbd8df}[armor] || 0x87532f;
        const vest = new THREE.Mesh(new THREE.BoxGeometry(.30,.25,.23), new THREE.MeshStandardMaterial({
          color, metalness:armor === 'cuir' ? 0 : .65, roughness:armor === 'cuir' ? .9 : .4
        }));
        vest.name = `armure-${armor}`; vest.position.set(0,.05,0); vest.castShadow = vest.receiveShadow = true; chest.add(vest);
      }
    }

    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map(clips.map(clip => [clip.name, mixer.clipAction(clip)]));
    let active = null, moving = false, disposed = false, dying = false, attackSequence = 0;
    function change(name, attack = false, duration = config().attackDuration) {
      if (active?.getClip().name === name && !attack) return;
      const next = actions.get(name);
      if (!next) return;
      const previous = active;
      active?.fadeOut(config().crossFade);
      next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
      next.clampWhenFinished = attack;
      next.setLoop(attack ? THREE.LoopOnce : THREE.LoopRepeat, attack ? 1 : Infinity);
      if (attack) next.setDuration(duration);
      if (previous) next.fadeIn(config().crossFade);
      next.play();
      active = next;
    }
    mixer.addEventListener('finished', event => {
      if (!dying && event.action === active) change(moving ? config().clips.walk : config().clips.idle);
    });
    function die() {
      if (disposed || dying) return;
      dying = true; moving = false;
      change(config().clips.death, true, E.Config.visualEffects.unitDeathDuration);
    }
    change(config().clips.idle);
    mixer.update(0);
    instances++;
    group.userData.ravager = {
      setMoving(value) { moving = Boolean(value); },
      attack(sequence) {
        if (disposed || dying || sequence === attackSequence) return;
        attackSequence = sequence;
        change(config().clips.attacks[(sequence - 1) % config().clips.attacks.length], true);
      },
      die,
      tick(delta, paused, dead = false) {
        if (disposed || paused) return;
        if (dead) die();
        if (!dying && !config().clips.attacks.includes(active?.getClip().name)) change(moving ? config().clips.walk : config().clips.idle);
        mixer.update(Math.min(delta, config().maxFrameDelta));
      },
      dispose() {
        if (disposed) return;
        disposed = true; instances--;
        mixer.stopAllAction(); mixer.uncacheRoot(model);
        skeletons.forEach(skeleton => skeleton.dispose());
      },
      get action() { return active?.getClip().name; },
      get time() { return active?.time || 0; },
      get sequence() { return attackSequence; },
      get dying() { return dying; },
      get deathProgress() { return dying ? Math.min(1, active.time / active.getClip().duration) : 0; },
      get mixer() { return mixer; }
    };
    return group;
  }

  E.RavagerModel = { init, create,
    get ready() { return Boolean(template); },
    get diagnostics() { return { ready: Boolean(template), error, instances, clips: clips?.map(clip => clip.name) || [] }; }
  };
}());
