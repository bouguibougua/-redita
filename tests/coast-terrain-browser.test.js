'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { startStaticServer, startBrowser } = require('../scripts/export-menu-gif');

async function run() {
  const site=await startStaticServer();let browser;
  try {
    browser=await startBrowser();const page=browser.page;
    await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await page.send('Page.navigate',{url:(process.env.EREDITA_TEST_URL||site.url)+'?intro=0'});
    await page.waitFor("document.readyState==='complete' && window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()");
    await page.waitFor('Eredita.CoastTerrain?.ready || Object.values(Eredita.CoastTerrain?.diagnostics||{}).some(d=>d.error)',25000);
    const diagnostics=await page.evaluate('Eredita.CoastTerrain.diagnostics');
    for(const d of Object.values(diagnostics)) {
      assert.equal(d.error,null);assert.equal(d.batches,5);
      assert.ok(d.triangles>5000 && d.triangles<12000);assert.deepEqual(d.cachedWidths,[1,1.15]);
    }
    const folder=path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});
    async function shot(name){const r=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(r.data,'base64'));}
    await page.click('[data-menu-screen="play"]');await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.evaluate(`(() => {
      const E=Eredita,s=window.cState=E.GameView.getState();
      for(const p of Object.values(s.players))for(const v of p.villages){v.biome='littoral';v.slots=E.Biomes.createSlots('littoral');}
      E.UI.render(s);
    })()`);
    const images=await page.evaluate(`(async()=>{
      const result=[];
      for(const owner of ['red','blue']){
        const card=document.querySelector('.biome-choice.littoral[data-player="'+owner+'"]');
        const src=getComputedStyle(card).backgroundImage.split('"')[1];
        const img=new Image();img.src=src;await img.decode();result.push({src,width:img.width,height:img.height});
      }return result;
    })()`);
    assert.match(images[0].src,/littoral_rouge-card/);assert.match(images[1].src,/littoral_bleu-card/);
    images.forEach(i=>assert.ok(i.width===768 && i.height===432));
    await shot('littoral_web_setup');
    await page.click('[data-setup-action="keep"][data-player="red"]');await page.click('#start-game');
    await page.waitFor("cState.phase==='running'");await page.click('#pause-game');
    await page.evaluate(`(() => {
      cState.preparationRemaining=0;
      for(const p of Object.values(cState.players))for(const v of p.villages){v.maritime={voilier:1,barque:1,filet:1,filetTimer:0};}
      Eredita.UI.render(cState);Eredita.Board3D.update(cState,true);Eredita.Board3D.setMode(true);
      window.cTiles=()=>Eredita.Board3D.getXRContext().terrainGroup.children;
      window.cModel=i=>cTiles()[i].getObjectByName('terrain-littoral');
      window.cPart=(i,role)=>cModel(i).children.find(m=>m.userData.terrainRole===role);
      window.cDisposed=0;cModel(0).children.forEach(m=>m.geometry.addEventListener('dispose',()=>cDisposed++));
    })()`);
    const initialState=await page.evaluate('JSON.stringify(cState)');
    const checks=await page.evaluate(`(() => {
      const c=Eredita.Board3D.getXRContext(),T=c.THREE;c.world.updateMatrixWorld(true);
      return cTiles().map((tile,i)=>{
        const water=cPart(i,'water'),bb=water.geometry.boundingBox;
        const slots=tile.children.filter(o=>o.userData.xrTarget?.kind==='slot');
        return {owner:tile.userData.playerId,slots:slots.length,minZ:bb.min.z,maxZ:bb.max.z,
          boats:tile.children.filter(o=>o.name==='transport-barque').length,
          sails:tile.children.filter(o=>o.name==='transport-voilier').length,
          transparent:water.material.transparent,
          // Le brouillard adverse masque volontairement ses slots ; vérifier ici le relief seul.
          reachable:slots.every(slot=>{const p=slot.getWorldPosition(new T.Vector3());p.y+=2;return new T.Raycaster(p,new T.Vector3(0,-1,0)).intersectObject(tile,true).filter(hit=>hit.object.name!=='mythology-fog')[0]?.object===slot;})};
      });
    })()`);
    assert.equal(checks.length,4);
    for(const c of checks){
      assert.equal(c.slots,2);assert.equal(c.boats,1);assert.equal(c.sails,1);assert.equal(c.transparent,false);assert.equal(c.reachable,true);
      assert.ok(c.owner==='red'?c.minZ>.45&&c.maxZ<2.43:c.maxZ<-.45&&c.minZ>-2.43,'La mer reste orientée vers le centre');
    }
    assert.equal(await page.evaluate("cPart(0,'water').geometry===cPart(1,'water').geometry && cPart(0,'water').material!==cPart(1,'water').material"),true);
    assert.equal(await page.evaluate("cPart(0,'water').geometry===cPart(2,'water').geometry"),false,'Deux compositions indépendantes');
    // Les deux côtes ne sont pas une rotation à 180 degrés du même tracé.
    assert.equal(await page.evaluate(`(() => {
      const a=cPart(0,'water').geometry.attributes.position,b=cPart(2,'water').geometry.attributes.position;
      const az=[],bz=[];
      for(let i=0;i<a.count;i++)if(Math.abs(a.getX(i))<.01)az.push(a.getZ(i));
      for(let i=0;i<b.count;i++)if(Math.abs(b.getX(i))<.01)bz.push(-b.getZ(i));
      return Math.abs(Math.min(...az)-Math.min(...bz))>.005;
    })()`),true);
    await page.evaluate('Eredita.Board3D.update(cState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');
    assert.equal(await page.evaluate('JSON.stringify(cState)'),initialState);
    assert.equal(await page.evaluate('cDisposed'),0);
    await shot('littoral_in_game');
    await page.click('#toggle-board-view');
    for(const [owner,name] of [['red','rouge'],['blue','bleu']])assert.match(await page.evaluate(`getComputedStyle(document.querySelector('.region.littoral.${owner}'),'::before').backgroundImage`),new RegExp(`littoral_${name}-v1`));
    await page.click('#pause-game');await page.click('[data-select-slot="0"]');
    await page.click('[data-place-crop="ble"][data-slot-index="0"]');await page.click('#pause-game');
    assert.equal(await page.evaluate('cState.players.red.villages[0].slots[0].content.type'),'ble');
    assert.equal(await page.evaluate("document.querySelectorAll('.region.littoral.red .slot').length"),4,'Deux slots par village, deux villages');
    await shot('littoral_web_2d');
    await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await page.evaluate("document.querySelector('#battlefield').scrollIntoView({block:'start'})");await shot('littoral_web_mobile');
    assert.equal(await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await page.click('#toggle-board-view');
    const burn=await page.evaluate(`(() => {
      const before=cPart(0,'water').material.color.getHex();
      cState.players.red.villages[0].burnUntil=cState.elapsed+120;Eredita.Board3D.update(cState,true);
      return {before,after:cPart(0,'water').material.color.getHex(),plants:cPart(0,'decoration').visible,rocks:cPart(0,'rock').visible,water:cPart(0,'water').visible};
    })()`);
    assert.equal(burn.before,burn.after);assert.equal(burn.plants,false);assert.equal(burn.rocks,true);assert.equal(burn.water,true);
    const classic=await page.evaluate(`(() => {
      const s=Eredita.Board.createState('classic');s.paused=true;
      for(const p of Object.values(s.players))for(const v of p.villages){v.biome='littoral';v.slots=Eredita.Biomes.createSlots('littoral');}
      Eredita.Board3D.update(s,true);
      return {tiles:cTiles().length,width:cPart(0,'ground').geometry.boundingBox.max.x};
    })()`);
    assert.equal(classic.tiles,8);assert.ok(Math.abs(classic.width-1.41)<.000001);
    const fallback=await page.evaluate(`(() => {
      const create=Eredita.CoastTerrain.create;Eredita.CoastTerrain.create=()=>null;Eredita.Board3D.update(cState,true);Eredita.CoastTerrain.create=create;
      return {model:!!cModel(0),slots:cTiles()[0].children.filter(o=>o.userData.xrTarget?.kind==='slot').length,boat:!!cTiles()[0].getObjectByName('transport-barque')};
    })()`);
    assert.deepEqual(fallback,{model:false,slots:2,boat:true});assert.equal(await page.evaluate('cDisposed'),0);
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.consoleErrors,[]);assert.deepEqual(page.badResponses.filter(url=>!/favicon/.test(url)),[]);
    console.log('Littoral browser tests passed:',JSON.stringify(diagnostics));
  }finally{if(browser)await browser.close();await new Promise(resolve=>site.server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
