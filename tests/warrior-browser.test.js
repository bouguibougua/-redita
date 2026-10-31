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
    await page.waitFor('window.Eredita?.GameView?.getState() && Eredita.Board3D?.ready && Eredita.MenuScene?.diagnostics.ready');
    await page.waitFor('Eredita.WarriorModel?.ready', 25000);
    assert.deepEqual((await page.evaluate('Eredita.WarriorModel.diagnostics.clips')).sort(), ['Coup_Droit', 'Marche', 'Repos', 'Revers']);
    await page.click('[data-menu-screen="play"]');
    await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.evaluate(`(() => {
      const E=Eredita,s=window.wState=E.GameView.getState();
      s.phase='running';s.paused=true;s.preparationRemaining=0;s.elapsed=0;s.unitDeathEffects=[];s.units=[];
      for(const player of Object.values(s.players))for(const v of player.villages){
        v.biome='plaine';v.residents=v.lane===0?v.residents.slice(0,1):[];
        for(const r of v.residents){r.profession='guerrier';r.mission='attaque';r.tool='fer';r.armor=null;r.hp=70;}
      }
      for(const owner of ['red','blue']){
        const r=s.players[owner].villages[0].residents[0];
        const u=E.Units.create(owner,0,'guerrier',{residentId:r.id,profession:r.profession,tool:r.tool});
        r.unitId=u.id;u.position=owner==='red'?50:52;s.units.push(u);
      }
      E.UI.render(s);E.Board3D.update(s,true);E.Board3D.setMode(true);
      document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
      window.wFigures=()=>E.Board3D.getXRContext().world.children[1].children;
      window.wFind=owner=>wFigures().find(f=>f.userData.profession==='guerrier'&&f.userData.visualSignature.startsWith(owner+':'));
      window.wRed=wFind('red');window.wBlue=wFind('blue');
      window.wMesh=f=>{let result;f.traverse(p=>{if(!result&&p.isSkinnedMesh)result=p;});return result;};
      window.wBlade=f=>{let blade;f.getObjectByName('Epee_Acier').traverse(p=>{if(!blade&&p.isSkinnedMesh)blade=p;});return blade;};
      window.wTip=f=>{
        const ctx=E.Board3D.getXRContext(),blade=wBlade(f),a=blade.geometry.attributes.position;
        let index=0;for(let i=1;i<a.count;i++)if(a.getZ(i)>a.getZ(index))index=i;
        f.updateMatrixWorld(true);blade.skeleton.update();
        return blade.getVertexPosition(index,new ctx.THREE.Vector3()).applyMatrix4(blade.matrixWorld).toArray();
      };
      window.wAdvance=(f,steps)=>{for(let i=0;i<steps;i++)f.userData.warrior.tick(.04,false);};
      window.wStrike=delta=>{s.paused=false;E.Combat.update(s,delta);s.paused=true;E.Board3D.update(s,true);};
      window.wSharedDisposed=0;wMesh(wRed).geometry.addEventListener('dispose',()=>wSharedDisposed++);
    })()`);
    assert.equal(await page.evaluate('wFigures().filter(f=>f.userData.profession===\'guerrier\').length'), 2);
    assert.equal(await page.evaluate("Boolean(wRed.getObjectByName('guerrier-corse')) && !wRed.getObjectByName('casque-guerrier')"), true);
    assert.equal(await page.evaluate('wMesh(wRed).geometry===wMesh(wBlue).geometry'), true, 'La géométrie est partagée');
    assert.equal(await page.evaluate('wMesh(wRed).material===wMesh(wBlue).material'), false, 'Les matériaux restent indépendants');
    assert.equal(await page.evaluate('wMesh(wRed).skeleton.bones[0]===wMesh(wBlue).skeleton.bones[0]'), false, 'Chaque guerrier a son squelette');
    const hp = await page.evaluate('wState.units.map(u=>u.hp)');
    const damage = await page.evaluate('wState.units.map(u=>u.damage)');
    await page.evaluate('wStrike(.01)');
    assert.deepEqual(await page.evaluate('wState.units.map(u=>u.hp)'), [hp[0]-damage[1], hp[1]-damage[0]], 'Les dégâts restent ceux du moteur');
    assert.equal(await page.evaluate('wRed.userData.warrior.action'), 'Coup_Droit');
    await page.evaluate('wAdvance(wRed,3)');
    const forwardStart = await page.evaluate('wTip(wRed)');
    const blueBefore = await page.evaluate('wTip(wBlue)');
    const pausedAt = await page.evaluate('wRed.userData.warrior.time');
    await delay(250);
    assert.equal(await page.evaluate('wRed.userData.warrior.time'), pausedAt, 'La pause fige le squelette');
    await page.evaluate('wAdvance(wRed,5)');
    const forwardEnd = await page.evaluate('wTip(wRed)');
    assert.deepEqual(await page.evaluate('wTip(wBlue)'), blueBefore, 'Animer le rouge ne déforme pas le bleu');
    await screenshot(page, 'coup-droit');
    await page.evaluate('wAdvance(wRed,14)');
    assert.equal(await page.evaluate('wRed.userData.warrior.action'), 'Repos', 'Le coup revient en garde');
    await page.evaluate('wStrike(1)');
    assert.equal(await page.evaluate('wRed.userData.warrior.action'), 'Revers');
    assert.deepEqual(await page.evaluate('wState.units.map(u=>u.hp)'), [hp[0]-2*damage[1], hp[1]-2*damage[0]]);
    await page.evaluate('wAdvance(wRed,3)');
    const reverseStart = await page.evaluate('wTip(wRed)');
    await page.evaluate('wAdvance(wRed,5)');
    const reverseEnd = await page.evaluate('wTip(wRed)');
    const forwardDirection = forwardEnd[0]-forwardStart[0], reverseDirection = reverseEnd[0]-reverseStart[0];
    assert.ok(Math.abs(forwardDirection)>.02 && Math.abs(reverseDirection)>.02 && forwardDirection*reverseDirection<0,
      `Les deux lames traversent en sens opposés : ${forwardDirection}, ${reverseDirection}`);
    await screenshot(page, 'revers');

    await page.evaluate(`(() => {
      wState.players.red.villages[0].residents[0].tool='bronze';
      wState.players.red.villages[0].residents[0].armor='maille';
      Eredita.Board3D.update(wState,true);wRed=wFind('red');
    })()`);
    assert.equal(await page.evaluate('wSharedDisposed'), 0, 'L’équipement ne détruit pas la géométrie du cache');
    assert.equal(await page.evaluate("Boolean(wRed.getObjectByName('armure-maille'))"), true);
    assert.equal(await page.evaluate('Eredita.WarriorModel.diagnostics.instances'), 2);
    assert.equal(await page.evaluate('wFind(\'blue\')===wBlue'), true);
    await page.evaluate(`(() => {
      const resident=wState.players.red.villages[0].residents[0];resident.donkey=true;
      wState.units[0].waterTransport='barque';Eredita.Board3D.update(wState,true);wRed=wFind('red');
    })()`);
    assert.equal(await page.evaluate("wRed.userData.waterTransport==='barque' && wRed.userData.donkey && !!wRed.getObjectByName('guerrier-corse')"), true);

    // Une figurine locale conserve aussi le modèle du métier, sans unité déployée.
    await page.evaluate(`(() => {
      wState.units[0].waterTransport=null;wState.units[0].position=20;
      Eredita.Board3D.update(wState,true);wRed=wFind('red');
      wState.units[0].position=21;Eredita.Board3D.update(wState,true);
      wAdvance(wRed,24); // La marche prend le relais après la fin de l'attaque en cours.
    })()`);
    assert.equal(await page.evaluate('wRed.userData.warrior.action'), 'Marche');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.evaluate('Eredita.Board3D.resize()');
    await screenshot(page, 'mobile');
    await page.evaluate(`(() => {
      const dead=wState.units.shift();wState.players.red.villages[0].residents[0].hp=0;
      wState.unitDeathEffects=[{...dead,id:771,unitId:dead.id}];
      Eredita.Board3D.update(wState,true);
    })()`);
    await page.waitFor('Eredita.WarriorModel.diagnostics.instances===1', 6000);
    assert.equal(await page.evaluate('wSharedDisposed'), 0, 'La mort ne détruit pas la géométrie de l’autre guerrier');
    await page.evaluate(`(() => {
      wState.units=[];wState.unitDeathEffects=[];
      wState.players.blue.villages[0].residents[0].hp=0;
      Eredita.Board3D.update(wState,true);
    })()`);
    assert.equal(await page.evaluate('Eredita.WarriorModel.diagnostics.instances'), 0, 'Les mixers et squelettes sont libérés');
    assert.equal(page.errors.length, 0, JSON.stringify(page.errors));
    assert.equal(page.consoleErrors.length, 0, JSON.stringify(page.consoleErrors));
    assert.equal(page.badResponses.filter(url=>/\/(assets|js)\//.test(url)).length, 0, JSON.stringify(page.badResponses));
    console.log('Guerrier GLB : vrai chargement sous /-redita/, squelette par unité, frappes opposées, dégâts inchangés, pause, équipement, bateau, âne, marche, mobile et nettoyage validés.');
  } finally { await browser?.close(); await new Promise(resolve => site.server.close(resolve)); }
}

async function screenshot(page, name) {
  const folder = process.env.EREDITA_WARRIOR_PREVIEW_DIR;
  if (!folder) return;
  fs.mkdirSync(folder, { recursive: true });
  const result = await page.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(folder, name+'.png'), Buffer.from(result.data, 'base64'));
}

run().catch(error => { console.error(error); process.exitCode=1; });
