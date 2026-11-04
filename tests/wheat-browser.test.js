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
    await page.waitFor('Eredita.CropModels?.ready || Object.keys(Eredita.CropModels?.diagnostics.errors || {}).length', 25000);
    const diagnostics = await page.evaluate('Eredita.CropModels.diagnostics');
    assert.deepEqual(diagnostics.errors, {});
    assert.equal(diagnostics.models.ble.batches, 2);
    assert.ok(diagnostics.models.ble.triangles > 1000 && diagnostics.models.ble.triangles < 5000);
    await page.click('[data-menu-screen="play"]'); await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.click('[data-setup-action="keep"][data-player="red"]');
    await page.click('#start-game');
    await page.waitFor("Eredita.GameView.getState().phase==='running'");
    await page.click('#pause-game');
    await page.evaluate(`(() => {
      const E=Eredita, s=window.wState=E.GameView.getState();
      s.paused=true;s.preparationRemaining=0;s.selectedVillage={playerId:'red',lane:0};
      for(const p of Object.values(s.players)) for(const v of p.villages) {
        v.biome=v.lane===0?'plaine':'littoral';v.slots=E.Biomes.createSlots(v.biome);
        v.terrain={};v.burnUntil=0;v.curseUntil=0;
      }
      E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
      document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      window.wTile=lane=>E.Board3D.getXRContext().terrainGroup.children.find(g=>g.children.some(o=>
        o.userData.xrTarget?.kind==='slot' && o.userData.xrTarget.playerId==='red' && o.userData.xrTarget.lane===lane));
      window.wCrops=lane=>wTile(lane).children.filter(o=>o.name==='culture-ble');
    })()`);
    assert.equal(await page.evaluate('wCrops(0).length+wCrops(1).length'), 0, 'Aucune plantation automatique');
    // Planter par les contrôles réels, puis examiner la scène utilisée aussi par WebXR.
    await page.click('#pause-game');
    await page.click('[data-select-slot="0"]');
    assert.match(await page.evaluate("getComputedStyle(document.querySelector('[data-place-crop=ble] .crop-preview-ble')).backgroundImage"), /crop-ble-v1.webp/);
    await page.click('[data-place-crop="ble"][data-slot-index="0"]');
    await page.click('#pause-game');
    await page.evaluate('Eredita.Board3D.update(wState,true)');
    assert.equal(await page.evaluate('wState.players.red.villages[0].slots[0].content.hp'), 200);
    assert.equal(await page.evaluate('wCrops(0).length'), 1);
    const compatibility=await page.evaluate(`(() => {
      const E=Eredita,s=wState;s.paused=false;
      const plain=E.Crops.place(s,'red',0,1,'ble'), coast=E.Crops.place(s,'red',1,0,'ble');
      const v=s.players.blue.villages[0];v.biome='montagne';v.slots=E.Biomes.createSlots('montagne');
      const mountain=E.Crops.canPlace(s,'blue',0,0,'ble');s.paused=true;
      E.UI.render(s);E.Board3D.update(s,true);return {plain,coast,mountain};
    })()`);
    assert.deepEqual(compatibility,{plain:true,coast:true,mountain:false});
    const geometry=await page.evaluate(`(() => {
      const T=Eredita.Board3D.getXRContext().THREE,a=wCrops(0)[0],b=wCrops(0)[1];
      a.updateWorldMatrix(true,true);const bounds=new T.Box3().setFromObject(a);
      window.wDisposed=0;a.children.forEach(m=>m.geometry.addEventListener('dispose',()=>wDisposed++));
      return {size:bounds.getSize(new T.Vector3()).toArray(),batches:a.children.length,
        shared:a.children[0].geometry===b.children[0].geometry,
        separateMaterials:a.children[0].material!==b.children[0].material,
        opaque:a.children.every(m=>!m.material.transparent && !m.material.map && m.material.vertexColors),
        elevation:a.position.y,coast:wCrops(1).length};
    })()`);
    assert.equal(geometry.batches,2);assert.equal(geometry.coast,1);
    assert.ok(geometry.shared && geometry.separateMaterials && geometry.opaque);
    assert.ok(Math.abs(geometry.size[0]-.48)<.0001 && Math.abs(geometry.size[2]-.48)<.0001);
    assert.ok(geometry.size[1]>.25 && geometry.size[1]<.35);
    assert.equal(geometry.elevation,.13);
    const before=await page.evaluate('JSON.stringify(wState)');
    await page.evaluate('Eredita.Board3D.update(wState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');
    assert.equal(await page.evaluate('JSON.stringify(wState)'),before);
    assert.equal(await page.evaluate('wDisposed'),0,'Le cache partagé survit aux reconstructions');
    async function screenshot(name){
      const shot=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      fs.writeFileSync(path.join(__dirname,'../eredita3D/previews',name+'.png'),Buffer.from(shot.data,'base64'));
    }
    await screenshot('ble_in_game');
    await page.click('#toggle-board-view');
    assert.match(await page.evaluate("getComputedStyle(document.querySelector('.crop-ble .content-icon')).backgroundImage"),/crop-ble-v1.webp/);
    const sprite=await page.evaluate(`(async()=>{
      const img=new Image();img.src='assets/generated/crop-ble-v1.webp';await img.decode();
      const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
      return {width:img.naturalWidth,height:img.naturalHeight,alpha:ctx.getImageData(0,0,1,1).data[3]};
    })()`);
    assert.deepEqual(sprite,{width:256,height:256,alpha:0});
    await screenshot('ble_web_2d');
    await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
    // Remplacement et retrait retirent le modèle, sans détruire sa géométrie partagée.
    const lifecycle=await page.evaluate(`(() => {
      const E=Eredita,s=wState;s.paused=false;const replaced=E.Crops.place(s,'red',0,0,'chataignier');s.paused=true;
      s.players.red.villages[0].slots[1].content=null;E.Board3D.update(s,true);
      const removed=wCrops(0).length===0,otherCrop=!!wTile(0).getObjectByName('culture-chataignier');
      const create=E.CropModels.create;E.CropModels.create=()=>null;E.Board3D.update(s,true);E.CropModels.create=create;
      const fallback=!!wTile(1).getObjectByName('culture-ble-simple');E.Board3D.update(s,true);
      return {replaced,removed,otherCrop,fallback,restored:wCrops(1).length===1,disposed:wDisposed};
    })()`);
    assert.deepEqual(lifecycle,{replaced:true,removed:true,otherCrop:true,fallback:true,restored:true,disposed:0});
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.consoleErrors,[]);
    assert.deepEqual(page.badResponses.filter(url=>!/favicon/.test(url)),[]);
    console.log('Blé : plantation, GLB, sprite, cache, remplacement et repli validés.',JSON.stringify(diagnostics));
  } finally {if(browser)await browser.close();await new Promise(resolve=>site.server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
