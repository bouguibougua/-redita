'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { startStaticServer, startBrowser, delay } = require('../scripts/export-menu-gif');
async function run() {
  const site = await startStaticServer(); let browser;
  try {
    browser = await startBrowser(); const page = browser.page;
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: (process.env.EREDITA_TEST_URL || site.url) + '?intro=0' });
    await page.waitFor("document.readyState==='complete' && window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()");
    await page.waitFor('Eredita.FullettuModel?.ready || Eredita.FullettuModel?.diagnostics.error', 25000);
    const diagnostics = await page.evaluate('Eredita.FullettuModel.diagnostics');
    assert.equal(diagnostics.error, null);
    assert.deepEqual(diagnostics.clips.sort(), ['Bonds', 'Mort', 'Recolte', 'Repos']);
    await page.click('[data-menu-screen="play"]'); await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.click('[data-setup-action="keep"][data-player="red"]'); await page.click('#start-game');
    await page.waitFor("Eredita.GameView.getState().phase==='running'"); await page.click('#pause-game');
    const summoned = await page.evaluate(`(() => {
      const E=Eredita,s=window.fState=E.GameView.getState();s.phase='running';s.paused=false;s.preparationRemaining=0;s.elapsed=0;s.units=[];s.unitDeathEffects=[];
      s.reinforcementEpoch='fullettu-model';E.MythologyEffects.init(s);
      for(const p of Object.values(s.players))for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.terrain={};v.burnUntil=0;}
      const accepted=['red','blue'].map(owner=>E.MythologyEffects.activate(s,{epoch:s.reinforcementEpoch,playerId:owner,legendId:'u-fullettu',target:{},activationId:'fullettu-'+owner}).accepted);
      const count=s.units.length,stats=s.units.map(u=>({hp:u.hp,damage:u.damage,speed:u.speed}));
      s.units=[s.units.find(u=>u.ownerId==='red'),s.units.find(u=>u.ownerId==='blue')];
      for(const u of s.units){u.lane=u.originLane=u.lanePosition=0;u.position=u.ownerId==='red'?35:49.5;}
      s.paused=true;E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
      document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      window.fFigures=()=>E.Board3D.getXRContext().world.children[1].children;
      window.fFind=owner=>fFigures().find(f=>f.userData.fullettu&&f.userData.visualSignature.startsWith(owner+':'));
      window.fRed=fFind('red');window.fBlue=fFind('blue');
      window.fMesh=f=>{let mesh;f.traverse(p=>{if(!mesh&&p.isSkinnedMesh)mesh=p;});return mesh;};
      window.fBone=(f,suffix)=>{const T=E.Board3D.getXRContext().THREE;f.updateMatrixWorld(true);return fMesh(f).skeleton.bones.find(b=>b.name.endsWith(suffix)).getWorldPosition(new T.Vector3()).toArray();};
      window.fAdvance=(f,n)=>{for(let i=0;i<n;i++)f.userData.fullettu.tick(.05,false);};
      window.fLamp=f=>{let lamp;f.traverse(p=>{if(p.name.includes('Lanterne')&&p.name.includes('Main_Gauche'))lamp=p;});return lamp;};
      window.fLampDistance=f=>{const T=E.Board3D.getXRContext().THREE;f.updateMatrixWorld(true);return fLamp(f).getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(...fBone(f,'LeftHand')));};
      window.fDisposed=0;fMesh(fRed).geometry.addEventListener('dispose',()=>fDisposed++);
      return {accepted,count,stats,speed:E.Config.reinforcementPowers.fullettuSpeed};
    })()`);
    assert.deepEqual(summoned.accepted, [true, true]); assert.equal(summoned.count, 10);
    assert.ok(summoned.stats.every(u => u.hp === 20 && u.damage === 0 && u.speed === summoned.speed));
    const imported = await page.evaluate(`(() => {
      const E=Eredita,T=E.Board3D.getXRContext().THREE,a=fMesh(fRed),b=fMesh(fBlue),lamp=fLamp(fRed);
      let triangles=0,meshes=0;fRed.getObjectByName('u-fullettu-modele').traverse(p=>{if(p.isMesh){triangles+=(p.geometry.index?.count||p.geometry.attributes.position.count)/3;meshes++;}});
      const ancestors=[];for(let p=lamp.parent;p;p=p.parent)ancestors.push(p.name);
      fRed.updateMatrixWorld(true);fBlue.updateMatrixWorld(true);
      return {count:fFigures().filter(f=>f.userData.fullettu).length,triangles,meshes,
        shared:a.geometry===b.geometry,texturesShared:a.material.map===b.material.map,
        separateMaterials:a.material!==b.material,separateBones:a.skeleton.bones[0]!==b.skeleton.bones[0],
        texture:[a.material.map.image.width,a.material.map.image.height],originalColor:a.material.color.getHex(),
        height:new T.Box3().setFromObject(fRed.getObjectByName('u-fullettu-modele')).getSize(new T.Vector3()).y,
        leftHand:ancestors.some(name=>name.endsWith('LeftHand')),
        teams:[fRed,fBlue].map(f=>f.getObjectByName('equipe-fullettu').material.color.getHex())};
    })()`);
    assert.equal(imported.count, 2); assert.ok(imported.meshes >= 2);
    assert.ok(imported.triangles > 9000 && imported.triangles < 30000);
    assert.ok(imported.shared && imported.texturesShared && imported.separateMaterials && imported.separateBones);
    assert.deepEqual(imported.texture, [2048, 2048]); assert.equal(imported.originalColor, 0xffffff);
    assert.ok(imported.height > .3 && imported.height < .5, `Hauteur importée : ${imported.height}`);
    assert.ok(imported.leftHand); assert.notEqual(imported.teams[0], imported.teams[1]);
    const before = await page.evaluate('JSON.stringify(fState)');
    await page.evaluate('Eredita.Board3D.update(fState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');
    assert.equal(await page.evaluate('JSON.stringify(fState)'), before);
    const folder = path.join(__dirname, '../eredita3D/previews'); fs.mkdirSync(folder, { recursive: true });
    async function screenshot(name) { const r = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(folder, name + '.png'), Buffer.from(r.data, 'base64')); }
    await screenshot('fullettu_in_game');
    const hopping = await page.evaluate(`(() => {
      const a=fBone(fRed,'Hips'),b=fBone(fBlue,'Hips'),lamp=fLampDistance(fRed);
      fRed.userData.fullettu.setMoving(true);fAdvance(fRed,4);
      const result={action:fRed.userData.fullettu.action,before:a,after:fBone(fRed,'Hips'),blueBefore:b,blueAfter:fBone(fBlue,'Hips'),lampBefore:lamp,lampAfter:fLampDistance(fRed)};
      fRed.userData.fullettu.setMoving(false);fAdvance(fRed,4);return result;
    })()`);
    assert.equal(hopping.action, 'Bonds'); assert.ok(hopping.after[1] > hopping.before[1] + .005);
    assert.deepEqual(hopping.blueBefore, hopping.blueAfter); assert.ok(Math.abs(hopping.lampBefore - hopping.lampAfter) < 1e-6);
    const harvest = await page.evaluate(`(() => {
      const E=Eredita,s=fState,u=s.units.find(u=>u.ownerId==='red');u.position=100;u.mythologyGatherTimer=.75;
      for(const p of Object.values(s.players))for(const v of p.villages)for(const r of E.Config.resources)v.resources[r]=0;
      s.players.blue.villages[0].resources.ble=10;
      E.Board3D.update(s,true);E.Board3D.update(s,true);fAdvance(fRed,2);
      const reach=fBone(fRed,'RightHand'),lamp=fLampDistance(fRed),phase=fRed.userData.fullettu.harvestPhase;
      u.mythologyGatherTimer=2.1;E.Board3D.update(s,true);fAdvance(fRed,2);
      return {action:fRed.userData.fullettu.action,reach,behind:fBone(fRed,'RightHand'),bodyZ:fRed.position.z,phase,behindPhase:fRed.userData.fullettu.harvestPhase,lampBefore:lamp,lampAfter:fLampDistance(fRed),bank:s.players.blue.villages[0].resources.ble};
    })()`);
    assert.equal(harvest.action, 'Recolte'); assert.ok(harvest.phase > .24 && harvest.phase < .35);
    assert.ok(harvest.behindPhase > .69 && harvest.behindPhase < .8);
    assert.ok(harvest.reach.some((v, i) => Math.abs(v - harvest.behind[i]) > .02));
    assert.ok(harvest.reach[2] > harvest.bodyZ + .05, 'La main droite atteint devant le corps');
    assert.ok(harvest.behind[2] < harvest.bodyZ - .01, 'La main droite passe derrière le corps');
    assert.ok(Math.abs(harvest.lampBefore - harvest.lampAfter) < 1e-6); assert.equal(harvest.bank, 10);
    await screenshot('fullettu_harvest_in_game');
    const pausedAt = await page.evaluate('fRed.userData.fullettu.time'); await delay(180);
    assert.equal(await page.evaluate('fRed.userData.fullettu.time'), pausedAt);
    const transfer = await page.evaluate(`(() => {
      const E=Eredita,s=fState,u=s.units.find(u=>u.ownerId==='red');u.mythologyGatherTimer=2.9;
      s.paused=false;E.MythologyEffects.update(s,.1);s.paused=true;E.Board3D.update(s,true);
      const result={enemy:s.players.blue.villages[0].resources.ble,home:s.players.red.villages[0].resources.ble,phase:fRed.userData.fullettu.harvestPhase,hp:u.hp,damage:u.damage};
      s.players.blue.villages[0].resources.ble=0;E.Board3D.update(s,true);fAdvance(fRed,3);
      result.emptyAction=fRed.userData.fullettu.action;
      u.position=70;E.Board3D.update(s,true);fAdvance(fRed,3);result.returnAction=fRed.userData.fullettu.action;return result;
    })()`);
    assert.deepEqual(transfer, { enemy: 9, home: 1, phase: 0, hp: 20, damage: 0, emptyAction: 'Repos', returnAction: 'Bonds' });
    const death = await page.evaluate(`(() => {
      const E=Eredita,s=fState,u=s.units.find(u=>u.ownerId==='red');u.hp=0;E.Combat.settleDeaths(s);E.Board3D.update(s,true);fAdvance(fRed,23);
      window.fDeath=s.unitDeathEffects.at(-1);return {legend:fDeath.mythologyLegendId,scale:fRed.scale.x,action:fRed.userData.fullettu.action};
    })()`);
    assert.deepEqual(death, { legend: 'u-fullettu', scale: .65, action: 'Mort' });
    await page.evaluate('fAdvance(fRed,25)'); await page.waitFor('Eredita.FullettuModel.diagnostics.instances===1');
    assert.equal(await page.evaluate('fDisposed'), 0);
    const fallback = await page.evaluate(`(() => {
      const E=Eredita,descriptor=Object.getOwnPropertyDescriptor(E.FullettuModel,'ready');Object.defineProperty(E.FullettuModel,'ready',{get:()=>false,configurable:true});
      E.Board3D.update(fState,true);const simple=!fFind('blue')&&fState.units[0].hp===20;
      Object.defineProperty(E.FullettuModel,'ready',descriptor);E.Board3D.update(fState,true);
      return {simple,restored:!!fFind('blue'),disposed:fDisposed};
    })()`);
    assert.deepEqual(fallback, { simple: true, restored: true, disposed: 0 });
    assert.deepEqual(page.errors, []); assert.deepEqual(page.consoleErrors, []);
    assert.deepEqual(page.badResponses.filter(url => !/favicon/.test(url)), []);
    console.log('U Fullettu : modèle fourni, lanterne gauche, bonds, récolte synchronisée, banque, pause, mort, cache et repli validés.', JSON.stringify(imported));
  } finally { if (browser) await browser.close(); await new Promise(resolve => site.server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
