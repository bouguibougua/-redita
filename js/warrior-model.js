(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  let THREE, cloneSkeleton, template, clips, loading, error = null, instances = 0;
  const config = () => E.Config.characterModels.warrior;

  function init(three) {
    if (loading) return loading;
    THREE = three;
    loading = Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/SkeletonUtils.js')])
      .then(async ([loader, skeleton]) => {
        cloneSkeleton = skeleton.clone;
        const asset = await new loader.GLTFLoader().loadAsync(new URL(config().src, document.baseURI).href);
        const names = [config().clips.idle, config().clips.walk, ...config().clips.attacks];
        if (!names.every(name => asset.animations.some(clip => clip.name === name))) throw new Error('Animations du guerrier manquantes');
        template = asset.scene; clips = asset.animations;
        return true;
      }).catch(reason => { error = String(reason?.stack || reason); return false; });
    return loading;
  }

  function create(owner, tool, armor) {
    if (!template) return null;
    const group = new THREE.Group();
    const model = cloneSkeleton(template);
    model.name = 'guerrier-corse';
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
        if (/^Acier/.test(source.name) && tool) {
          result.color.setHex({ bois: 0xb98542, bronze: 0xc28b43, fer: 0xd2e0e4 }[tool] || 0xd2e0e4);
          result.metalness = tool === 'bois' ? 0 : 0.75;
          result.roughness = tool === 'bois' ? 0.85 : 0.35;
        }
        if (source.name === 'Cuir_gilet' && armor && armor !== 'cuir') {
          result.map = null;
          result.color.setHex(armor === 'maille' ? 0x919ca0 : 0xcbd8df);
          result.metalness = armor === 'maille' ? 0.45 : 0.75;
          result.roughness = armor === 'maille' ? 0.7 : 0.37;
        }
        return result;
      });
      part.material = Array.isArray(part.material) ? copies : copies[0];
      if (armor && copies.some(material => material.name === 'Cuir_gilet')) part.name = `armure-${armor}`;
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
    marker.name = 'equipe-guerrier'; marker.rotation.x = Math.PI / 2; marker.position.y = .012;
    group.add(marker);

    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map(clips.map(clip => [clip.name, mixer.clipAction(clip)]));
    let active = null, moving = false, disposed = false, attackSequence = 0;
    function change(name, attack = false) {
      if (active?.getClip().name === name && !attack) return;
      const next = actions.get(name);
      if (!next) return;
      const previous = active;
      active?.fadeOut(config().crossFade);
      next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
      next.clampWhenFinished = attack;
      next.setLoop(attack ? THREE.LoopOnce : THREE.LoopRepeat, attack ? 1 : Infinity);
      if (attack) next.setDuration(config().attackDuration);
      if (previous) next.fadeIn(config().crossFade);
      next.play();
      active = next;
    }
    mixer.addEventListener('finished', event => {
      if (event.action === active) change(moving ? config().clips.walk : config().clips.idle);
    });
    change(config().clips.idle);
    mixer.update(0);
    instances++;
    group.userData.warrior = {
      setMoving(value) { moving = Boolean(value); },
      attack(sequence) {
        if (disposed || sequence === attackSequence) return;
        attackSequence = sequence;
        change(config().clips.attacks[(sequence - 1) % config().clips.attacks.length], true);
      },
      tick(delta, paused, dying = false) {
        if (disposed || paused || dying) return;
        if (!config().clips.attacks.includes(active?.getClip().name)) change(moving ? config().clips.walk : config().clips.idle);
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
      get mixer() { return mixer; }
    };
    return group;
  }

  E.WarriorModel = { init, create,
    get ready() { return Boolean(template); },
    get diagnostics() { return { ready: Boolean(template), error, instances, clips: clips?.map(clip => clip.name) || [] }; }
  };
}());
