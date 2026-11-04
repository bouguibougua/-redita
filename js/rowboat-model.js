(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  let THREE, template, loading, error = null, triangles = 0;
  function init(three) {
    if (loading) return loading;
    THREE = three;
    loading = import('./vendor/GLTFLoader.js').then(async ({GLTFLoader}) => {
      const asset = await new GLTFLoader().loadAsync(new URL(E.Config.transportModels.barque.src,document.baseURI).href);
      asset.scene.traverse(part => {if(part.isMesh)triangles+=(part.geometry.index?.count||part.geometry.attributes.position.count)/3;});
      if(!triangles)throw new Error('Le modèle de barque ne contient aucun maillage');
      template=asset.scene;return true;
    }).catch(reason=>{error=String(reason?.stack||reason);return false;});
    return loading;
  }
  function create(owner) {
    if(!template)return null;
    const group=new THREE.Group(),model=template.clone(true),materials=new Map();
    group.name='transport-barque';group.userData.ownerId=owner;model.name='barque-modele';
    model.scale.setScalar(E.Config.transportModels.barque.scale);group.add(model);
    model.traverse(part=>{
      if(!part.isMesh)return;
      part.castShadow=part.receiveShadow=true;part.userData.sharedGeometry=true;
      const copy=source=>{if(!materials.has(source))materials.set(source,source.clone());return materials.get(source);};
      part.material=Array.isArray(part.material)?part.material.map(copy):copy(part.material);
    });
    return group;
  }
  E.RowboatModel={init,create,get ready(){return Boolean(template);},get diagnostics(){return {ready:Boolean(template),error,triangles};}};
}());
