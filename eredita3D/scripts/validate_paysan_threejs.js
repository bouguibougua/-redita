'use strict';
// Vérification réelle du GLB avec la version Three.js déjà présente dans le projet.
// Le serveur et Chrome sont temporaires ; les fichiers du jeu sont seulement lus.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),project=path.resolve(root,'..');
const {startBrowser}=require(path.join(project,'scripts/export-menu-gif.js'));
const expected=['Paysan_Corps','Chapeau_Paille','Fourche_4_Dents','Panier_Osier','Foin_Panier',
  'Gourde_Ceinture','Sacoche_Cuir','Cordes_Ceinture','Serpette_Ceinture','Piquet_Bois'];
const vendors=new Set(['three.module.min.js','three.core.js','GLTFLoader.js','SkeletonUtils.js','BufferGeometryUtils.js']);

async function main(){
  const html=`<!doctype html><meta charset="utf-8"><title>Validation paysan</title><script type="module">
  import * as THREE from '/vendor/three.module.min.js';
  import {GLTFLoader} from '/vendor/GLTFLoader.js';
  try{
    const gltf=await new GLTFLoader().loadAsync('/paysan.glb');
    const character=gltf.scene.getObjectByName('Paysan');
    if(!character)throw new Error('Racine Paysan absente');
    const missing=${JSON.stringify(expected)}.filter(name=>!gltf.scene.getObjectByName(name));
    let triangles=0,meshes=0,skinned=0;const materials=new Set(),textures=new Set();
    gltf.scene.traverse(obj=>{
      if(!obj.isMesh)return;
      meshes++;if(obj.isSkinnedMesh)skinned++;
      const geometry=obj.geometry;geometry.computeBoundingSphere();
      if(!Number.isFinite(geometry.boundingSphere.radius))throw new Error('Géométrie non finie');
      triangles+=(geometry.index?geometry.index.count:geometry.attributes.position.count)/3;
      for(const material of Array.isArray(obj.material)?obj.material:[obj.material]){
        if(!material.isMeshStandardMaterial)throw new Error('Matériau PBR invalide');
        materials.add(material.uuid);
        for(const name of ['map','normalMap','roughnessMap','metalnessMap'])if(material[name]){
          if(!(material[name].image?.width>0))throw new Error('Texture non chargée');
          textures.add(material[name].uuid);
        }
      }
    });
    const box=new THREE.Box3().setFromObject(character),size=box.getSize(new THREE.Vector3());
    window.paysanCheck={three_revision:THREE.REVISION,triangles,meshes,materials:materials.size,
      textures:textures.size,height_m:size.y,animations:gltf.animations.length,skinned,missing};
  }catch(error){window.paysanCheck={error:String(error.stack||error)};}
  </script>`;
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');let file,type;
    if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html);}
    if(url.pathname==='/paysan.glb'){file=path.join(root,'exports/paysan.glb');type='model/gltf-binary';}
    else if(url.pathname.startsWith('/vendor/')&&vendors.has(url.pathname.slice(8))){
      file=path.join(project,'js/vendor',url.pathname.slice(8));type='text/javascript';
    }else{res.writeHead(404);return res.end();}
    fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);return res.end();}
      res.writeHead(200,{'Content-Type':type});res.end(bytes);});
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  let browser;
  try{
    browser=await startBrowser();const page=browser.page;
    await page.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
    await page.waitFor('window.paysanCheck!==undefined',25000);
    const result=await page.evaluate('window.paysanCheck');
    assert.equal(result.error,undefined,JSON.stringify(result));
    assert.deepEqual(result.missing,[]);
    assert.equal(result.animations,0);assert.equal(result.skinned,0);
    assert.ok(Math.abs(result.height_m-1.75)<.003);
    assert.ok(result.textures>=9);
    const blender=JSON.parse(fs.readFileSync(path.join(root,'logs/paysan-validation.json'),'utf8'));
    assert.equal(result.triangles,blender.triangles);
    assert.equal(page.errors.length,0,JSON.stringify(page.errors));
    fs.writeFileSync(path.join(root,'logs/paysan-threejs-validation.json'),JSON.stringify(result,null,2)+'\n');
    console.log('PAYSAN_THREEJS_OK',JSON.stringify(result));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
