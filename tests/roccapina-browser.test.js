'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser}=require('../scripts/export-menu-gif');
(async()=>{
 const site=await startStaticServer();let browser;
 try{
  browser=await startBrowser();const page=browser.page;
  await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await page.send('Page.navigate',{url:site.url+'?intro=0'});
  await page.waitFor("document.readyState==='complete' && Eredita.Board3D?.ready && Eredita.GameView?.getState()");
  await page.waitFor('Eredita.RoccapinaModel?.ready || Eredita.RoccapinaModel?.diagnostics.error',30000);
  assert.equal((await page.evaluate('Eredita.RoccapinaModel.diagnostics')).error,null);
  const poster=await page.evaluate(`(async()=>{const img=new Image();img.src=Eredita.Mythology.get('lion-roccapina').visuals.normal.src;await img.decode();return [img.naturalWidth,img.naturalHeight]})()`);assert.deepEqual(poster,[1280,720]);
  await page.click('[data-menu-screen="play"]');await page.click('#training-button');
  await page.waitFor("Eredita.Network.mode==='solo'");
  await page.click('[data-setup-action="keep"][data-player="red"]');await page.click('#start-game');
  await page.waitFor("Eredita.GameView.getState().phase==='running'");
  const result=await page.evaluate(`(()=>{
   const E=Eredita,s=E.GameView.getState();s.paused=false;s.preparationRemaining=0;s.units=[];s.reinforcementEpoch='lion-browser';E.MythologyEffects.init(s);
   for(const p of Object.values(s.players))for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.terrain={};}
   ['guerrier','ravageur','chasseur'].forEach((profession,i)=>{const v=s.players.red.villages[0];E.Economy.deployResident(s,'red',0,v.residents[i].id,'attaque',profession);s.units.at(-1).position=30+i*7;});
   const request={epoch:s.reinforcementEpoch,playerId:'red',legendId:'lion-roccapina',target:{playerId:'red',lane:1},activationId:'lion-1'};
   const activated=E.MythologyEffects.activate(s,request);s.paused=true;E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
   window.lionState=s;window.lionFigure=()=>E.Board3D.getXRContext().world.children[1].children.find(f=>f.userData.roccapina);
   return {activated,units:s.units.map(u=>({legend:u.mythologyLegendId,hp:u.hp,damage:u.damage,lane:u.lane,position:u.position,origin:u.originLane}))};
  })()`);
  assert.equal(result.activated.accepted,true);assert.deepEqual(result.units.slice(0,3).map(u=>[u.lane,u.position,u.origin]),[[1,30,0],[1,37,0],[1,44,0]]);
  assert.equal(result.units[3].hp,145);assert.equal(result.units[3].damage,25);
  const model=await page.evaluate(`(()=>{const E=Eredita,T=E.Board3D.getXRContext().THREE,f=lionFigure(),m=f.getObjectByName('lion-roccapina-modele');return {name:m.name,bottom:new T.Box3().setFromObject(m).min.y,height:new T.Box3().setFromObject(m).getSize(new T.Vector3()).y,meshes:(()=>{let n=0;m.traverse(p=>{if(p.isMesh)n++});return n})(),team:!!f.getObjectByName('equipe-roccapina')};})()`);

  const movement=await page.evaluate(`(()=>{
   const E=Eredita,T=E.Board3D.getXRContext().THREE,f=lionFigure(),a=f.userData.roccapina;
   const hand=f.getObjectByName('mixamorigRightHand'),weapon=f.getObjectByName('Epee_Lion_Fournie');
   if(!hand||!weapon)throw Error('Main ou épée absente');
   const point=()=>{f.updateMatrixWorld(true);return weapon.getWorldPosition(new T.Vector3()).toArray();};
   a.setMoving(true);for(let i=0;i<6;i++)a.tick(.05,false);const walking=a.action;
   a.setMoving(false);for(let i=0;i<5;i++)a.tick(.05,false);const start=point();a.attack(1);for(let i=0;i<7;i++)a.tick(.05,false);const end=point();
   const pose=hand.quaternion.toArray(),at=a.time;a.tick(.05,true);const paused=a.time===at&&JSON.stringify(hand.quaternion.toArray())===JSON.stringify(pose);
   return {walking,action:a.action,start,end,paused,attached:weapon.parent===hand||weapon.parent.parent===hand,clips:E.RoccapinaModel.diagnostics.clips};
  })()`);
  assert.equal(movement.walking,'Marche');assert.equal(movement.action,'Frappe_Droite');assert.ok(movement.paused&&movement.attached);assert.ok(movement.start.some((v,i)=>Math.abs(v-movement.end[i])>.015),'Épée entraînée par la main pendant la frappe');
  const realAttack=await page.evaluate(`(()=>{
   const E=Eredita,s=lionState,u=s.units.find(x=>x.mythologyLegendId==='lion-roccapina');
   const enemy=E.Units.create('blue',u.lane,'habitant');enemy.position=u.position+.5;s.units.push(enemy);
   u.visualAttackSequence=1;u.attackCooldown=0;s.paused=false;E.Combat.update(s,.01);s.paused=true;E.Board3D.update(s,true);
   const a=lionFigure().userData.roccapina;return {damage:enemy.maxHp-enemy.hp,action:a.action,sequence:a.sequence};
  })()`);assert.equal(realAttack.damage,25);assert.equal(realAttack.action,'Frappe_Revers');assert.equal(realAttack.sequence,2);
  const folder=path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});
  const preview=await page.evaluate(`(()=>{
   const E=Eredita,T=E.Board3D.getXRContext().THREE,scene=new T.Scene();scene.background=new T.Color('#d9d3c3');
   scene.add(new T.HemisphereLight(0xffffff,0x777777,3));const key=new T.DirectionalLight(0xffffff,3);key.position.set(2,4,3);scene.add(key);
   const models=[E.WarriorModel.create('red'),E.RoccapinaModel.create('red'),E.RoccapinaModel.create('red')];
   models.forEach((f,i)=>{f.position.x=(i-1)*.75;f.rotation.y=.3;scene.add(f);if(i===2){f.userData.roccapina.attack(1);for(let j=0;j<7;j++)f.userData.roccapina.tick(.05,false);}});
   const camera=new T.PerspectiveCamera(32,1.8,.01,100);camera.position.set(1.2,1.1,2.7);camera.lookAt(0,.3,0);
   const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,667);renderer.render(scene,camera);const data=renderer.domElement.toDataURL('image/png');
   renderer.dispose();return data.split(',')[1];
  })()`);fs.writeFileSync(path.join(folder,'roccapina-armed-comparison.png'),Buffer.from(preview,'base64'));
  assert.ok(model.height>.55&&model.height<.68);assert.ok(Math.abs(model.bottom-.2)<.02,`Pieds au sol : ${model.bottom}`);
  const capture=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(folder,'roccapina-in-game.png'),Buffer.from(capture.data,'base64'));
  const lore=await page.evaluate(`(()=>{const d=document.createElement('dialog');d.style.cssText='width:900px;max-height:90vh;overflow:auto;background:#15140f;color:#eee';d.append(Eredita.MythologyUI.createPair('lion-roccapina'));document.body.append(d);d.showModal();return d.textContent;})()`);
  assert.ok(lore.includes('145')&&lore.includes('25'));
  await page.waitFor("[...document.querySelectorAll('dialog img')].every(i=>i.complete&&i.naturalWidth>0)");
  const card=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(folder,'roccapina-card.png'),Buffer.from(card.data,'base64'));
  await page.send('Page.navigate',{url:site.url+'?intro=0'});
  await page.waitFor("document.readyState==='complete' && Eredita.MenuScene?.diagnostics.ready");
  await page.click('[data-menu-screen="legends"]');
  await page.click('.mythology-roster-card[data-legend-id="lion-roccapina"]');
  await page.waitFor("document.querySelector('.mythology-codex-feature').textContent.includes('145')");
  await page.click('.mythology-codex-crystal');
  await page.waitFor("document.querySelector('.mythology-codex-feature').textContent.includes('amours impossibles')");
  await page.waitFor("document.querySelector('.mythology-codex-feature video')?.readyState>=2");
  await page.waitFor("document.querySelector('.mythology-codex-crystal').getAttribute('aria-disabled')==='false'");
  assert.ok(await page.evaluate("document.querySelector('.mythology-codex-index').textContent.endsWith('/ 17')"));
  const story=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(folder,'roccapina-story.png'),Buffer.from(story.data,'base64'));
  assert.equal(page.errors.length,0,JSON.stringify(page.errors));assert.equal(page.badResponses.length,0,JSON.stringify(page.badResponses));
  console.log('Roccapina : GLB, illustration, fiche, invocation 145/25, regroupement, taille réduite, épée fournie liée à la main, marche, frappe droite/revers sur coup réel et pause validés.');
 }finally{if(browser)await browser.close();await new Promise(r=>site.server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
