'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {startStaticServer, startBrowser} = require('../scripts/export-menu-gif');

(async () => {
  const site = await startStaticServer(); let browser;
  try {
    browser = await startBrowser(); const p = browser.page;
    await p.send('Emulation.setDeviceMetricsOverride', {width:1600,height:1000,deviceScaleFactor:1,mobile:false});
    await p.send('Page.navigate', {url:(process.env.EREDITA_TEST_URL || site.url)+'?intro=0'});
    await p.waitFor('window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()');
    await p.waitFor('Eredita.CropModels.ready || Object.keys(Eredita.CropModels.diagnostics.errors).length', 30000);
    const diagnostics = await p.evaluate('Eredita.CropModels.diagnostics');
    assert.deepEqual(diagnostics.errors, {});
    const models = ['petit','moyen','grand'].map(v => diagnostics.models['ble:'+v]);
    assert.ok(models.every(m => m.batches===2 && m.triangles<9000));
    assert.ok(models[0].triangles<models[1].triangles && models[1].triangles<models[2].triangles);
    await p.click('[data-menu-screen="play"]'); await p.click('#training-button');
    await p.waitFor("Eredita.Network.mode==='solo'");
    await p.evaluate(`(() => {
      const E=Eredita,s=window.wState=E.GameView.getState();E.AI.update=()=>false;
      s.phase='running';s.paused=false;s.preparationRemaining=3600;s.units=[];s.players.red.gold=5000;
      for(const player of Object.values(s.players))for(const v of player.villages){
        v.biome=v.lane===0?'plaine':'littoral';v.slots=E.Biomes.createSlots(v.biome);v.terrain={};v.burnUntil=0;v.curseUntil=0;
      }
      s.selectedVillage={playerId:'red',lane:0};E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
      document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      window.wTile=(lane=0)=>E.Board3D.getXRContext().terrainGroup.children.find(g=>g.userData.playerId==='red'&&g.userData.lane===lane);
      window.wCrops=(lane=0)=>wTile(lane).children.filter(o=>o.name==='culture-ble');
      window.wVariants=(lane=0)=>wCrops(lane).map(o=>o.userData.cropVariant);
      window.wRefresh=()=>{E.UI.render(s);E.Board3D.update(s);};
    })()`);
    assert.deepEqual(await p.evaluate('wVariants()'), []);
    async function selectSlot(index) {
      if(!await p.evaluate(`document.querySelector('[data-select-slot="${index}"]').getAttribute('aria-expanded')==='true'`))
        await p.click(`[data-select-slot="${index}"]`);
    }
    for(let index=0;index<3;index++) {
      await selectSlot(index);
      assert.match(await p.evaluate("getComputedStyle(document.querySelector('[data-place-crop=ble] .crop-preview-ble')).backgroundImage"), /crop-ble-petit-v1.webp/);
      await p.click(`[data-place-crop="ble"][data-slot-index="${index}"]`); await p.evaluate('wRefresh()');
      assert.deepEqual(await p.evaluate('wVariants()'), Array(index+1).fill('petit'));
    }
    async function upgrade(index,level) {
      await selectSlot(index); await p.click(`[data-upgrade-crop="${index}"]`); await p.evaluate('wRefresh()');
      assert.equal(await p.evaluate(`wState.players.red.villages[wState.selectedVillage.lane].slots[${index}].content.level`),level);
    }
    await upgrade(0,2); assert.deepEqual(await p.evaluate('wVariants()'), ['moyen','petit','petit']);
    await upgrade(0,3); await upgrade(1,2);
    assert.deepEqual(await p.evaluate('wVariants()'), ['grand','moyen','petit']);
    assert.equal(await p.evaluate('wState.players.red.gold'),4175,'Les prix existants restent 75 / 150 / 300');
    assert.ok(await p.evaluate('wState.players.red.villages[0].slots.slice(0,3).every(s=>s.content.hp===200&&s.content.maxHp===200)'));
    assert.equal(await p.evaluate("Eredita.Economy.cropYield(wState.players.red.villages[0],'ble')"),6,'Rendements existants 3+2+1');
    await p.evaluate("Eredita.GameView.selectVillage('red',1)"); await selectSlot(0);
    await p.click('[data-place-crop="ble"][data-slot-index="0"]'); await upgrade(0,2); await upgrade(0,3);
    assert.deepEqual(await p.evaluate('wVariants(1)'),['grand'],'Le Littoral suit aussi le niveau de sa culture');
    await p.evaluate(`(() => {
      const v=wState.players.blue.villages[0];v.biome='montagne';v.slots=Eredita.Biomes.createSlots('montagne');
    })()`);
    assert.equal(await p.evaluate("Eredita.Crops.canPlace(wState,'blue',0,0,'ble')"),false);
    await p.evaluate("Eredita.GameView.selectVillage('red',0);wState.paused=true;wRefresh()");
    const geometry = await p.evaluate(`(() => {
      const T=Eredita.Board3D.getXRContext().THREE,a=wCrops()[0],b=wCrops(1)[0];a.updateWorldMatrix(true,true);
      window.wDisposed=0;a.children.forEach(m=>m.geometry.addEventListener('dispose',()=>wDisposed++));
      return {size:new T.Box3().setFromObject(a).getSize(new T.Vector3()).toArray(),
        heights:wCrops().map(o=>new T.Box3().setFromObject(o).getSize(new T.Vector3()).y),
        shared:a.children[0].geometry===b.children[0].geometry,separate:a.children[0].material!==b.children[0].material,
        opaque:a.children.every(m=>!m.material.transparent&&!m.material.map&&m.material.vertexColors)};
    })()`);
    assert.ok(geometry.shared && geometry.separate && geometry.opaque);
    assert.ok(Math.abs(geometry.size[0]-.48)<.0001 && Math.abs(geometry.size[2]-.48)<.0001);
    assert.ok(geometry.heights[0]>geometry.heights[1] && geometry.heights[1]>geometry.heights[2]);
    const before = await p.evaluate('JSON.stringify(wState)');
    await p.evaluate('Eredita.Board3D.update(wState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');
    assert.equal(await p.evaluate('JSON.stringify(wState)'),before,'Le rendu ne modifie pas les règles');
    assert.equal(await p.evaluate('wDisposed'),0);
    const folder=process.env.EREDITA_WHEAT_PREVIEW_DIR||path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});
    async function screenshot(name) {
      const shot=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(shot.data,'base64'));
    }
    await screenshot('ble_tiers_in_game');
    await p.evaluate('Eredita.Board3D.setMode(false)');
    const images=await p.evaluate("Array.from(document.querySelectorAll('.region.red[data-lane=\"0\"] .crop-ble .content-icon'),el=>getComputedStyle(el).backgroundImage)");
    assert.deepEqual(images.map(src=>src.match(/crop-ble-(\w+)-v1/)[1]),['grand','moyen','petit']);
    const sprites=await p.evaluate(`(async()=>{
      const result=[];for(const variant of ['petit','moyen','grand']){
        const img=new Image();img.src='assets/generated/crop-ble-'+variant+'-v1.webp';await img.decode();
        const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
        result.push([img.naturalWidth,img.naturalHeight,ctx.getImageData(0,0,1,1).data[3]]);
      }return result;
    })()`);
    assert.deepEqual(sprites,[[256,256,0],[256,256,0],[256,256,0]]);
    await screenshot('ble_tiers_web_2d');
    const lifecycle=await p.evaluate(`(() => {
      const E=Eredita,s=wState;s.paused=false;s.preparationRemaining=3600;
      E.Crops.remove(s,'red',0,0);wRefresh();const remaining=wVariants();
      const replaced=E.Crops.place(s,'red',0,1,'chataignier');E.Crops.place(s,'red',0,0,'ble');s.paused=true;wRefresh();
      const replanted=wVariants(),otherCrop=!!wTile().getObjectByName('culture-chataignier');
      const create=E.CropModels.create;E.CropModels.create=()=>null;E.Board3D.update(s,true);E.CropModels.create=create;
      const fallback=!!wTile().getObjectByName('culture-ble-simple');E.Board3D.update(s,true);
      return {remaining,replaced,replanted,otherCrop,fallback,restored:wVariants(),coast:wVariants(1),disposed:wDisposed};
    })()`);
    assert.deepEqual(lifecycle,{remaining:['moyen','petit'],replaced:true,replanted:['petit','petit'],otherCrop:true,fallback:true,restored:['petit','petit'],coast:['grand'],disposed:0});
    await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.ok(await p.evaluate('document.documentElement.scrollWidth<=innerWidth'));
    assert.deepEqual(p.errors,[]);assert.deepEqual(p.consoleErrors,[]);assert.deepEqual(p.badResponses.filter(u=>!/favicon/.test(u)),[]);
    console.log('Blé : N1/N2/N3 distincts, améliorations par slot, 2D/3D, sprites transparents, cache, replantation et règles existantes validés.');
  } finally {await browser?.close();await new Promise(r=>site.server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
