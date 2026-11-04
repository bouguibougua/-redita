'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser}=require('../scripts/export-menu-gif');
async function run(){
  const site=await startStaticServer();let browser;
  try{
    browser=await startBrowser();const page=browser.page;
    await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await page.send('Page.navigate',{url:(process.env.EREDITA_TEST_URL||site.url)+'?intro=0'});
    await page.waitFor("document.readyState==='complete' && window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()");
    await page.waitFor('Eredita.CropModels?.ready || Object.keys(Eredita.CropModels?.diagnostics.errors||{}).length',25000);
    const diagnostics=await page.evaluate('Eredita.CropModels.diagnostics');assert.deepEqual(diagnostics.errors,{});
    const counts=['petit','moyen','grand'].map(size=>diagnostics.models['chataignier:'+size]);
    assert.ok(counts.every(m=>m.batches===2 && m.triangles<8500));
    assert.ok(counts[0].triangles<counts[1].triangles && counts[1].triangles<counts[2].triangles);
    await page.click('[data-menu-screen="play"]');await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.click('[data-setup-action="keep"][data-player="red"]');await page.click('#start-game');
    await page.waitFor("Eredita.GameView.getState().phase==='running'");await page.click('#pause-game');
    await page.evaluate(`(()=>{
      const E=Eredita,s=window.cState=E.GameView.getState();s.paused=true;s.selectedVillage={playerId:'red',lane:0};
      for(const p of Object.values(s.players))for(const v of p.villages){
        v.biome=v.lane===0?'plaine':'montagne';v.slots=E.Biomes.createSlots(v.biome);v.terrain={};v.burnUntil=0;v.curseUntil=0;
      }
      E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
      document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      window.cTile=(lane=0,owner='red')=>E.Board3D.getXRContext().terrainGroup.children.find(g=>g.userData.playerId===owner&&g.userData.lane===lane);
      window.cModels=(lane=0)=>cTile(lane).children.filter(o=>o.name==='culture-chataignier');
      window.cVariants=(lane=0)=>cModels(lane).map(o=>o.userData.cropVariant);
    })()`);
    assert.deepEqual(await page.evaluate('cVariants()'),[]);
    for(let slot=0;slot<4;slot++){
      const expected='petit';
      await page.click('#pause-game');await page.click(`[data-select-slot="${slot}"]`);
      assert.equal(await page.evaluate(`document.querySelector('[data-place-crop=chataignier] .crop-preview-chataignier').classList.contains('crop-size-${expected}')`),true);
      await page.click(`[data-place-crop="chataignier"][data-slot-index="${slot}"]`);await page.click('#pause-game');
      // Sans force : vérifier l'invalidation normale du rendu lorsqu'un champ est ajouté.
      await page.evaluate('Eredita.Board3D.update(cState);Eredita.UI.render(cState)');
      assert.deepEqual(await page.evaluate('cVariants()'),Array(slot+1).fill(expected));
      assert.equal(await page.evaluate(`document.querySelectorAll('.region.red .crop-chataignier.crop-size-${expected}').length`),slot+1);
      assert.equal(await page.evaluate('cState.players.red.villages[0].slots[0].content.hp'),200);
    }
    // Chaque amélioration change uniquement le modèle du slot concerné.
    async function upgradeSlot(index, level) {
      await page.click('#pause-game');
      if(!await page.evaluate(`document.querySelector('[data-select-slot="${index}"]').getAttribute('aria-expanded')==='true'`))await page.click(`[data-select-slot="${index}"]`);
      await page.click(`[data-upgrade-crop="${index}"]`);await page.click('#pause-game');
      await page.evaluate('Eredita.Board3D.update(cState);Eredita.UI.render(cState)');
      assert.equal(await page.evaluate(`cState.players.red.villages[cState.selectedVillage.lane].slots[${index}].content.level`),level);
    }
    await upgradeSlot(0,2);
    assert.deepEqual(await page.evaluate('cVariants()'),['moyen','petit','petit','petit']);
    await upgradeSlot(0,3);await upgradeSlot(1,2);await upgradeSlot(2,2);await upgradeSlot(2,3);
    assert.deepEqual(await page.evaluate('cVariants()'),['grand','moyen','grand','petit']);
    assert.deepEqual(await page.evaluate("Array.from(document.querySelectorAll('.placement-slot small'),el=>el.textContent.slice(0,2))"),['N3','N2','N3','N1']);
    const rules=await page.evaluate(`(()=>{
      const E=Eredita,s=cState;s.paused=false;
      const mountain=E.Crops.place(s,'red',1,0,'chataignier'),animalSlot=E.Crops.canPlace(s,'red',1,2,'chataignier');
      const v=s.players.blue.villages[0];v.biome='littoral';v.slots=E.Biomes.createSlots('littoral');
      const coast=E.Crops.canPlace(s,'blue',0,0,'chataignier');s.paused=true;
      E.UI.render(s);E.Board3D.update(s);return {mountain,animalSlot,coast,plain:cVariants(),second:cVariants(1)};
    })()`);
    assert.deepEqual(rules,{mountain:true,animalSlot:false,coast:false,plain:['grand','moyen','grand','petit'],second:['petit']});
    await page.evaluate("Eredita.GameView.selectVillage('red',1)");
    await upgradeSlot(0,2);await upgradeSlot(0,3);
    assert.deepEqual(await page.evaluate('cVariants(1)'),['grand'],'Une seule plantation en Montagne peut atteindre N3');
    await page.evaluate("Eredita.GameView.selectVillage('red',0)");
    const mesh=await page.evaluate(`(()=>{
      const T=Eredita.Board3D.getXRContext().THREE,models=cModels(),a=models[0],b=models[2];a.updateWorldMatrix(true,true);
      const size=new T.Box3().setFromObject(a).getSize(new T.Vector3()).toArray();
      window.cDisposed=0;a.children.forEach(m=>m.geometry.addEventListener('dispose',()=>cDisposed++));
      return {size,shared:a.children[0].geometry===b.children[0].geometry,
        separate:a.children[0].material!==b.children[0].material,
        opaque:a.children.every(m=>!m.material.transparent&&!m.material.map&&m.material.vertexColors)};
    })()`);
    assert.ok(mesh.shared&&mesh.separate&&mesh.opaque);
    assert.ok(mesh.size[0]<.60 && mesh.size[2]<.60 && mesh.size[1]>.65 && mesh.size[1]<.8);
    const before=await page.evaluate('JSON.stringify(cState)');
    await page.evaluate('Eredita.Board3D.update(cState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');
    assert.equal(await page.evaluate('JSON.stringify(cState)'),before);
    assert.equal(await page.evaluate('cDisposed'),0);
    const folder=path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});
    async function screenshot(name){const shot=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(shot.data,'base64'));}
    await screenshot('chataigniers_in_game');await page.click('#toggle-board-view');
    assert.match(await page.evaluate("getComputedStyle(document.querySelector('.crop-size-grand .content-icon')).backgroundImage"),/crop-chataignier-grand-v1.webp/);
    const icons=await page.evaluate(`Array.from(document.querySelectorAll('.region.red [data-lane="0"].crop-chataignier'),el=>getComputedStyle(el.querySelector('.content-icon')).backgroundImage)`);
    assert.deepEqual(icons.map(src=>src.match(/crop-chataignier-(\w+)-v1/)[1]),['grand','moyen','grand','petit']);
    await screenshot('chataigniers_web_2d');
    const sprites=await page.evaluate(`(async()=>{
      const result=[];for(const size of ['petit','moyen','grand']){
        const img=new Image();img.src='assets/generated/crop-chataignier-'+size+'-v1.webp';await img.decode();
        const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
        result.push([img.naturalWidth,img.naturalHeight,ctx.getImageData(0,0,1,1).data[3]]);
      }return result;
    })()`);
    assert.deepEqual(sprites,Array.from({length:3},()=>[256,256,0]));
    // Retirer ou remplacer un voisin ne réduit pas le niveau d'une autre parcelle.
    const reduction=await page.evaluate(`(()=>{
      const E=Eredita,s=cState;s.preparationRemaining=60;s.paused=false;
      E.Crops.remove(s,'red',0,3);E.UI.render(s);E.Board3D.update(s);const remaining=cVariants();
      const replaced=E.Crops.place(s,'red',0,0,'ble');E.Crops.remove(s,'red',0,2);
      E.UI.render(s);E.Board3D.update(s);const alone=cVariants(),wheat=!!cTile().getObjectByName('culture-ble');
      E.Crops.remove(s,'red',0,1);E.Crops.place(s,'red',0,1,'chataignier');s.paused=true;
      E.UI.render(s);E.Board3D.update(s);const replanted=cVariants();
      const create=E.CropModels.create;E.CropModels.create=()=>null;E.Board3D.update(s,true);E.CropModels.create=create;
      const fallback=!!cTile().getObjectByName('culture-chataignier-simple');E.Board3D.update(s,true);
      return {remaining,replaced,alone,wheat,replanted,fallback,restored:cVariants(),mountain:cVariants(1),disposed:cDisposed};
    })()`);
    assert.deepEqual(reduction,{remaining:['grand','moyen','grand'],replaced:true,alone:['moyen'],wheat:true,replanted:['petit'],fallback:true,restored:['petit'],mountain:['grand'],disposed:0});
    await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.consoleErrors,[]);
    assert.deepEqual(page.badResponses.filter(url=>!/favicon/.test(url)),[]);
    console.log('Châtaigniers : modèles N1/N2/N3 par slot, améliorations, retrait, 2D/3D, cache et biomes validés.',JSON.stringify(diagnostics));
  }finally{if(browser)await browser.close();await new Promise(resolve=>site.server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
