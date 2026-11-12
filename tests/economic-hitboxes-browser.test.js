'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser}=require('../scripts/export-menu-gif');
(async()=>{const site=await startStaticServer();let b;
try{
 b=await startBrowser();const p=b.page;await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await p.send('Page.navigate',{url:site.url+'?intro=0'});await p.waitFor('window.Eredita?.Board3D?.ready && Eredita.RavagerModel?.ready && Eredita.LupuModel?.ready');
 await p.click('[data-menu-screen="play"]');await p.click('#training-button');
 const checks=await p.evaluate(`(()=>{
  const E=Eredita,s=window.contactState=E.GameView.getState();s.phase='running';s.preparationRemaining=0;s.paused=false;s.reinforcementEpoch='contacts';s.units=[];E.MythologyEffects.init(s);
  for(const player of Object.values(s.players))for(const v of player.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.residents=[];v.population=0;}
  E.Crops.place(s,'blue',0,0,'ble');E.Livestock.place(s,'blue',1,0,'chevre');
  E.Buildings.buildT1(s,'blue',1,'bergerie');for(let i=0;i<3;i++)E.Livestock.buy(s,'blue',1,'chevre');
  const ravager=E.Units.create('red',0,'ravageur',{profession:'ravageur'});s.units.push(ravager);
  E.MythologyEffects.activate(s,{epoch:s.reinforcementEpoch,playerId:'red',legendId:'u-lupu-mannaru',target:{playerId:'red',lane:1},activationId:'wolf'});
  // Sans habitant disponible, l’invocation attend une naissance : la créer par le crochet réel.
  E.Economy.addResident(s.players.red.villages[1],s);
  const wolf=s.units.find(u=>u.mythologyLegendId==='u-lupu-mannaru');if(!wolf)throw Error('Lupu absent');
  const units=[ravager,wolf];units.forEach(u=>{const v=s.players.blue.villages[u.lane];u.position=E.Board.slotHitbox(s,v,0).position-12;});
  for(let n=0;n<1000 && units.some(u=>!u.visualAttackSequence);n++)E.Combat.update(s,.05);
  s.paused=true;E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
  const world=E.Board3D.getXRContext().world,T=E.Board3D.getXRContext().THREE;
  return units.map(u=>{
   const f=world.children[1].children.find(f=>f.userData.visualKey==='unit-'+u.id);
   const region=world.children[0].children.find(g=>g.userData.playerId==='blue'&&g.userData.lane===u.lane);
   const marker=region.children.find(g=>g.geometry?.type==='CylinderGeometry'&&g.userData.mapTarget?.slotIndex===0);
   region.updateMatrixWorld(true);const center=marker.getWorldPosition(new T.Vector3());
   const box=E.Board.slotHitbox(s,s.players.blue.villages[u.lane],0),distance=Math.hypot(f.position.x-center.x,f.position.z-center.z);
   const a=f.userData.ravager||f.userData.lupu;a.attack(u.visualAttackSequence);for(let i=0;i<5;i++)a.tick(.05,false);
   return {legend:u.mythologyLegendId||null,distance,reach:box.radius+E.Config.economicHitboxes.contactReach,
    hp:s.players.blue.villages[u.lane].slots[0].content?.hp,sequence:u.visualAttackSequence,action:a.action,
    targetX:E.Config.board.laneSpacing*E.Board.widthScale(s)*(u.lane-.5)+u.visualAttackTarget.terrainOffset*E.Board.widthScale(s),markerX:center.x,
    face:Math.sin(f.rotation.y)*(center.x-f.position.x)+Math.cos(f.rotation.y)*(center.z-f.position.z)};
  });
 })()`);
 for(const c of checks){assert.ok(c.distance<=c.reach+1e-6,JSON.stringify(c));assert.ok(c.sequence>0&&c.face>0);assert.ok(Math.abs(c.targetX-c.markerX)<1e-6);}
 const folder=path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});const shot=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,'economic-hitboxes-contact.png'),Buffer.from(shot.data,'base64'));
 assert.deepEqual(p.errors,[]);assert.deepEqual(p.badResponses,[]);console.log(JSON.stringify(checks,null,2));console.log('Contacts 3D vérifiés sur les vrais marqueurs : Ravageur sur champ, Lupu sur élevage, orientation et animation de frappe.');
}finally{if(b)await b.close();await new Promise(r=>site.server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
