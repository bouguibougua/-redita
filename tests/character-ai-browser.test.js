'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser}=require('../scripts/export-menu-gif');
(async()=>{const site=await startStaticServer();let b;
try {
 b=await startBrowser();const p=b.page;
 await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await p.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await p.send('Page.navigate',{url:site.url+'?intro=0'});
 await p.waitFor('window.Eredita?.Board3D?.ready && Eredita.FarmerModel?.ready && Eredita.ShepherdModel?.ready');
 await p.click('[data-menu-screen="play"]');await p.click('#training-button');
 const result=await p.evaluate(`(()=>{
  const E=Eredita,s=E.GameView.getState();s.phase='running';s.preparationRemaining=0;s.paused=false;s.units=[];s.reinforcementEpoch='spatial-browser';E.MythologyEffects.init(s);
  for(const player of Object.values(s.players))for(const v of player.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.terrain={};v.residents=[];v.population=0;}
  const v=s.players.red.villages[0];v.buildings=[{type:'bergerie',level:1}];
  for(let i=0;i<4;i++)v.slots[i].content=i<2?{category:'crop',type:'ble',level:1,hp:200,maxHp:200}:{category:'livestock',type:'chevre',count:2,hp:200,maxHp:200,reproductionProgress:0};
  for(let i=0;i<8;i++){const r=E.Economy.addResident(v);E.Economy.assignResidentJob(s,'red',0,r.id,i<4?'agriculture':'elevage');}
  for(const owner of ['red','blue'])for(let i=0;i<5;i++){
    const u=E.Units.create(owner,1,'guerrier');u.position=owner==='red'?40:50;u.terrainOffset=(i-2)*.19;u.hp=u.maxHp=300;s.units.push(u);
  }
  E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
  let collisionChecks=0,attack=false,minClearance=Infinity,harvest=false;const started=performance.now();
  for(let frame=0;frame<2000;frame++){
    E.Economy.updateProduction(s,.05);E.Combat.update(s,.05);
    const all=E.CharacterAI.bodies(s);
    for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
      const clearance=E.CharacterAI.distance(s,all[i].point,all[j].point)-all[i].radius-all[j].radius;
      minClearance=Math.min(minClearance,clearance);collisionChecks++;
      if(clearance<-.00001)throw Error('Chevauchement '+all[i].entity.id+'/'+all[j].entity.id+': '+clearance);
    }
    attack ||= s.units.some(u=>u.visualAttackSequence>0);harvest ||= v.residents.some(r=>r.workPhase==='harvesting');
  }
  const simulationMs=performance.now()-started;
  E.Board3D.update(s,true);E.Economy.updateProduction(s,.05);E.Combat.update(s,.05);E.Board3D.update(s,true);s.paused=true;E.UI.render(s);
  const figures=E.Board3D.getXRContext().world.children[1].children;
  const rendered=v.residents.map(r=>{
    const f=figures.find(f=>f.userData.visualKey==='resident-red-'+r.id),point=E.CharacterAI.residentPoint(s,v,r);
    return {mission:r.mission,phase:r.workPhase,slot:r.targetSlotIndex,x:f.position.x,z:f.position.z,
      expectedX:(v.lane-.5)*E.Config.board.laneSpacing*E.Board.widthScale(s)+point.terrainOffset*E.Board.widthScale(s),expectedZ:E.Board.combatZ(point.position),
      moving:f.userData.locomotionMoving,heading:f.userData.locomotionHeading,rotation:f.rotation.y};
  });
  return {collisionChecks,minClearance,attack,harvest,ble:v.resources.ble,lait:v.resources.lait,rendered,simulationMs};
 })()`);
 assert.ok(result.attack&&result.harvest&&result.ble>0&&result.lait>0,JSON.stringify(result));assert.ok(result.collisionChecks>50000);
 for(const r of result.rendered){assert.ok(Math.abs(r.x-r.expectedX)<1e-7&&Math.abs(r.z-r.expectedZ)<1e-7);if(r.moving)assert.ok(Math.abs(r.rotation-r.heading)<1e-7);}
 const folder=path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});const shot=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,'character-ai-contact.png'),Buffer.from(shot.data,'base64'));
 // Le dernier tirage n'affiche qu'une seule carte sélectionnable.
 await p.evaluate(`window.singlePreview=Eredita.MythologyUI.createCrystalPreview({leftId:'lion-roccapina',rightId:null,mode:'match'})`);
 await p.evaluate(`document.body.append(singlePreview.element);singlePreview.element.style.cssText='position:fixed;inset:0;z-index:9999;background:#16120e;overflow:auto';window.singleSelected=null;singlePreview.element.addEventListener('eredita:mythology-select',e=>window.singleSelected=e.detail.legendId)`);
 await p.waitFor('singlePreview.crystal.diagnostics.ready');
 assert.equal(await p.evaluate("singlePreview.element.querySelectorAll('.mythology-choice').length"),1);
 await p.evaluate('singlePreview.crystal.activate()');await p.waitFor('singlePreview.crystal.diagnostics.cardsProgress>=1');
 await p.click('.mythology-crystal-preview[data-single="true"] .mythology-choice');
 assert.equal(await p.evaluate('singleSelected'),'lion-roccapina');await p.evaluate('singlePreview.dispose();singlePreview.element.remove()');
 assert.deepEqual(p.errors,[]);assert.deepEqual(p.badResponses,[]);assert.deepEqual(p.consoleErrors,[]);
 console.log(JSON.stringify(result,null,2));console.log('Navigateur : collisions, combats, récoltes et livraisons, positions/rotations réelles 3D et choix unique du dernier tirage validés.');
} finally {if(b)await b.close();await new Promise(r=>site.server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
