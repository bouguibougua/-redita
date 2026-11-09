'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser,delay}=require('../scripts/export-menu-gif');
(async()=>{const site=await startStaticServer();let browser;
 try{
  browser=await startBrowser();const p=browser.page;
  await p.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1050,deviceScaleFactor:1,mobile:false});
  await p.send('Page.navigate',{url:(process.env.EREDITA_TEST_URL||site.url)+'?intro=0'});
  await p.waitFor('window.Eredita?.Board3D?.ready&&Eredita.GameView?.getState()');
  await p.waitFor('Eredita.DiavuleEffects.diagnostics.ready&&Eredita.VillageModels.ready&&Eredita.PlainTerrain.ready',45000);
  await p.evaluate(`(()=>{const E=Eredita;window.realRandom=Math.random;const pool=E.Mythology.all.filter(E.MythologyMatch.activatable),index=pool.findIndex(l=>l.id==='u-diavulu');Math.random=()=>(index+.1)/pool.length;
   E.Network.startMode('local');E.GameView.command('confirmBiomes','red','keep');E.GameView.command('confirmBiomes','blue','keep');E.GameView.command('start');Math.random=realRandom;
   const s=window.dState=E.GameView.getState();E.AI.update=()=>false;for(const player of Object.values(s.players))for(const v of player.villages){v.biome=v.lane===0?'plaine':'littoral';v.slots=E.Biomes.createSlots(v.biome);v.terrain={};v.buildings=[];}
   const u=window.dTarget=E.Units.create('blue',0,'habitant');u.position=80;u.hp=u.maxHp=1000;s.units.push(u);E.UI.render(s);E.Board3D.update(s,true);
   window.dSounds=[];const play=E.Audio.playEffect;E.Audio.playEffect=name=>{const audio=play(name);if(name==='diavule'&&audio)dSounds.push(audio);return audio;};
   window.dInitial=null;const render=E.UI.render;E.UI.render=s=>{if(!dInitial&&s.players.red.villages[0].burn)dInitial={hp:u.hp,prep:s.preparationRemaining,elapsed:s.elapsed};return render(s);};
   window.dRoot=()=>E.Board3D.getXRContext().world.getObjectByName('diavule-effects');
  })()`);
  const diag='Eredita.MythologySession.diagnostics';
  async function chooseDiavule(){await p.waitFor(`${diag}.crystal?.ready`);await p.click('.mythology-match-widget .mythology-crystal-stage');await p.waitFor(`${diag}.crystal.cardsProgress===1`);await p.click('.mythology-match-widget [data-legend-id="u-diavulu"]');await p.waitFor("!!document.querySelector('#mythology-stock [data-legend-id=\"u-diavulu\"]')");await p.click('#mythology-stock [data-legend-id="u-diavulu"]');await p.waitFor(`${diag}.targeting?.legendId==='u-diavulu'`);}
  async function clickRegion(owner,lane){const point=await p.evaluate(`(()=>{const {THREE:T,terrainGroup,camera,renderer}=Eredita.Board3D.getXRContext(),g=terrainGroup.children.find(g=>g.userData.playerId==='${owner}'&&g.userData.lane===${lane});g.updateWorldMatrix(true,false);camera.updateMatrixWorld();const v=g.localToWorld(new T.Vector3(-.3,.2,.45)).project(camera),r=renderer.domElement.getBoundingClientRect();return {x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2};})()`);for(const [type,button]of [['mouseMoved','none'],['mousePressed','left'],['mouseReleased','left']])await p.send('Input.dispatchMouseEvent',{type,button,clickCount:1,...point});}
  await chooseDiavule();await clickRegion('blue',0);
  await p.waitFor('dRoot().getObjectByName("diavule-modele-anime")?.visible&&dSounds.length===1');
  const initial=await p.evaluate('dInitial');assert.equal(initial.hp,990);assert.ok(initial.prep>0);assert.equal(initial.elapsed,0);
  await p.waitFor('dTarget.hp<990');assert.equal(await p.evaluate('dState.elapsed'),0,'Le feu et les dégâts avancent pendant la préparation');
  const at=await p.evaluate("(()=>{const g=dRoot().getObjectByName('apparition-diavule');return {caster:g.userData.casterId,z:g.position.z,age:dRoot().getObjectByName('flammes-terrain').material.uniforms.time.value};})()");
  assert.equal(at.caster,'red');assert.ok(at.z<0&&at.age>0);
  await p.evaluate(`(()=>{Eredita.GameView.command('togglePause');const s=dState;s.preparationRemaining=0;s.elapsed=20;for(const player of Object.values(s.players))for(const v of player.villages)if(v.burn){v.burn.startedAt=80;v.burnUntil=86;}
   window.dStep=age=>{s.elapsed=20+age;Eredita.Board3D.update(s);Eredita.DiavuleEffects.update(s,lane=>(lane-(s.players.red.villages.length-1)/2)*3.45,1.15);};dStep(.3);})()`);
  const folder=process.env.EREDITA_DIAVULE_PREVIEW_DIR||path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});
  async function closeup(name,time){await p.evaluate(`dStep(${time})`);const url=await p.evaluate(`(()=>{const {THREE:T,scene}=Eredita.Board3D.getXRContext();const c=new T.PerspectiveCamera(38,1.2,.01,100);c.position.set(-8.2,4.4,1);c.lookAt(-1.725,.85,-.8);const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(1200,1000);r.render(scene,c);const url=r.domElement.toDataURL();r.dispose();return url;})()`);fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(url.split(',')[1],'base64'));}
  await closeup('diavule-flash',.3);await closeup('diavule-ailes',.5);await closeup('diavule-bras-leve',.85);await closeup('diavule-reception',1.44);
  const poses=await p.evaluate(`(()=>{const T=Eredita.Board3D.getXRContext().THREE;window.dModel=dRoot().getObjectByName('diavule-modele-anime');window.dMesh=dModel.getObjectByProperty('isSkinnedMesh',true);
   window.dBone=name=>{dModel.updateMatrixWorld(true);return dMesh.skeleton.bones.find(b=>b.name.endsWith(name.replace(/^mixamorig:/,''))).getWorldPosition(new T.Vector3()).toArray();};
   dStep(.1);const low=dBone('mixamorig:Hips')[1];dStep(.85);const high=dBone('mixamorig:Hips')[1],hand=dBone('mixamorig:LeftHand')[1],head=dBone('mixamorig:Head')[1];dStep(1.5);const land=dBone('mixamorig:Hips')[1];dStep(3);const wing=dBone('WingTip_Left');dStep(3.7);return {low,high,hand,head,land,wing,wingAfter:dBone('WingTip_Left')};})()`);
  assert.ok(poses.high>poses.low+.15);assert.ok(poses.land<poses.high-.15);assert.ok(poses.hand>poses.head,'La main gauche se lève au-dessus de la tête');assert.ok(poses.wing.some((v,i)=>Math.abs(v-poses.wingAfter[i])>.01));
  const staging=await p.evaluate(`(()=>{const g=dRoot().getObjectByName('apparition-diavule'),m=g.getObjectByProperty('isSkinnedMesh',true).material;
   dStep(.3);const flash=m.userData.invocationGlow.value;dStep(.85);const foot=dBone('mixamorig:LeftToeBase')[1];dStep(1.44);const impact=g.getObjectByName('impact-reception').visible,toe=dBone('mixamorig:LeftToeBase')[1],hips=dBone('mixamorig:Hips')[1];
   dStep(2);return{flash,foot,toe,hips,standing:dBone('mixamorig:Hips')[1],impact,glowAfter:m.userData.invocationGlow.value,lightAfter:g.getObjectByProperty('isPointLight',true).intensity};})()`);
  assert.ok(staging.flash>4,'Flash doré sur la silhouette');assert.equal(staging.glowAfter,0);assert.equal(staging.lightAfter,0);
  assert.ok(staging.foot>staging.toe+.4,'Pieds nettement décollés pendant la suspension');
  assert.ok(staging.hips<staging.standing-.1,'La réception comprime la posture');assert.equal(staging.impact,true);
  const freeze=await p.evaluate("[...dBone('WingTip_Left'),dRoot().getObjectByName('flammes-terrain').material.uniforms.time.value]");await delay(180);const paused=await p.evaluate("[...dBone('WingTip_Left'),dRoot().getObjectByName('flammes-terrain').material.uniforms.time.value]");assert.ok(paused.every((v,i)=>Math.abs(v-freeze[i])<1e-8));
  const stateBefore=await p.evaluate('JSON.stringify(dState)');await p.evaluate('for(let i=0;i<5;i++)Eredita.Board3D.update(dState,true)');assert.equal(await p.evaluate('JSON.stringify(dState)'),stateBefore);assert.equal(await p.evaluate('dSounds.length'),1);
  await p.evaluate('dStep(7.01)');assert.equal(await p.evaluate('Eredita.DiavuleEffects.diagnostics.apparitions'),0);assert.equal(await p.evaluate('Eredita.DiavuleEffects.diagnostics.regions'),2);
  await closeup('terrain-flammes',15);await p.evaluate('dStep(65.8)');assert.ok(await p.evaluate("dRoot().getObjectByName('flammes-terrain').material.uniforms.intensity.value<.01"));
  await p.evaluate('dStep(66);Eredita.UI.render(dState)');assert.equal(await p.evaluate('dRoot().children.length'),0);assert.equal(await p.evaluate("document.querySelectorAll('.terrain-fire-2d').length"),0);
  await p.evaluate("Eredita.GameView.command('togglePause');Eredita.GameView.selectVillage('blue',1);Eredita.MythologySession.render(dState)");await chooseDiavule();await clickRegion('red',1);
  await p.waitFor('dSounds.length===2&&dRoot().getObjectByName("apparition-diavule")?.userData.casterId==="blue"');
  assert.ok(await p.evaluate('dRoot().getObjectByName("apparition-diavule").position.z>2.2'),'Sur le Littoral, le Diable apparaît sur la terre du lanceur');
  await p.evaluate("Eredita.GameView.command('togglePause')");
  const coast=await p.evaluate(`dRoot().children.filter(g=>g.name==='terrain-incendie').map(g=>{const arr=g.getObjectByName('flammes-terrain').geometry.attributes.origin.array,z=[];for(let i=2;i<arr.length;i+=3)z.push(arr[i]);return [Math.min(...z),Math.max(...z)];})`);assert.ok(coast.every(([a,b])=>a>-.55&&b<.55));
  await p.waitFor('dSounds.every(a=>a.readyState>=1)');const audio=await p.evaluate('dSounds.map(a=>({duration:a.duration,source:new URL(a.src).pathname}))');assert.ok(audio.every(a=>a.duration>1.6&&a.duration<1.65&&a.source.endsWith('diavule-invocation.wav')));
  await p.evaluate('Eredita.Board3D.setMode(false)');assert.equal(await p.evaluate("getComputedStyle(document.querySelector('.terrain-fire-2d i')).animationPlayState"),'paused');await p.evaluate('Eredita.Board3D.setMode(true)');
  await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(100);assert.equal(await p.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
  assert.deepEqual(p.errors,[]);assert.deepEqual(p.consoleErrors,[]);assert.deepEqual(p.badResponses.filter(u=>/\/(js|assets|css)\//.test(u)),[]);
  console.log('Invocation réelle du cristal : feu et dégâts pendant la préparation, son original unique, camp du lanceur Rouge/Bleu, saut, ailes, bras levé, réception, pause, extinction à 66 s et mobile validés.',JSON.stringify(poses));
 }finally{await browser?.close();await new Promise(r=>site.server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
