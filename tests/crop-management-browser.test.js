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
    await page.click('[data-menu-screen="play"]');await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");await page.click('[data-setup-action="keep"][data-player="red"]');await page.click('#start-game');
    await page.waitFor("Eredita.GameView.getState().phase==='running'");await page.click('#pause-game');
    await page.evaluate(`(()=>{
      const E=Eredita,s=window.cState=E.GameView.getState();s.paused=true;s.preparationRemaining=60;s.players.red.gold=2000;
      for(const p of Object.values(s.players))for(const v of p.villages){v.biome=v.lane===0?'plaine':'montagne';v.slots=E.Biomes.createSlots(v.biome);v.terrain={};v.burnUntil=0;v.curseUntil=0;}
      E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
      document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      window.cCrop=()=>cState.players.red.villages[cState.selectedVillage.lane].slots[0].content;
    })()`);
    await page.click('#pause-game');
    const folder=path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});
    async function screenshot(name){const r=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(r.data,'base64'));}
    async function select(lane,index){
      await page.evaluate(`Eredita.GameView.selectVillage('red',${lane})`);
      if(!await page.evaluate(`document.querySelector('[data-select-slot="${index}"]').getAttribute('aria-expanded')==='true'`))await page.click(`[data-select-slot="${index}"]`);
    }
    for(const [type,lane] of [['ble',0],['chataignier',0],['vignoble',1]]){
      await select(lane,0);
      await page.evaluate('cState.preparationRemaining=60');
      assert.match(await page.evaluate(`document.querySelector('[data-place-crop="${type}"]').textContent`),/75 or/);
      await page.click(`[data-place-crop="${type}"][data-slot-index="0"]`);
      assert.equal(await page.evaluate('cCrop().level'),1);assert.equal(await page.evaluate('cState.players.red.gold'),1925);
      const order=await page.evaluate(`(()=>{
        const a=document.querySelector('[data-remove-slot="0"]').getBoundingClientRect(),b=document.querySelector('[data-upgrade-crop="0"]').getBoundingClientRect();
        return {left:a.x<b.x,sameLine:Math.abs(a.y-b.y)<2};
      })()`);
      assert.deepEqual(order,{left:true,sameLine:true});
      for(const [level,cost,balance] of [[2,150,1775],[3,300,1475]]){
        assert.match(await page.evaluate("document.querySelector('[data-upgrade-crop=\"0\"]').textContent"),new RegExp(cost+' or'));
        await page.click('[data-upgrade-crop="0"]');
        assert.equal(await page.evaluate('cCrop().level'),level);assert.equal(await page.evaluate('cState.players.red.gold'),balance);
        assert.equal(await page.evaluate('cCrop().hp'),200);
        assert.match(await page.evaluate("document.querySelector('[data-select-slot=\"0\"]').textContent"),new RegExp('N'+level));
      }
      assert.equal(await page.evaluate("document.querySelector('[data-upgrade-crop=\"0\"]').disabled"),true);
      assert.equal(await page.evaluate("Eredita.GameView.command('upgradeCrop',0)"),false);
      assert.match(await page.evaluate("document.querySelector('[data-remove-slot=\"0\"]').textContent"),/525 or/);
      if(type==='ble')await screenshot('cultures_preparation');
      await page.click('[data-remove-slot="0"]');
      assert.equal(await page.evaluate('cCrop()'),null);assert.equal(await page.evaluate('cState.players.red.gold'),2000);
    }
    await select(0,0);
    await page.evaluate('cState.players.red.gold=74;Eredita.UI.render(cState)');
    assert.equal(await page.evaluate("document.querySelector('[data-place-crop=ble]').disabled"),true);
    assert.equal(await page.evaluate("Eredita.GameView.command('placeCrop','ble',0)"),false);
    await page.evaluate('cState.players.red.gold=2000;cState.preparationRemaining=60;Eredita.UI.render(cState)');
    await page.click('[data-place-crop="ble"][data-slot-index="0"]');
    await select(0,1);await page.click('[data-place-livestock="chevre"][data-slot-index="1"]');
    assert.match(await page.evaluate("document.querySelector('[data-remove-slot=\"1\"]').textContent"),/Retirer/);
    const meat=await page.evaluate('cState.players.red.villages[0].resources.viande');
    await page.click('[data-remove-slot="1"]');
    assert.equal(await page.evaluate('cState.players.red.villages[0].slots[1].content'),null);
    assert.equal(await page.evaluate('cState.players.red.villages[0].resources.viande'),meat);
    await page.click('[data-place-livestock="chevre"][data-slot-index="1"]');
    await select(0,0);
    // Laisser la vraie boucle franchir zéro : le retrait disparaît et Améliorer revient à gauche.
    await page.evaluate('cState.preparationRemaining=.03');
    await page.waitFor('cState.preparationRemaining===0 && !document.querySelector("[data-remove-slot]")');
    assert.equal(await page.evaluate(`(()=>{
      const b=document.querySelector('[data-upgrade-crop="0"]');return Math.abs(b.getBoundingClientRect().left-b.parentElement.getBoundingClientRect().left)<2;
    })()`),true);
    const gold=await page.evaluate('cState.players.red.gold');
    assert.equal(await page.evaluate("Eredita.GameView.command('removeSlot',0)"),false);
    assert.equal(await page.evaluate('cState.players.red.gold'),gold);assert.equal(await page.evaluate('cCrop().type'),'ble');
    await page.click('[data-upgrade-crop="0"]');assert.equal(await page.evaluate('cCrop().level'),2);
    await screenshot('cultures_combat');
    await select(0,1);
    assert.equal(await page.evaluate("!!document.querySelector('[data-remove-slot]')"),false);
    await page.click('[data-slaughter-all="1"]');
    assert.equal(await page.evaluate('cState.players.red.villages[0].slots[1].content'),null);
    assert.equal(await page.evaluate('cState.players.red.villages[0].resources.viande'),meat+4);
    await select(0,0);await page.click('#toggle-board-view');
    assert.match(await page.evaluate("document.querySelector('.region.red .crop-ble').textContent"),/N2/);
    assert.match(await page.evaluate("document.querySelector('.region.red .crop-ble [data-crop-yield]').textContent"),/2/);
    await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.consoleErrors,[]);assert.deepEqual(page.badResponses.filter(url=>!/favicon/.test(url)),[]);
    console.log('Gestion des cultures : 75/150/300 or, niveaux, remboursement, fin de préparation, disposition et abattage total validés.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>site.server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
