(function () {
  'use strict';
  const E = window.Eredita;
  // Le rendu ne possède ni stock ni prix. Il reçoit les devis de la boutique existante.
  async function create(container) {
    const [T, {GLTFLoader}, {mergeGeometries}] = await Promise.all([
      import('./vendor/three.module.min.js'), import('./vendor/GLTFLoader.js'), import('./vendor/BufferGeometryUtils.js')
    ]);
    const cfg = E.Config.shopScene, art = E.ShopArt;
    const scene = new T.Scene(), root = new T.Group(), decor = new T.Group();
    scene.background = new T.Color('#a8c5c2'); scene.add(root); root.add(decor);
    const camera = new T.OrthographicCamera(-cfg.width/2,cfg.width/2,cfg.height/2,-cfg.height/2,.1,60);
    camera.position.set(0,0,25); camera.lookAt(0,0,0);
    const renderer = new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1,cfg.pixelRatio));
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18; renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
    const canvas = renderer.domElement; canvas.className = 'shop-3d-canvas';
    canvas.setAttribute('aria-hidden','true'); container.prepend(canvas);
    const errors = {}, records = new Map(), resources = new Set(), textures = new Set(), animations = [];
    const loader = new GLTFLoader(), raycaster = new T.Raycaster(), pointer = new T.Vector2();
    let frame = 0, running = false, disposed = false, lastTime = 0, hover = null, elapsed = 0, lost = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let seed = 9187;
    function random() { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }
    const track = value => (resources.add(value),value);
    function texture(kind) {
      const c=document.createElement('canvas'); c.width=c.height=256;
      const x=c.getContext('2d');
      x.fillStyle=kind==='wood'?'#d0bda1':kind==='cloth'?'#eee1cf':'#ede6db'; x.fillRect(0,0,256,256);
      for(let i=0;i<3200;i++) {
        const v=random(); x.fillStyle=`rgba(${v>.5?'255,234,188':'51,27,13'},${kind==='wood'?.035+v*.07:.035})`;
        const px=random()*256,py=random()*256;
        x.fillRect(px,py,kind==='wood'?random()*95:kind==='cloth'?1:random()*5,kind==='wood'?1:kind==='cloth'?random()*32:random()*4);
      }
      if(kind==='wood')for(let i=0;i<18;i++) {
        x.strokeStyle='rgba(45,23,10,.18)';x.lineWidth=.7;x.beginPath();
        const y=random()*256;x.moveTo(0,y);x.bezierCurveTo(90,y-8,180,y+8,256,y-2);x.stroke();
      }
      const t=new T.CanvasTexture(c); t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;
      textures.add(t);return t;
    }
    const woodMap=texture('wood'),stoneMap=texture('stone'),clothMap=texture('cloth');
    function chainmailTexture() {
      const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
      x.fillStyle='#454945';x.fillRect(0,0,256,256);
      for(let row=-1;row<9;row++)for(let col=-1;col<9;col++) {
        x.lineWidth=5;x.strokeStyle='#b1b6ae';x.beginPath();x.ellipse(col*32+(row%2)*16,row*32,12,18,.35,0,Math.PI*2);x.stroke();
        x.lineWidth=1.5;x.strokeStyle='#dde0d4';x.beginPath();x.ellipse(col*32+(row%2)*16-1,row*32-1,10,16,.35,Math.PI,Math.PI*2);x.stroke();
      }
      const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(1.5,1.5);textures.add(t);return t;
    }
    const mailMap=chainmailTexture();
    function mat(color,options={}) {return track(new T.MeshStandardMaterial({color,roughness:.77,...options}));}
    const wood=mat('#ab7849',{map:woodMap}),darkWood=mat('#624126',{map:woodMap}),paleWood=mat('#d0a469',{map:woodMap});
    const iron=mat('#49443b',{metalness:.68,roughness:.4}),brass=mat('#c39a51',{metalness:.62,roughness:.36});
    const linen=mat('#f7e5c6',{map:clothMap,side:T.DoubleSide}),rope=mat('#bb8e54');
    const wicker=mat('#bd8950',{map:woodMap}),wickerDark=mat('#89602e',{map:woodMap});
    const green=mat('#647349'),leafLight=mat('#82925b'),silver=mat('#abb6b6',{metalness:.72,roughness:.27});
    function mesh(parent,g,m,x=0,y=0,z=0) {
      track(g);const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;
    }
    const box=(p,w,h,d,m,x=0,y=0,z=0)=>mesh(p,new T.BoxGeometry(w,h,d),m,x,y,z);
    const ball=(p,r,m,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{
      const o=mesh(p,new T.SphereGeometry(r,12,8),m,x,y,z);o.scale.set(sx,sy,sz);return o;
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
      const c=document.createElement('canvas');c.width=512;c.height=128;const cx=c.getContext('2d');
      cx.clearRect(0,0,512,128);cx.fillStyle=color;cx.textAlign='center';cx.textBaseline='middle';
      cx.font=`bold ${text.length>17?60:78}px Georgia`;cx.fillText(text,256,66,478);
      const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;textures.add(t);
      return mesh(p,new T.PlaneGeometry(w,h),track(new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false})),x,y,z);
    }
    function plate(p,text,w=1.25,x=0,y=0,z=.5) {
      const g=new T.Group();p.add(g);g.position.set(x,y,z);
      const body=box(g,w,.27,.065,paleWood);body.rotation.z=-.012;
      for(const s of [-1,1])ball(g,.024,iron,s*(w/2-.07),0,.045);
      label(g,text,w-.08,.27,0,0,.045);return g;
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
      const g=new T.Group();g.add(object);object.position.sub(center);g.scale.setScalar(s);return g;
    }
    function prepareModel(object) {
      object.traverse(o=>{if(o.isMesh){track(o.geometry);for(const m of [].concat(o.material)){track(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}o.castShadow=o.receiveShadow=true;}});
      return object;
    }
    scene.add(new T.HemisphereLight('#fff1d1','#806547',2.4));
    const sun=new T.DirectionalLight('#ffe9c9',2.7);sun.position.set(-5,8,12);sun.castShadow=true;
    sun.shadow.mapSize.set(cfg.shadowSize,cfg.shadowSize);Object.assign(sun.shadow.camera,{left:-10,right:10,top:7,bottom:-6,near:1,far:35});
    sun.shadow.bias=-.001;sun.shadow.normalBias=.025;scene.add(sun);
    const bounce=new T.DirectionalLight('#b6d8e4',1.1);bounce.position.set(8,2,6);scene.add(bounce);

    // Échoppe en volume : mur, toiture, poutres, table et clôture indépendants des marchandises.
    box(decor,16.8,8,.25,mat('#d9c7ae',{map:stoneMap}),0,0,-1.25);
    const stones=Array.from({length:5},(_,i)=>mat(['#ccb18b','#bd9975','#d8ba92','#c3a17d','#d6ad7e'][i],{map:stoneMap}));
    for(let row=0;row<11;row++)for(let col=0;col<20;col++) {
      const w=.76+random()*.09,h=.51+random()*.09;
      const points=[[-w/2+.07,-h/2],[-w/2,-h/2+.08],[-w/2+.01,h/2-.08],[-w/2+.09,h/2],[w/2-.07,h/2],[w/2,h/2-.1],[w/2-.01,-h/2+.07],[w/2-.08,-h/2]];
      const o=extrude(decor,points,.13+random()*.06,stones[(row*3+col)%5]);
      o.position.set(-8.35+col*.87+(row%2)*.43,3.2-row*.65,-1.03);o.rotation.z=(random()-.5)*.04;
    }
    for(const x of [-7.94,-3.62,3.06,7.94]) {
      box(decor,.25,7.8,.39,darkWood,x,0,-.55);
      for(const s of [-1,1]){const b=box(decor,.20,1.25,.27,wood,x+s*.35,2.85,-.36);b.rotation.z=s*-.58;}
      for(const y of [-2.5,.1,2.55])ball(decor,.045,iron,x,y,-.31);
    }
    box(decor,17,.28,.53,wood,0,3.48,-.22);box(decor,17,.12,.59,paleWood,0,3.63,-.18);
    const tile=mat('#b3683d',{map:stoneMap});
    for(let i=0;i<52;i++) {
      const r=mesh(decor,new T.CylinderGeometry(.18,.19,1.0,10,1,true,0,Math.PI),tile,-8.5+i*.33,3.83,-.55);
      r.rotation.x=Math.PI/2+.18;
    }
    const floor=box(decor,18,.25,5,mat('#b6a086',{map:stoneMap}),0,-4.53,.3);
    for(let i=0;i<90;i++)box(decor,.45+random()*.35,.05,.25+random()*.25,stones[i%5],-8.5+random()*17,-3.51,random()*3-1);
    box(decor,10.55,.19,1.45,darkWood,.38,-2.85,1.0);
    for(const x of [-4.52,5.2])box(decor,.24,1.4,.25,wood,x,-3.52,.9);
    box(decor,3.2,.17,1.05,wood,5.32,-1.33,.38);
    for(const x of [3.85,6.65])box(decor,.17,1.42,.22,darkWood,x,-2.12,.05);
    for(const x of [-8.1,-6.85,-5.62,-4.4])box(decor,.16,1.45,.19,wood,x,-2.63,1.8);
    for(const y of [-2.4,-2.98])box(decor,4,.16,.14,paleWood,-6.3,y,1.88);
    // Tissu suspendu. Chaque bande conserve son maillage pour un mouvement léger.
    for(const [x,w] of [[-5.75,3.7],[-.28,5.9],[5.55,4.35]]) {
      const g=new T.PlaneGeometry(w,.57,30,5),a=g.attributes.position;
      for(let i=0;i<a.count;i++){const px=a.getX(i);a.setY(i,a.getY(i)-.35*(1-Math.pow(px/(w/2),2)));a.setZ(i,.065*Math.cos(px*6));}
      g.computeVertexNormals();const cloth=mesh(root,g,linen,x,3.1,.18);
      animations.push(t=>{cloth.rotation.z=Math.sin(t*.48+x)*.004;});
    }
    const tablecloth=box(decor,10.4,.46,.035,linen,.38,-3.13,1.76);
    for(const x of [-4.55,-4.34,4.9,5.11])box(decor,.055,.46,.01,mat('#a45b41'),x,-3.13,1.79);
    // Branches d'olivier à la périphérie du cadre.
    for(const [x,y,s] of [[-7.4,3.75,1.25],[7.5,3.6,.9],[-8,-3.6,.65]]) {
      const branch=new T.Group();root.add(branch);branch.position.set(x,y,.6);
      for(let i=0;i<16;i++) {
        const bx=(i/15-.5)*2.0*s,by=-Math.sin(i/15*Math.PI)*.52*s;
        if(i)rod(branch,[bx-.14*s,by,.02],[bx,by,0],.018,darkWood);
        for(const side of [-1,1]){const l=ball(branch,.1,side===1?green:leafLight,bx,by+side*.12*s,.02,.48,1.5,.18);l.rotation.z=side*.7;}
      }
      batch(branch);animations.push(t=>{branch.rotation.z=Math.sin(t*.6+x)*.012;});
    }
    batch(decor);

    function weapon(type) {
      const g=new T.Group(),metal=type==='bronze'?mat('#c58a45',{metalness:.65,roughness:.32}):type==='fer'?silver:mat('#9e9a8b');
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
    function armor(type) {
      const g=new T.Group(),m=type==='cuir'?mat('#9e5830',{map:woodMap}):type==='maille'?mat('#c1c5bd',{map:mailMap,bumpMap:mailMap,bumpScale:.025,metalness:.52,roughness:.5}):silver;
      const body=extrude(g,[[-.50,.7],[-.23,.72],[-.18,.51],[.18,.51],[.23,.72],[.5,.7],[.43,.32],[.37,-.43],[.49,-.65],[-.49,-.65],[-.37,-.43],[-.43,.32]],.27,m);
      body.rotation.y=-.10;
      if(type!=='maille') {
        rod(g,[0,-.57,.15],[0,.48,.15],.022,type==='cuir'?rope:brass);
        for(const s of [-1,1]){rod(g,[s*.34,-.5,.15],[s*.38,.48,.15],.022,type==='cuir'?rope:iron);
          for(let i=0;i<6;i++)ball(g,.025,brass,s*.38,-.45+i*.18,.16);}
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
    const fruitMaterials={ble:mat('#dda94d'),chataigne:mat('#754329',{roughness:.37}),raisin:mat('#614276',{roughness:.38}),viande:mat('#ba6556'),poisson:silver,lait:mat('#f2e4c3',{roughness:.3})};
    function basket(type) {
      const g=new T.Group();
      const b=mesh(g,new T.CylinderGeometry(.64,.46,.48,24,1,true),wicker,0,-.15,0);b.material.side=T.DoubleSide;
      for(let i=0;i<10;i++){const r=ring(g,.48+i*.017,.023,i%2?wicker:wickerDark,0,-.38+i*.047,0);r.rotation.x=Math.PI/2;}
      for(let i=0;i<24;i++){const a=i*Math.PI/12;rod(g,[Math.cos(a)*.47,-.4,Math.sin(a)*.47],[Math.cos(a)*.64,.1,Math.sin(a)*.64],.015,paleWood,4);}
      const top=mesh(g,new T.CylinderGeometry(.60,.6,.05,24),wickerDark,0,.05,0);
      const m=fruitMaterials[type];
      if(['chataigne','raisin'].includes(type))for(let i=0;i<35;i++) {
        const a=random()*6.28,r=Math.sqrt(random())*.5;
        ball(g,type==='raisin'?.095:.13,m,Math.cos(a)*r,.13+(.5-r)*.48,Math.sin(a)*r,1,.9,1);
      }
      if(type==='ble')for(let i=0;i<24;i++) {
        const x=(random()-.5)*.95,z=(random()-.5)*.65,h=.4+random()*.45;
        rod(g,[x,.1,z],[x+.12,h,z],.01,rope,4);
        for(let j=0;j<5;j++)ball(g,.045,m,x+.12+(j%2?.035:-.035),h-j*.065,z,1,1.5,.6);
      }
      if(type==='viande')for(let i=0;i<4;i++) {
        const meat=ball(g,.26,m,(i-1.5)*.23,.2+(i%2)*.10,(i%2)*.2-.1,1,.38,1.25);meat.rotation.z=i*.3;
        const fat=ring(g,.19,.014,fruitMaterials.lait,(i-1.5)*.23,.3+(i%2)*.1,(i%2)*.2-.1);fat.rotation.x=-Math.PI/2;
      }
      if(type==='poisson')for(let i=0;i<4;i++) {
        const f=new T.Group();g.add(f);f.position.set((i-1.5)*.20,.20+i*.035,0);f.rotation.y=-.45;
        ball(f,.15,m,0,0,0,.8,.55,2.6);const tail=mesh(f,new T.ConeGeometry(.17,.24,3),m,0,0,-.46);tail.rotation.x=Math.PI/2;
        for(const s of [-1,1])ball(f,.019,iron,s*.10,.03,.25);
      }
      if(type==='lait')for(let i=0;i<5;i++) {
        const x=(i%3-1)*.31,z=Math.floor(i/3)*.33-.15;
        mesh(g,new T.CylinderGeometry(.1,.13,.42,12),m,x,.29,z);mesh(g,new T.CylinderGeometry(.055,.10,.12,12),m,x,.56,z);
        mesh(g,new T.CylinderGeometry(.058,.058,.11,12),paleWood,x,.67,z);
      }
      return batch(g);
    }
    function collar() {
      const g=new T.Group();const r=ring(g,.43,.075,mat('#824c2b'));r.scale.y=.80;
      box(g,.23,.16,.1,brass,0,-.30,.08);ring(g,.12,.024,brass,0,-.5,.04);return batch(g);
    }
    function fallbackAnimal(type) {
      const supplied=E.Board3D?.createShopAnimal?.(type);
      if(supplied){prepareModel(supplied);supplied.rotation.y=-.7;return fit(supplied,1.4,2.35,1.3);}
      const g=new T.Group(),m=mat(type==='cochon'?'#d29e83':'#a89b7e');
      ball(g,.45,m,0,0,0,1,.7,1);ball(g,.24,m,.3,.3,.2);
      for(const x of [-.25,.25])for(const z of [-.2,.2])box(g,.1,.5,.1,m,x,-.45,z);
      return batch(g);
    }
    function makeItem(item,index) {
      const [x,y,w,h]=item.bounds,anchor=new T.Group();root.add(anchor);
      anchor.name='shop-item-'+item.id;anchor.position.set((x+w/2)/100-cfg.width/2,cfg.height/2-(y+h/2)/100+(item.kind==='resource'?.20:0),item.kind==='resource'?2:item.kind==='animal'||item.id==='ane'?.4:0);
      const display=new T.Group();anchor.add(display);let model;
      if(item.kind==='tools')model=weapon(item.type);
      else if(item.kind==='armors')model=armor(item.type);
      else if(item.kind==='resource'){model=basket(item.id);model.rotation.x=.28;}
      else if(item.id==='filet')model=net();
      else if(item.kind==='inactive')model=trap(item.id==='piege-chasse');
      else if(item.id==='chien')model=collar();
      else if(item.id==='sanglier'){
        model=fallbackAnimal('sanglier');model.rotation.y=-.3;
      }else if(item.id==='barque'){model=new T.Group();box(model,2,.4,.7,wood);}
      else model=fallbackAnimal(item.id);
      model=fit(model,w/100*.88,h/100*.9,2.5);display.add(model);
      const record={item,anchor,display,model,allowed:false,sold:false,brightness:1,amount:0,index,materials:[],outline:null,sign:null};records.set(item.id,record);
      decorate(record);
      if(item.kind==='animal'||item.id==='ane')animations.push(t=>{display.scale.y=1+Math.sin(t*1.6+index)*.006;});
      if(item.kind==='tools'||item.kind==='armors') {
        const hook=ring(decor,.055,.018,iron,anchor.position.x,anchor.position.y+h/200+.04,-.05);
        box(decor,.08,.12,.045,darkWood,anchor.position.x,anchor.position.y+h/200+.04,-.15);
      }
      if(item.kind!=='resource'&&!['vache','chevre','cochon','ane'].includes(item.id)) {
        const [lx,ly]=item.labelAt;
        record.plate=plate(root,item.label,item.id==='filet'?1.8:item.kind==='inactive'?1.48:1.25,lx/100-cfg.width/2,cfg.height/2-ly/100,item.kind==='inactive'?1.05:.65);
      }
      if(['tools','armors','transport'].includes(item.kind)) {
        const sign=new T.Group();anchor.add(sign);sign.name='sold-'+item.id;sign.visible=false;sign.position.z=.7;
        record.sign=sign;record.signBody=plate(sign,'',Math.min(1.15,w/100*.85));
        record.signText=label(sign,'VINDUTU',1,.26,0,0,.57,'#392517');
        record.trace=box(root,w/100*.63,h/100*.70,.012,mat('#ddc9a9'),anchor.position.x,anchor.position.y,-.87);
        record.trace.visible=false;record.trace.castShadow=false;
      }
      return record;
    }
    function decorate(record) {
      record.materials=[];const copies=new Map();
      record.model.traverse(o=>{
        if(!o.isMesh)return;o.userData.shopItem=record.item.id;
        const array=Array.isArray(o.material),list=[].concat(o.material).map(m=>{if(!copies.has(m)){const c=track(m.clone());copies.set(m,c);record.materials.push({m:c,color:c.color?.clone(),emissive:c.emissive?.clone()});}return copies.get(m);});
        o.material=array?list:list[0];
      });
      if(record.outline){record.display.remove(record.outline);record.outline=null;}
      const outline=record.model.clone(true);
      const outlineMat=track(new T.MeshBasicMaterial({color:'#eec66c',side:T.BackSide,depthWrite:false}));
      outline.traverse(o=>{if(o.isMesh){o.material=outlineMat;o.castShadow=o.receiveShadow=false;o.userData={shopOutline:true};}});
      outline.scale.multiplyScalar(1.025);outline.visible=false;record.display.add(outline);record.outline=outline;
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
    const pending=Object.entries(cfg.models).map(async([id,url])=>{
      try {
        const asset=await loader.loadAsync(new URL(url,document.baseURI).href);prepareModel(asset.scene);
        const record=records.get(id);
        if(id==='barque'){
          asset.scene.rotation.set(.55,-.55,-.10);replace(record,asset.scene,2.9,1.8,2.6);
        }else {
          asset.scene.updateMatrixWorld(true);const group=new T.Group();
          asset.scene.traverse(o=>{if(o.isMesh&&o.userData.livestockRole==='animal'&&o.userData.animalIndex===0){const copy=o.clone();copy.matrixAutoUpdate=false;copy.matrix.copy(o.matrixWorld);group.add(copy);}});
          if(!group.children.length)throw new Error('Animal séparé introuvable');
          group.rotation.y=id==='vache'?-1.05:-.65;
          const [, ,w,h]=record.item.bounds;replace(record,group,w/100*.93,h/100*.92,2.6);
        }
      }catch(error){errors[id]=String(error.message||error);}
    });
    pending.push((async()=>{
      try {
        const asset=await loader.loadAsync(new URL(cfg.sign,document.baseURI).href);prepareModel(asset.scene);
        for(const record of records.values())if(record.sign) {
          record.sign.remove(record.signBody);
          const model=asset.scene.clone(true);model.rotation.y=-Math.PI/2;
          const fitted=fit(model,1.18,.7,.32);fitted.position.y=.09;record.sign.add(fitted);
          record.signText.position.z=.22;record.signText.position.y=-.015;
        }
      }catch(error){errors.sign=String(error.message||error);}
    })());
    const loaded=Promise.all(pending).then(()=>{renderer.shadowMap.needsUpdate=true;return true;});
    function resize() {
      const w=container.clientWidth,h=w*cfg.height/cfg.width;
      if(w>0)renderer.setSize(w,h,false);
    }
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    function setHover(id){hover=id;}
    function setState(id,state) {
      const r=records.get(id);if(!r)return;
      if(r.sold!==Boolean(state.sold))renderer.shadowMap.needsUpdate=true;
      r.allowed=Boolean(state.allowed);r.sold=Boolean(state.sold);
      r.display.visible=!r.sold;if(r.sign)r.sign.visible=r.sold;if(r.plate)r.plate.visible=!r.sold;
      if(r.trace)r.trace.visible=r.sold;
      const title=id==='barque'?(state.vessel==='voilier'?'Voilier':'Barque'):id==='filet'?`Filet · ${state.count||0}/3`:r.item.label;
      if(r.plate&&r.title!==title){
        r.title=title;
        const old=r.plate.children.at(-1);
        if(old){old.removeFromParent();old.geometry.dispose();resources.delete(old.geometry);old.material.map.dispose();textures.delete(old.material.map);old.material.dispose();resources.delete(old.material);}
        label(r.plate,title,id==='filet'?1.72:id==='barque'?1.17:r.item.kind==='inactive'?1.40:1.17,.27,0,0,.045);
      }
      if(id==='barque'&&state.vessel!==r.vessel){
        r.vessel=state.vessel;
        if(state.vessel==='voilier'&&!r.sail){
          const sail=new T.Group();r.anchor.add(sail);sail.position.set(0,.4,.9);
          rod(sail,[0,-.6,0],[0,.72,0],.028,darkWood);
          extrude(sail,[[.05,-.35],[.05,.65],[.75,-.35]],.015,linen);r.sail=sail;
          sail.traverse(o=>{if(o.isMesh)o.userData.shopItem='barque';});
        }
      }
      if(r.sail)r.sail.visible=!r.sold&&r.vessel==='voilier';
    }
    function hit(event) {
      if(disposed||lost)return null;
      const rect=canvas.getBoundingClientRect();if(!rect.width||event.clientY<rect.top||event.clientY>rect.bottom)return null;
      pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      // Le survol est purement visuel : un cordage fin ne doit pas fuir le clic
      // lorsque le modèle se soulève de quelques pixels sous le pointeur.
      const poses=[];
      for(const r of records.values()){
        poses.push([r.display,r.display.position.y,r.display.rotation.z]);
        r.display.position.y=0;r.display.rotation.z=0;
      }
      scene.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);
      const intersections=raycaster.intersectObject(root,true);
      for(const [display,y,z] of poses){display.position.y=y;display.rotation.z=z;}
      scene.updateMatrixWorld(true);
      // Intersections de décor incluses : ne jamais cliquer à travers une poutre ou une clôture.
      for(const hit of intersections) {
        const o=hit.object;if(o.userData.shopOutline||!o.isMesh)continue;
        let visible=true;for(let p=o;p;p=p.parent)if(!p.visible)visible=false;
        if(!visible)continue;
        return o.userData.shopItem || null;
      }
      return null;
    }
    function draw(time) {
      if(!running||disposed)return;frame=requestAnimationFrame(draw);
      if(time-lastTime<1000/cfg.maxFPS)return;
      const dt=Math.min(.1,(time-lastTime)/1000 || .016);lastTime=time;elapsed+=dt;
      const t=reduced.matches?0:elapsed;
      if(!reduced.matches)animations.forEach(fn=>fn(t));
      for(const r of records.values()) {
        const target=hover===r.item.id&&r.allowed&&!r.sold?1:0;
        r.amount+= (target-r.amount)*(1-Math.exp(-cfg.hoverSpeed*dt));
        r.display.position.y=reduced.matches?0:r.amount*cfg.hoverLift;
        r.display.rotation.z=reduced.matches?0:Math.sin(t*1.5)*r.amount*.012;
        r.outline.visible=target>0;
        r.brightness+=( (r.allowed?1:.45)-r.brightness)*(1-Math.exp(-8*dt));
        const glint=r.allowed&&!reduced.matches?Math.pow(Math.max(0,Math.sin(t*.8+r.index*1.31)),22)*.10:0;
        for(const {m,color,emissive} of r.materials){if(color)m.color.copy(color).multiplyScalar(r.brightness);if(emissive)m.emissive.copy(emissive).addScalar(r.amount*.12+glint);}
        if(r.sign&&!reduced.matches)r.sign.rotation.z=Math.sin(t*.9+r.index)*.012;
      }
      dust.visible=!reduced.matches;dust.position.y=Math.sin(t*.15)*.13;
      renderer.render(scene,camera);
    }
    function setVisible(value) {
      if(disposed)return;
      running=Boolean(value)&&!lost;cancelAnimationFrame(frame);
      if(running){lastTime=performance.now();resize();frame=requestAnimationFrame(draw);}else hover=null;
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
      get diagnostics(){return {objects:records.size,errors:{...errors},running,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
        items:Object.fromEntries([...records].map(([id,r])=>[id,{sold:r.sold,allowed:r.allowed,position:r.anchor.position.toArray()}]))};}};
  }
  E.ShopScene={create};
}());
