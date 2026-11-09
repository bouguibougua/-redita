(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  let THREE, root, template, clips, cloneSkeleton, loading, error = null;
  const regions = new Map(), apparitions = new Map();
  const sounded = new Set();
  let matchEpoch = null;
  const cfg = () => E.Config.diavuleVisuals;
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = (a, b, x) => { const t = clamp((x-a)/(b-a)); return t*t*(3-2*t); };
  const random = n => { const v = Math.sin(n*127.1+311.7)*43758.5453; return v-Math.floor(v); };
  const noise = `
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.07)*.15;}
  `;

  function init(three, world) {
    THREE = three; root = new THREE.Group(); root.name = 'diavule-effects'; world.add(root);
    loadModel(); // Préparer le GLB avant le clic d'invocation.
  }
  function loadModel() {
    if (loading) return loading;
    loading = Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/SkeletonUtils.js')])
      .then(async ([loader, skeleton]) => {
        const asset = await new loader.GLTFLoader().loadAsync(new URL(cfg().src, document.baseURI).href);
        if (!['Battement','Invocation'].every(name => asset.animations.some(a => a.name === name))) throw new Error('Animations du Diavule manquantes');
        template = asset.scene; clips = asset.animations; cloneSkeleton = skeleton.clone;
        return true;
      }).catch(reason => { error = String(reason?.stack || reason); return false; });
    return loading;
  }
  function shader(vertexShader, fragmentShader, uniforms, additive = false) {
    return new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  }
  function effectMesh(geometry, material, name) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.raycast = () => {}; mesh.frustumCulled = false; return mesh;
  }
  // Merged billboards: one draw call per layer, no particle allocation during animation.
  function quads(entries) {
    const vertices=[],uv=[],origins=[],sizes=[],seeds=[];
    for (const [i,e] of entries.entries()) {
      for (const [x,y] of [[0,0],[1,0],[0,1],[0,1],[1,0],[1,1]]) {
        vertices.push(x-.5,y,0);uv.push(x,y);origins.push(...e.position);sizes.push(...e.size);seeds.push(i*.731+e.seed);
      }
    }
    const geometry=new THREE.BufferGeometry();
    for(const [key,array,size]of [['position',vertices,3],['uv',uv,2],['origin',origins,3],['extent',sizes,2],['seed',seeds,1]]) {
      geometry.setAttribute(key,new THREE.Float32BufferAttribute(array,size));
    }
    return geometry;
  }
  const flameVertex = `
    attribute vec3 origin; attribute vec2 extent; attribute float seed;
    uniform float time,intensity; varying vec2 vUv; varying float vSeed;
    void main(){vUv=uv;vSeed=seed;
      vec4 center=modelViewMatrix*vec4(origin,1.0);
      float height=extent.y*(.88+.12*sin(time*4.7+seed))*(.55+.45*intensity);
      center.xy+=vec2(position.x*extent.x,position.y*height);
      gl_Position=projectionMatrix*center;
    }`;
  const flameFragment = `
    uniform float time,intensity; varying vec2 vUv; varying float vSeed;
    ${noise}
    void main(){
      vec2 p=vUv;float t=time*1.65+vSeed*4.0;
      float n=fbm(vec2(p.x*5.0+vSeed,p.y*4.0-t));
      float bend=sin(p.y*8.0-t*2.0)*.10*p.y+(n-.5)*.30*p.y;
      float width=(1.0-p.y)*.46+.025;
      float shape=1.0-abs(p.x-.5+bend)/width;
      float edge=shape-(n*.7+p.y*.6);
      float alpha=smoothstep(-.13,.18,edge)*(1.0-smoothstep(.78,1.0,p.y))*smoothstep(0.0,.06,p.y);
      float heat=clamp(edge*1.4+(1.0-p.y)*.25,0.0,1.0);
      vec3 color=mix(vec3(1.0,.065,.006),vec3(1.0,.62,.035),smoothstep(.02,.55,heat));
      color=mix(color,vec3(1.0,.97,.68),smoothstep(.48,.95,heat));
      gl_FragColor=vec4(color,alpha*min(1.0,intensity*1.3));
    }`;
  const groundVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

  function createRegion(village, x, width) {
    const group=new THREE.Group();group.name='terrain-incendie';group.position.set(x,0,village.ownerId==='red'?-2.55:2.55);
    const direction=village.ownerId==='red'?1:-1;
    // Local depth is measured from the village towards the central border.
    // Keep the courtyard and sea clear; a river also interrupts the flame bed.
    const depth=village.biome==='littoral'?.45:2.29, near=E.Config.villagePresentation.front+.17;
    const seed=village.lane*71+(direction+1)*19;
    const entries=[];
    for(let i=0;i<cfg().flamesPerRegion;i++) {
      const xx=(random(seed+i*3)-.5)*2.48*width;
      let zz=near+random(seed+i*3+1)*(depth-near);
      if(village.terrain?.river&&Math.abs(direction*zz+xx*.13)<.18)zz=Math.min(depth,zz+.38);
      entries.push({position:[xx,.14,direction*zz],size:[.30+random(i+7)*.30,.44+random(i+13)*.70],seed:random(seed+i)});
    }
    const uniforms={time:{value:0},intensity:{value:1}};
    group.add(effectMesh(quads(entries),shader(flameVertex,flameFragment,uniforms),'flammes-terrain'));
    const ground=effectMesh(new THREE.PlaneGeometry(2.58*width,depth-near),shader(groundVertex,`
      uniform float time,intensity,river,direction,near,depth,width;varying vec2 vUv;${noise}
      void main(){vec2 p=vUv;float z=mix(depth,near,p.y),x=(p.x-.5)*width;
        float bank=1.0-river*(1.0-smoothstep(.09,.18,abs(z+x*.13)));
        float edge=smoothstep(0.0,.08,p.x)*smoothstep(0.0,.08,1.0-p.x)*smoothstep(0.0,.12,p.y)*smoothstep(0.0,.12,1.0-p.y);
        float n=fbm(p*vec2(16.0,19.0));float cracks=pow(1.0-abs(n-.5)*2.0,18.0);
        float glow=(.12+cracks*.50)*(.8+.2*sin(time*3.0+n*14.0));
        gl_FragColor=vec4(1.0,.16+cracks*.23,.012,glow*edge*intensity*bank);
      }`,{...uniforms,river:{value:village.terrain?.river?1:0},direction:{value:direction},near:{value:near},depth:{value:depth},width:{value:2.58*width}},true),'braises-au-sol');
    ground.rotation.x=-Math.PI/2;ground.rotation.z=direction<0?Math.PI:0;ground.position.set(0,.125,direction*(near+depth)/2);group.add(ground);
    const sparks=entries.slice(0,cfg().embersPerRegion).map((e,i)=>({...e,size:[.015+random(i)*.02,.035+random(i+33)*.04]}));
    group.add(effectMesh(quads(sparks),shader(`
      attribute vec3 origin;attribute vec2 extent;attribute float seed;uniform float time,intensity;
      varying vec2 vUv;varying float life;
      void main(){vUv=uv;life=fract(time*.34+seed);vec3 p=origin;
        p.x+=sin(time*1.4+seed*9.0)*life*.22;p.y+=life*(1.2+fract(seed)*.8);
        vec4 center=modelViewMatrix*vec4(p,1.0);center.xy+=position.xy*extent;
        gl_Position=projectionMatrix*center;}`,`
      uniform float intensity;varying vec2 vUv;varying float life;
      void main(){float a=pow(max(0.0,1.0-length((vUv-.5)*2.0)),1.4)*sin(life*3.14159);
        gl_FragColor=vec4(1.0,.60,.13,a*intensity);}`,uniforms,true),'etincelles-terrain'));
    root.add(group);return {group,uniforms,burnUntil:village.burnUntil};
  }
  function createApparition(lane,x,key,casterId,spawnDepth,viewCamera) {
    const group=new THREE.Group();group.name='apparition-diavule';
    group.position.set(x,0,casterId==='red'?-spawnDepth:spawnDepth);
    group.userData={lane,casterId};
    const uniforms={time:{value:0},intensity:{value:1},sparkIntensity:{value:0},flash:{value:0}};
    // Fines langues de feu autour d'un cœur lumineux : la silhouette et les
    // ailes restent visibles lorsque la colonne s'ouvre, comme dans le clip.
    const eruption=effectMesh(quads([{position:[0,.13,0],size:[1.45,2.05],seed:1}]),shader(flameVertex,`
      varying vec2 vUv;uniform float time,intensity;${noise}
      void main(){vec2 p=vUv;float n=fbm(vec2(p.x*5.0,p.y*5.0-time*3.0));
        float flash=smoothstep(.20,.28,time)*(1.0-smoothstep(.32,.48,time));
        float width=(.055+.12*sin(3.14159*p.y)+.12*exp(-pow((p.y-.76)*6.0,2.0))*flash)*(1.0-smoothstep(.82,1.0,p.y));
        float bend=sin(p.y*11.0-time*9.0)*.028+(n-.5)*.07;
        float d=abs(p.x-.5+bend)/max(.002,width);
        float core=1.0-smoothstep(.32,1.0,d);
        float veil=exp(-d*d*1.2)*.35;
        float ribbons=pow(max(0.0,1.0-abs(sin(p.y*9.0-time*12.0+abs(p.x-.5)*19.0))),9.0);
        float alpha=(core+veil+ribbons*.18*exp(-d))*(1.0-smoothstep(.88,1.0,p.y));
        vec3 color=mix(vec3(1.0,.18,.008),vec3(1.0,.80,.21),core);
        color=mix(color,vec3(1.0,.98,.86),flash*core);
        gl_FragColor=vec4(color,alpha*intensity);}`,uniforms,true),'gerbe-invocation');
    group.add(eruption);
    const glow=effectMesh(quads([{position:[0,.05,0],size:[3.0,3.0],seed:0}]),shader(flameVertex,`
      varying vec2 vUv;uniform float intensity,flash;
      void main(){vec2 p=(vUv-vec2(.5,.45))*vec2(2.8,2.0);
        float halo=exp(-dot(p,p)*4.5)*(1.0-smoothstep(.7,1.0,length(p)));
        gl_FragColor=vec4(1.0,.38+flash*.35,.045,halo*intensity*.48);}`,uniforms,true),'halo-invocation');group.add(glow);
    const ring=effectMesh(new THREE.PlaneGeometry(3.1,3.1),shader(groundVertex,`
      varying vec2 vUv;uniform float time,intensity;
      void main(){vec2 p=(vUv-.5)*2.0;float r=length(p),angle=atan(p.y,p.x);
        float radius=.23+min(time/.85,1.0)*.40;
        float ring=exp(-pow((r-radius)*34.0,2.0));
        float arc=pow(.5+.5*sin(angle*3.0-time*15.0),2.0);
        float second=exp(-pow((r-radius*.72)*45.0,2.0))*(.5+.5*sin(angle*2.0+time*10.0));
        float glow=exp(-r*r*7.0)*.18;
        gl_FragColor=vec4(1.0,.42+.4*ring,.07,(ring*arc+second*.55+glow)*intensity);}`,uniforms,true),'onde-incandescente');
    ring.rotation.x=-Math.PI/2;ring.position.y=.15;group.add(ring);root.add(group);
    const flare=effectMesh(quads([{position:[0,1.1,0],size:[3.6,.16],seed:0}]),shader(flameVertex,`
      varying vec2 vUv;uniform float flash;
      void main(){float a=exp(-pow((vUv.y-.5)*4.0,2.0))*pow(1.0-abs(vUv.x-.5)*2.0,2.0);
        gl_FragColor=vec4(1.0,.87,.61,a*flash);}`,uniforms,true),'flash-invocation');group.add(flare);
    // Un ruban en volume passe devant et derrière le personnage.
    const ribbonGeometry=new THREE.PlaneGeometry(1,1,64,1);
    const ribbons=effectMesh(ribbonGeometry,shader(`
      uniform float time;varying vec2 vUv;
      void main(){vUv=uv;float a=uv.x*6.28318+time*9.0;
        float h=.18+uv.x*1.75,r=.46-.14*uv.x;
        vec3 p=vec3(cos(a)*r,h+position.y*.025,sin(a)*r);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,`
      uniform float sparkIntensity;varying vec2 vUv;
      void main(){float taper=sin(vUv.x*3.14159),edge=1.0-abs(vUv.y-.5)*2.0;
        gl_FragColor=vec4(1.0,.85,.36,pow(taper,1.5)*edge*sparkIntensity);}`,uniforms,true),'rubans-invocation');
    group.add(ribbons);
    const sparks=Array.from({length:36},(_,i)=>({position:[0,0,0],size:[.018,.055+random(i)*.09],seed:random(i+9)}));
    group.add(effectMesh(quads(sparks),shader(`
      attribute vec3 origin;attribute vec2 extent;attribute float seed;uniform float time;
      varying vec2 vUv;varying float fade;
      void main(){vUv=uv;float life=fract(seed+time*.72),angle=seed*12.0+time*6.0;
        vec3 p=vec3(cos(angle)*(.28+seed*.34),.18+life*2.0,sin(angle)*(.28+seed*.34));
        vec4 center=modelViewMatrix*vec4(p,1.0);center.xy+=position.xy*extent;fade=sin(life*3.14159);
        gl_Position=projectionMatrix*center;}`,`
      varying vec2 vUv;varying float fade;uniform float sparkIntensity;
      void main(){float a=pow(max(0.0,1.0-length((vUv-.5)*2.0)),1.5);
        gl_FragColor=vec4(1.0,.86,.42,a*fade*sparkIntensity);}`,uniforms,true),'spirale-etincelles'));
    const impact=effectMesh(new THREE.PlaneGeometry(3.6,3.6),shader(groundVertex,`
      varying vec2 vUv;uniform float time;${noise}
      void main(){float t=clamp((time-1.37)/.48,0.0,1.0),r=length((vUv-.5)*2.0);
        float arc=.6+.4*noise(vUv*18.0),ring=exp(-pow((r-(.12+t*.72))*38.0,2.0));
        float fade=smoothstep(0.0,.09,t)*(1.0-smoothstep(.25,1.0,t));
        gl_FragColor=vec4(1.0,.42,.06,ring*arc*fade*.7);}`,uniforms,true),'impact-reception');
    impact.rotation.x=-Math.PI/2;impact.position.y=.152;group.add(impact);
    const light=new THREE.PointLight(0xffa23e,0,4,2);light.position.y=1.05;group.add(light);
    let facing=-Math.PI/2;
    if(viewCamera){const eye=viewCamera.getWorldPosition(new THREE.Vector3());root.worldToLocal(eye).sub(group.position);facing=Math.atan2(eye.x,eye.z);}
    return {group,uniforms,eruption,ring,flare,glow,ribbons,impact,light,facing,key,model:null,mixer:null,materials:[],skeletons:new Set()};
  }
  function attachModel(effect) {
    if(!template||effect.model)return;
    const model=cloneSkeleton(template);model.name='diavule-modele-anime';model.scale.setScalar(cfg().modelScale);
    model.rotation.y=effect.facing; // Face au joueur à l'invocation, puis pose stable pendant la séquence.
    model.traverse(part=>{
      part.raycast=()=>{};
      if(!part.isMesh)return;
      part.userData.sharedGeometry=true;part.castShadow=true;part.frustumCulled=false;
      part.material=part.material.clone();part.material.transparent=true;
      part.material.emissiveMap=part.material.map;
      // Une lueur non multipliée par la texture rouge fait émerger le corps
      // blanc-or, puis laisse réapparaître progressivement sa couleur originale.
      const glow={value:0},flash={value:0};
      part.material.userData.invocationGlow=glow;part.material.userData.invocationFlash=flash;
      part.material.onBeforeCompile=program=>{
        program.uniforms.invocationGlow=glow;program.uniforms.invocationFlash=flash;
        program.fragmentShader='uniform float invocationGlow, invocationFlash;\n'+program.fragmentShader;
        program.fragmentShader=program.fragmentShader.replace('#include <emissivemap_fragment>',`
          #include <emissivemap_fragment>
          float rim=pow(1.0-max(0.0,dot(normal,normalize(vViewPosition))),2.0);
          vec3 invocationColor=mix(vec3(1.0,.48,.035),vec3(1.0,.96,.79),invocationFlash);
          totalEmissiveRadiance+=invocationColor*invocationGlow*(.48+rim*.8);
        `);
      };
      part.material.customProgramCacheKey=()=> 'diavule-invocation-v3';
      effect.materials.push(part.material);
      if(part.isSkinnedMesh)effect.skeletons.add(part.skeleton);
    });
    const mixer=new THREE.AnimationMixer(model);
    effect.actions=Object.fromEntries(clips.map(clip=>[clip.name,mixer.clipAction(clip).play()]));
    effect.model=model;effect.mixer=mixer;effect.group.add(model);
  }
  function dispose(effect) {
    effect.audio?.pause();
    effect.mixer?.stopAllAction();if(effect.model)effect.mixer.uncacheRoot(effect.model);
    effect.skeletons?.forEach(s=>s.dispose());effect.group.removeFromParent();
    effect.group.traverse(p=>{if(!p.userData.sharedGeometry)p.geometry?.dispose();p.material?.dispose();});
  }
  function update(state, laneX, width, viewCamera) {
    if(!root||!state)return;
    if(matchEpoch!==state.reinforcementEpoch){matchEpoch=state.reinforcementEpoch;sounded.clear();}
    const active=new Set(),activeLanes=new Map(),duration=E.Config.reinforcementPowers.burnDuration;
    for(const player of Object.values(state.players))for(const village of player.villages){
      if(!E.MythologyEffects.isBurned(state,village))continue;
      const age=E.MythologyEffects.burnAge(state,village),castKey=village.burn?.id||village.burnUntil;
      const key=village.id,signature=[castKey,village.biome,!!village.terrain?.river,width].join(':');
      const casterId=village.burn?.casterId||'red';
      const source=state.players[casterId]?.villages[village.lane];
      const spawnDepth=source?.biome==='littoral'?cfg().coastSpawnDepth:cfg().spawnDepth;
      active.add(key);activeLanes.set(village.lane,{age,key:castKey,casterId,spawnDepth});
      let effect=regions.get(key);
      if(effect?.signature!==signature){if(effect)dispose(effect);effect=createRegion(village,laneX(village.lane),width);effect.signature=signature;regions.set(key,effect);}
      const remaining=duration-age;
      effect.uniforms.time.value=age;
      effect.uniforms.intensity.value=(.42+.58*(1-smooth(4,23,age)))*smooth(0,4,remaining)*(.12+.88*smooth(0,.3,age));
      effect.group.position.x=laneX(village.lane);
    }
    for(const [key,effect]of regions)if(!active.has(key)){dispose(effect);regions.delete(key);}
    for(const [lane,{age,key,casterId,spawnDepth}]of activeLanes){
      if(age>=cfg().apparitionDuration)continue;
      loadModel();let effect=apparitions.get(lane);
      if(effect?.key!==key){if(effect)dispose(effect);effect=createApparition(lane,laneX(lane),key,casterId,spawnDepth,viewCamera);apparitions.set(lane,effect);}
      if(!sounded.has(key)&&!state.paused){
        sounded.add(key);
        if(age<cfg().invocationDuration&&!state.paused)effect.audio=E.Audio?.playEffect('diavule');
      }
      if(effect.audio&&!effect.audio.ended){
        if(state.paused||E.Audio?.muted)effect.audio.pause();
        else if(effect.audio.paused&&age<cfg().invocationDuration)effect.audio.play().catch(()=>{});
      }
      attachModel(effect);effect.group.position.x=laneX(lane);
      effect.uniforms.time.value=age;
      effect.uniforms.intensity.value=smooth(.15,.28,age)*(1-smooth(.42,.98,age));
      effect.uniforms.flash.value=smooth(.20,.28,age)*(1-smooth(.31,.50,age));
      effect.uniforms.sparkIntensity.value=smooth(.18,.35,age)*(1-smooth(.85,1.50,age));
      effect.eruption.visible=effect.ring.visible=effect.flare.visible=effect.glow.visible=age<1.05;
      effect.ribbons.visible=age<1.5;
      effect.impact.visible=age>1.37&&age<1.85;
      effect.light.intensity=5*effect.uniforms.intensity.value+1.1*smooth(1.37,1.45,age)*(1-smooth(1.45,1.8,age));
      if(effect.model){
        const fade=(.12+.88*smooth(.18,.32,age))*(1-smooth(cfg().apparitionDuration-1.25,cfg().apparitionDuration,age));
        effect.model.visible=fade>.001;effect.materials.forEach(m=>{m.opacity=fade;m.depthWrite=fade>.95;});
        const heat=smooth(.20,.32,age)*(1-smooth(.60,1.06,age)),flash=effect.uniforms.flash.value;
        effect.materials.forEach(m=>{
          m.emissive.setRGB(1,.40,.04);m.emissiveIntensity=heat*.3;
          m.userData.invocationGlow.value=heat*(1.9+3.6*flash);
          m.userData.invocationFlash.value=flash;
        });
        effect.model.position.y=.14;
        const invocation=1-smooth(1.55,cfg().invocationDuration,age);
        effect.actions.Invocation.setEffectiveWeight(invocation);effect.actions.Battement.setEffectiveWeight(1-invocation);
        if(effect.poseTime!==age){effect.mixer.setTime(age);effect.poseTime=age;}
      }
    }
    for(const [lane,effect]of apparitions)if(!activeLanes.has(lane)||activeLanes.get(lane).age>=cfg().apparitionDuration){dispose(effect);apparitions.delete(lane);}
  }
  E.DiavuleEffects={init,update,loadModel,get diagnostics(){return {ready:!!template,error,regions:regions.size,apparitions:apparitions.size,clips:clips?.map(c=>c.name)||[]};}};
}());
