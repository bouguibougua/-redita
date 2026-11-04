'use strict';
const assert = require('node:assert/strict');
const { startStaticServer, startBrowser } = require('../scripts/export-menu-gif');

(async () => {
  const site = await startStaticServer(); let browser;
  try {
    browser = await startBrowser(); const page = browser.page;
    await page.send('Page.navigate', {url:site.url+'?intro=0'});
    await page.waitFor("document.readyState==='complete' && window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()");
    await page.click('[data-menu-screen="play"]'); await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.evaluate(`(() => {
      const E=Eredita,s=window.visibilityState=E.GameView.getState();
      s.phase='running';s.preparationRemaining=0;s.paused=false;s.units=[];
      E.MythologyEffects.init(s);
      for(const p of Object.values(s.players)){
        p.revealOffensive=false;p.revealCoasts=false;p.gold=1000;
        for(const v of p.villages){v.resources.ble=123;for(const r of v.residents){r.hp=50;r.unitId=null;r.mission='disponible';}}
      }
      const v=s.players.blue.villages[0];
      if(!E.Economy.deployResident(s,'blue',0,v.residents[0].id,'attaque'))throw Error('Déploiement ennemi impossible');
      s.paused=true;E.UI.render(s);E.Board3D.update(s,true);E.Board3D.setMode(true);
    })()`);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-terrain-fog').length"),0,'Aucun brouillard 2D');
    assert.equal(await page.evaluate("!!document.querySelector('.units-layer .unit.blue')"),true,'L’unité adverse est visible avant toute révélation');
    assert.equal(await page.evaluate("document.querySelectorAll('[data-map-village][data-player=blue]').length"),0,'Les fiches de stocks adverses ne sont plus affichées');
    assert.equal(await page.evaluate("Array.from(document.querySelectorAll('[data-map-village][data-player=red] [data-map-resource=ble]')).every(el=>el.textContent==='123')"),true,'Les stocks du joueur restent visibles');
    assert.equal(await page.evaluate(`(() => {
      const c=Eredita.Board3D.getXRContext();let fog=0;
      c.world.traverse(o=>{if(o.name==='mythology-fog')fog++});
      return fog===0&&c.world.children[1].children.some(f=>f.userData.visualSignature?.startsWith('blue:'));
    })()`),true,'Camp adverse visible sans cache 3D');
    assert.equal(await page.evaluate("Eredita.GameView.selectVillage('blue',0)"),false,'La consultation adverse est bloquée');
    assert.equal(await page.evaluate("Eredita.GameView.villageInfo('blue',0)"),null);
    assert.equal(await page.evaluate("visibilityState.selectedVillage.playerId"),'red');
    await page.evaluate("window.ownHud=document.querySelector('[data-map-village]');visibilityState.players.red.villages[0].resources.ble=124;Eredita.UI.renderFrame(visibilityState)");
    assert.equal(await page.evaluate("ownHud===document.querySelector('[data-map-village]')"),true,'La mise à jour ne recrée pas les fiches à chaque image');
    assert.equal(await page.evaluate("document.querySelector('[data-map-village][data-player=red] [data-map-resource=ble]').textContent"),'124');
    await page.evaluate(`(() => {
      window.networkDescriptors={mode:Object.getOwnPropertyDescriptor(Eredita.Network,'mode'),playerId:Object.getOwnPropertyDescriptor(Eredita.Network,'playerId')};
      Object.defineProperty(Eredita.Network,'mode',{value:'guest',configurable:true});
      Object.defineProperty(Eredita.Network,'playerId',{value:'blue',configurable:true});
      visibilityState.selectedVillage={playerId:'blue',lane:0};Eredita.UI.render(visibilityState);
    })()`);
    assert.equal(await page.evaluate("document.querySelectorAll('[data-map-village][data-player=blue]').length"),2,'Le joueur Bleu reçoit ses propres fiches');
    assert.equal(await page.evaluate("document.querySelectorAll('[data-map-village][data-player=red],[data-village-select][data-player=red]').length"),0);
    assert.equal(await page.evaluate("Eredita.GameView.selectVillage('red',0)"),false);
    await page.evaluate(`(() => {
      Object.defineProperty(Eredita.Network,'mode',networkDescriptors.mode);
      Object.defineProperty(Eredita.Network,'playerId',networkDescriptors.playerId);
      visibilityState.selectedVillage={playerId:'red',lane:0};Eredita.UI.render(visibilityState);
    })()`);
    await page.evaluate('Eredita.Board3D.setMode(false)');
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-terrain-fog').length"),0);
    assert.equal(page.errors.length,0,JSON.stringify(page.errors));
    assert.equal(page.consoleErrors.length,0,JSON.stringify(page.consoleErrors));
    console.log('Visibilité permanente : terrain et unités en 2D/3D ; seules les fiches du joueur sont visibles, sans consultation adverse.');
  } finally { await browser?.close(); await new Promise(resolve=>site.server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
