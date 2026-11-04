(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  let THREE, cloneSkeleton, template, clips, loading, error = null, triangles = 0, instances = 0;
  const config = () => E.Config.characterModels.hunter;

  function init(three) {
    if (loading) return loading;
    THREE = three;
    loading = Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/SkeletonUtils.js')])
      .then(async ([loader, skeleton]) => {
        cloneSkeleton = skeleton.clone;
        const asset = await new loader.GLTFLoader().loadAsync(new URL(config().src, document.baseURI).href);
        if (!Object.values(config().clips).every(name => asset.animations.some(clip => clip.name === name))) {
          throw new Error('Animations du chasseur manquantes');
        }
        asset.scene.traverse(part => {
          if (part.isMesh) triangles += (part.geometry.index?.count || part.geometry.attributes.position.count) / 3;
        });
        if (!triangles) throw new Error('Le modèle du chasseur ne contient aucun maillage');
        template = asset.scene; clips = asset.animations;
        return true;
      }).catch(reason => { error = String(reason?.stack || reason); return false; });
    return loading;
  }

  function create(owner, tool = null, armor = null) {
    if (!template) return null;
    const group = new THREE.Group(), model = cloneSkeleton(template);
    model.name = 'chasseur-modele'; model.scale.setScalar(config().scale); group.add(model);
    const materials = new Map(), skeletons = new Set();
    let canonicalSkeleton;
    model.traverse(part => {
      if (!part.isMesh) return;
      part.castShadow = part.receiveShadow = true;
      part.userData.sharedGeometry = true;
      const copy = source => {
        if (!materials.has(source)) {
          const result = source.clone();
          if (source.name === 'Arc_Bagues_Bronze' && tool) {
            result.color.setHex({bois:0xb98542,bronze:0xc28b43,fer:0xd2e0e4}[tool] || 0xc28b43);
            result.metalness = tool === 'bois' ? 0 : .65;
          }
          materials.set(source, result);
        }
        return materials.get(source);
      };
      part.material = Array.isArray(part.material) ? part.material.map(copy) : copy(part.material);
      if (part.isSkinnedMesh) {
        const skeleton = part.skeleton;
        if (canonicalSkeleton && skeleton.bones.length === canonicalSkeleton.bones.length &&
          skeleton.bones.every((bone, i) => bone === canonicalSkeleton.bones[i] && skeleton.boneInverses[i].equals(canonicalSkeleton.boneInverses[i]))) {
          part.skeleton = canonicalSkeleton;
        } else if (!canonicalSkeleton) canonicalSkeleton = skeleton;
        skeletons.add(part.skeleton); part.frustumCulled = false;
      }
    });
    const marker = new THREE.Mesh(new THREE.TorusGeometry(.11, .009, 5, 16),
      new THREE.MeshStandardMaterial({ color: owner === 'red' ? 0x9e4039 : 0x3f7298, roughness: .9 }));
    marker.name = 'equipe-chasseur'; marker.rotation.x = Math.PI / 2; marker.position.y = .012; group.add(marker);

    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map(clips.map(clip => [clip.name, mixer.clipAction(clip)]));
    let active = null, moving = false, disposed = false, dying = false, attacking = false, lastAttack = null;
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
    let shotTarget = null, launched = false, flight = null;
    const arrow = new THREE.Group(); arrow.name = 'fleche-en-vol'; arrow.visible = false; group.add(arrow);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.003, .003, .16, 5), new THREE.MeshStandardMaterial({color:0x88603a}));
    shaft.rotation.x = Math.PI / 2; arrow.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.012, .035, 4), new THREE.MeshStandardMaterial({color:0xc7d1d2,metalness:.6,roughness:.4}));
    tip.rotation.x = Math.PI / 2; tip.position.z = .095; arrow.add(tip);
    function launch() {
      launched = true;
      if (!shotTarget || !group.parent) return;
      group.updateWorldMatrix(true, true);
      const bow = model.getObjectByName('bow');
      const start = group.parent.worldToLocal(bow.getWorldPosition(new THREE.Vector3()));
      flight = { start, target: shotTarget.clone(), time: 0 }; arrow.visible = true;
    }
    function animateArrow(delta) {
      if (!flight || !group.parent) return;
      flight.time += delta;
      const t = Math.min(1, flight.time / config().arrowFlightDuration);
      const position = flight.start.clone().lerp(flight.target, t);
      position.y += Math.sin(t * Math.PI) * .07;
      group.updateWorldMatrix(true, false);
      arrow.position.copy(group.worldToLocal(group.parent.localToWorld(position)));
      const target = group.worldToLocal(group.parent.localToWorld(flight.target.clone()));
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), target.sub(arrow.position).normalize());
      if (t >= 1) { arrow.visible = false; flight = null; }
    }
    const locomotion = () => change(moving ? config().clips.walk : config().clips.idle);
    function die() {
      if (disposed || dying) return;
      dying = true; moving = attacking = false;
      change(config().clips.death, true, E.Config.visualEffects.unitDeathDuration);
    }
    mixer.addEventListener('finished', event => {
      if (!dying && event.action === active) { attacking = false; locomotion(); }
    });
    change(config().clips.idle); mixer.update(0); group.updateMatrixWorld(true);
    addEquipment(model, tool, armor);
    instances++;
    group.userData.hunter = {
      setMoving(value) { moving = Boolean(value); },
      attack(sequence, target) {
        if (disposed || dying || sequence === lastAttack) return;
        lastAttack = sequence; attacking = true; shotTarget = target?.clone() || null; launched = false;
        change(config().clips.attack, true, config().attackDuration);
      },
      die,
      tick(delta, paused, dead = false) {
        if (disposed || paused) return;
        if (dead) die();
        if (!dying && !attacking) locomotion();
        const step = Math.min(delta, config().maxFrameDelta);
        mixer.update(step);
        if (attacking && !launched && active.time >= active.getClip().duration * .5) launch();
        animateArrow(step);
      },
      dispose() {
        if (disposed) return;
        disposed = true; instances--; mixer.stopAllAction(); mixer.uncacheRoot(model);
        skeletons.forEach(skeleton => skeleton.dispose());
      },
      get action() { return active?.getClip().name; },
      get time() { return active?.time || 0; },
      get projectileVisible() { return arrow.visible; },
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
    if (armor && bone('chest')) {
      const chest = bone('chest'), color = { cuir: 0x87532f, maille: 0x919ca0, fer: 0xcbd8df }[armor] || 0x87532f;
      const metalness = armor === 'cuir' ? 0 : armor === 'maille' ? .45 : .75;
      box(chest, `armure-${armor}`, [.52, .40, .37], color, [0, -.04, 0], metalness);
    }
  }

  E.HunterModel = { init, create,
    get ready() { return Boolean(template); },
    get diagnostics() { return { ready: Boolean(template), error, triangles, instances, clips: clips?.map(clip => clip.name) || [] }; }
  };
}());
