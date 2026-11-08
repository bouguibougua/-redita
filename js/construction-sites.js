(function () {
  'use strict';
  const E=window.Eredita, geometries=new Map(), emblems=new Map();
  let loading, modelParts=[], error=null;
  function init(T) {
    if(loading)return loading;
    const config=E.Config.constructionSiteModel;
    loading=import('./vendor/GLTFLoader.js').then(async({GLTFLoader})=>{
      const asset=await new GLTFLoader().loadAsync(new URL(config.src,document.baseURI).href);
      asset.scene.updateMatrixWorld(true);
      asset.scene.traverse(part=>{
        if(!part.isMesh)return;
        if(Array.isArray(part.material))throw new Error('Un matériau par maillage est requis pour le chantier');
        const geometry=part.geometry.clone().applyMatrix4(part.matrixWorld);
        modelParts.push({geometry,material:part.material});
      });
      if(!modelParts.length)throw new Error('Chantier vide');
      return true;
    }).catch(reason=>{error=String(reason?.message||reason);modelParts.forEach(p=>p.geometry.dispose());modelParts=[];return false;});
    return loading;
  }
  function instance(T,type,geometry) {
    const g=new T.Group();g.name=`chantier-${type}`;g.userData.constructionSite=type;
    const parts=modelParts.length?modelParts:[{geometry,material:new T.MeshStandardMaterial({vertexColors:true,roughness:.92})}];
    for(const part of parts){
      const mesh=new T.Mesh(part.geometry,modelParts.length?part.material.clone():part.material);
      mesh.castShadow=mesh.receiveShadow=true;mesh.userData.sharedGeometry=true;g.add(mesh);
    }
    if(modelParts.length){
      const icon=new T.Mesh(emblems.get(type),new T.MeshStandardMaterial({vertexColors:true,roughness:.92}));
      icon.position.fromArray(E.Config.constructionSiteModel.emblemPosition);icon.scale.setScalar(E.Config.constructionSiteModel.emblemScale);icon.castShadow=icon.receiveShadow=true;icon.userData.sharedGeometry=true;icon.name='pictogramme-'+type;g.add(icon);
    }
    g.userData.constructionModel=modelParts.length?'tripo':'simple';return g;
  }
  function create(T,type) {
    if(geometries.has(type))return instance(T,type,geometries.get(type));
    const g=new T.Group();g.name=`chantier-${type}`;g.userData.constructionSite=type;
    const colors={earth:0x765437,wood:0x8d6339,rope:0xd0b37a,hay:0xdab65b,metal:0x68757c,stone:0x999280};
    function add(geometry,color,x,y,z) {
      const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.92}));
      m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;
    }
    const box=(w,h,d,color,x,y,z)=>add(new T.BoxGeometry(w,h,d),color,x,y,z);
    box(.65,.035,.55,colors.earth,0,.018,0);
    // Un panneau et quelques matériaux : aucun bâtiment déjà formé.
    for(const x of [-.12,.12])box(.025,.34,.025,colors.wood,x,.17,-.02);
    box(.36,.23,.035,0x926b3e,0,.32,-.02);
    box(.32,.19,.008,0xd8bd87,0,.32,.003);
    for(let i=0;i<3;i++)box(.29,.025,.055,colors.wood,-.09+i*.055,.05+i*.026,.14).rotation.y=.22+i*.12;
    for(let i=0;i<4;i++){
      const stone=add(new T.DodecahedronGeometry(.045,0),colors.stone,.12+i*.037,.055,-.16+(i%2)*.09);
      stone.scale.set(1.25,.7,1);stone.rotation.y=i;
    }
    // Pictogramme en relief sur le panneau (foin, outils, four en pierre).
    box(.32,.19,.008,0xd8bd87,0,.32,-.043);
    const pictogramStart=g.children.length;
    const z=.015;
    if(type==='bergerie'){
      box(.19,.10,.012,colors.hay,0,.32,z);
      for(const x of [-.055,.055])box(.014,.108,.014,0x9a722a,x,.32,z+.008);
      for(let i=0;i<7;i++)box(.007,.11,.005,0xedcc65,-.085+i*.028,.32,z+.004).rotation.z=.12;
    }else if(type==='artisanat'){
      box(.017,.17,.012,colors.wood,-.015,.31,z).rotation.z=-.55;
      box(.017,.17,.012,colors.wood,.015,.31,z+.012).rotation.z=.55;
      box(.10,.035,.018,colors.metal,.026,.375,z+.015).rotation.z=-.55;
      const pick=add(new T.TorusGeometry(.065,.009,4,10,Math.PI),colors.metal,-.035,.369,z+.025);pick.rotation.z=.45;
    }else{
      box(.18,.035,.014,colors.stone,0,.255,z);
      box(.15,.105,.014,0x343027,0,.307,z);
      for(const x of [-.073,.073])box(.04,.10,.018,colors.stone,x,.305,z+.007);
      for(let i=0;i<7;i++){
        const a=i*Math.PI/6;box(.04,.035,.018,colors.stone,.073*Math.cos(a),.337+.05*Math.sin(a),z+.007).rotation.z=a;
      }
      box(.025,.05,.018,colors.stone,.045,.396,z);
    }
    // Même pictogramme au dos pour rester lisible après rotation du plateau.
    for(const front of g.children.slice(pictogramStart)){
      const back=front.clone();back.geometry=front.geometry.clone();back.material=front.material.clone();back.position.z=-.04-front.position.z;g.add(back);
    }
    // Un seul lot de rendu par chantier ; géométrie commune aux villages.
    const positions=[],normals=[],vertexColors=[],iconPositions=[],iconNormals=[],iconColors=[];
    g.updateMatrixWorld(true);
    for(const [index,child] of g.children.entries()){
      const source=child.geometry,geometry=(source.index?source.toNonIndexed():source.clone()).applyMatrix4(child.matrixWorld);
      positions.push(...geometry.attributes.position.array);normals.push(...geometry.attributes.normal.array);
      const color=child.material.color;
      for(let i=0;i<geometry.attributes.position.count;i++)vertexColors.push(color.r,color.g,color.b);
      if(index>=pictogramStart){
        iconPositions.push(...geometry.attributes.position.array);iconNormals.push(...geometry.attributes.normal.array);
        for(let i=0;i<geometry.attributes.position.count;i++)iconColors.push(color.r,color.g,color.b);
      }
      geometry.dispose();source.dispose();child.material.dispose();
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(vertexColors,3));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.set(type,geometry);
    const icon=new T.BufferGeometry();icon.setAttribute('position',new T.Float32BufferAttribute(iconPositions,3));icon.setAttribute('normal',new T.Float32BufferAttribute(iconNormals,3));icon.setAttribute('color',new T.Float32BufferAttribute(iconColors,3));icon.translate(0,-.32,.02);icon.computeBoundingBox();icon.computeBoundingSphere();emblems.set(type,icon);
    return instance(T,type,geometry);
  }
  E.ConstructionSites={init,create,get ready(){return modelParts.length>0;},get diagnostics(){return {ready:modelParts.length>0,error,batches:modelParts.length,triangles:modelParts.reduce((sum,p)=>sum+(p.geometry.index?.count||p.geometry.attributes.position.count)/3,0)};}};
}());
