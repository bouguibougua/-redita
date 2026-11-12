'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser}=require('../scripts/export-menu-gif');
(async()=>{const site=await startStaticServer();let browser;
try{
 browser=await startBrowser();const p=browser.page;await p.send('Page.navigate',{url:site.url+'?intro=0'});
 await p.waitFor("window.Eredita?.Board3D?.ready && ['Lupu','Mazzeru','Roccapina','Warrior'].every(n=>Eredita[n+'Model']?.ready)",30000);
 const checks=await p.evaluate(`(()=>{
  const E=Eredita,T=E.Board3D.getXRContext().THREE,results=[];
  for(const [name,api,bonePrefix,walk,base]of [
    ['Lupu','LupuModel','','Quatre_Pattes',E.Config.characterModels.lupu.scale],
    ['Mazzeru','MazzeruModel','mixamorig','Marche',E.Config.characterModels.mazzeru.height/E.Config.characterModels.mazzeru.canonicalHeight],
    ['Lion','RoccapinaModel','mixamorig','Marche',E.Config.characterModels.roccapina.height/E.Config.characterModels.roccapina.canonicalHeight]]){
   const f=E[api].create('red'),g=E[api].create('blue'),a=f.userData.lupu||f.userData.mazzeru||f.userData.roccapina,b=g.userData.lupu||g.userData.mazzeru||g.userData.roccapina;
   const model=f.children[0];if(Math.abs(model.scale.x/base-1.1)>1e-8)throw Error(name+' taille');
   const sample=figure=>{figure.updateMatrixWorld(true);return ['LeftFoot','RightFoot','LeftHand','RightHand'].map(n=>figure.getObjectByName(bonePrefix+n).getWorldPosition(new T.Vector3()).toArray());};
   a.setMoving(true);b.setMoving(true);a.tick(.15,false);b.tick(.15,false);const before=a.time;
   a.tick(.1,false);for(let i=0;i<6;i++)b.tick(1/60,false);
   const fps=E.Config.characterModels[name==='Lupu'?'lupu':name==='Mazzeru'?'mazzeru':'roccapina'].walkTimeScale;
   if(Math.abs(a.time-before-.1*fps)>1e-6)throw Error(name+' ralentit pendant une image longue');
   const whole=sample(f),split=sample(g);const error=Math.max(...whole.flatMap((v,i)=>v.map((n,j)=>Math.abs(n-split[i][j]))));if(error>1e-5)throw Error(name+' dépend du découpage des images');
   const start=sample(f);for(let i=0;i<14;i++)a.tick(1/60,false);const moved=sample(f);
   if(!start.every((v,i)=>Math.hypot(...v.map((n,j)=>n-moved[i][j]))>.002))throw Error(name+' membre inerte');
   const paused=JSON.stringify(sample(f));a.tick(.1,true);if(JSON.stringify(sample(f))!==paused)throw Error(name+' bouge pendant la pause');
   const action=a.mixer._actions.find(x=>x.getClip().name===walk);a.mixer.stopAllAction();action.reset().setEffectiveWeight(1).play();
   action.time=0;a.mixer.update(0);const loopStart=sample(f);action.time=action.getClip().duration-1e-6;a.mixer.update(0);const loopEnd=sample(f);
   const seam=Math.max(...loopStart.flatMap((v,i)=>v.map((n,j)=>Math.abs(n-loopEnd[i][j]))));if(seam>.001)throw Error(name+' saute à la boucle '+seam);
   results.push({name,scale:model.scale.x/base,framePartitionError:error,loopSeam:seam,clips:E[api].diagnostics.clips});
   for(const [figure,controller]of [[f,a],[g,b]]){controller.dispose();figure.traverse(o=>{if(!o.userData.sharedGeometry)o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});}
  }
  return results;
 })()`);
 assert.equal(checks.length,3);
 const preview=await p.evaluate(`(()=>{
  const E=Eredita,T=E.Board3D.getXRContext().THREE,scene=new T.Scene();scene.background=new T.Color('#d8d1c1');scene.add(new T.HemisphereLight(0xffffff,0x777777,3));const light=new T.DirectionalLight(0xffeedc,3);light.position.set(2,4,3);scene.add(light);
  const models=[E.WarriorModel.create('red'),E.MazzeruModel.create('red'),E.LupuModel.create('red'),E.RoccapinaModel.create('red')];
  const labels=['Guerrier · repère','Mazzeru +10 %','Lupu Mannaru +10 %','Lion de Roccapina +10 %'];
  models.forEach((f,i)=>{f.position.x=(i-1.5)*.92;f.rotation.y=.35;if(i===2)f.scale.setScalar(1.25);scene.add(f);const a=f.userData.warrior||f.userData.mazzeru||f.userData.lupu||f.userData.roccapina;a.setMoving(true);for(let j=0;j<24;j++)a.tick(1/60,false);
   const c=document.createElement('canvas');c.width=512;c.height=64;const ctx=c.getContext('2d');ctx.font='bold 26px system-ui';ctx.fillStyle='#352a1f';ctx.textAlign='center';ctx.fillText(labels[i],256,40);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const label=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false}));label.position.set(f.position.x,.9,0);label.scale.set(.88,.11,1);scene.add(label);
  });
  const camera=new T.PerspectiveCamera(34,1.75,.01,100);camera.position.set(2,1.6,4);camera.lookAt(0,.40,0);const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1400,800);renderer.render(scene,camera);const png=renderer.domElement.toDataURL('image/png').split(',')[1];renderer.dispose();return png;
 })()`);
 const folder=path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'legends-fluid-motion.png'),Buffer.from(preview,'base64'));
 assert.deepEqual(p.errors,[]);assert.deepEqual(p.badResponses,[]);assert.deepEqual(p.consoleErrors,[]);console.log(JSON.stringify(checks,null,2));console.log('Trois légendes : +10 %, quatre membres animés, boucles continues, rattrapage à 10 FPS et pause vérifiés dans Three.js.');
}finally{if(browser)await browser.close();await new Promise(resolve=>site.server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
