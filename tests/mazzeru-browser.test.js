'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const{startStaticServer,startBrowser}=require('../scripts/export-menu-gif');
(async()=>{const site=await startStaticServer();let b;
try{
 b=await startBrowser();const p=b.page;await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await p.send('Page.navigate',{url:site.url+'?intro=0'});
 await p.waitFor('window.Eredita?.MazzeruModel?.ready || window.Eredita?.MazzeruModel?.diagnostics.error',30000);assert.equal((await p.evaluate('Eredita.MazzeruModel.diagnostics')).error,null);
 await p.click('[data-menu-screen="play"]');await p.click('#training-button');
 const folder=path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});
 const result=await p.evaluate(`(()=>{
  const E=Eredita,s=window.omenState=E.GameView.getState();s.phase='running';s.preparationRemaining=0;s.paused=false;s.units=[];s.reinforcementEpoch='omen-browser';E.MythologyEffects.init(s);
  for(const player of Object.values(s.players))for(const v of player.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.residents=[];v.population=0;}
  const v=s.players.blue.villages[1],r=window.omenFarmer=E.Economy.addResident(v,s);r.profession='agriculteur';r.mission='agriculture';r.workPosition=77;r.workPhase='harvesting';
  const soldier=window.omenSoldier=E.Units.create('blue',0,'guerrier',{stance:'defense'});soldier.position=80;s.units.push(soldier);
  E.MythologyEffects.activate(s,{epoch:s.reinforcementEpoch,playerId:'red',legendId:'u-mazzeru',target:{playerId:'red',lane:0},activationId:'omen-model'});
  const m=window.omenMazzeru=s.units.find(u=>u.mythologyLegendId==='u-mazzeru');
  for(let n=0;n<20;n++)E.Combat.update(s,.05);s.paused=true;E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
  window.omenFigures=()=>E.Board3D.getXRContext().world.children[1].children;window.omenFigure=()=>omenFigures().find(f=>f.userData.mazzeru);const f=omenFigure(),a=f.userData.mazzeru;a.attack(m.visualAttackSequence);for(let i=0;i<12;i++)a.tick(.05,false);
  const T=E.Board3D.getXRContext().THREE,model=f.getObjectByName('mazzeru-modele');
  return {hp:m.hp,damage:m.damage,position:m.position,arrow:omenFigures().some(f=>f.name==='fleche-mauvais-presage'),height:new T.Box3().setFromObject(model,true).getSize(new T.Vector3()).y,bow:!!f.getObjectByName('Arc_Mazzeru_Fourni'),action:a.action};
 })()`);
 assert.equal(result.hp,45);assert.equal(result.damage,15);assert.equal(result.position,20);assert.ok(result.arrow&&result.bow);assert.equal(result.action,'Tir');assert.ok(result.height>.5&&result.height<.8,JSON.stringify(result));
 let shot=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,'mazzeru-arrow.png'),Buffer.from(shot.data,'base64'));
 const marked=await p.evaluate(`(()=>{
  const E=Eredita,s=omenState;s.paused=false;for(let n=0;n<400&&!omenFarmer.badOmen;n++)E.Combat.update(s,.05);s.paused=true;E.UI.render(s);E.Board3D.update(s,true);
  const f=omenFigures().find(f=>f.userData.visualKey==='resident-blue-'+omenFarmer.id),hud=f.userData.characterHud,px=hud.canvas.getContext('2d').getImageData(20,52,1,1).data;
  const html=E.CharacterHUD.html(E.Economy.residentStats(s,s.players.blue.villages[1],omenFarmer),false);
  return {both:!!omenFarmer.badOmen&&!!omenSoldier.badOmen,logo:hud.omen.visible,health:hud.health.visible,size:hud.omen.scale.x,ring:hud.floor.scale.x,threshold:hud.group.userData.omenThreshold,pixel:Array.from(px),html};
 })()`);
 assert.ok(marked.both&&marked.logo&&marked.health);assert.equal(marked.threshold,7.5);assert.ok(marked.size<marked.ring*.6);assert.deepEqual(marked.pixel.slice(0,3),[229,35,47]);assert.ok(marked.html.includes('omen-threshold')&&marked.html.includes('width:15%'));
 shot=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,'mazzeru-mark.png'),Buffer.from(shot.data,'base64'));
 const gain=await p.evaluate(`(()=>{const E=Eredita,s=omenState;omenSoldier.hp=omenSoldier.maxHp*.15;E.Combat.settleDeaths(s);E.UI.render(s);E.Board3D.update(s,true);const hud=omenFigure().userData.characterHud;return {hp:omenMazzeru.hp,maxHp:omenMazzeru.maxHp,timer:omenMazzeru.omenGrowthTimer,visible:hud.health.visible};})()`);assert.equal(gain.hp,45);assert.equal(gain.maxHp,60);assert.ok(gain.timer>0&&gain.visible);
 const frozen=await p.evaluate('JSON.stringify(omenState)');await p.evaluate('Eredita.Combat.update(omenState,1)');assert.equal(await p.evaluate('JSON.stringify(omenState)'),frozen);
 shot=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,'mazzeru-growth.png'),Buffer.from(shot.data,'base64'));
 const vampireGain=await p.evaluate(`(()=>{
  const E=Eredita,s=omenState;s.paused=false;
  E.MythologyEffects.activate(s,{epoch:s.reinforcementEpoch,playerId:'red',legendId:'u-surpatore',target:{playerId:'red',lane:1},activationId:'vampire-growth'});
  const vampire=s.units.find(u=>u.mythologyLegendId==='u-surpatore');vampire.hp=0;E.Combat.settleDeaths(s);vampire.position=50;
  const victim=E.Units.create('blue',1,'habitant',{stance:'defense'});Object.assign(victim,{position:52.5,damage:0});s.units.push(victim);
  s.paused=false;E.Combat.update(s,.05);s.paused=true;const key=victim.badOmen?.sourceKey;
  victim.hp=0;E.Combat.settleDeaths(s);E.UI.render(s);E.Board3D.update(s,true);
  const f=omenFigures().find(f=>f.userData.visualKey==='unit-'+vampire.id);
  return {maxHp:vampire.maxHp,hp:vampire.hp,mazzeru:omenMazzeru.maxHp,visible:f.userData.characterHud.health.visible,timer:vampire.omenGrowthTimer,key,html:E.CharacterHUD.html(vampire,true)};
 })()`);
 assert.equal(vampireGain.maxHp,55);assert.equal(vampireGain.hp,40);assert.equal(vampireGain.mazzeru,60);assert.ok(vampireGain.visible&&vampireGain.timer>0);assert.ok(vampireGain.html.includes('omen-growth')&&vampireGain.html.includes('+15 PV max'));
 const pose=await p.evaluate(`(()=>{
  const E=Eredita,T=E.Board3D.getXRContext().THREE,f=E.MazzeruModel.create('red'),a=f.userData.mazzeru;
  const sample=()=>{f.updateMatrixWorld(true);const p=name=>f.getObjectByName(name).getWorldPosition(new T.Vector3()).toArray();return {left:p('mixamorigLeftHand'),right:p('mixamorigRightHand'),foot:p('mixamorigLeftFoot'),arrow:f.getObjectByName('fleche-encochee-mazzeru').visible,glow:f.getObjectByName('lueur-de-tir-mazzeru').visible};};
  const idle=sample();a.attack(1);for(let i=0;i<6;i++)a.tick(.05,false);const raised=sample();for(let i=0;i<8;i++)a.tick(.05,false);const drawn=sample();
  const frozen=a.time;a.tick(.05,true);if(a.time!==frozen)throw Error('Animation non figée');
  for(let i=0;i<2;i++)a.tick(.05,false);const release=sample();for(let i=0;i<15;i++)a.tick(.05,false);const end=a.action;
  a.dispose();f.traverse(p=>{if(!p.userData.sharedGeometry)p.geometry?.dispose();if(Array.isArray(p.material))p.material.forEach(m=>m.dispose());else p.material?.dispose();});
  return {idle,raised,drawn,release,end};
 })()`);
 assert.ok(pose.raised.left[1]-pose.idle.left[1]>.1,'Lève réellement le bras d’arc');
 assert.ok(pose.raised.right[2]-pose.drawn.right[2]>.05,'La main tire réellement la corde vers la joue');
 assert.ok(pose.drawn.arrow&&!pose.release.arrow&&pose.release.glow,'Flèche encochée, décoche et éclair synchronisés');
 assert.ok(Math.hypot(...pose.drawn.foot.map((n,i)=>n-pose.idle.foot[i]))<.001,'Pieds plantés');assert.equal(pose.end,'Repos');
 const preview=await p.evaluate(`(()=>{const E=Eredita,T=E.Board3D.getXRContext().THREE,scene=new T.Scene();scene.background=new T.Color('#d6d0bf');scene.add(new T.HemisphereLight(0xffffff,0x777777,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(2,4,3);scene.add(light);
  [0,1,2,3].forEach(i=>{const f=E.MazzeruModel.create('red');f.position.x=(i-1.5)*.70;f.rotation.y=-.9;scene.add(f);if(i){f.userData.mazzeru.attack(1);for(let n=0;n<[0,6,14,16][i];n++)f.userData.mazzeru.tick(.05,false);}});
  const c=new T.PerspectiveCamera(32,1.8,.01,100);c.position.set(1.4,1.3,4);c.lookAt(0,.3,0);const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,667);renderer.render(scene,c);const png=renderer.domElement.toDataURL('image/png').split(',')[1];renderer.dispose();return png;})()`);fs.writeFileSync(path.join(folder,'mazzeru-bow-animation.png'),Buffer.from(preview,'base64'));
 assert.deepEqual(p.errors,[]);assert.deepEqual(p.badResponses,[]);console.log('Mazzeru : modèle et arc fournis, Tir, flèche en vol, impact, marques travailleurs/troupes, logo, seuil rouge 15 %, bonus attribué à Mazzeru/vampire, bras/corde/décoche, pieds plantés et pause validés.');
}finally{if(b)await b.close();await new Promise(r=>site.server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
