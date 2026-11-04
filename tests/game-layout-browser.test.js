'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { startStaticServer, startBrowser, delay } = require('../scripts/export-menu-gif');

(async () => {
  const site = await startStaticServer();
  let browser;
  try {
    browser = await startBrowser(); const page = browser.page;
    await page.send('Emulation.setDeviceMetricsOverride', {width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await page.send('Page.navigate', {url:site.url+'?intro=0'});
    await page.waitFor("document.readyState==='complete' && window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()");
    await page.click('[data-menu-screen="play"]'); await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.evaluate(`(() => {
      const E=Eredita,s=window.layoutState=E.GameView.getState(),p=s.players.red,v=p.villages[0];
      s.phase='running';s.paused=false;s.preparationRemaining=45;s.selectedVillage={playerId:'red',lane:0};
      p.gold=5000;v.biome='plaine';v.buildings=[];
      for(const key of E.Config.resources)v.resources[key]=2000;
      E.UI.render(s);E.Board3D.update(s,true);E.Board3D.setMode(true);
    })()`);
    assert.equal(await page.evaluate("document.querySelector('#building-market').previousElementSibling.id"),'open-shop-modal');
    await page.click('#building-market [data-build="bergerie"]');
    await page.waitFor("document.querySelector('#owned-buildings .building-bergerie')");
    assert.equal(await page.evaluate("layoutState.players.red.villages[0].buildings[0].type"),'bergerie');
    await page.click('#building-market [data-build="artisanat"]');
    assert.equal(await page.evaluate("document.querySelectorAll('#owned-buildings .building-card').length"),2);
    await page.evaluate("(()=>{const select=document.querySelector('#owned-buildings [data-upgrade-resource]');select.value='lait';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
    const before = await page.evaluate('layoutState.players.red.villages[0].resources.lait');
    await page.click('#owned-buildings [data-upgrade="0"]');
    assert.equal(await page.evaluate('layoutState.players.red.villages[0].buildings[0].level'),2);
    assert.equal(await page.evaluate('layoutState.players.red.villages[0].resources.lait'),before-100);
    await page.click('.management-professions [data-profession="agriculteur"]');
    assert.equal(await page.evaluate('layoutState.players.red.villages[0].residents[0].profession'),'agriculteur');
    await page.click('#open-shop-modal');
    assert.equal(await page.evaluate("document.querySelector('#shop-modal').hidden"),false);
    await page.click('#close-shop-modal');
    const peopleBefore=await page.evaluate('layoutState.players.red.villages[0].residents.length');
    await page.click('.management-village [data-buy-resident]');
    assert.equal(await page.evaluate('layoutState.players.red.villages[0].residents.length'),peopleBefore+1,'Achat d’habitant depuis le panneau Village');
    await page.evaluate('layoutState.paused=true;Eredita.UI.render(layoutState);layoutState.players.red.villages[0].damageSmoke=2;Eredita.Board3D.update(layoutState,true)');
    assert.equal(await page.evaluate("(()=>{const c=Eredita.Board3D.getXRContext();let count=0;c.world.traverse(o=>{if(o.userData.smoke)count++});return count===0&&c.scene.fog===null;})()"),true,'Pas de fumée ni de brume décorative');
    await page.evaluate('layoutState.paused=false;layoutState.players.red.villages[0].damageSmoke=0;Eredita.UI.render(layoutState);Eredita.Board3D.update(layoutState,true)');
    for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[390,844],[320,568],[844,390]]) {
      await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<801});
      await delay(250);
      const layout = await page.evaluate(`(() => {
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        return {pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,
          panels:['.character-panel','.board-panel','.management-professions','.management-village','.side-panel'].map(rect)};
      })()`);
      assert.ok(layout.pageWidth<=width+1&&layout.pageHeight<=height+1,`${width}×${height} : page débordante ${JSON.stringify(layout)}`);
      for(const panel of layout.panels) assert.ok(panel.x>=-1&&panel.y>=-1&&panel.right<=width+1&&panel.bottom<=height+1&&panel.width>0&&panel.height>0,`${width}×${height} : panneau hors écran ${JSON.stringify(panel)}`);
      assert.equal(await page.evaluate("Array.from(document.querySelectorAll('.resident-card')).every(card=>{const r=card.getBoundingClientRect(),t=card.querySelector('strong').getBoundingClientRect();return t.top>=r.top&&t.bottom<=r.bottom})"),true,'Les noms restent dans leur fiche');
      if(width>=801) {
        const [people,map,jobs,village,tools]=layout.panels;
        assert.ok(people.right<=map.x+1&&tools.x>=map.right-1&&jobs.y>=map.bottom-1&&village.x>=jobs.right-1);
        assert.ok(Math.abs(map.x+map.width/2-width/2)<2,'Carte centrée dans le viewport');
      }
      assert.equal(await page.evaluate(`(() => {
        const c=Eredita.Board3D.getXRContext(),half=Eredita.Board3D.getBoardWidth()/2;
        c.camera.updateMatrixWorld();c.world.updateMatrixWorld(true);
        for(const x of [-half,half])for(const z of [-5.5,5.5]){
          const p=c.world.localToWorld(new c.THREE.Vector3(x,.1,z)).project(c.camera);
          if(Math.abs(p.x)>1||Math.abs(p.y)>1)return false;
        }return true;
      })()`),true,`${width}×${height} : le plateau 3D tient dans son cadre`);
      const folder=process.env.EREDITA_LAYOUT_PREVIEW_DIR;
      if(folder){fs.mkdirSync(folder,{recursive:true});const capture=await page.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,`${width}x${height}.png`),Buffer.from(capture.data,'base64'));}
    }
    await page.evaluate('Eredita.Board3D.setMode(false)');
    assert.equal(await page.evaluate("document.querySelector('#battlefield-3d').hidden"),true);
    await page.evaluate('Eredita.Board3D.setMode(true)');
    await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await page.evaluate("(()=>{const c=Eredita.Board.createState('classic');layoutState.players=c.players;layoutState.format='classic';Eredita.UI.render(layoutState);Eredita.Board3D.update(layoutState,true);})()");
    await delay(250);
    assert.equal(await page.evaluate("document.querySelectorAll('[data-map-village]').length"),8,'Les huit villages du format classique restent accessibles');
    assert.equal(page.errors.length,0,JSON.stringify(page.errors));
    assert.equal(page.consoleErrors.length,0,JSON.stringify(page.consoleErrors));
    assert.equal(page.badResponses.filter(url=>/\/(assets|js|css)\//.test(url)).length,0,JSON.stringify(page.badResponses));
    console.log('Layout : 7 tailles sans débordement, carte centrée, construction, bâtiment possédé, amélioration, métier, boutique et absence de fumée validés.');
  } finally { await browser?.close(); await new Promise(resolve=>site.server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
