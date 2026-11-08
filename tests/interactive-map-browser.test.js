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
  await p.waitFor('Eredita.VillageModels.ready&&Eredita.CropModels.ready&&Eredita.VillagerModel.ready',45000);
  await p.click('[data-menu-screen="play"]');await p.click('#training-button');await p.waitFor("Eredita.Network.mode==='solo'");
  await p.evaluate(`(()=>{
    const E=Eredita,s=window.mState=E.GameView.getState();E.AI.update=()=>false;s.phase='running';s.paused=false;s.preparationRemaining=3600;s.units=[];
    for(const player of Object.values(s.players)){player.gold=10000;for(const v of player.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.buildings=[];v.terrain={};v.destroyed=false;for(const key of E.Config.resources)v.resources[key]=1000;}}
    s.selectedVillage={playerId:'red',lane:0};s.selectedResidentId=s.players.red.villages[0].residents[0].id;
    E.Crops.place(s,'red',1,0,'ble');E.UI.render(s);E.Board3D.update(s,true);document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    window.mTile=(lane=0,playerId='red')=>E.Board3D.getXRContext().terrainGroup.children.find(g=>g.userData.playerId===playerId&&g.userData.lane===lane);
    window.mMatch=(a,b)=>a&&Object.entries(b).every(([k,v])=>a[k]===v);
    window.mPoint=target=>{
      const ctx=E.Board3D.getXRContext(),T=ctx.THREE,rect=ctx.renderer.domElement.getBoundingClientRect();ctx.world.updateMatrixWorld(true);
      const roots=[];ctx.world.traverse(o=>{if(o.userData.mapTarget&&mMatch(o.userData.mapTarget,target))roots.push(o);});
      for(const root of roots){
        const box=new T.Box3().setFromObject(root),center=box.getCenter(new T.Vector3()).project(ctx.camera);
        const x=rect.left+(center.x+1)*rect.width/2,y=rect.top+(1-center.y)*rect.height/2;
        for(const radius of [0,4,9,15,24,38,60])for(let i=0;i<(radius?12:1);i++){
          const px=x+Math.cos(i*Math.PI/6)*radius,py=y+Math.sin(i*Math.PI/6)*radius;
          if(mMatch(E.Board3D.targetAt(px,py),target)&&document.elementFromPoint(px,py)===ctx.renderer.domElement)return {x:px,y:py};
        }
      }
      throw new Error('Cible non cliquable : '+JSON.stringify(target));
    };
  })()`);
  await delay(250);
  async function clickTarget(target,touch=false){
    const point=await p.evaluate('mPoint('+JSON.stringify(target)+')');
    if(touch){await p.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await p.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await p.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});}
    return point;
  }
  const target=(kind,lane=1,extra={})=>({kind,playerId:'red',lane,...extra});
  await clickTarget(target('village'));
  assert.equal(await p.evaluate('mState.selectedVillage.lane'),1);
  assert.equal(await p.evaluate("mTile(1).getObjectByName('village-selection-outline').visible"),true);
  assert.equal(await p.evaluate("mTile(0).getObjectByName('village-selection-outline').visible"),false);
  assert.deepEqual(await p.evaluate("[0,1].map(l=>['bergerie','artisanat','boucherie'].every(t=>!!mTile(l).getObjectByName('chantier-'+t)))"),[true,true]);
  await clickTarget(target('slot',1,{slotIndex:0}));
  assert.equal(await p.evaluate("document.querySelector('#map-selection').dataset.kind"),'slot');
  assert.equal(await p.evaluate("document.querySelector('[data-select-slot=\"0\"]').getAttribute('aria-expanded')"),'true');
  await p.click('[data-map-action="upgrade-crop"]');await p.waitFor('mState.players.red.villages[1].slots[0].content.level===2');
  assert.equal(await p.evaluate("mTile(1).getObjectByName('culture-ble').userData.cropVariant"),'moyen');
  assert.equal(await p.evaluate('mState.players.red.villages[0].slots[0].content'),null);
  for(const type of ['bergerie','artisanat','boucherie']){
    await clickTarget(target('building',1,{buildingType:type}));
    assert.match(await p.evaluate("document.querySelector('#map-selection header').textContent"),/Chantier/);
    await p.click('[data-map-action="build"]');await p.waitFor(`mState.players.red.villages[1].buildings.some(b=>b.type==='${type}')`);
    assert.equal(await p.evaluate(`!!mTile(1).getObjectByName('chantier-${type}')`),false);
    assert.equal(await p.evaluate(`!!mTile(1).getObjectByName('batiment-${type}')`),true);
  }
  await clickTarget(target('building',1,{buildingType:'artisanat'}));
  await p.evaluate("(()=>{const s=document.querySelector('[data-map-upgrade-resource]');s.value='raisin';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
  const beforeResource=await p.evaluate('mState.players.red.villages[1].resources.raisin');
  await p.click('[data-map-action="upgrade-building"]');
  assert.equal(await p.evaluate("mState.players.red.villages[1].buildings.find(b=>b.type==='artisanat').level"),2);
  assert.equal(await p.evaluate('mState.players.red.villages[1].resources.raisin'),beforeResource-100);
  const resident=await p.evaluate('mState.players.red.villages[0].residents[1].id');
  await clickTarget(target('resident',0,{residentId:resident}));
  assert.equal(await p.evaluate('mState.selectedResidentId'),resident);assert.equal(await p.evaluate('mState.selectedVillage.lane'),0);
  assert.equal(await p.evaluate("document.querySelector('#map-selection').dataset.kind"),'resident');
  // Le glissement avec plusieurs petits déplacements n’est jamais un clic.
  const point=await p.evaluate('mPoint('+JSON.stringify(target('village',1))+')');const old=await p.evaluate('JSON.stringify(Eredita.MapInteraction.selection)');
  await p.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  for(let i=1;i<=15;i++)await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:point.x+i*2,y:point.y});
  await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x+30,y:point.y});
  assert.equal(await p.evaluate('JSON.stringify(Eredita.MapInteraction.selection)'),old);
  const gold=await p.evaluate('mState.players.blue.gold');
  await clickTarget({kind:'building',playerId:'blue',lane:0,buildingType:'bergerie'});
  assert.equal(await p.evaluate('mState.selectedVillage.playerId'),'red');assert.equal(await p.evaluate('mState.players.blue.gold'),gold);
  // Barre absente à pleine santé, visible dès une blessure, puis masquée après soin.
  const health=await p.evaluate(`(()=>{
    const E=Eredita,s=mState,r=s.players.red.villages[0].residents[1];
    E.Economy.assignResidentMission(s,'red',0,r.id,'attaque','guerrier');E.Board3D.update(s,true);
    const unit=s.units.find(u=>u.residentId===r.id);window.mUnit=unit;
    const figure=()=>E.Board3D.getXRContext().world.children[1].children.find(f=>f.userData.visualKey==='unit-'+unit.id);
    const healthy=figure().userData.characterHud.health.visible,htmlHealthy=E.CharacterHUD.html(unit,true).includes('character-hp');
    unit.hp-=.25;E.Board3D.update(s,true);const wounded=figure().userData.characterHud.health.visible,htmlWounded=E.CharacterHUD.html(unit,true).includes('character-hp');
    unit.hp=unit.maxHp;E.Board3D.update(s,true);const healed=figure().userData.characterHud.health.visible;
    return {healthy,htmlHealthy,wounded,htmlWounded,healed};
  })()`);
  assert.deepEqual(health,{healthy:false,htmlHealthy:false,wounded:true,htmlWounded:true,healed:false});
  await clickTarget(target('resident',0,{residentId:resident}));
  await p.click('[data-map-action="close"]');
  // Toucher un champ ouvre la même fiche.
  await clickTarget(target('slot',1,{slotIndex:0}),true);
  assert.equal(await p.evaluate('Eredita.MapInteraction.selection.slotIndex'),0);
  await p.evaluate('mState.paused=true;Eredita.UI.render(mState)');
  assert.equal(await p.evaluate("document.querySelector('[data-map-action=\"upgrade-crop\"]').disabled"),true);
  await p.evaluate('mState.paused=false;Eredita.UI.render(mState);Eredita.Board3D.setMode(false)');
  await p.click('[data-map-action="close"]');
  await p.click('.region.red[data-lane="1"] [data-slot-visual][data-slot-index="0"]');
  assert.equal(await p.evaluate('Eredita.MapInteraction.selection.kind'),'slot');
  await p.click('[data-map-action="upgrade-crop"]');assert.equal(await p.evaluate('mState.players.red.villages[1].slots[0].content.level'),3);
  await p.click('[data-map-action="close"]');
  await p.click('.region.red[data-lane="0"] [data-terrain-building="bergerie"]');
  assert.match(await p.evaluate("document.querySelector('#map-selection header').textContent"),/Chantier/);
  await p.click('[data-map-action="close"]');
  const resident2D=await p.evaluate('mState.players.red.villages[0].residents[0].id');
  await p.click(`[data-local-resident="${resident2D}"]`);
  assert.equal(await p.evaluate('Eredita.MapInteraction.selection.residentId'),resident2D);
  await p.evaluate("Eredita.MapInteraction.select({kind:'building',playerId:'red',lane:0,buildingType:'bergerie'})");
  const folder=process.env.EREDITA_MAP_PREVIEW_DIR;
  if(folder){fs.mkdirSync(folder,{recursive:true});await p.evaluate('Eredita.Board3D.setMode(true)');await delay(100);const shot=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,'interactive-map.png'),Buffer.from(shot.data,'base64'));}
  await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(150);
  assert.ok(await p.evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'));
  assert.deepEqual(p.errors,[]);assert.deepEqual(p.consoleErrors,[]);assert.deepEqual(p.badResponses.filter(u=>/\/(js|assets|css)\//.test(u)),[]);
  console.log('Carte : clics 3D/2D, toucher, rotation sans sélection, contours, chantiers, achats/améliorations, contrôle allié et PV conditionnels validés.');
 }finally{await browser?.close();await new Promise(r=>site.server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
