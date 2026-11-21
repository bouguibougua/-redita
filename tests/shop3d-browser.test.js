'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser,delay}=require('../scripts/export-menu-gif');
async function run(){
  const site=await startStaticServer();let browser;
  try{
    browser=await startBrowser();const p=browser.page;
    await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await p.send('Page.navigate',{url:site.url+'?intro=0'});
    await p.waitFor('window.Eredita?.GameView?.getState()',60000);
    await p.click('[data-menu-screen="play"]');await p.click('#training-button');
    // État économique réservé à ce navigateur de test ; les règles de production ne changent pas.
    await p.evaluate(`(()=>{const E=Eredita,s=window.shopState=E.GameView.getState();s.phase='running';s.preparationRemaining=3600;s.paused=false;
      s.players.red.gold=20000;s.selectedVillage={playerId:'red',lane:0};
      for(const v of s.players.red.villages){v.biome='littoral';v.slots=E.Biomes.createSlots('littoral');v.buildings=['bergerie','artisanat','boucherie'].map(type=>({type,level:3}));for(const key of E.Config.resources)v.resources[key]=2110;}
      window.shopSounds=[];window.shopReceipts=[];const original=E.Audio.playEffect;E.Audio.playEffect=function(name){shopSounds.push(name);return original(name);};E.ShopTransactions.subscribe(r=>shopReceipts.push(r));
      E.UI.render(s);})()`);
    await p.click('#open-shop-modal');
    await p.waitFor('document.querySelector("#shop-modal").dataset.modelsReady==="true" && Eredita.IllustratedShop.scene3D?.diagnostics.drawCalls>0',60000);
    const diag=await p.evaluate('Eredita.IllustratedShop.scene3D.diagnostics');
    assert.equal(diag.objects,22);assert.deepEqual(diag.errors,{});assert.ok(diag.triangles>5000);
    assert.equal(await p.evaluate('document.querySelectorAll(".shop-3d-canvas").length'),1);
    assert.equal(await p.evaluate('getComputedStyle(document.querySelector(".shop-object svg")).visibility'),'hidden');
    async function capture(name){if(!process.env.EREDITA_SHOP_PREVIEW_DIR)return;const dir=process.env.EREDITA_SHOP_PREVIEW_DIR;fs.mkdirSync(dir,{recursive:true});const r=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(r.data,'base64'));}
    await capture('boutique-3d');
    // Chercher un point dans le rectangle calculé à partir du modèle 3D.
    async function point(id){return p.evaluate(`(()=>{const shop=Eredita.IllustratedShop.scene3D,id=${JSON.stringify(id)},r=document.querySelector('.shop-3d-canvas').getBoundingClientRect();
      const [x,y,w,h]=shop.diagnostics.items[id].hitBounds;for(const v of [.5,.3,.7,.2,.8])for(const u of [.5,.3,.7,.2,.8]){
      const px=Math.round(r.x+(x+w*u)/1672*r.width),py=Math.round(r.y+(y+h*v)/941*r.height);
      if(shop.hit({clientX:px,clientY:py})===id)return {x:px,y:py};}return null;})()`);}
    async function clickObject(id){const pos=await point(id);assert.ok(pos,`Article cliquable : ${id}`);await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});await p.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos});}
    const time=await p.evaluate('shopState.preparationRemaining');
    await clickObject('armors-cuir');
    assert.equal(await p.evaluate('shopState.players.red.gold'),19850);
    assert.equal(await p.evaluate('shopState.players.red.villages[0].equipment.armor'),'cuir');
    assert.deepEqual(await p.evaluate('shopSounds'),['shopPurchase']);
    assert.equal(await p.evaluate('shopReceipts.at(-1).deltaGold'),-150);
    assert.equal(await p.evaluate('Eredita.IllustratedShop.scene3D.diagnostics.items["tools-bronze"].allowed'),false,'Pierre requis malgré Artisanat T3');
    assert.equal(await p.evaluate('Eredita.IllustratedShop.scene3D.diagnostics.items["armors-maille"].allowed'),true,'Cuir débloque les mailles');
    assert.equal(await p.evaluate('Eredita.IllustratedShop.scene3D.root.getObjectByName("sold-armors-cuir").visible'),true);
    assert.equal(await point('armors-cuir'),null,'Un objet vendu ne reste pas sélectionnable');
    await capture('boutique-3d-vindutu');
    await p.click('[data-shop-village="1"]');
    assert.equal(await p.evaluate('Eredita.IllustratedShop.scene3D.diagnostics.items["armors-cuir"].sold'),false);
    assert.equal(await p.evaluate('shopState.players.red.villages[1].equipment.armor'),null);
    await p.click('[data-shop-village="0"]');
    assert.equal(await p.evaluate('Eredita.IllustratedShop.scene3D.diagnostics.items["armors-cuir"].sold'),true);
    // Animaux réachetables, filets épuisables et pièges inactifs restent des règles du moteur.
    await clickObject('chien');await clickObject('chien');
    assert.equal(await p.evaluate('shopState.players.red.villages[0].animals.length'),2);
    for(let i=0;i<3;i++)await clickObject('filet');
    assert.equal(await p.evaluate('shopState.players.red.villages[0].maritime.filet'),3);
    assert.equal(await p.evaluate('Eredita.IllustratedShop.scene3D.diagnostics.items.filet.sold'),true);
    const beforeTrap=await p.evaluate('shopState.players.red.gold');await clickObject('piege-chasse');
    assert.equal(await p.evaluate('shopState.players.red.gold'),beforeTrap);
    assert.equal(await p.evaluate('shopSounds.filter(n=>n==="shopPurchase").length'),6,'Aucun son de réussite pour le piège inactif');
    const beforeSale=await p.evaluate('shopState.players.red.gold');
    await p.click('[data-shop-sell="poisson"][data-quantity="100"]');
    assert.equal(await p.evaluate('shopState.players.red.villages[0].resources.poisson'),2010);
    assert.equal(await p.evaluate('shopState.players.red.gold'),beforeSale+230);
    assert.equal(await p.evaluate('shopSounds.at(-1)'),'shopSale');
    assert.equal(await p.evaluate('shopReceipts.at(-1).deltaGold'),230);
    await p.waitFor(`shopState.preparationRemaining<${time}`);
    assert.equal(await p.evaluate('shopState.paused'),false,'La boutique ne met pas la simulation en pause');
    await p.evaluate('shopState.players.red.gold=0;Eredita.UI.render(shopState)');
    await clickObject('tools-bronze');assert.equal(await p.evaluate('shopState.players.red.villages[0].equipment.tool'),null);
    assert.equal(await p.evaluate('Eredita.IllustratedShop.scene3D.diagnostics.items["tools-bronze"].allowed'),false);
    await p.evaluate('shopState.players.red.villages[0].destroyed=true;shopState.players.red.gold=1000;Eredita.UI.render(shopState)');
    await clickObject('tools-fer');assert.equal(await p.evaluate('shopState.players.red.gold'),1000);
    assert.equal(await p.evaluate('shopSounds.filter(n=>n==="shopPurchase").length'),6,'Ni manque d’or ni destruction ne joue le son de réussite');
    // La vue Gestion conserve les fonctions historiques et suspend seulement le dessin de la scène.
    await p.click('.shop-manage');assert.equal(await p.evaluate('Eredita.IllustratedShop.scene3D.diagnostics.running'),false);
    await p.click('.shop-manage');assert.equal(await p.evaluate('Eredita.IllustratedShop.scene3D.diagnostics.running'),true);
    for(const [width,height] of [[844,390],[390,844]]){
      await p.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await delay(200);
      assert.ok(await p.evaluate(`(()=>{const r=document.querySelector('.shop-3d-canvas').getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=${width}&&Math.abs(r.width/r.height-1672/941)<.02})()`));
      if(width<height){
        const pos=await point('chien');
        assert.ok(pos,'Le collier reste accessible en portrait');
        await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});
        await p.waitFor('Eredita.IllustratedShop.scene3D.diagnostics.hovered==="chien" && Eredita.IllustratedShop.scene3D.diagnostics.items.chien.hoverAmount>.8');
      }
      await capture(`boutique-3d-${width}x${height}`);
    }
    await p.click('#close-shop-modal');assert.equal(await p.evaluate('Eredita.IllustratedShop.scene3D.diagnostics.running'),false);
    await p.click('#open-shop-modal');assert.equal(await p.evaluate('document.querySelector("#shop-modal").hidden'),true,'Village détruit : ouverture refusée');
    await p.evaluate('Eredita.GameView.selectVillage("red",1)');await p.click('#open-shop-modal');
    assert.equal(await p.evaluate('document.querySelectorAll(".shop-3d-canvas").length'),1,'Réouverture sans second renderer');
    await p.evaluate(`document.querySelector('.shop-3d-canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true}))`);
    assert.equal(await p.evaluate('Eredita.IllustratedShop.scene3D.ready'),false);
    assert.equal(await p.evaluate('getComputedStyle(document.querySelector(".shop-object svg")).visibility'),'visible','Repli illustré si contexte perdu');
    assert.deepEqual(p.errors,[]);assert.deepEqual(p.consoleErrors,[]);
    assert.deepEqual(p.badResponses.filter(u=>/\/(assets|js|css)\//.test(u)),[]);
    console.log('Boutique 3D : modèles, zones rectangulaires, achat souris, VINDUTU, villages indépendants, animaux, filets, pièges, ventes, refus, temps réel, responsive, réouverture et repli validés.');
  }finally{await browser?.close();await new Promise(r=>site.server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
