(function () {
  'use strict';
  const E = window.Eredita;
  // Le rendu ne possède ni stock ni prix. Il reçoit les devis de la boutique existante.
  async function create(container) {
    const [T, {GLTFLoader}, {mergeGeometries,mergeVertices}] = await Promise.all([
      import('./vendor/three.module.min.js'), import('./vendor/GLTFLoader.js'), import('./vendor/BufferGeometryUtils.js')
    ]);
    const cfg = E.Config.shopScene, art = E.ShopArt;
    const scene = new T.Scene(), root = new T.Group(), decor = new T.Group();
    scene.background = new T.Color('#75624c'); scene.add(root); root.add(decor);
    const camera = new T.OrthographicCamera(-cfg.width/2,cfg.width/2,cfg.height/2,-cfg.height/2,.1,60);
    camera.position.set(0,0,25); camera.lookAt(0,0,0);
    const renderer = new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1,cfg.pixelRatio));
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cfg.exposure; renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
    const canvas = renderer.domElement; canvas.className = 'shop-3d-canvas';
    canvas.setAttribute('aria-hidden','true'); container.prepend(canvas);
    const errors = {}, records = new Map(), resources = new Set(), textures = new Set(), animations = [];
    const loader = new GLTFLoader();
    let renderStats={calls:0,triangles:0};
    let frame = 0, running = false, disposed = false, lastTime = 0, hover = null, elapsed = 0, lost = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let seed = 9187;
    function random() { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }
    const track = value => (resources.add(value),value);
    const hoverEffect=E.ShopHover.create(cfg.hover);
    const surfaces=E.ShopMaterials.create(T,{track,textures,renderer,config:cfg});
    const {wood,darkWood,paleWood,iron,brass,linen,rope,wicker,wickerDark,green,leafLight,silver,leather}=surfaces;
    function chainmailTexture() {
      const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
      x.fillStyle='#454945';x.fillRect(0,0,512,512);
      for(let row=-1;row<17;row++)for(let col=-1;col<17;col++) {
        x.lineWidth=5;x.strokeStyle='#b1b6ae';x.beginPath();x.ellipse(col*32+(row%2)*16,row*32,12,18,.35,0,Math.PI*2);x.stroke();
        x.lineWidth=1.5;x.strokeStyle='#dde0d4';x.beginPath();x.ellipse(col*32+(row%2)*16-1,row*32-1,10,16,.35,Math.PI,Math.PI*2);x.stroke();
      }
      const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(1.5,1.5);textures.add(t);return t;
    }
    const mailMap=chainmailTexture();
    function mat(color,options={}) {return track(new T.MeshStandardMaterial({color,roughness:.77,...options}));}
    function mesh(parent,g,m,x=0,y=0,z=0) {
      track(g);const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;
    }
    // Arêtes usées et UV métriques : le veinage suit la longueur de chaque pièce.
    function box(p,w,h,d,m,x=0,y=0,z=0) {
      const bevel=Math.min(.035,w*.12,h*.12,d*.12),shape=new T.Shape();
      shape.moveTo(-w/2+bevel,-h/2+bevel);shape.lineTo(w/2-bevel,-h/2+bevel);
      shape.lineTo(w/2-bevel,h/2-bevel);shape.lineTo(-w/2+bevel,h/2-bevel);shape.closePath();
      const g=new T.ExtrudeGeometry(shape,{depth:d-2*bevel,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,steps:1});
      g.translate(0,0,-d/2+bevel);
      if(m.map){const a=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
        for(let i=0;i<a.count;i++){
          const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
          let u,v;
          if(nz>=nx&&nz>=ny){u=w>=h?a.getX(i):a.getY(i);v=w>=h?a.getY(i):a.getX(i);}
          else if(ny>=nx){u=w>=d?a.getX(i):a.getZ(i);v=w>=d?a.getZ(i):a.getX(i);}
          else{u=h>=d?a.getY(i):a.getZ(i);v=h>=d?a.getZ(i):a.getY(i);}
          uv.setXY(i,u/2.2,v/.65);
        }
      }
      return mesh(p,g,m,x,y,z);
    }
    const ball=(p,r,m,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{
      const o=mesh(p,new T.SphereGeometry(r,20,14),m,x,y,z);o.scale.set(sx,sy,sz);return o;
    };
    function rod(p,a,b,r,m,sides=6) {
      const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av);
      const o=mesh(p,new T.CylinderGeometry(r,r,v.length(),sides),m);
      o.position.copy(av.add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;
    }
    function ring(p,r,t,m,x=0,y=0,z=0) {return mesh(p,new T.TorusGeometry(r,t,5,36),m,x,y,z);}
    function extrude(p,points,depth,m) {
      const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
      const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,steps:1,curveSegments:12});
      g.translate(0,0,-depth/2);return mesh(p,g,m);
    }
    function label(p,text,w,h,x,y,z,color='#392817') {
      const c = document.createElement('canvas');
      c.height = 128;
      c.width = Math.round(c.height * w / h);
      const cx = c.getContext('2d');
      cx.fillStyle = color;
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      const fontSize = text.length > 17 ? 60 : 78;
      cx.font = `bold ${fontSize}px Georgia`;
      const textWidth = cx.measureText(text).width;
      const availableWidth = c.width * .93;
      if (textWidth > availableWidth) cx.font = `bold ${fontSize * availableWidth / textWidth}px Georgia`;
      cx.fillText(text, c.width / 2, c.height / 2 + 2);
      const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;textures.add(t);
      return mesh(p,new T.PlaneGeometry(w,h),track(new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false})),x,y,z);
    }
    function wearTrace(w,h,x,y) {
      const c=document.createElement('canvas');c.width=c.height=128;const cx=c.getContext('2d');
      const fade=cx.createRadialGradient(64,64,12,64,64,62);
      fade.addColorStop(0,'rgba(225,207,172,.15)');fade.addColorStop(.6,'rgba(225,207,172,.08)');fade.addColorStop(1,'rgba(225,207,172,0)');
      cx.fillStyle=fade;cx.fillRect(0,0,128,128);
      const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;textures.add(t);
      const trace=mesh(root,new T.PlaneGeometry(w,h),track(new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,toneMapped:false})),x,y,-.83);
      trace.visible=false;trace.castShadow=trace.receiveShadow=false;return trace;
    }
    function plate(p,text,w=1.25,x=0,y=0,z=.5) {
      const g=new T.Group();p.add(g);g.position.set(x,y,z);
      const body=extrude(g,[[-w/2+.04,-.135],[-w/2,-.08],[-w/2+.015,.10],[-w/2+.055,.135],[w/2-.055,.13],[w/2,.08],[w/2-.01,-.105],[w/2-.06,-.135]],.05,paleWood);body.rotation.z=-.012;
      for(const s of [-1,1])ball(g,.024,iron,s*(w/2-.07),0,.045);
      label(g,text,w-.08,.27,0,0,.075);return g;
    }
    // Fusion par matériau à l'intérieur d'un seul objet : les objets interactifs restent distincts.
    function batch(group) {
      group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),buckets=new Map(),old=[];
      group.traverse(o=>{
        if(!o.isMesh || Array.isArray(o.material))return;
        const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(inverse.clone().multiply(o.matrixWorld));
        if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(g);old.push(o);
      });
      old.forEach(o=>o.removeFromParent());
      for(const [m,gs] of buckets){const g=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());if(g)mesh(group,g,m);}
      return group;
    }
    function fit(object,w,h,depth=1.2) {
      object.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(object),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
      const s=Math.min(w/Math.max(.001,size.x),h/Math.max(.001,size.y),depth/Math.max(.001,size.z));
      const g=new T.Group();
      g.add(object);
      object.position.sub(center);
      g.scale.setScalar(s);
      g.userData.shopBounds = new T.Box3().setFromObject(g, true);
      return g;
    }
    function prepareModel(object) {
      object.traverse(o=>{if(o.isMesh){track(o.geometry);for(const m of [].concat(o.material)){track(m);for(const v of Object.values(m))if(v?.isTexture){v.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.add(v);}}o.castShadow=o.receiveShadow=true;}});
      return object;
    }
    // Environnement de réflexion partagé, sans HDR externe ni post-traitement.
    const envCanvas=document.createElement('canvas');envCanvas.width=1024;envCanvas.height=512;
    const ec=envCanvas.getContext('2d'),sky=ec.createLinearGradient(0,0,0,512);
    sky.addColorStop(0,'#b9d1d6');sky.addColorStop(.42,'#eee1bd');sky.addColorStop(.56,'#79634d');sky.addColorStop(1,'#342a22');
    ec.fillStyle=sky;ec.fillRect(0,0,1024,512);
    ec.fillStyle='#fff4d8';ec.fillRect(150,85,160,105);ec.fillStyle='#98b5c0';ec.fillRect(700,110,180,120);
    const envTexture=new T.CanvasTexture(envCanvas);envTexture.colorSpace=T.SRGBColorSpace;envTexture.mapping=T.EquirectangularReflectionMapping;
    const pmrem=new T.PMREMGenerator(renderer),environment=track(pmrem.fromEquirectangular(envTexture));
    scene.environment=environment.texture;envTexture.dispose();pmrem.dispose();
    scene.add(new T.HemisphereLight('#dce5dd','#55402e',cfg.ambientIntensity));
    const sun=new T.DirectionalLight('#ffe2af',cfg.sunIntensity);sun.position.set(-6,9,10);sun.castShadow=true;
    sun.shadow.mapSize.set(cfg.shadowSize,cfg.shadowSize);Object.assign(sun.shadow.camera,{left:-10,right:10,top:7,bottom:-6,near:1,far:35});
    sun.shadow.bias=-.0006;sun.shadow.normalBias=.025;sun.shadow.radius=3;scene.add(sun);
    const bounce=new T.DirectionalLight('#b8d0d6',cfg.bounceIntensity);bounce.position.set(8,3,6);scene.add(bounce);

    const decorModels=E.ShopDecor.create(T,{root,decor,surfaces,track,random,mergeGeometries,label});
    animations.push(...decorModels.animations);

    function weapon(type) {
      const g=new T.Group(),metal=type==='bronze'?brass:type==='fer'?silver:mat('#aaa99c',{...surfaces.maps.stone,roughness:.85});
      const sword=new T.Group();g.add(sword);sword.rotation.z=-.46;
      extrude(sword,[[-.105,-.08],[-.13,.58],[0,.88],[.13,.58],[.105,-.08]],.09,metal);
      box(sword,.54,.085,.15,brass,0,-.15,0);box(sword,.13,.48,.12,darkWood,0,-.43,0);
      for(let i=0;i<6;i++)box(sword,.15,.022,.14,rope,0,-.25-i*.065,0);
      ball(sword,.1,brass,0,-.72,0);
      const sickle=new T.Group();g.add(sickle);sickle.rotation.z=.47;sickle.position.x=-.30;sickle.position.z=-.15;
      box(sickle,.12,.88,.12,wood,0,-.24,0);
      const shape=[];for(let i=0;i<=20;i++){const a=.05+i/20*Math.PI;shape.push([Math.cos(a)*.50,.18+Math.sin(a)*.50]);}
      for(let i=20;i>=0;i--){const a=.05+i/20*Math.PI;shape.push([Math.cos(a)*.38,.18+Math.sin(a)*.38]);}
      extrude(sickle,shape,.06,metal);return batch(g);
    }
    // Subdiviser les faces avant de les cintrer évite les grandes diagonales
    // d'un plastron extrudé avec seulement quelques triangles.
    function curvedArmor(geometry) {
      let source=geometry.index?geometry.toNonIndexed():geometry.clone();
      for(let pass=0;pass<3;pass++){
        const attributes={};
        for(const name of ['position','normal','uv'])attributes[name]=[];
        for(let i=0;i<source.attributes.position.count;i+=3){
          for(const name of Object.keys(attributes)){
            const a=source.attributes[name],size=a.itemSize;
            const vertices=[0,1,2].map(n=>Array.from({length:size},(_,k)=>a.array[(i+n)*size+k]));
            const [v0,v1,v2]=vertices,mid=(a,b)=>a.map((v,k)=>(v+b[k])/2);
            const m01=mid(v0,v1),m12=mid(v1,v2),m20=mid(v2,v0);
            for(const v of [v0,m01,m20,m01,v1,m12,m20,m12,v2,m01,m12,m20])attributes[name].push(...v);
          }
        }
        const next=new T.BufferGeometry();for(const [name,values] of Object.entries(attributes))next.setAttribute(name,new T.Float32BufferAttribute(values,name==='uv'?2:3));
        source.dispose();source=next;
      }
      const welded=mergeVertices(source);source.dispose();const a=welded.attributes.position;
      for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i);a.setZ(i,a.getZ(i)+.17*Math.max(0,1-x*x/.26)*Math.max(0,1-y*y/1.0));}
      welded.computeVertexNormals();return track(welded);
    }
    function armor(type) {
      const g=new T.Group(),m=type==='cuir'?leather:type==='maille'?mat('#c1c5bd',{map:mailMap,bumpMap:mailMap,bumpScale:.025,metalness:.52,roughness:.5}):silver;
      const body=extrude(g,[[-.50,.7],[-.23,.72],[-.18,.51],[.18,.51],[.23,.72],[.5,.7],[.43,.32],[.37,-.43],[.49,-.65],[-.49,-.65],[-.37,-.43],[-.43,.32]],.27,m);
      const flat=body.geometry;body.geometry=curvedArmor(flat);flat.dispose();resources.delete(flat);
      body.rotation.y=-.10;
      for(const side of [-1,1]){
        const strap=box(g,.16,.24,.12,type==='cuir'?leather:m,side*.36,.68,.07);strap.rotation.z=side*-.13;
        ball(g,.03,brass,side*.36,.59,.22);
      }
      if(type==='cuir'){
        box(g,.84,.105,.05,darkWood,0,-.28,.26);box(g,.15,.14,.035,brass,.05,-.28,.30);
        box(g,.095,.085,.039,darkWood,.05,-.28,.32);
      }

      if(type!=='maille') {
        rod(g,[0,-.57,.30],[0,.48,.30],.022,type==='cuir'?rope:brass);
        for(const s of [-1,1]){rod(g,[s*.34,-.5,.23],[s*.38,.48,.23],.022,type==='cuir'?rope:iron);
          for(let i=0;i<6;i++)ball(g,.025,brass,s*.38,-.45+i*.18,.25);}
      }
      box(g,.07,.25,.07,darkWood,0,.86,-.13);return batch(g);
    }
    function net() {
      const g=new T.Group();
      for(let i=0;i<12;i++)for(let j=0;j<8;j++) {
        const x=-1.2+i*.21,y=.85-j*.22;
        rod(g,[x,y,0],[x+.18,y-.22,.04*Math.sin(i+j)],.014,rope,4);
        rod(g,[x+.18,y,0],[x,y-.22,0],.014,rope,4);
      }
      for(const s of [-1,1])rod(g,[s*1.2,.95,0],[s*1.2,-.96,0],.033,rope);
      return batch(g);
    }
    function trap(cage) {
      const g=new T.Group();
      if(cage){box(g,1.22,.12,.6,wood,0,-.35,0);box(g,1.22,.10,.6,wood,0,.35,0);
        for(let i=0;i<9;i++)for(const z of [-.28,.28])rod(g,[-.54+i*.135,-.3,z],[-.54+i*.135,.3,z],.025,wood);
        for(const x of [-.58,.58])box(g,.08,.72,.62,darkWood,x,0,0);
      }else {
        const r=ring(g,.48,.065,iron);r.rotation.x=1.1;
        for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const tooth=mesh(g,new T.ConeGeometry(.065,.18,4),silver,Math.cos(a)*.47,.1,Math.sin(a)*.25);tooth.rotation.z=-Math.cos(a)*.4;}
        box(g,.37,.07,.34,iron,0,0,0);
      }return batch(g);
    }
    function produceMap(kind) {
      const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
      const colors={chataigne:'#7e4526',raisin:'#574267',viande:'#a65048',poisson:'#a1b8b8',ble:'#cfaa58',lait:'#e0d2b5'};
      x.fillStyle=colors[kind];x.fillRect(0,0,512,512);
      for(let i=0;i<11000;i++){
        const light=random()>.48;x.fillStyle=light?'rgba(255,239,208,.055)':'rgba(37,22,16,.045)';
        x.fillRect(random()*512,random()*512,1+random()*2,kind==='chataigne'?5+random()*15:1+random()*3);
      }
      if(kind==='viande')for(let i=0;i<30;i++){
        const y=random()*512;x.beginPath();x.moveTo(0,y);x.bezierCurveTo(160,y-35,320,y+40,512,y-30);
        x.strokeStyle='rgba(244,204,173,.48)';x.lineWidth=.5+random()*2;x.stroke();
      }
      if(kind==='poisson')for(let row=0;row<24;row++)for(let col=0;col<18;col++){
        x.beginPath();x.ellipse(col*30+(row%2)*15,row*23,15,18,0,0,Math.PI);
        x.strokeStyle='rgba(55,78,76,.3)';x.lineWidth=1.3;x.stroke();
      }
      const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;textures.add(t);return t;
    }
    const fruitMaterials={
      ble:mat('#fff2c9',{map:produceMap('ble'),roughness:.86}),
      chataigne:mat('#fff5de',{map:produceMap('chataigne'),roughness:.34}),
      raisin:mat('#e5dfeb',{map:produceMap('raisin'),roughness:.51}),
      viande:mat('#fff1e3',{map:produceMap('viande'),roughness:.58}),
      poisson:mat('#dde9e3',{map:produceMap('poisson'),metalness:.45,roughness:.32}),
      lait:mat('#fffae8',{map:produceMap('lait'),roughness:.32})};
    const chestnutScar=mat('#bda079',{roughness:.88}),grapeStem=mat('#7a7550'),fatMaterial=mat('#e9c7ad',{roughness:.64});
    function basket(type) {
      const g=new T.Group();
      const b=mesh(g,new T.CylinderGeometry(.64,.46,.48,24,1,true),wicker,0,-.15,0);b.material.side=T.DoubleSide;
      for(let i=0;i<10;i++){const r=ring(g,.48+i*.017,.023,i%2?wicker:wickerDark,0,-.38+i*.047,0);r.rotation.x=Math.PI/2;}
      for(let i=0;i<24;i++){const a=i*Math.PI/12;rod(g,[Math.cos(a)*.47,-.4,Math.sin(a)*.47],[Math.cos(a)*.64,.1,Math.sin(a)*.64],.015,paleWood,4);}
      const top=mesh(g,new T.CylinderGeometry(.60,.6,.05,24),wickerDark,0,.05,0);
      const m=fruitMaterials[type];
      if(['chataigne','raisin'].includes(type))for(let i=0;i<35;i++) {
        const a=random()*6.28,r=Math.sqrt(random())*.5;
        const fx=Math.cos(a)*r,fy=.13+(.5-r)*.48,fz=Math.sin(a)*r;
        ball(g,type==='raisin'?.095:.13,m,fx,fy,fz,1,.9,1);
        if(type==='chataigne')ball(g,.064,chestnutScar,fx,fy-.088,fz+.04,1,.23,.8);
      }
      if(type==='raisin'){
        rod(g,[-.15,.31,0],[.15,.48,.03],.015,grapeStem);
        const leaf=ball(g,.13,green,.22,.40,.03,1.2,.2,.85);leaf.rotation.z=.25;
      }
      if(type==='ble')for(let i=0;i<24;i++) {
        const x=(random()-.5)*.95,z=(random()-.5)*.65,h=.4+random()*.45;
        rod(g,[x,.1,z],[x+.12,h,z],.01,rope,4);
        for(let j=0;j<7;j++){const grain=ball(g,.033,m,x+.12+(j%2?.024:-.024),h-j*.045,z,.7,1.9,.6);grain.rotation.z=j%2?-.4:.4;}rod(g,[x+.12,h,z],[x+.15,h+.13,z],.003,rope,3);
      }
      if(type==='viande')for(let i=0;i<4;i++) {
        const meat=ball(g,.26,m,(i-1.5)*.23,.2+(i%2)*.10,(i%2)*.2-.1,1,.38,1.25);meat.rotation.z=i*.3;
        const fat=ring(g,.19,.012,fatMaterial,(i-1.5)*.23,.3+(i%2)*.1,(i%2)*.2-.1);fat.rotation.x=-Math.PI/2;
      }
      if(type==='poisson')for(let i=0;i<4;i++) {
        const f=new T.Group();g.add(f);f.position.set((i-1.5)*.20,.20+i*.035,0);f.rotation.y=-.45;
        ball(f,.15,m,0,0,0,.8,.55,2.6);const tail=mesh(f,new T.ConeGeometry(.17,.24,3),m,0,0,-.46);tail.rotation.x=Math.PI/2;
        for(const s of [-1,1])ball(f,.019,iron,s*.10,.03,.25);
      }
      if(type==='lait')for(let i=0;i<5;i++) {
        const x=(i%3-1)*.31,z=Math.floor(i/3)*.33-.15;
        const profile=[[.08,0],[.12,.02],[.145,.12],[.15,.27],[.12,.38],[.07,.43],[.065,.51],[.08,.53]].map(([r,y])=>new T.Vector2(r,y));
        mesh(g,new T.LatheGeometry(profile,20),m,x,.08,z);
        const handle=ring(g,.10,.023,m,x+.13,.39,z);handle.scale.set(.75,1,1);
        mesh(g,new T.CylinderGeometry(.060,.060,.035,16),fruitMaterials.lait,x,.595,z);
      }
      return batch(g);
    }
    function collar() {
      const g=new T.Group();const r=ring(g,.43,.065,leather);r.scale.y=.80;const inner=ring(g,.43,.012,rope,0,0,.060);inner.scale.y=.80;
      box(g,.23,.16,.1,brass,0,-.30,.08);ring(g,.12,.024,brass,0,-.5,.04);return batch(g);
    }
    function boarTrophy() {
      // Tête seule également pendant le chargement du GLB, ou en cas d'échec réseau.
      const g=new T.Group(),fur=mat('#574536',{roughness:.95}),ivory=mat('#e8dcc2');
      ball(g,.58,darkWood,0,0,-.24,1,1.26,.16);
      ball(g,.44,fur,0,.04,0,1,1.10,.8);ball(g,.27,fur,0,-.16,.30,.85,.8,1.05);
      ball(g,.16,iron,0,-.18,.54,1.12,.66,.5);
      for(const side of [-1,1]){
        const ear=mesh(g,new T.ConeGeometry(.17,.42,5),fur,side*.34,.43,-.03);ear.rotation.z=-side*.30;
        ball(g,.035,iron,side*.24,.12,.30);
        const curve=new T.CatmullRomCurve3([new T.Vector3(side*.22,-.28,.32),new T.Vector3(side*.31,-.18,.48),new T.Vector3(side*.29,-.06,.46)]);
        mesh(g,new T.TubeGeometry(curve,8,.027,5,false),ivory);
      }return batch(g);
    }
    function fallbackAnimal(type) {
      const supplied=E.Board3D?.createShopAnimal?.(type);
      if(supplied){prepareModel(supplied);supplied.rotation.y=-.7;return fit(supplied,1.4,2.35,1.3);}
      const g=new T.Group(),m=mat(type==='cochon'?'#d29e83':'#a89b7e');
      ball(g,.45,m,0,0,0,1,.7,1);ball(g,.24,m,.3,.3,.2);
      for(const x of [-.25,.25])for(const z of [-.2,.2])box(g,.1,.5,.1,m,x,-.45,z);
      return batch(g);
    }
    function placeHitBox(record) {
      const {min, max} = record.model.userData.shopBounds;
      const {x, y} = record.anchor.position;
      const padding = cfg.hover.hitPadding;
      record.hitBounds = [
        cfg.width/2 + x + min.x - padding,
        cfg.height/2 - y - max.y - padding,
        max.x - min.x + 2*padding,
        max.y - min.y + 2*padding
      ];
    }
    function makeItem(item,index) {
      const [x,y,w,h]=item.bounds,anchor=new T.Group();root.add(anchor);
      anchor.name='shop-item-'+item.id;anchor.position.set((x+w/2)/100-cfg.width/2,cfg.height/2-(y+h/2)/100+(item.kind==='resource'?.20:0),item.kind==='resource'?2:item.kind==='animal'||item.id==='ane'?.4:0);
      const offset = cfg.models[item.id]?.offset;
      if (offset) anchor.position.add(new T.Vector3(...offset));
      if (item.id === 'filet') anchor.position.x = decorModels.butcherTableX;
      const display=new T.Group();anchor.add(display);let model;
      if(item.kind==='tools')model=weapon(item.type);
      else if(item.kind==='armors')model=armor(item.type);
      else if(item.kind==='resource'){model=basket(item.id);model.rotation.x=.28;}
      else if(item.id==='filet')model=net();
      else if(item.kind==='inactive')model=trap(item.id==='piege-chasse');
      else if(item.id==='chien')model=collar();
      else if(item.id==='sanglier')model=boarTrophy();
      else if(item.id==='barque'){model=new T.Group();box(model,2,.4,.7,wood);}
      else model=fallbackAnimal(item.id);
      model=fit(model,w/100*.88,h/100*.9,2.5);display.add(model);
      const record={item,anchor,display,model,allowed:false,sold:false,brightness:1,amount:0,index,materials:[],sign:null,
        hoverPointer:{x:0,y:0},hoverTilt:{x:0,y:0}};
      records.set(item.id,record);
      decorate(record);
      placeHitBox(record);
      if(item.kind==='animal'||item.id==='ane')animations.push(t=>{record.breath=1+Math.sin(t*1.6+index)*.006;});
      if(item.kind==='tools'||item.kind==='armors') {
        const hook=ring(decor,.055,.018,iron,anchor.position.x,anchor.position.y+h/200+.04,-.05);
        box(decor,.08,.12,.045,darkWood,anchor.position.x,anchor.position.y+h/200+.04,-.15);
      }
      if(item.kind!=='resource'&&!['vache','chevre','cochon','ane'].includes(item.id)) {
        const [lx,ly]=item.labelAt;
        const plateDepth = item.kind==='inactive' ? 1.05 : .65;
        const plateX = item.id==='filet' ? anchor.position.x : lx/100-cfg.width/2+(offset?.[0]||0);
        record.plate=plate(root,item.label,item.id==='filet'?1.8:item.kind==='inactive'?1.48:1.25,
          plateX,cfg.height/2-ly/100+(offset?.[1]||0),
          item.id==='barque' ? anchor.position.z+plateDepth : plateDepth);
      }
      if(['tools','armors','transport'].includes(item.kind)) {
        const sign=new T.Group();anchor.add(sign);sign.name='sold-'+item.id;sign.visible=false;sign.position.z=.7;
        record.sign=sign;record.signBody=decorModels.createSoldSign();sign.add(record.signBody);
        record.signText=label(sign,'VINDUTU',1,.24,0,-.08,.09,'#392517');
        record.trace=wearTrace(w/100*.63,h/100*.70,anchor.position.x,anchor.position.y);
      }
      return record;
    }
    function decorate(record) {
      record.materials=[];const copies=new Map();
      record.model.traverse(o=>{
        if(!o.isMesh)return;
        const array=Array.isArray(o.material),list=[].concat(o.material).map(m=>{if(!copies.has(m)){const c=track(m.clone());copies.set(m,c);record.materials.push({m:c,color:c.color?.clone(),emissive:c.emissive?.clone()});}return copies.get(m);});
        o.material=array?list:list[0];
      });
    }
    for(const [i,item] of art.entries())makeItem(item,i);
    const dustGeo=track(new T.BufferGeometry()),dustPositions=new Float32Array(cfg.dustCount*3);
    for(let i=0;i<cfg.dustCount;i++){dustPositions[i*3]=random()*16-8;dustPositions[i*3+1]=random()*7-3;dustPositions[i*3+2]=1+random()*2;}
    dustGeo.setAttribute('position',new T.BufferAttribute(dustPositions,3));
    const dust=new T.Points(dustGeo,track(new T.PointsMaterial({color:'#f5d9a4',size:.022,transparent:true,opacity:.36,depthWrite:false})));root.add(dust);
    function replace(record,object,w,h,depth) {
      if(disposed)return;
      record.display.remove(record.model);record.model=fit(prepareModel(object),w,h,depth);record.display.add(record.model);decorate(record);renderer.shadowMap.needsUpdate=true;
    }
    const pending=Object.entries(cfg.models).map(async([id,definition])=>{
      const spec=typeof definition==='string'?{src:definition}:definition,url=spec.src;
      try {
        const asset=await loader.loadAsync(new URL(url,document.baseURI).href);
        const record=records.get(id);
        if(id==='ane'){
          asset.scene.rotation.y=-1.35;
          const [,,w,h]=record.item.bounds;replace(record,asset.scene,w/100*.93,h/100*.90,4.0);
        }else{
          asset.scene.rotation.set(...spec.rotation);
          replace(record,asset.scene,...spec.fit);
          const {min} = record.model.userData.shopBounds;
          if(record.item.kind==='resource')record.anchor.position.y=cfg.resourceBaseY-min.y;
          if(record.item.kind==='animal')record.anchor.position.y=cfg.animalBaseY-min.y;
        }
        placeHitBox(record);
        record.source=url;
      }catch(error){errors[id]=String(error.message||error);}
    });
    pending.push(surfaces.loaded.catch(error=>{errors.materials=String(error.message||error);}));
    const loaded=Promise.all(pending).then(()=>{renderer.shadowMap.needsUpdate=true;return true;});
    function resize() {
      const w=container.clientWidth,h=w*cfg.height/cfg.width;
      if(w>0)renderer.setSize(w,h,false);
    }
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    function setHover(id,event){
      const record=records.get(id);hover=record&&!record.sold?id:null;
      if(hover)hoverEffect.point(record,event,canvas,cfg);
    }
    function setState(id,state) {
      const r=records.get(id);if(!r)return;
      if(r.sold!==Boolean(state.sold))renderer.shadowMap.needsUpdate=true;
      r.allowed=Boolean(state.allowed);r.sold=Boolean(state.sold);
      r.display.visible=!r.sold;if(r.sign)r.sign.visible=r.sold;if(r.plate)r.plate.visible=!r.sold;
      if(r.trace)r.trace.visible=r.sold;
      const title=id==='filet'?`Filet · ${state.count||0}/3`:r.item.label;
      if(r.plate&&r.title!==title){
        r.title=title;
        const old=r.plate.children.at(-1);
        if(old){old.removeFromParent();old.geometry.dispose();resources.delete(old.geometry);old.material.map.dispose();textures.delete(old.material.map);old.material.dispose();resources.delete(old.material);}
        label(r.plate,title,id==='filet'?1.72:id==='barque'?1.17:r.item.kind==='inactive'?1.40:1.17,.27,0,0,.075);
      }
    }
    function hit(event) {
      if(disposed||lost)return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const x = (event.clientX - rect.left) / rect.width * cfg.width;
      const y = (event.clientY - rect.top) / rect.height * cfg.height;
      if (x < 0 || x > cfg.width || y < 0 || y > cfg.height) return null;
      // La zone au repos reste stable pendant l'animation. Le premier plan
      // l'emporte là où deux rectangles se recouvrent.
      let selected = null;
      let centerDistance = Infinity;
      for (const record of records.values()) {
        if (record.sold) continue;
        const [left, top, width, height] = record.hitBounds;
        if (x < left || x > left+width || y < top || y > top+height) continue;
        const depth = record.anchor.position.z;
        const distance = ((x-left)/width-.5)**2 + ((y-top)/height-.5)**2;
        if (!selected || depth > selected.anchor.position.z ||
            (depth === selected.anchor.position.z && distance < centerDistance)) {
          selected = record;
          centerDistance = distance;
        }
      }
      return selected?.item.id ?? null;
    }
    function draw(time) {
      if(!running||disposed)return;frame=requestAnimationFrame(draw);
      if(time-lastTime<1000/cfg.maxFPS)return;
      const frameDt=Math.min(1,(time-lastTime)/1000 || .016),dt=Math.min(.1,frameDt);lastTime=time;elapsed+=dt;
      const t=reduced.matches?0:elapsed;
      if(!reduced.matches)animations.forEach(fn=>fn(t));
      for(const r of records.values()) {
        hoverEffect.update(r,hover===r.item.id,frameDt,reduced.matches);
        r.brightness+=( (r.allowed?1:.45)-r.brightness)*(1-Math.exp(-8*dt));
        const glint=r.allowed&&!reduced.matches&&['tools','armors','transport'].includes(r.item.kind)?Math.pow(Math.max(0,Math.sin(t*.8+r.index*1.31)),22)*.018:0;
        for(const {m,color,emissive} of r.materials){if(color)m.color.copy(color).multiplyScalar(r.brightness);if(emissive)m.emissive.copy(emissive).addScalar(r.amount*cfg.hover.emissive+glint);}
        if(r.sign&&!reduced.matches)r.sign.rotation.z=Math.sin(t*.9+r.index)*.012;
      }
      dust.visible=!reduced.matches;dust.position.y=Math.sin(t*.15)*.13;
      renderer.render(scene,camera);
      renderStats={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
    }
    function setVisible(value) {
      if(disposed)return;
      running=Boolean(value)&&!lost;cancelAnimationFrame(frame);
      if(running){lastTime=performance.now();resize();frame=requestAnimationFrame(draw);}
      else hover=null;
    }
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;setVisible(false);container.classList.remove('shop-has-3d');container.dataset.sceneError='context-lost';});
    canvas.addEventListener('webglcontextrestored',()=>{lost=false;container.classList.add('shop-has-3d');setVisible(!container.closest('[hidden]')&&!container.classList.contains('shop-managing'));});
    function dispose() {
      if(disposed)return;setVisible(false);disposed=true;observer.disconnect();
      resources.forEach(r=>r.dispose());textures.forEach(t=>t.dispose());sun.shadow.map?.dispose();renderer.dispose();canvas.remove();
    }
    window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();else setVisible(false);});
    window.addEventListener('pageshow',event=>{if(event.persisted)setVisible(!container.closest('[hidden]')&&!container.classList.contains('shop-managing'));});
    return {setVisible,setState,setHover,hit,loaded,dispose,root,camera,
      get ready(){return !lost&&!disposed;},
      get diagnostics(){return {objects:records.size,errors:{...errors},running,hovered:hover,drawCalls:renderStats.calls,triangles:renderStats.triangles,
        items:Object.fromEntries([...records].map(([id,r])=>[id,{sold:r.sold,allowed:r.allowed,source:r.source||null,position:r.anchor.position.toArray(),hoverAmount:r.amount,
          hitBounds:r.hitBounds.map(value=>value*100),displayPosition:r.display.position.toArray(),
          displayRotation:r.display.rotation.toArray().slice(0,3),displayScale:r.display.scale.toArray()}]))};}};
  }
  E.ShopScene={create};
}());
