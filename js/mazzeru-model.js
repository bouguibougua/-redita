(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  let THREE, cloneSkeleton, template, clips, loading, error = null, instances = 0;
  const config = () => E.Config.characterModels.mazzeru;

  function init(three) {
    if (loading) return loading;
    THREE = three;
    loading = Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/SkeletonUtils.js')])
      .then(async ([loader, skeleton]) => {
        cloneSkeleton = skeleton.clone;
        const asset = await new loader.GLTFLoader().loadAsync(new URL(config().src, document.baseURI).href);
        const names = [config().clips.idle, config().clips.walk, ...config().clips.attacks, config().clips.death];
        if (!names.every(name => asset.animations.some(clip => clip.name === name))) throw new Error('Animations du Mazzeru manquantes');
        template = asset.scene; clips = asset.animations;
        return true;
      }).catch(reason => { error = String(reason?.stack || reason); return false; });
    return loading;
  }

  function create(owner) {
    if (!template) return null;
    const group = new THREE.Group();
    const model = cloneSkeleton(template);
    model.name = 'mazzeru-modele';
    model.scale.setScalar(config().height / config().canonicalHeight * E.Config.legendMotion.scaleMultiplier);
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
        // Les bras et l'arc dépassent le volume de la pose initiale pendant la visée.
        part.frustumCulled = false;
      }
    });
    // Recaler la prise de l’arc dans la paume gauche.
    const hand = model.getObjectByName('mixamorigLeftHand');
    const bow = model.getObjectByName('Arc_Mazzeru_Fourni');
    model.updateMatrixWorld(true);
    if (hand && bow) {
      bow.position.set(0,0,0);
      bow.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion())).invert()
        .multiply(model.getWorldQuaternion(new THREE.Quaternion()));
    }
    // Corde et flèche encochée suivent les mains du squelette, dans les coordonnées de la figurine.
    const drawHand=model.getObjectByName('mixamorigRightHand'),vfx=config().bowVisual;
    const cordGeometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(9),3));
    const cord=new THREE.Line(cordGeometry,new THREE.LineBasicMaterial({color:0xc9bca4,transparent:true,opacity:.85}));
    cord.name='corde-animee-mazzeru';group.add(cord);
    const nocked=new THREE.Group();nocked.name='fleche-encochee-mazzeru';
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.002,.002,vfx.arrowLength,5),new THREE.MeshStandardMaterial({color:0x542c26,roughness:.7}));
    shaft.rotation.x=Math.PI/2;shaft.position.z=vfx.arrowLength/2;
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.009,.035,4),new THREE.MeshStandardMaterial({color:0xff9b88,emissive:0x9f151c,emissiveIntensity:.8}));
    tip.rotation.x=Math.PI/2;tip.position.z=vfx.arrowLength+.012;
    const feather=new THREE.Mesh(new THREE.PlaneGeometry(.026,.045),new THREE.MeshBasicMaterial({color:0x9f2534,side:THREE.DoubleSide}));
    feather.rotation.x=Math.PI/2;feather.position.z=.035;
    nocked.add(shaft,tip,feather);group.add(nocked);nocked.visible=false;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
    gradient.addColorStop(0,'#fff1dc');gradient.addColorStop(.18,'#ff8870');gradient.addColorStop(.45,'#ee1c37aa');gradient.addColorStop(1,'#ee1c3700');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const glowMap=new THREE.CanvasTexture(canvas),glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    glow.name='lueur-de-tir-mazzeru';glow.visible=false;group.add(glow);
    let bowBox;
    if(bow?.isMesh){
      // Déformer la corde d'origine avec la traction, sans modifier la géométrie partagée du cache.
      bow.geometry=bow.geometry.clone();bow.userData.sharedGeometry=false;bow.geometry.computeBoundingBox();bowBox=bow.geometry.boundingBox.clone();
      const positions=bow.geometry.attributes.position,offsets=new Float32Array(positions.count*3),height=bowBox.max.y-bowBox.min.y;
      for(let i=0;i<positions.count;i++){
        const y=(positions.getY(i)-(bowBox.min.y+bowBox.max.y)/2)/(height/2),z=positions.getZ(i);
        const band=Math.max(0,1-Math.abs(z-bowBox.min.z)/vfx.stringBand);
        offsets[i*3+2]=-vfx.stringPull*band*Math.max(0,1-Math.abs(y));
      }
      bow.geometry.morphTargetsRelative=true;bow.geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(offsets,3)];bow.updateMorphTargets();
    }
    const local=world=>group.worldToLocal(world.clone());
    const smooth=(a,b,t)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};
    function archeryVisual(phase,shooting){
      if(!hand||!drawHand||!bowBox)return;
      group.updateWorldMatrix(true,true);
      const release=E.Config.badOmen.releaseDelay/config().attackDuration;
      const pull=shooting?smooth(.22,.51,phase)*(1-smooth(release,release+.06,phase)):0;
      bow.morphTargetInfluences[0]=pull;
      const middleZ=bowBox.min.z;
      const top=local(bow.localToWorld(new THREE.Vector3(0,bowBox.max.y,middleZ))),bottom=local(bow.localToWorld(new THREE.Vector3(0,bowBox.min.y,middleZ)));
      const palm=local(hand.getWorldPosition(new THREE.Vector3())),right=local(drawHand.getWorldPosition(new THREE.Vector3()));
      const middle=top.clone().lerp(bottom,.5).lerp(right,pull);
      cordGeometry.attributes.position.setXYZ(0,top.x,top.y,top.z);cordGeometry.attributes.position.setXYZ(1,middle.x,middle.y,middle.z);cordGeometry.attributes.position.setXYZ(2,bottom.x,bottom.y,bottom.z);cordGeometry.attributes.position.needsUpdate=true;cordGeometry.computeBoundingSphere();
      cord.material.color.setHex(pull>0?0xee3344:0xc9bca4);
      nocked.visible=shooting&&phase>.12&&phase<release;
      nocked.position.copy(right);const direction=palm.clone().sub(right);if(direction.lengthSq()>1e-8)nocked.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.normalize());
      const flash=shooting&&phase>=release?Math.max(0,1-(phase-release)*config().attackDuration/vfx.releaseFlash):0;
      glow.visible=shooting&&(pull>.1||flash>0);glow.position.copy(flash?palm:right);glow.material.opacity=.35*pull+flash;glow.scale.setScalar(vfx.glowSize*(.6+pull*.5+flash));
    }
    const marker = new THREE.Mesh(new THREE.TorusGeometry(config().markerRadius, .009, 5, 16),
      new THREE.MeshStandardMaterial({ color: owner === 'red' ? 0x9e4039 : 0x3f7298, roughness: .9 }));
    marker.name = 'equipe-mazzeru'; marker.rotation.x = Math.PI / 2; marker.position.y = .012;
    group.add(marker);

    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map(clips.map(clip => [clip.name, mixer.clipAction(clip)]));
    let active = null, moving = false, disposed = false, dying = false, attackSequence = 0;
    function change(name, attack = false, duration = config().attackDuration) {
      if (active?.getClip().name === name && !attack) return;
      const next = actions.get(name);
      if (!next) return;
      const previous = active;
      active?.fadeOut(E.Config.legendMotion.blendDuration);
      next.reset().setEffectiveWeight(1).setEffectiveTimeScale(name === config().clips.walk ? config().walkTimeScale : 1);
      next.clampWhenFinished = attack;
      next.setLoop(attack ? THREE.LoopOnce : THREE.LoopRepeat, attack ? 1 : Infinity);
      if (attack) next.setDuration(duration);
      if (previous) next.fadeIn(E.Config.legendMotion.blendDuration);
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
    if(hand&&bow){model.updateMatrixWorld(true);bow.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion())).invert().multiply(group.getWorldQuaternion(new THREE.Quaternion()));}
    instances++;
    group.userData.preserveMythologyMaterial = true;
    group.userData.mazzeru = {
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
        // Rattraper une image longue sans ralentir artificiellement les jambes ; sous-pas pour les fondus.
        let remaining=Math.min(Math.max(0,delta),E.Config.legendMotion.maxCatchUp);
        while(remaining>1e-8){const step=Math.min(remaining,E.Config.legendMotion.frameStep);mixer.update(step);remaining-=step;}
        // L’arc reste vertical ; les bras, la corde et la flèche forment un seul geste.
        if(hand&&bow){model.updateMatrixWorld(true);bow.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion())).invert().multiply(group.getWorldQuaternion(new THREE.Quaternion()));}
        const shooting=!dying&&config().clips.attacks.includes(active?.getClip().name);
        archeryVisual(active?.time/(active?.getClip().duration||1),shooting);
      },
      getShotOrigin() { group.updateWorldMatrix(true,true);return hand?hand.getWorldPosition(new THREE.Vector3()):group.getWorldPosition(new THREE.Vector3()); },
      dispose() {
        if (disposed) return;
        disposed = true; instances--; glowMap.dispose();
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

  E.MazzeruModel = { init, create,
    get ready() { return Boolean(template); },
    get diagnostics() { return { ready: Boolean(template), error, instances, clips: clips?.map(clip => clip.name) || [] }; }
  };
}());
