'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { startStaticServer, startBrowser, delay } = require('../scripts/export-menu-gif');
(async () => {
  const site = await startStaticServer(); let browser;
  try {
    browser = await startBrowser(); const p = browser.page;
    await p.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
    await p.send('Page.navigate', { url: (process.env.EREDITA_TEST_URL || site.url) + '?intro=0' });
    await p.waitFor('window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()');
    await p.waitFor('Eredita.VillageModels?.ready || Object.values(Eredita.VillageModels?.diagnostics||{}).some(d=>d.error)', 45000);
    const diagnostics = await p.evaluate('Eredita.VillageModels.diagnostics');
    assert.equal(Object.keys(diagnostics).length, await p.evaluate('Object.keys(Eredita.Config.villageModels).length'));
    for (const info of Object.values(diagnostics)) { assert.equal(info.error, null); assert.ok(info.triangles > 0 && info.triangles <= 18000); }
    await p.waitFor('Eredita.VillagerModel?.ready', 30000);
    await p.click('[data-menu-screen="play"]'); await p.click('#training-button');
    await p.waitFor("Eredita.Network.mode==='solo'");
    await p.evaluate(`(()=>{const E=Eredita,s=window.vState=E.GameView.getState();s.phase='running';s.paused=true;s.preparationRemaining=3600;s.units=[];s.unitDeathEffects=[];E.AI.update=()=>false;
      for(const player of Object.values(s.players))for(const v of player.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.buildings=E.Config.building.types.map(type=>({type,level:1,hpBonus:75}));v.hp=375;v.maxHp=425;v.level=1;v.populationMax=15;v.residents=v.residents.slice(0,5);for(const r of v.residents)Object.assign(r,{mission:'disponible',profession:'habitant',unitId:null});}
      s.selectedVillage={playerId:'red',lane:0};s.selectedResidentId=s.players.red.villages[0].residents[0].id;E.UI.render(s);E.Board3D.update(s,true);E.Board3D.setMode(true);document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      window.vRegions=()=>E.Board3D.getXRContext().terrainGroup.children;window.vRegion=(id,lane=0)=>vRegions().find(g=>g.userData.playerId===id&&g.userData.lane===lane);
      window.vFigures=()=>E.Board3D.getXRContext().world.children[1].children;window.vFigure=(id,r)=>vFigures().find(f=>f.userData.visualKey==='resident-'+id+'-'+r.id);
    })()`);
    const geometry = await p.evaluate(`(()=>{const T=Eredita.Board3D.getXRContext().THREE;return vRegions().map(region=>{const courtyard=region.getObjectByName('village-courtyard'),wall=region.getObjectByName('remparts');return {owner:region.userData.playerId,assets:['bergerie_t1','artisanat_t1','boucherie_t1','hotel_t1','feu_camp_t1'].map(key=>{let found=false;courtyard.traverse(o=>{if(o.userData.villageAsset===key)found=true;});return found;}),level:wall.userData.level,hp:wall.userData.villageHp,selectable:wall.userData.xrTarget?.kind,fire:courtyard.getObjectByName('feu-de-camp').visible};});})()`);
    assert.equal(geometry.length, 4);
    for (const g of geometry) { assert.ok(g.assets.every(Boolean), JSON.stringify(g)); assert.equal(g.level, 1); assert.equal(g.hp, 375); assert.equal(g.selectable, 'village'); assert.equal(g.fire, true); }
    const idlePositions = await p.evaluate(`(()=>{const E=Eredita,T=E.Board3D.getXRContext().THREE,cfg=E.Config.villagePresentation;return vRegions().flatMap(region=>{const estate=region.getObjectByName('village-courtyard'),v=vState.players[region.userData.playerId].villages[region.userData.lane];estate.updateMatrixWorld(true);return v.residents.map(r=>{const figure=vFigures().find(f=>f.userData.visualKey==='resident-'+v.ownerId+'-'+r.id)||vFigures().find(f=>f.userData.visualKey==='resident-'+v.ownerId+'-'+r.id);if(!figure)return {missing:r.id};const local=estate.worldToLocal(figure.getWorldPosition(new T.Vector3()));return {inside:Math.abs(local.x)<cfg.wallHalfWidth*1.15&&local.z>cfg.back&&local.z<cfg.front,around:figure.userData.aroundCampfire};});});})()`);
    assert.equal(idlePositions.length, 20); assert.ok(idlePositions.every(r => r.inside && r.around), JSON.stringify(idlePositions));
    // The new button uses the old upgrade command: one price, one level, wounds conserved.
    assert.match(await p.evaluate("document.querySelector('.building-village').textContent"), /Feu de camp T1/);
    await p.evaluate('vState.paused=false;Eredita.UI.render(vState)');
    const gold = await p.evaluate('vState.players.red.gold');
    await p.click('[data-upgrade="village"]');
    assert.equal(await p.evaluate('vState.players.red.villages[0].level'), 2);
    assert.equal(await p.evaluate('vState.players.red.gold'), gold - 300);
    assert.deepEqual(await p.evaluate('(()=>{const v=vState.players.red.villages[0];return [v.hp,v.maxHp,v.populationMax];})()'), [575, 625, 25]);
    await p.evaluate('vState.paused=true;Eredita.Board3D.update(vState,true)');
    assert.equal(await p.evaluate("vRegion('red').getObjectByName('remparts').userData.level"), 2);
    assert.equal(await p.evaluate("vRegion('red').getObjectByName('feu-de-camp').userData.campfireTier"), 2);
    assert.equal(await p.evaluate('vState.players.red.villages[1].level'), 1);
    const assetKeys = (owner,lane=0) => p.evaluate(`(()=>{const keys=[];vRegion('${owner}',${lane}).getObjectByName('village-courtyard').traverse(o=>{if(o.userData.villageAsset)keys.push(o.userData.villageAsset);});return keys;})()`);
    const villageT2 = await assetKeys('red');
    for (const key of ['hotel_t2','feu_camp_t2','bergerie_t1','artisanat_t1','boucherie_t1']) assert.ok(villageT2.includes(key),key);
    assert.match(await p.evaluate("document.querySelector('.campfire-management-image').src"),/feu_camp_t2\.png/);
    await p.evaluate(`vState.paused=false;for(const r of Eredita.Config.resources)vState.players.red.villages[0].resources[r]=1000;Eredita.UI.render(vState)`);
    const buildingGold = await p.evaluate('vState.players.red.gold');
    for (const type of ['bergerie','artisanat','boucherie']) {
      await p.click('[data-building-row="'+type+'"] [data-upgrade]');
      await p.waitFor(`vRegion('red').getObjectByName('batiment-${type}').userData.villageAsset==='${type}_t2'`);
      assert.ok((await assetKeys('red')).includes(type+'_t2'));
      assert.match(await p.evaluate(`getComputedStyle(document.querySelector('[data-building-row="${type}"] .building-thumbnail')).backgroundImage`),new RegExp(type+'_t2\\.png'));
      assert.match(await p.evaluate(`getComputedStyle(document.querySelector('.region.red [data-terrain-building="${type}"]')).backgroundImage`),new RegExp(type+'_t2\\.png'));
    }
    await p.evaluate('vState.paused=true;Eredita.Board3D.update(vState,true)');
    assert.equal(await p.evaluate('vState.players.red.gold'),buildingGold-600);
    assert.deepEqual(await p.evaluate('(()=>{const v=vState.players.red.villages[0];return [v.hp,v.maxHp];})()'),[800,850]);
    const expectedT2=['bergerie_t2','artisanat_t2','boucherie_t2','hotel_t2','feu_camp_t2'];
    for (const key of expectedT2) assert.ok((await assetKeys('red')).includes(key),key);
    assert.ok(!(await assetKeys('red',1)).some(k=>expectedT2.includes(k)),'Le village voisin reste T1');
    const sources=await p.evaluate(`(()=>{const result={};vRegion('red').traverse(o=>{if(o.userData.source_sha256)result[o.userData.village_asset]=o.userData.source_sha256;});return result;})()`);
    const reports=JSON.parse(fs.readFileSync(path.join(__dirname,'../eredita3D/logs/village-t2-validation.json'),'utf8'));
    for(const report of reports)assert.equal(sources[report.name],report.source_sha256,'Le T2 utilise le GLB fourni');
    // Crowded villages keep every idle person in the courtyard.
    await p.evaluate(`(()=>{const E=Eredita,v=vState.players.red.villages[0];while(v.residents.length<35)E.Economy.addResident(v,vState);v.populationMax=35;E.Board3D.update(vState,true);})()`);
    assert.equal(await p.evaluate("vFigures().filter(f=>f.userData.aroundCampfire&&f.userData.visualSignature.startsWith('red:')).length"), 40);
    assert.ok(await p.evaluate(`(()=>{const E=Eredita,T=E.Board3D.getXRContext().THREE,yard=vRegion('red').getObjectByName('village-courtyard'),ids=new Set(vState.players.red.villages[0].residents.map(r=>'resident-red-'+r.id));yard.updateMatrixWorld(true);return vFigures().filter(f=>ids.has(f.userData.visualKey)).every(f=>{const p=yard.worldToLocal(f.getWorldPosition(new T.Vector3()));return Math.abs(p.x)<E.Config.villagePresentation.wallHalfWidth*1.15&&p.z>E.Config.villagePresentation.back&&p.z<E.Config.villagePresentation.front;});})()`),'Les 35 habitants restent dans l’enceinte');
    // Assigned workers leave the fire; a recalled resident comes back to it.
    await p.evaluate(`(()=>{const v=vState.players.red.villages[0];Object.assign(v.residents[0],{mission:'agriculture',workPosition:23,workPhase:'harvesting'});Eredita.Board3D.update(vState,true);})()`);
    assert.equal(await p.evaluate("vFigures().filter(f=>f.userData.aroundCampfire&&f.userData.visualSignature.startsWith('red:')).length"), 39);
    await p.evaluate(`(()=>{const r=vState.players.red.villages[0].residents[0];Object.assign(r,{mission:'disponible',workPosition:null});Eredita.Board3D.update(vState,true);})()`);
    assert.equal(await p.evaluate("vFigures().filter(f=>f.userData.aroundCampfire&&f.userData.visualSignature.startsWith('red:')).length"), 40);
    await p.evaluate(`(()=>{const v=vState.players.red.villages[0];v.terrain={river:true};v.residents[0].mission='peche';Eredita.Board3D.update(vState,true);})()`);
    assert.equal(await p.evaluate("vFigures().filter(f=>f.userData.aroundCampfire&&f.userData.visualSignature.startsWith('red:')).length"),39,'Un pêcheur au bord d’une rivière ne reste pas au feu');
    await p.evaluate("vState.players.red.villages[0].residents[0].mission='disponible';Eredita.Board3D.update(vState,true)");
    // The enemy-facing endpoint is the wall; the central water mapping is unchanged.
    await p.evaluate(`(()=>{const E=Eredita,u=E.Units.create('red',0,'habitant');u.position=100;vState.units=[u];E.Board3D.update(vState,true);})()`);
    assert.ok(await p.evaluate("Math.abs(vFigures().find(f=>f.userData.visualKey.startsWith('unit-')).position.z-2.87)<.001"));
    const hpBefore = await p.evaluate('vState.players.blue.villages[0].hp');
    await p.evaluate('vState.paused=false;vState.preparationRemaining=0;Eredita.Combat.update(vState,1);vState.paused=true;vState.preparationRemaining=3600;Eredita.Board3D.update(vState,true)');
    assert.ok(await p.evaluate('vState.players.blue.villages[0].hp') < hpBefore, 'Les coups à la porte retirent les PV du village existant');
    const before = await p.evaluate('JSON.stringify(vState.players)+JSON.stringify(vState.units)');
    await p.evaluate('Eredita.Board3D.update(vState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');
    assert.equal(await p.evaluate('JSON.stringify(vState.players)+JSON.stringify(vState.units)'), before, 'Le décor ne modifie pas les règles');
    // Destruction shares the existing village state and removes idle residents/fire.
    await p.evaluate("vState.players.blue.villages[0].hp=0;vState.players.blue.villages[0].destroyed=true;Eredita.Board3D.update(vState,true)");
    assert.equal(await p.evaluate("vRegion('blue').getObjectByName('remparts').userData.destroyed"), true);
    assert.equal(await p.evaluate("vRegion('blue').getObjectByName('feu-de-camp').visible"), false);
    assert.equal(await p.evaluate("vFigures().filter(f=>f.userData.visualKey.startsWith('resident-blue-blue-0-')).length"), 0);
    assert.ok(await p.evaluate("vRegion('blue').getObjectByName('remparts').getObjectByName('rempart-avant-gauche').rotation.x< -1"));
    await p.evaluate('vState.paused=false;Eredita.UI.render(vState)');
    await p.click('[data-upgrade="village"]');
    await p.evaluate('vState.paused=true;Eredita.Board3D.update(vState,true)');
    assert.equal(await p.evaluate('vState.players.red.villages[0].level'),3);
    assert.ok((await assetKeys('red')).includes('feu_camp_t2'),'Au T3, le feu garde le dernier modèle fourni');
    assert.ok(!(await assetKeys('red')).includes('hotel_t2'),'L’hôtel T3 garde son apparence propre');
    // All biomes and both board formats keep the courtyard clear and slots outside.
    await p.waitFor('Eredita.PlainTerrain.ready&&Eredita.MountainTerrain.ready&&Eredita.CoastTerrain.ready',30000);
    await p.evaluate(`(()=>{const E=Eredita;Object.assign(vState,E.Board.createState('classic'));vState.phase='running';vState.paused=true;vState.preparationRemaining=3600;
      for(const p of Object.values(vState.players))for(const v of p.villages){v.biome=['montagne','plaine','littoral','plaine'][v.lane];v.slots=E.Biomes.createSlots(v.biome);v.buildings=E.Config.building.types.map(type=>({type,level:1,hpBonus:75}));v.hp=v.maxHp=425;}
      vState.selectedResidentId=vState.players.red.villages[0].residents[0].id;E.UI.render(vState);E.Board3D.update(vState,true);})()`);
    assert.equal(await p.evaluate('vRegions().length'),8);
    assert.ok(await p.evaluate(`(()=>{const T=Eredita.Board3D.getXRContext().THREE,cfg=Eredita.Config.villagePresentation;return vRegions().every(region=>{const yard=region.getObjectByName('village-courtyard');yard.updateMatrixWorld(true);return region.children.filter(o=>o.userData.xrTarget?.kind==='slot').every(o=>yard.worldToLocal(o.getWorldPosition(new T.Vector3())).z>cfg.front);});})()`),'Les emplacements sont devant les remparts dans chaque biome et dans les deux camps');
    assert.equal(await p.evaluate("vFigures().filter(f=>f.userData.aroundCampfire).length"),40);
    for (const [width,height] of [[1920,1080],[390,844]]) {
      await p.send('Emulation.setDeviceMetricsOverride', { width,height,deviceScaleFactor:1,mobile:width<800 }); await delay(300);
      assert.ok(await p.evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'));
    }
    if (process.env.EREDITA_VILLAGE_PREVIEW_DIR) {
      const dir=process.env.EREDITA_VILLAGE_PREVIEW_DIR; fs.mkdirSync(dir,{recursive:true});
      await p.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await delay(250);
      await p.evaluate(`(()=>{const E=Eredita;Object.assign(vState,E.Board.createState('simplified'));vState.phase='running';vState.paused=true;vState.preparationRemaining=180;
        for(const p of Object.values(vState.players))for(const v of p.villages){v.biome=v.lane===0?'montagne':'littoral';v.slots=E.Biomes.createSlots(v.biome);v.level=2;v.populationMax=25;v.buildings=E.Config.building.types.map(type=>({type,level:2,hpBonus:150}));v.hp=v.maxHp=850;}
        vState.selectedResidentId=vState.players.red.villages[0].residents[0].id;E.UI.render(vState);E.Board3D.update(vState,true);})()`);
      await delay(200);
      const shot=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'village-jeu.png'),Buffer.from(shot.data,'base64'));
      await p.evaluate(`(()=>{const c=Eredita.Board3D.getXRContext();c.renderer.setAnimationLoop(null);c.camera.position.set(-.25,4.1,.65);c.camera.lookAt(-1.725,.15,-3.85);c.renderer.render(c.scene,c.camera);})()`);
      const clip=await p.evaluate("(()=>{const r=document.querySelector('#battlefield-3d canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1};})()");
      const close=await p.send('Page.captureScreenshot',{format:'png',clip});fs.writeFileSync(path.join(dir,'cour-village.png'),Buffer.from(close.data,'base64'));

    }
    assert.deepEqual(p.errors,[]);assert.deepEqual(p.consoleErrors,[]);assert.deepEqual(p.badResponses.filter(u=>/\/(assets|js|css)\//.test(u)),[]);
    console.log('Villages : modèles T1/T2 fournis, achats et améliorations indépendantes, provenance, portraits, remparts, habitants au feu, PV, destruction, rendu XR et responsive validés.');
  } finally { await browser?.close(); await new Promise(r=>site.server.close(r)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
