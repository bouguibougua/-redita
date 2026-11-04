'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { startStaticServer, startBrowser } = require('../scripts/export-menu-gif');

async function run() {
  const site = await startStaticServer(); let browser;
  try {
    browser = await startBrowser(); const page = browser.page;
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: (process.env.EREDITA_TEST_URL || site.url) + '?intro=0' });
    await page.waitFor("document.readyState==='complete' && window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()");
    await page.waitFor('Eredita.PlainTerrain?.ready || Eredita.PlainTerrain?.diagnostics.error', 25000);
    const diagnostics = await page.evaluate('Eredita.PlainTerrain.diagnostics');
    assert.equal(diagnostics.error, null);
    assert.equal(diagnostics.batches, 3);
    assert.ok(diagnostics.triangles > 5000 && diagnostics.triangles < 12000);
    assert.deepEqual(diagnostics.cachedWidths, [1, 1.15]);
    await page.click('[data-menu-screen="play"]'); await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    const folder=path.join(__dirname,'../eredita3D/previews'); fs.mkdirSync(folder,{recursive:true});
    async function screenshot(name) {
      const shot=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(shot.data,'base64'));
    }
    await page.evaluate(`(() => {
      const E=Eredita,s=E.GameView.getState();
      for(const p of Object.values(s.players)) for(const v of p.villages) {v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');}
      E.UI.render(s);
    })()`);
    assert.match(await page.evaluate("getComputedStyle(document.querySelector('.biome-choice.plaine')).backgroundImage"), /terrain-plaine-card-v1.webp/);
    const imageSizes=await page.evaluate(`(async () => {
      const result=[];
      for(const name of ['terrain-plaine-card-v1','terrain-plaine-v1']){
        const img=new Image();img.src='assets/generated/'+name+'.webp';await img.decode();
        result.push([img.naturalWidth,img.naturalHeight]);
      }return result;
    })()`);
    assert.deepEqual(imageSizes,[[768,432],[768,1321]]);
    await screenshot('plaine_web_setup');
    await page.click('[data-setup-action="keep"][data-player="red"]');
    await page.click('#start-game');
    await page.waitFor("Eredita.GameView.getState().phase==='running'");
    await page.click('#pause-game');
    await page.evaluate(`(() => {
      const E=Eredita,s=window.pState=E.GameView.getState();
      s.phase='running';s.paused=true;s.preparationRemaining=0;
      for(const p of Object.values(s.players)) for(const v of p.villages) {
        v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.terrain={};v.burnUntil=0;v.curseUntil=0;
      }
      E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
      document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      window.pTiles=()=>E.Board3D.getXRContext().terrainGroup.children;
      window.pModel=i=>pTiles()[i].getObjectByName('terrain-plaine');
      window.pDisposed=0;pModel(0).children.forEach(m=>m.geometry.addEventListener('dispose',()=>pDisposed++));
    })()`);
    const originalState = await page.evaluate('JSON.stringify(pState)');
    const dimensions = await page.evaluate(`(() => {
      const T=Eredita.Board3D.getXRContext().THREE, a=pModel(0).getObjectByName('plaine-ground'),b=pModel(1).getObjectByName('plaine-ground');
      return {tiles:pTiles().length,slots:pTiles()[0].children.filter(o=>o.userData.xrTarget?.kind==='slot').length,
        size:a.geometry.boundingBox.getSize(new T.Vector3()).toArray(),shared:a.geometry===b.geometry,
        separateMaterials:a.material!==b.material,texturesShared:a.material.map===b.material.map};
    })()`);
    assert.equal(dimensions.tiles, 4);assert.equal(dimensions.slots, 4);
    assert.ok(Math.abs(dimensions.size[0]-2.82*1.15)<.00001 && Math.abs(dimensions.size[2]-4.85)<.00001);
    assert.ok(dimensions.shared && dimensions.separateMaterials && dimensions.texturesShared);
    await page.evaluate('Eredita.Board3D.update(pState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');
    assert.equal(await page.evaluate('pDisposed'), 0);
    assert.equal(await page.evaluate('JSON.stringify(pState)'), originalState, 'Le rendu ne modifie aucune donnée de jeu');
    assert.equal(await page.evaluate('pModel(0).children.every(m=>!m.material.transparent && m.material.opacity===1 && m.material.depthWrite)'), true);
    // La fusion n’étire pas les décors : les arêtes correspondantes restent de même longueur.
    const edgeError = await page.evaluate(`(() => {
      const T=Eredita.Board3D.getXRContext().THREE;
      const a=Eredita.PlainTerrain.create(1), b=Eredita.PlainTerrain.create(1.15);
      const ga=a.getObjectByName('plaine-decoration').geometry,gb=b.getObjectByName('plaine-decoration').geometry;
      let max=0;const p=new T.Vector3(),q=new T.Vector3();
      for(let i=0;i<ga.index.count;i+=3){
        const x=ga.index.getX(i),y=ga.index.getX(i+1);
        const la=p.fromBufferAttribute(ga.attributes.position,x).distanceTo(q.fromBufferAttribute(ga.attributes.position,y));
        const lb=p.fromBufferAttribute(gb.attributes.position,x).distanceTo(q.fromBufferAttribute(gb.attributes.position,y));
        max=Math.max(max,Math.abs(la-lb));
      }
      a.children.forEach(m=>m.material.dispose());b.children.forEach(m=>m.material.dispose());return max;
    })()`);
    assert.ok(edgeError<.000001, `Décors déformés : ${edgeError}`);
    // Un rayon visant un slot rencontre encore son marqueur avant le sol.
    assert.equal(await page.evaluate(`(() => {
      const c=Eredita.Board3D.getXRContext(),T=c.THREE; c.world.updateMatrixWorld(true);
      const slot=pTiles()[0].children.find(o=>o.userData.xrTarget?.kind==='slot');
      const pos=slot.getWorldPosition(new T.Vector3());pos.y+=2;
      const hits=new T.Raycaster(pos,new T.Vector3(0,-1,0)).intersectObject(pTiles()[0],true);
      return hits[0]?.object===slot;
    })()`), true);
    // Aperçu réel du plateau, avant effets, avec les quatre slots créés par le jeu.
    await screenshot('plaine_in_game');
    await page.click('#toggle-board-view');
    assert.equal(await page.evaluate('Eredita.Board3D.enabled'),false);
    assert.match(await page.evaluate("getComputedStyle(document.querySelector('.region.plaine'),'::before').backgroundImage"),/terrain-plaine-v1.webp/);
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('#board-columns')).visibility"),'visible');
    // Développer la région par les contrôles web conserve les couches dynamiques.
    await page.click('#pause-game');
    await page.click('[data-select-slot="0"]');
    await page.click('[data-place-crop="ble"][data-slot-index="0"]');
    await page.click('#pause-game');
    assert.equal(await page.evaluate('pState.players.red.villages[0].slots[0].content.type'),'ble');
    assert.equal(await page.evaluate("!!document.querySelector('.region.plaine.red .crop-ble')"),true);
    await screenshot('plaine_web_2d');
    await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await page.evaluate("document.querySelector('#battlefield').scrollIntoView({block:'start'})");
    await screenshot('plaine_web_mobile');
    assert.equal(await page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
    await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await page.click('#toggle-board-view');
    assert.equal(await page.evaluate('Eredita.Board3D.enabled && !!pModel(0)'),true);
    await page.evaluate(`(() => {
      const v=pState.players.red.villages[0];v.burnUntil=pState.elapsed+120;v.terrain.river=true;
      Eredita.Board3D.update(pState,true);
    })()`);
    assert.equal(await page.evaluate("!pModel(0).getObjectByName('plaine-decoration').visible && !!pTiles()[0].getObjectByName('mythology-burned-terrain') && !!pTiles()[0].getObjectByName('mythology-river')"),true);
    assert.equal(await page.evaluate("pModel(1).getObjectByName('plaine-decoration').visible"),true);
    // Les huit régions du format classique utilisent aussi le cache.
    const classicView=await page.evaluate(`(() => {
      const s=window.pClassic=Eredita.Board.createState('classic');s.paused=true;
      for(const p of Object.values(s.players)) for(const v of p.villages){v.biome='plaine';v.slots=Eredita.Biomes.createSlots('plaine');}
      Eredita.Board3D.update(s,true);
      // Capturer avant que la boucle de la vraie partie ne restaure son état Simplifié.
      return {tiles:pTiles().length,maxX:pModel(0).getObjectByName('plaine-ground').geometry.boundingBox.max.x};
    })()`);
    assert.equal(classicView.tiles,8);
    assert.ok(Math.abs(classicView.maxX-1.41)<.000001);
    assert.equal(await page.evaluate('pDisposed'),0);
    // Échec du modèle : même scène jouable grâce au terrain de repli.
    const fallback=await page.evaluate(`(() => {
      const create=Eredita.PlainTerrain.create;Eredita.PlainTerrain.create=()=>null;
      Eredita.Board3D.update(pState,true);Eredita.PlainTerrain.create=create;
      return {hasModel:!!pModel(0),slots:pTiles()[0].children.filter(o=>o.userData.xrTarget?.kind==='slot').length};
    })()`);
    assert.equal(fallback.hasModel,false);assert.equal(fallback.slots,4);
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.consoleErrors,[]);
    assert.deepEqual(page.badResponses.filter(url=>!/favicon/.test(url)),[]);
    console.log('Plaine browser tests passed:',JSON.stringify(diagnostics));
  } finally { if(browser)await browser.close();await new Promise(resolve=>site.server.close(resolve)); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
