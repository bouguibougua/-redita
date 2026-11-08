'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser,delay}=require('../scripts/export-menu-gif');
(async()=>{
 const site=await startStaticServer();let browser;
 try{
  browser=await startBrowser();const p=browser.page;
  await p.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  await p.send('Page.navigate',{url:(process.env.EREDITA_TEST_URL||site.url)+'?intro=0'});
  await p.waitFor('window.Eredita?.Board3D?.ready&&Eredita.GameView?.getState()');
  await p.waitFor('Eredita.VillageModels.ready&&Eredita.CropModels.ready&&Eredita.FarmerModel.ready',45000);
  await p.click('[data-menu-screen="play"]');await p.click('#training-button');await p.waitFor("Eredita.Network.mode==='solo'");
  await p.evaluate(`(()=>{const E=Eredita,s=window.pState=E.GameView.getState();E.AI.update=()=>false;s.phase='running';s.preparationRemaining=3600;s.units=[];s.paused=false;
    for(const player of Object.values(s.players))for(const v of player.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.buildings=[];v.terrain={};v.destroyed=false;}
    E.Crops.place(s,'red',0,0,'ble');E.Crops.place(s,'red',0,1,'chataignier');E.Crops.place(s,'blue',0,0,'ble');
    s.players.red.villages[0].slots[1].content.hp=80;s.players.blue.villages[0].slots[0].content.hp=30;
    E.MythologySession.start(s);E.UI.render(s);E.Board3D.update(s,true);document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    window.pTile=(owner='red',lane=0)=>E.Board3D.getXRContext().terrainGroup.children.find(g=>g.userData.playerId===owner&&g.userData.lane===lane);
    window.pRings=()=>{const values=[];pTile().traverse(o=>{if(o.name==='crop-health-ring')values.push(o.userData.healthRatio)});return values;};
  })()`);
  assert.deepEqual(await p.evaluate('pRings()'),[1,.4]);
  const ring=await p.evaluate(`(()=>{let ring;pTile().traverse(o=>{if(o.userData.cropHealthSlot===0)ring=o;});window.pRing=ring;const fill=ring.getObjectByName('crop-health-fill');return {count:fill.geometry.drawRange.count,color:fill.material.color.getHex()};})()`);
  assert.equal(ring.count,384);assert.equal(ring.color,0x77d580);
  await p.evaluate('pState.players.red.villages[0].slots[0].content.hp=40;Eredita.Board3D.update(pState);Eredita.UI.renderFrame(pState)');
  assert.equal(await p.evaluate('pRing.userData.healthRatio'),.2);
  assert.equal(await p.evaluate("pRing.getObjectByName('crop-health-fill').material.color.getHex()"),0xe86956);
  assert.equal(await p.evaluate("document.querySelector('.region.red[data-lane=\"0\"] .slot.crop').style.getPropertyValue('--crop-health')"),'20%');
  for(const owner of ['red','blue']){
    const summary=await p.evaluate(`Eredita.MythologySession.getPublicSummary(pState,'${owner}')`);assert.ok(summary.pendingColors.length>0);
    const colors=await p.evaluate(`Array.from(document.querySelectorAll('[data-map-camp="${owner}"] .pending-crystal')).map(el=>Array.from(el.querySelectorAll('path')).slice(0,2).map(p=>p.style.fill))`);
    assert.equal(colors.length,summary.pendingColors.length);assert.ok(colors.every(pair=>pair.length===2&&pair.every(Boolean)));
  }
  assert.equal(await p.evaluate("['bergerie','artisanat','boucherie'].every(type=>!!pTile().getObjectByName('chantier-'+type))"),true);
  await p.evaluate("Eredita.MapInteraction.select({kind:'building',playerId:'red',lane:0,buildingType:'bergerie'})");await p.click('[data-map-action="build"]');
  assert.equal(await p.evaluate("!!pTile().getObjectByName('chantier-bergerie')"),false);
  await p.evaluate(`(()=>{const E=Eredita,s=pState,v=s.players.red.villages[0],r=window.pFarmer=v.residents[0];E.Economy.assignResidentMission(s,'red',0,r.id,'agriculture');r.workPosition=2;r.workPhase='toVillage';r.carrying={resource:'ble',amount:3};s.preparationRemaining=0;
    const foe=E.Units.create('blue',0,'habitant',{stance:'defense'});foe.position=3;s.units=[foe];E.Combat.update(s,.1);s.preparationRemaining=3600;E.UI.render(s);E.Board3D.update(s,true);})()`);
  assert.equal(await p.evaluate("Eredita.Board3D.getXRContext().world.children[1].children.find(f=>f.userData.visualKey==='unit-'+pFarmer.unitId).userData.characterHud.health.visible"),true);
  assert.equal(await p.evaluate("!!document.querySelector('.units-layer [data-unit-id=\"'+pFarmer.unitId+'\"]')"),true);
  const folder=process.env.EREDITA_PROXIMITY_PREVIEW_DIR;
  if(folder){fs.mkdirSync(folder,{recursive:true});await p.evaluate('pState.selectedResidentId=pFarmer.id;Eredita.UI.render(pState);Eredita.Board3D.update(pState)');await delay(150);
    const shot=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,'proximity-map.png'),Buffer.from(shot.data,'base64'));
    const png=await p.evaluate(`(()=>{const T=Eredita.Board3D.getXRContext().THREE,scene=new T.Scene();scene.background=new T.Color('#211c14');scene.add(new T.HemisphereLight(0xffebcf,0x655342,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(-2,5,5);scene.add(light);['bergerie','artisanat','boucherie'].forEach((type,i)=>{const g=Eredita.ConstructionSites.create(T,type);g.position.x=(i-1)*.9;scene.add(g);});const camera=new T.OrthographicCamera(-1.5,1.5,.6,-.6,.01,20);camera.position.set(.9,1.5,5);camera.lookAt(0,.2,0);const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,480);renderer.render(scene,camera);const url=renderer.domElement.toDataURL();renderer.dispose();return url;})()`);
    fs.writeFileSync(path.join(folder,'construction-signs.png'),Buffer.from(png.split(',')[1],'base64'));
  }
  assert.deepEqual(p.errors,[]);assert.deepEqual(p.consoleErrors,[]);assert.deepEqual(p.badResponses.filter(u=>/\/(js|assets|css)\//.test(u)),[]);
  console.log('Carte : chantiers avec panneaux, construction, cristaux bicolores publics, anneaux de PV des cultures et agriculteur en défense validés.');
 }finally{await browser?.close();await new Promise(r=>site.server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
