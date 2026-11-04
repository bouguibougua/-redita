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
    await page.waitFor('Eredita.LivestockModels?.ready || Object.keys(Eredita.LivestockModels?.diagnostics.errors||{}).length',25000);
    const diagnostics=await page.evaluate('Eredita.LivestockModels.diagnostics');assert.deepEqual(diagnostics.errors,{});
    assert.ok(['petit','moyen','grand'].every(id=>{
      const m=diagnostics.models['vache:'+id];return m.batches===2 && m.animalTriangles>500 && m.animalTriangles<1500;
    }));
    await page.click('[data-menu-screen="play"]');await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.click('[data-setup-action="keep"][data-player="red"]');await page.click('#start-game');
    await page.waitFor("Eredita.GameView.getState().phase==='running'");await page.click('#pause-game');
    await page.evaluate(`(()=>{
      const E=Eredita,s=window.gState=E.GameView.getState();s.paused=true;s.preparationRemaining=0;s.selectedVillage={playerId:'red',lane:0};
      for(const p of Object.values(s.players))for(const v of p.villages){
        v.biome=v.lane===0?'plaine':'montagne';v.slots=E.Biomes.createSlots(v.biome);v.terrain={};v.burnUntil=0;v.curseUntil=0;
      }
      E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
      document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      window.gTile=(lane=0,owner='red')=>E.Board3D.getXRContext().terrainGroup.children.find(g=>g.userData.playerId===owner&&g.userData.lane===lane);
      window.gHerd=()=>gTile().getObjectByName('elevage-vache');
      window.gResult=()=>{const h=gHerd();return {variant:h?.userData.herdVariant,shown:h?.userData.displayedAnimals,
        count:gState.players.red.villages[0].slots[0].content?.count,
        label:document.querySelector('.region.red .livestock-vache [data-herd-count]')?.textContent,
        css:document.querySelector('.region.red .livestock-vache')?.className};};
    })()`);
    assert.equal(await page.evaluate('!!gHerd()'),false,'Pas d’élevage automatique');
    await page.click('#pause-game');await page.click('[data-select-slot="0"]');
    assert.equal(await page.evaluate("!!document.querySelector('[data-place-livestock=vache] .herd-preview-vache')"),true);
    await page.click('[data-place-livestock="vache"][data-slot-index="0"]');await page.click('#pause-game');
    await page.evaluate('Eredita.Board3D.update(gState);Eredita.UI.render(gState)');
    assert.equal(await page.evaluate('gResult().count'),1);
    assert.equal(await page.evaluate('gHerd().userData.displayedAnimals'),1);
    assert.equal(await page.evaluate('gState.players.red.villages[0].slots[0].content.hp'),30);
    // Faire naître deux vaches avec le véritable cycle économique.
    for(let count=2;count<=3;count++){
      const result=await page.evaluate(`(()=>{
        const E=Eredita,s=gState,h=s.players.red.villages[0].slots[0].content;
        h.reproductionProgress=119.99;E.Economy.updateProduction(s,.1);E.UI.render(s);E.Board3D.update(s);return gResult();
      })()`);
      assert.equal(result.count,count);assert.equal(result.shown,count);assert.equal(result.label,String(count));
      assert.equal(result.variant,count===2?'petit':'moyen');assert.match(result.css,new RegExp('herd-size-'+result.variant));
    }
    // Les achats existants augmentent l'effectif, et le passage à six change l'enclos.
    await page.evaluate("gState.players.red.villages[0].buildings.push({type:'bergerie',level:1});gState.players.red.gold=1000");
    for(let count=4;count<=7;count++){
      const result=await page.evaluate(`(()=>{
        const E=Eredita,s=gState;s.paused=false;const bought=E.Livestock.buy(s,'red',0,'vache');s.paused=true;
        E.UI.render(s);E.Board3D.update(s);return {...gResult(),bought:!!bought};
      })()`);
      assert.equal(result.bought,true);assert.equal(result.count,count);assert.equal(result.label,String(count));
      assert.equal(result.shown,Math.min(6,count));assert.equal(result.variant,count<6?'moyen':'grand');
      assert.match(result.css,new RegExp('herd-size-'+result.variant));
    }
    assert.equal(await page.evaluate('gState.players.red.gold'),640);
    assert.equal(await page.evaluate('Eredita.Economy.dairyAnimalCount(gState.players.red.villages[0])'),7);
    const geometry=await page.evaluate(`(()=>{
      const E=Eredita,T=E.Board3D.getXRContext().THREE,a=gHerd(),b=E.LivestockModels.create('vache',10000);
      a.updateWorldMatrix(true,true);const size=new T.Box3().setFromObject(a).getSize(new T.Vector3()).toArray();
      window.gDisposed=0;a.children.forEach(m=>m.geometry.addEventListener('dispose',()=>gDisposed++));
      const result={size,shared:a.children.every((m,i)=>m.geometry===b.children[i].geometry),
        separate:a.children.every((m,i)=>m.material!==b.children[i].material),shown:b.userData.displayedAnimals,
        opaque:a.children.every(m=>!m.material.transparent&&!m.material.map&&m.material.vertexColors),
        animalHeight:a.getObjectByName('animaux').geometry.boundingBox.getSize(new T.Vector3()).y};
      b.children.forEach(m=>m.material.dispose());return result;
    })()`);
    assert.ok(geometry.shared&&geometry.separate&&geometry.opaque);assert.equal(geometry.shown,6);
    assert.ok(geometry.size[0]<.56 && geometry.size[2]<.56 && geometry.size[1]<.30);
    assert.ok(geometry.animalHeight>.18 && geometry.animalHeight<.27,'Orientation verticale correcte après export');
    const before=await page.evaluate('JSON.stringify(gState)');
    await page.evaluate('Eredita.Board3D.update(gState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');
    assert.equal(await page.evaluate('JSON.stringify(gState)'),before);assert.equal(await page.evaluate('gDisposed'),0);
    const folder=path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});
    async function screenshot(name){const r=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(r.data,'base64'));}
    await screenshot('vaches_in_game');await page.click('#toggle-board-view');
    assert.match(await page.evaluate("getComputedStyle(document.querySelector('.livestock-vache .content-icon')).backgroundImage"),/herd-vache-grand-v1.webp/);
    await screenshot('vaches_web_2d');
    const sprites=await page.evaluate(`(async()=>{
      const result=[];for(const size of ['petit','moyen','grand']){
        const img=new Image();img.src='assets/generated/herd-vache-'+size+'-v1.webp';await img.decode();
        const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
        result.push([img.naturalWidth,img.naturalHeight,ctx.getImageData(0,0,1,1).data[3]]);
      }return result;
    })()`);
    assert.deepEqual(sprites,Array.from({length:3},()=>[256,256,0]));
    // Abattage réel dans le menu : 7 -> 2, petite variante et 40 viandes en banque.
    if(!await page.evaluate("!!document.querySelector('[data-slaughter=\"0\"]')"))await page.click('[data-select-slot="0"]');
    const meat=await page.evaluate('gState.players.red.villages[0].resources.viande');
    await page.click('#pause-game');
    await page.evaluate(`(()=>{const input=document.querySelector('[data-slaughter-quantity]');input.value='5';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-slaughter="0"]').click();})()`);
    await page.click('#pause-game');await page.evaluate('Eredita.Board3D.update(gState);Eredita.UI.render(gState)');
    assert.equal(await page.evaluate('gResult().variant'),'petit');assert.equal(await page.evaluate('gResult().shown'),2);
    assert.equal(await page.evaluate('Eredita.Economy.dairyAnimalCount(gState.players.red.villages[0])'),2);
    assert.equal(await page.evaluate('gState.players.red.villages[0].resources.viande'),meat+40);
    const lifecycle=await page.evaluate(`(()=>{
      const E=Eredita,s=gState;s.paused=false;
      const killed=E.Livestock.slaughter(s,'red',0,0,2);s.paused=true;E.UI.render(s);E.Board3D.update(s);
      const empty=!gHerd()&&s.players.red.villages[0].slots[0].content===null&&E.Economy.dairyAnimalCount(s.players.red.villages[0])===0;s.paused=false;
      const mountain=E.Livestock.place(s,'red',1,2,'vache'),goat=E.Livestock.place(s,'red',0,1,'chevre');
      const v=s.players.blue.villages[0];v.biome='littoral';v.slots=E.Biomes.createSlots('littoral');
      const coast=E.Livestock.place(s,'blue',0,0,'vache');s.paused=true;E.UI.render(s);E.Board3D.update(s);
      const ownMountain=!!gTile(1).getObjectByName('elevage-vache'),goatVisible=!!gTile().getObjectByName('elevage-chevre');
      const create=E.LivestockModels.create;E.LivestockModels.create=()=>null;E.Board3D.update(s,true);E.LivestockModels.create=create;
      const fallback=!!gTile(1).getObjectByName('elevage-vache-simple');E.Board3D.update(s,true);
      return {killed:!!killed,empty,mountain,coast,goat,ownMountain,goatVisible,fallback,restored:!!gTile(1).getObjectByName('elevage-vache'),disposed:gDisposed};
    })()`);
    assert.deepEqual(lifecycle,{killed:true,empty:true,mountain:true,coast:true,goat:true,ownMountain:true,goatVisible:true,fallback:true,restored:true,disposed:0});
    await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.consoleErrors,[]);assert.deepEqual(page.badResponses.filter(url=>!/favicon/.test(url)),[]);
    console.log('Vaches : placement, naissances, achats, effectifs, abattage, 3 variantes, cache, 2D/3D et repli validés.',JSON.stringify(diagnostics));
  }finally{if(browser)await browser.close();await new Promise(resolve=>site.server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
