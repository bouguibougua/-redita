(function(){
  'use strict';
  const E=window.Eredita;
  // Modèles de décor modulaires. Aucun stock, prix ou objet achetable ici.
  function create(T,{root,decor,surfaces:S,track,random,mergeGeometries,label}){
    const animations=[],cache=new Map();
    const add=(p,g,m,x=0,y=0,z=0)=>{track(g);const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;};
    function extruded(p,points,d,m,x=0,y=0,z=0,bevel=.025){
      const shape=new T.Shape();points.forEach(([px,py],i)=>i?shape.lineTo(px,py):shape.moveTo(px,py));shape.closePath();
      const g=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1});g.translate(0,0,-d/2);
      return add(p,g,m,x,y,z);
    }
    function timber(p,w,h,d,m,x=0,y=0,z=0){
      const r=Math.min(.025,w*.1,h*.1,d*.1),key=[w,h,d,m.uuid].join(':');let g=cache.get(key);
      if(!g){const sh=new T.Shape();sh.moveTo(-w/2+r,-h/2+r);sh.lineTo(w/2-r,-h/2+r);sh.lineTo(w/2-r,h/2-r);sh.lineTo(-w/2+r,h/2-r);sh.closePath();
        g=new T.ExtrudeGeometry(sh,{depth:d-2*r,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:2,steps:1});g.translate(0,0,-d/2+r);
        const pos=g.attributes.position,normal=g.attributes.normal,uv=g.attributes.uv;
        for(let i=0;i<pos.count;i++){
          const n=[Math.abs(normal.getX(i)),Math.abs(normal.getY(i)),Math.abs(normal.getZ(i))],a=[pos.getX(i),pos.getY(i),pos.getZ(i)];
          const axes=n[2]>=n[0]&&n[2]>=n[1]?[0,1]:n[1]>=n[0]?[0,2]:[1,2],dims=[w,h,d];
          if(dims[axes[0]]<dims[axes[1]])axes.reverse();uv.setXY(i,a[axes[0]]/1.7,a[axes[1]]/.48);
        }cache.set(key,g);
      }return add(p,g,m,x,y,z);
    }
    function rod(p,a,b,r,m,sides=8){const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);const o=add(p,new T.CylinderGeometry(r*.86,r,delta.length(),sides),m);o.position.copy(av.add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;}
    const sphere=(p,r,m,x,y,z,sx=1,sy=1,sz=1)=>{const o=add(p,new T.SphereGeometry(r,12,8),m,x,y,z);o.scale.set(sx,sy,sz);return o;};
    const torus=(p,r,t,m,x,y,z)=>add(p,new T.TorusGeometry(r,t,5,24),m,x,y,z);
    function merge(group){group.updateMatrixWorld(true);const inv=group.matrixWorld.clone().invert(),buckets=new Map(),old=[];
      group.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(inv.clone().multiply(o.matrixWorld));if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(g);old.push(o);});old.forEach(o=>o.removeFromParent());
      for(const [m,gs] of buckets){const g=mergeGeometries(gs);gs.forEach(g=>g.dispose());if(g)add(group,g,m);}return group;
    }
    const plaster=track(S.stoneBase.clone());plaster.color.set('#e1d5be');plaster.normalScale.set(.35,.35);
    const stone=S.stoneVariants.map((source,i)=>{const m=track(source.clone());m.color.set(['#dcd1bd','#d4c7af','#c8c1b0','#e5d5ba','#c9b9a1','#c0b8a8'][i]);m.normalScale.set(.6,.6);return m;});
    const velvet=track(S.linen.clone());velvet.color.set('#685746');velvet.roughness=1;
    const redLinen=track(S.linen.clone());redLinen.color.set('#875340');
    const warmWood=track(S.wood.clone());warmWood.color.set('#d9b993');warmWood.normalScale.set(.65,.65);
    const brass=track(S.brass.clone());brass.roughness=1;
    decor.name='shop-decor';
    timber(decor,18,9.6,.25,plaster,0,0,-1.46);
    // Moellons de tailles variées, parements taillés séparément, joints de chaux.
    for(let row=0;row<11;row++){
      let x=-9-(row%2)*.6;const y=3.65-row*.79;
      while(x<9){const w=.65+random()*.84,h=.62+random()*.09;
        const pts=[[-w/2+.06,-h/2],[-w/2,-h/2+.11],[-w/2+.02,h/2-.12],[-w/2+.12,h/2],[w/2-.14,h/2-.02],[w/2,h/2-.13],[w/2-.025,-h/2+.08],[w/2-.1,-h/2]];
        const o=extruded(decor,pts,.12+random()*.07,stone[Math.floor(random()*stone.length)],x+w/2,y+(random()-.5)*.045,-1.23,.035);
        o.rotation.z=(random()-.5)*.025;const uv=o.geometry.attributes.uv,offset=random()*3;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*1.1+offset,uv.getY(i)*1.1+offset);x+=w+.055;
      }
    }
    // Trois panneaux menuisés avec tissu sombre en retrait pour les équipements.
    for(const x of [-2.14,-.17,1.80]){
      timber(decor,1.85,4.95,.10,S.darkWood,x,-.31,-.97);
      timber(decor,1.66,4.68,.045,velvet,x,-.31,-.89);
      for(const side of [-1,1]){
        timber(decor,.065,4.92,.12,warmWood,x+side*.90,-.31,-.78);
        timber(decor,.025,4.78,.05,S.paleWood,x+side*.82,-.31,-.81);
      }
      for(const y of [-2.76,2.15]){timber(decor,1.86,.075,.14,warmWood,x,y,-.77);timber(decor,1.70,.025,.05,S.paleWood,x,y+(y>0?-.07:.07),-.80);}
      for(const y of [-2.68,2.06])for(const side of [-1,1])sphere(decor,.018,brass,x+side*.85,y,-.68);
    }
    // Piliers à assemblages chevillés et consoles courbes, hors des silhouettes.
    for(const x of [-7.96,-3.62,3.06,7.96]){
      timber(decor,.26,8.5,.44,S.darkWood,x,-.18,-.43);
      timber(decor,.30,.20,.49,warmWood,x,3.27,-.41);
      timber(decor,.34,.18,.51,warmWood,x,-3.77,-.41);
      for(const sign of [-1,1]){
        const o=extruded(decor,[[0,0],[sign*.64,0],[sign*.56,-.12],[sign*.35,-.25],[sign*.17,-.53],[0,-.72]],.26,warmWood,x,3.25,-.32);o.castShadow=true;
        sphere(decor,.032,S.paleWood,x+sign*.36,3.08,-.16);
      }
      for(const y of [-2.6,.13,2.46]){timber(decor,.29,.13,.04,S.iron,x,y,-.18);for(const dx of [-.085,.085])sphere(decor,.021,brass,x+dx,y,-.15);}
    }
    for(const y of [3.46,3.66])timber(decor,17.2,.16,.52,warmWood,0,y,-.25);
    timber(decor,17.2,.055,.57,S.paleWood,0,3.55,-.21);
    // Couverture à tuiles canal décalées et bouche des tuiles visible.
    for(let row=0;row<2;row++)for(let col=0;col<52;col++){
      const tile=add(decor,new T.CylinderGeometry(.17,.19,.72,14,1,true,0,Math.PI),S.terracotta,-8.6+col*.34,3.86+row*.27,-.45-row*.32);tile.rotation.x=Math.PI/2+.28;
    }
    function fabric(p,w,h,x,y,z,m,sag=.14){
      const g=new T.PlaneGeometry(w,h,Math.ceil(w*16),10),a=g.attributes.position;
      for(let i=0;i<a.count;i++){const px=a.getX(i),py=a.getY(i),across=px/w+.5,down=.5-py/h;
        a.setY(i,py-sag*Math.sin(across*Math.PI)*down);a.setZ(i,Math.cos(across*Math.PI*18)*.027*(.4+down)+down*.06);
      }g.computeVertexNormals();return add(p,g,m,x,y,z);
    }
    for(const [title,x,width] of [['Bergerie',-5.76,3.65],['Artisanal',-.28,4.25],['Boucherie',5.56,4.12]]){
      const sign=new T.Group();
      root.add(sign);
      sign.position.set(x,3.15,.22);
      timber(sign,width,.64,.12,warmWood);
      timber(sign,width-.13,.51,.08,S.darkWood,0,0,.07);
      label(sign,title,2.30,.59,0,0,.125,'#ffe5ad');
      for(const side of [-1,1]){
        const fastener=side*(width/2-.19);
        rod(sign,[fastener,.27,0],[fastener,.47,-.22],.019,S.iron);
        sphere(sign,.029,brass,fastener,0,.116);
      }
    }
    // Grand comptoir assemblé et drapé, tablette latérale des pièges.
    for(let i=0;i<4;i++)timber(decor,10.72,.14,.34,i%2?warmWood:S.wood,.35,-2.87,.55+i*.35);
    timber(decor,10.78,.22,.15,S.darkWood,.35,-3.07,1.79);
    for(const x of [-4.84,-1.30,2.23,5.59]){
      timber(decor,.24,1.4,.30,S.darkWood,x,-3.60,.7);timber(decor,.38,.10,.40,warmWood,x,-4.22,.7);
    }
    timber(decor,10.25,.15,.13,warmWood,.35,-3.91,.85);
    fabric(decor,10.45,.62,.35,-3.34,1.9,S.linen,.035);
    for(const x of [-4.68,-4.48,5.18,5.38])fabric(decor,.05,.61,x,-3.34,1.96,redLinen,.01);
    const table=new T.Group();
    table.name='shop-butcher-table';
    table.position.set(5.37,-1.30,.48);
    decor.add(table);
    const top=new T.Group();
    top.rotation.x=.43;
    table.add(top);
    for(let i=0;i<4;i++){
      timber(top,3.87,.13,.29,i%2?warmWood:S.wood,0,0,(i-1.5)*.30);
    }
    timber(top,3.90,.15,.09,S.paleWood,0,-.02,.60);
    for(const x of [-1.68,1.68]){
      for(const z of [-.43,.43]){
        const height=2.53-z*.43;
        timber(table,.17,height,.18,S.darkWood,x,-height/2-z*.43-.06,z);
      }
      timber(table,.15,.12,.98,warmWood,x,-1.72,0);
    }
    timber(table,3.53,.14,.11,warmWood,0,-.42,.47);
    timber(table,3.43,.12,.13,S.darkWood,0,-1.72,.44);
    // Laisser assez de profondeur pour que le cochon ne traverse pas la clôture au survol.
    const fenceDepth=3.21;
    const fencePosts=[-8.09,-6.86,-5.71,-4.94];
    for(const x of fencePosts){
      timber(decor,.13,1.44,.17,warmWood,x,-2.73,fenceDepth);
      sphere(decor,.085,S.paleWood,x,-1.98,fenceDepth,1,.3,1);
    }
    // La clôture s'arrête avant le comptoir et laisse le groin du cochon visible.
    for(const y of [-2.20,-2.98]){
      timber(decor,3.43,.115,.13,warmWood,-6.555,y,fenceDepth+.07);
      for(const x of fencePosts)sphere(decor,.018,S.iron,x,y,fenceDepth+.15);
    }
    // Étagère discrète sous les compagnons et crochet du trophée mural.
    timber(decor,3.18,.10,.63,warmWood,-5.80,.78,-.03);
    for(const x of [-6.96,-4.70])rod(decor,[x,.75,-.02],[x,.42,-.58],.035,S.iron);
    torus(decor,.035,.012,S.iron,-4.92,2.52,-.50);
    // Lanternes ajourées, verre ambré et chapeau de métal.
    const glass=track(new T.MeshStandardMaterial({color:'#d7a45b',emissive:'#f4b34d',emissiveIntensity:.45,roughness:.28}));
    for(const x of [-3.62,3.06]){
      rod(decor,[x,2.75,.10],[x,2.38,.10],.014,S.iron);torus(decor,.065,.013,S.iron,x,2.32,.10);
      timber(decor,.23,.34,.18,glass,x,2.03,.08);
      for(const dx of [-.14,.14])for(const dz of [-.12,.12])rod(decor,[x+dx,1.80,.08+dz],[x+dx,2.26,.08+dz],.013,S.iron);
      timber(decor,.33,.045,.28,S.iron,x,1.79,.08);
      const roof=add(decor,new T.ConeGeometry(.24,.15,4),S.iron,x,2.30,.08);roof.rotation.y=Math.PI/4;
      const light=new T.PointLight('#ffd18a',.32,2.1,2);light.position.set(x,2.03,.48);root.add(light);
    }
    // Dallage en perspective et rive maçonnée : aucune bande de fond vide.
    timber(decor,18,.9,.3,plaster,0,-4.20,-.65);
    for(let row=0;row<3;row++)for(let col=0;col<24;col++){
      const o=timber(decor,.70,.22,.10,stone[(row+col)%stone.length],-8.7+col*.75+(row%2)*.35,-3.88-row*.25,-.43);o.rotation.z=(random()-.5)*.02;
    }
    // Olivier aux bords : feuilles lancéolées et rameaux, au lieu de sphères.
    const leafShape=new T.Shape();leafShape.moveTo(0,-.14);leafShape.quadraticCurveTo(-.055,0,0,.14);leafShape.quadraticCurveTo(.055,0,0,-.14);
    const leafGeometry=track(new T.ShapeGeometry(leafShape,5));
    const leaf=track(S.green.clone());leaf.side=T.DoubleSide;const reverse=track(S.leafLight.clone());reverse.side=T.DoubleSide;
    for(const [x,y,scale] of [[-7.65,3.78,1.06],[7.68,3.77,.88],[-8.05,-3.90,.50]]){
      const group=new T.Group();root.add(group);group.position.set(x,y,.50);group.scale.setScalar(scale);
      for(let i=0;i<17;i++){
        const u=i/16,bx=-1+2*u,by=-.40*Math.sin(u*Math.PI);
        if(i)rod(group,[bx-.13,by+.025,0],[bx,by,0],.013,S.darkWood,5);
        for(const sign of [-1,1]){const l=add(group,leafGeometry,i%3?leaf:reverse,bx,by+sign*.11,.02);l.rotation.z=sign*.72;l.rotation.y=Math.sin(i)*.25;}
        if(i%5===0)sphere(group,.035,S.green,bx+.04,by-.05,.04,.8,1.2,.8);
      }merge(group);animations.push(t=>{group.rotation.z=Math.sin(t*.5+x)*.009;});
    }
    merge(decor);
    function createSoldSign(){
      const g=new T.Group();
      extruded(g,[[-.57,-.15],[-.59,.12],[-.51,.18],[.51,.17],[.58,.11],[.56,-.16],[.10,-.18],[-.39,-.17]],.12,S.paleWood,0,-.08,0,.015);
      for(const x of [-.41,.41]){
        rod(g,[x,.10,.015],[x*.82,.43,-.015],.012,S.rope,6);torus(g,.026,.009,S.iron,x,.08,.08);sphere(g,.016,S.iron,x,-.16,.083);
      }
      // Face vierge centrée y=-.08 ; le renderer ajoute le texte exact.
      return merge(g);
    }
    return {animations,createSoldSign,butcherTableX:table.position.x};
  }
  E.ShopDecor={create};
}());
