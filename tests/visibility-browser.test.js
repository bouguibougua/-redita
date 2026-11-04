'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser,delay}=require('../scripts/export-menu-gif');
(async()=>{
 const site=await startStaticServer();let browser;
 try{
  browser=await startBrowser();const page=browser.page;
  await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await page.send('Page.navigate',{url:(process.env.EREDITA_TEST_URL||site.url)+'?intro=0'});
  await page.waitFor('window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()');
  await page.click('[data-menu-screen="play"]');await page.click('#training-button');await page.waitFor("Eredita.Network.mode==='solo'");
  await page.evaluate(`(()=>{const E=Eredita,s=window.visibilityState=E.GameView.getState();s.phase='running';s.preparationRemaining=3600;s.paused=false;s.units=[];
   E.MythologyEffects.init(s);E.MythologySession.start(s);for(const p of Object.values(s.players)){p.revealEnemyStats=false;p.gold=5000;for(const v of p.villages){v.resources.ble=p.id==='red'?123:987;v.buildings=[];for(const r of v.residents)Object.assign(r,{hp:50,unitId:null,mission:'disponible'});E.Buildings.buildT1(s,p.id,v.lane,'artisanat');v.buildings[0].level=3;}}
   E.Equipment.buy(s,'red',0,'tools','bois');E.Equipment.buy(s,'red',0,'armors','cuir');E.Equipment.buy(s,'red',1,'tools','bronze');E.Equipment.buy(s,'red',1,'armors','maille');E.Equipment.buy(s,'blue',0,'tools','fer');E.Equipment.buy(s,'blue',0,'armors','fer');
   s.players.blue.villages[0].hp=173;E.Economy.deployResident(s,'blue',0,s.players.blue.villages[0].residents[0].id,'attaque');E.UI.render(s);E.Board3D.update(s,true);E.Board3D.setMode(true);})()`);
  const camp=id=>`[data-map-camp="${id}"]`,village=(id,lane=0)=>`[data-map-village][data-player="${id}"][data-lane="${lane}"]`;
  assert.equal(await page.evaluate("document.querySelector('#map-village-popups').children.length"),6);
  assert.equal(await page.evaluate(`document.querySelector('${camp('blue')} [data-camp-gold]').textContent`),'3 800');
  assert.equal(await page.evaluate(`document.querySelector('${village('blue')} [data-map-hp]').textContent`),'173/275');
  assert.equal(await page.evaluate(`document.querySelector('${camp('blue')} [data-camp-hp]').textContent`),'448/550');
  assert.equal(await page.evaluate(`document.querySelector('${village('blue')} [data-map-population]').textContent`),'?');
  assert.equal(await page.evaluate(`document.querySelector('${village('blue')} [data-map-resource=ble]').textContent`),'?');
  assert.equal(await page.evaluate(`document.querySelector('${village('red')} [data-map-resource=ble]').textContent`),'123');
  for(const [id,lane,tools,armor]of[['red',0,1,1],['red',1,2,2],['blue',0,3,3],['blue',1,0,0]]){
   assert.deepEqual(await page.evaluate(`Array.from(document.querySelector('${camp(id)} [data-equipment-lane="${lane}"]').querySelectorAll('.hud-pips')).map(p=>({all:p.children.length,lit:p.querySelectorAll('.is-lit').length}))`),[{all:3,lit:tools},{all:3,lit:armor}]);
  }
  assert.equal(await page.evaluate("!!document.querySelector('.units-layer .unit.blue')"),true,'Les unités adverses restent visibles');
  assert.equal(await page.evaluate("document.querySelectorAll('.mythology-terrain-fog').length"),0);
  assert.equal(await page.evaluate("Eredita.GameView.selectVillage('blue',0)"),false);assert.equal(await page.evaluate("Eredita.GameView.villageInfo('blue',0)"),null);
  await page.waitFor('Eredita.MythologySession.diagnostics.crystal?.ready');
  await page.click('.mythology-match-widget .mythology-crystal-stage');await page.waitFor('Eredita.MythologySession.diagnostics.crystal.cardsProgress===1',10000);
  await page.click('.mythology-match-widget .mythology-choice[data-side=left]');await page.waitFor('Eredita.MythologySession.diagnostics.privateView.selections.length===1');
  await page.evaluate('Eredita.UI.renderFrame(visibilityState)');
  assert.equal(await page.evaluate(`document.querySelector('${camp('red')} [data-camp-legends]').textContent`),'1');
  assert.equal(await page.evaluate(`document.querySelector('${camp('red')} .hud-crystal').style.getPropertyValue('--gem-color')===Eredita.Mythology.get(Eredita.MythologySession.diagnostics.privateView.selections[0].legendId).visuals.primaryColor`),true);
  assert.equal(await page.evaluate(`document.querySelector('${camp('red')} [data-camp-crystals]').textContent`),'','Les cristaux ne donnent aucun nom');
  async function screenshot(name){if(!process.env.EREDITA_STATS_PREVIEW_DIR)return;fs.mkdirSync(process.env.EREDITA_STATS_PREVIEW_DIR,{recursive:true});const shot=await page.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(process.env.EREDITA_STATS_PREVIEW_DIR,name+'.png'),Buffer.from(shot.data,'base64'));}
  await screenshot('stats-publiques');
  await page.evaluate("window.ownHud=document.querySelector('[data-map-village]');visibilityState.players.red.villages[0].resources.ble=124;Eredita.UI.renderFrame(visibilityState)");assert.equal(await page.evaluate("ownHud===document.querySelector('[data-map-village]')"),true,'Mises à jour sans recréer les fiches');
  await page.evaluate("Eredita.MythologyEffects.activate(visibilityState,{epoch:visibilityState.reinforcementEpoch,playerId:'red',legendId:'oeil-sainte-lucie',target:{},activationId:'browser-eye'});Eredita.UI.renderFrame(visibilityState)");
  assert.equal(await page.evaluate(`document.querySelector('${village('blue')} [data-map-resource=ble]').textContent`),'987');
  assert.equal(await page.evaluate(`document.querySelector('${village('blue')} [data-map-population]').textContent`),'5/15');
  assert.equal(await page.evaluate("Eredita.GameView.villageInfo('blue',0).resources[0].amount"),987);
  assert.equal(await page.evaluate("Eredita.GameView.selectVillage('blue',0)"),false,'Révélation sans contrôle adverse');
  await page.evaluate("visibilityState.players.blue.villages[0].resources.ble=988;Eredita.UI.renderFrame(visibilityState)");assert.equal(await page.evaluate(`document.querySelector('${village('blue')} [data-map-resource=ble]').textContent`),'988');
  await screenshot('stats-revelees');
  await page.evaluate(`(()=>{window.networkDescriptors={mode:Object.getOwnPropertyDescriptor(Eredita.Network,'mode'),playerId:Object.getOwnPropertyDescriptor(Eredita.Network,'playerId')};Object.defineProperty(Eredita.Network,'mode',{value:'guest',configurable:true});Object.defineProperty(Eredita.Network,'playerId',{value:'blue',configurable:true});visibilityState.selectedVillage={playerId:'blue',lane:0};Eredita.UI.render(visibilityState);})()`);
  assert.equal(await page.evaluate(`document.querySelector('${village('red')} [data-map-resource=ble]').textContent`),'?','Bleu ne reçoit pas la révélation de Rouge');
  assert.equal(await page.evaluate(`document.querySelector('${village('blue')} [data-map-resource=ble]').textContent`),'988');
  await page.evaluate(`(()=>{Object.defineProperty(Eredita.Network,'mode',networkDescriptors.mode);Object.defineProperty(Eredita.Network,'playerId',networkDescriptors.playerId);visibilityState.selectedVillage={playerId:'red',lane:0};Eredita.UI.render(visibilityState);})()`);
  for(const[width,height]of[[1440,900],[390,844],[320,568],[844,390]]){
   await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<801});await delay(200);
   const boxes=await page.evaluate("Array.from(document.querySelector('#map-village-popups').children).map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,overflow:e.scrollHeight-e.clientHeight}})");
   assert.equal(boxes.length,6);for(const r of boxes)assert.ok(r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1&&r.width>0&&r.height>0,`${width}×${height} ${JSON.stringify(r)}`);
   for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++)assert.ok(boxes[a].right<=boxes[b].x||boxes[b].right<=boxes[a].x||boxes[a].bottom<=boxes[b].y||boxes[b].bottom<=boxes[a].y,'Fiches sans chevauchement');
   assert.equal(await page.evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),true);await screenshot('stats-'+width+'x'+height);
  }
  assert.deepEqual(page.errors,[]);assert.deepEqual(page.consoleErrors,[]);assert.deepEqual(page.badResponses.filter(u=>/\/(assets|js|css)\//.test(u)),[]);
  console.log('Six fiches, PV/or publics, six indicateurs par village, cristaux sans noms, statistiques masquées/révélées en direct, droits Rouge/Bleu et responsive validés.');
 }finally{await browser?.close();await new Promise(r=>site.server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
