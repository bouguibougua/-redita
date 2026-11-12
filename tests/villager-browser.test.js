'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { startStaticServer, startBrowser, delay } = require('../scripts/export-menu-gif');

async function run() {
  const site = await startStaticServer(); let browser;
  try {
    browser = await startBrowser(); const page = browser.page;
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: site.url + '?intro=0' });
    await page.waitFor("document.readyState==='complete' && window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()");
    await page.waitFor('Eredita.VillagerModel?.ready || Eredita.VillagerModel?.diagnostics.error', 30000);
    // Le plateau doit être visible pour que sa boucle d’animation rende les impacts.
    await page.click('[data-menu-screen="play"]'); await page.click('#training-button');
    const diagnostics = await page.evaluate('Eredita.VillagerModel.diagnostics');
    assert.equal(diagnostics.error, null);
    assert.equal(diagnostics.ready, true);
    assert.ok(diagnostics.triangles > 0 && diagnostics.triangles <= 20000, 'Le villageois utilise le modèle allégé');
    await page.waitFor('Eredita.FarmerModel?.ready', 30000);
    await page.click('[data-menu-screen="play"]');
    await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.evaluate(`(() => {
      const E=Eredita,s=window.vState=E.GameView.getState();
      s.phase='running';s.paused=true;s.preparationRemaining=0;s.elapsed=0;s.unitDeathEffects=[];s.units=[];
      for(const player of Object.values(s.players))for(const v of player.villages){
        v.biome='plaine';v.residents=v.lane===0?v.residents.slice(0,1):[];
        for(const r of v.residents){r.profession='habitant';r.mission='disponible';r.tool=null;r.armor=null;r.unitId=null;r.hp=50;}
      }
      window.vResident=owner=>s.players[owner].villages[0].residents[0];
      s.selectedVillage={playerId:'red',lane:0};s.selectedResidentId=vResident('red').id;
      E.UI.render(s);E.Board3D.update(s,true);E.Board3D.setMode(true);
      document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
      window.vFigures=()=>E.Board3D.getXRContext().world.children[1].children;
      window.vFind=owner=>vFigures().find(f=>!f.userData.dying&&f.userData.visualSignature.startsWith(owner+':'));
      window.vMesh=f=>{let result;f.getObjectByName('habitant-sans-metier').traverse(p=>{if(!result&&p.isMesh)result=p;});return result;};
      window.vRed=vFind('red');window.vBlue=vFind('blue');
      window.vSharedDisposed=0;vMesh(vRed).geometry.addEventListener('dispose',()=>vSharedDisposed++);
    })()`);
    assert.equal(await page.evaluate('vFigures().length'), 2, 'Chaque villageois local apparaît une seule fois');
    assert.equal(await page.evaluate("!!vRed.getObjectByName('habitant-sans-metier') && !!vRed.getObjectByName('equipe-habitant')"), true);
    assert.equal(await page.evaluate('vMesh(vRed).geometry===vMesh(vBlue).geometry'), true, 'Les villageois partagent leur géométrie');
    assert.equal(await page.evaluate('vMesh(vRed).material.map===vMesh(vBlue).material.map'), true, 'Les textures sont partagées');
    assert.equal(await page.evaluate('vMesh(vRed).material===vMesh(vBlue).material'), false, 'Les matériaux restent indépendants pour les effets');
    const dimensions = await page.evaluate(`(() => {
      const E=Eredita,T=E.Board3D.getXRContext().THREE,model=E.VillagerModel.create('red',null,null);
      model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model.getObjectByName('habitant-sans-metier'));
      const result={height:box.max.y-box.min.y,bottom:box.min.y};
      model.traverse(p=>{const ms=Array.isArray(p.material)?p.material:p.material?[p.material]:[];ms.forEach(m=>m.dispose());if(p.geometry&&!p.userData.sharedGeometry)p.geometry.dispose();});
      return result;
    })()`);
    assert.ok(dimensions.height > .50 && dimensions.height < .62, `Échelle cohérente : ${dimensions.height}`);
    assert.ok(Math.abs(dimensions.bottom) < .015, `Les pieds reposent au sol : ${dimensions.bottom}`);
    assert.equal(await page.evaluate("vRed.getObjectByName('selection-halo').visible"), true, 'La sélection reste visible');
    await screenshot(page, 'habitants-3d');
    assert.equal(await page.evaluate("Array.from(document.querySelectorAll('.profession-habitant')).every(el=>getComputedStyle(el).backgroundImage.includes('habitant-v1.webp'))"), true, 'Les portraits utilisent aussi le design fourni');
    assert.equal(await page.evaluate(`(async()=>{const image=new Image();image.src=new URL('assets/generated/habitant-v1.webp',document.baseURI).href;await image.decode();return image.naturalWidth>0;})()`), true);
    await page.evaluate('Eredita.Board3D.setMode(false)');
    await screenshot(page, 'habitants-2d');
    await page.evaluate('Eredita.Board3D.setMode(true)');
    const blueColor = await page.evaluate('vMesh(vBlue).material.color.getHex()');
    await page.evaluate('vMesh(vRed).material.color.setHex(0xff0000)');
    assert.equal(await page.evaluate('vMesh(vBlue).material.color.getHex()'), blueColor, 'Teinter un villageois ne teinte pas son adversaire');

    // Une tâche économique n’attribue aucun métier et garde le modèle fourni.
    await page.evaluate("vResident('red').mission='chasse';vResident('red').workPosition=20;Eredita.Board3D.update(vState,true)");
    assert.equal(await page.evaluate('vFind(\'red\')===vRed'), true);
    assert.equal(await page.evaluate("vRed.userData.profession==='habitant' && !!vRed.getObjectByName('habitant-sans-metier')"), true);
    await page.evaluate("vState.players.red.villages[0].biome='littoral';vResident('red').mission='peche';delete vResident('red').workPosition;Eredita.Board3D.update(vState,true)");
    assert.equal(await page.evaluate('vFind(\'red\')===vRed'), true, 'Pêcher sans métier ne crée pas un pêcheur spécialisé');
    await page.evaluate("vResident('red').profession='agriculteur';Eredita.Board3D.update(vState,true)");
    assert.equal(await page.evaluate("!vFind('red').getObjectByName('habitant-sans-metier') && !!vFind('red').getObjectByName('agriculteur-modele')"), true);
    assert.equal(await page.evaluate('vSharedDisposed'), 0, 'Changer de métier conserve la géométrie du cache');
    await page.evaluate("vResident('red').profession='habitant';vResident('red').tool='fer';vResident('red').armor='maille';vResident('red').donkey=true;Eredita.Board3D.update(vState,true);vRed=vFind('red');void 0");
    assert.equal(await page.evaluate("!!vRed.getObjectByName('habitant-sans-metier') && !!vRed.getObjectByName('armure-maille') && !!vRed.getObjectByName('outil-tete') && !!vRed.getObjectByName('animal-ane')"), true, 'Le villageois importé conserve son équipement et son âne');
    assert.equal(await page.evaluate('vFind(\'blue\')===vBlue'), true);

    // Une mission d’attaque, même en bateau, garde l’apparence sans métier.
    await page.evaluate(`(() => {
      const E=Eredita,r=vResident('red');r.mission='attaque';
      const u=E.Units.create('red',0,'habitant',{residentId:r.id,profession:r.profession,tool:r.tool,armor:r.armor,donkey:r.donkey});
      u.position=45;u.waterTransport='barque';r.unitId=u.id;vState.units=[u];E.Board3D.update(vState,true);vRed=vFind('red');
    })()`);
    assert.equal(await page.evaluate('vFigures().length'), 2, 'Le villageois déployé ne double pas sa figurine locale');
    assert.equal(await page.evaluate("vRed.userData.waterTransport==='barque' && !!vRed.getObjectByName('habitant-sans-metier') && vRed.userData.donkey"), true);
    const originalRules = await page.evaluate('JSON.stringify({units:vState.units,red:vResident(\'red\'),blue:vResident(\'blue\')})');
    await page.evaluate('Eredita.Board3D.update(vState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');
    assert.equal(await page.evaluate('JSON.stringify({units:vState.units,red:vResident(\'red\'),blue:vResident(\'blue\')})'), originalRules, 'Le rendu conserve les données du jeu');
    await page.evaluate('vState.units[0].visualHitSequence=1;vState.units[0].visualHitTimer=.5;Eredita.Board3D.update(vState,true)');
    await page.waitFor('vMesh(vRed).material.color.getHex()!==vMesh(vBlue).material.color.getHex()', 3000);
    assert.equal(await page.evaluate('vMesh(vBlue).material.color.getHex()'), blueColor, 'Le flash d’impact ne se propage pas au villageois bleu');
    await screenshot(page, 'habitants-in-game');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.evaluate('Eredita.Board3D.resize()');
    await screenshot(page, 'habitants-mobile');
    await page.evaluate("vState.units=[];vResident('red').hp=0;vResident('blue').hp=0;vState.unitDeathEffects=[];Eredita.Board3D.update(vState,true)");
    assert.equal(await page.evaluate('vFigures().length'), 0, 'Les figurines retirées sont libérées');
    assert.equal(await page.evaluate('vSharedDisposed'), 0, 'Retirer les instances ne détruit pas le modèle partagé');
    await delay(100);
    assert.equal(page.errors.length, 0, JSON.stringify(page.errors));
    assert.equal(page.consoleErrors.length, 0, JSON.stringify(page.consoleErrors));
    assert.equal(page.badResponses.filter(url=>/\/(assets|js)\//.test(url)).length, 0, JSON.stringify(page.badResponses));
    console.log('Villageois GLB : modèle allégé, géométrie et textures partagées, matériaux indépendants, missions sans métier, changement de métier, équipement, transport, sélection, flash et nettoyage validés.');
  } finally { await browser?.close(); await new Promise(resolve => site.server.close(resolve)); }
}

async function screenshot(page, name) {
  const folder = process.env.EREDITA_VILLAGER_PREVIEW_DIR;
  if (!folder) return;
  fs.mkdirSync(folder, { recursive: true });
  const result = await page.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(folder, name+'.png'), Buffer.from(result.data, 'base64'));
}

run().catch(error => { console.error(error); process.exitCode=1; });
