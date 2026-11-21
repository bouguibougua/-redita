'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser,delay}=require('../scripts/export-menu-gif');
async function run(){const site=await startStaticServer();let browser;
try{
  browser=await startBrowser();const p=browser.page;
  await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await p.send('Page.navigate',{url:site.url+'?intro=0'});
  await p.waitFor('window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()');
  // Cette suite protège le repli illustré ; la scène a sa suite shop3d-browser dédiée.
  await p.evaluate('Eredita.Config.shopScene.enabled=false');
  await p.click('[data-menu-screen="play"]');await p.click('#training-button');await p.waitFor("Eredita.Network.mode==='solo'");
  // Fixture économique : seul ce navigateur de test reçoit un village intégralement débloqué.
  await p.evaluate(`(()=>{const E=Eredita,s=window.shopState=E.GameView.getState();s.phase='running';s.paused=false;s.preparationRemaining=3600;s.elapsed=0;s.units=[];s.players.red.gold=20000;s.selectedVillage={playerId:'red',lane:0};
    for(const v of s.players.red.villages){v.biome='littoral';v.slots=E.Biomes.createSlots('littoral');v.buildings=['bergerie','artisanat','boucherie'].map((type,i)=>({type,level:3,id:'shop-'+v.lane+'-'+i}));v.equipment={tool:null,armor:null};v.maritime={barque:0,voilier:0,filet:0,filetTimer:0};for(const r of v.residents)Object.assign(r,{tool:null,armor:null,profession:'habitant',mission:'disponible',unitId:null,donkey:false});for(const key of E.Config.resources)v.resources[key]=2110;}
    s.selectedResidentId=s.players.red.villages[0].residents[0].id;E.MythologySession.start(s);E.UI.render(s);document.querySelectorAll('dialog[open]').forEach(d=>d.close());})()`);
  await p.click('#open-shop-modal');await p.waitFor("document.querySelector('#shop-modal').dataset.artReady==='true'");
  // Observer à l'apparition : l'effet dure 1,2 s, les allers-retours CDP peuvent être plus lents.
  await p.evaluate(`window.shopGoldEvents=[];new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)shopGoldEvents.push({type:n.className,text:n.textContent});}))).observe(document.querySelector('.shop-gold-effects'),{childList:true})`);
  assert.equal(await p.evaluate("document.querySelectorAll('[data-shop-object]').length"),22);
  assert.equal(await p.evaluate("document.querySelectorAll('[data-shop-sell]').length"),18);
  assert.equal(await p.evaluate("document.querySelectorAll('#shop-village-nav button').length"),2);
  assert.equal(await p.evaluate("document.querySelectorAll('.shop-catalog-only[aria-disabled=true]').length"),2);
  const move=async(x,y,click=false)=>{const point=await p.evaluate(`(()=>{const r=document.querySelector('.shop-scene').getBoundingClientRect();return {x:r.x+r.width*${x}/1672,y:r.y+r.height*${y}/941};})()`);await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});if(click){await p.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});}};
  await move(635,470);assert.equal(await p.evaluate("document.querySelector('[data-shop-object=armors-cuir]').classList.contains('is-hovered')"),true);
  await delay(280);
  async function capture(name){if(!process.env.EREDITA_SHOP_PREVIEW_DIR)return;fs.mkdirSync(process.env.EREDITA_SHOP_PREVIEW_DIR,{recursive:true});const r=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(process.env.EREDITA_SHOP_PREVIEW_DIR,name+'.png'),Buffer.from(r.data,'base64'));}
  await capture('boutique-survol');
  await move(710,450);assert.equal(await p.evaluate("document.querySelectorAll('.shop-object.is-hovered').length"),0,'Le mur entre les articles ne constitue pas une hitbox');
  let gold=await p.evaluate('shopState.players.red.gold');await move(635,470,true);
  assert.equal(await p.evaluate('shopState.players.red.gold'),gold-150);assert.equal(await p.evaluate('shopState.players.red.villages[0].equipment.armor'),'cuir');
  assert.ok(await p.evaluate("shopGoldEvents.some(e=>e.type==='gold-loss'&&e.text.includes('150'))"));
  assert.equal(await p.evaluate("document.querySelector('[data-shop-object=armors-cuir]').hidden"),true);
  gold=await p.evaluate('shopState.players.red.gold');await move(635,470,true);assert.equal(await p.evaluate('shopState.players.red.gold'),gold,'Pas de rachat de l’armure équipée');
  await move(189,349,true);assert.equal(await p.evaluate("shopState.players.red.villages[0].animals.filter(a=>a.type==='chien').length"),1);
  await move(420,550,true);
  assert.equal(await p.evaluate('shopState.players.red.villages[0].waitingDonkeys'),1,'Un âne acheté attend à la base');
  assert.equal(await p.evaluate("document.querySelector('[data-shop-donkey-stock]').textContent"),'Ânes à la base · 1');
  await p.evaluate("Eredita.GameView.command('setProfession',shopState.players.red.villages[0].residents[0].id,'agriculteur')");
  assert.equal(await p.evaluate('shopState.players.red.villages[0].residents[0].donkey'),true,'L’âne rejoint automatiquement le nouvel agriculteur');
  assert.equal(await p.evaluate("document.querySelector('[data-shop-donkey-stock]').textContent"),'Ânes à la base · 0');
  await move(1470,717,true);assert.equal(await p.evaluate('shopState.players.red.villages[0].maritime.barque'),1);
  assert.equal(await p.evaluate("document.querySelector('[data-shop-object=barque]').hidden"),true);
  assert.equal(await p.evaluate("document.querySelector('[data-shop-vessel=voilier]')"),null,'Le voilier est retiré de l’échoppe');
  assert.equal(await p.evaluate('shopState.players.red.villages[0].maritime.voilier'),0);
  for(let count=1;count<=3;count++){await move(1222,255,true);assert.equal(await p.evaluate('shopState.players.red.villages[0].maritime.filet'),count);assert.equal(await p.evaluate("document.querySelector('[data-shop-object=filet]').hidden"),count===3);}
  const maxNetGold=await p.evaluate('shopState.players.red.gold');await move(1222,255,true);assert.equal(await p.evaluate('shopState.players.red.gold'),maxNetGold);
  gold=await p.evaluate('shopState.players.red.gold');await move(1222,550,true);assert.equal(await p.evaluate('shopState.players.red.gold'),gold,'Piège visible mais inactif');
  for(const resource of ['ble','chataigne','raisin','viande','poisson','lait']){
    for(const quantity of [10,100,1000]){const before=await p.evaluate(`shopState.players.red.villages[0].resources.${resource}`);gold=await p.evaluate('shopState.players.red.gold');const expected=await p.evaluate(`Eredita.Economy.saleQuote(shopState.players.red.villages[0],'${resource}',${quantity}).gold`);await p.click(`[data-shop-sell=${resource}][data-quantity="${quantity}"]`);assert.equal(await p.evaluate(`shopState.players.red.villages[0].resources.${resource}`),before-quantity);assert.equal(await p.evaluate('shopState.players.red.gold'),gold+expected);}
  }
  assert.ok(await p.evaluate("shopGoldEvents.some(e=>e.type==='gold-gain')"));await capture('boutique-transactions');
  await p.click('[data-shop-village="1"]');assert.equal(await p.evaluate("document.querySelector('[data-illustrated-stock=ble]').textContent"),'2 110');
  assert.equal(await p.evaluate('shopState.players.red.villages[1].equipment.armor'),null);
  await move(635,470,true);assert.equal(await p.evaluate('shopState.players.red.villages[1].equipment.armor'),'cuir');
  await p.click('[data-shop-village="0"]');assert.equal(await p.evaluate('shopState.players.red.villages[0].maritime.barque'),1);assert.equal(await p.evaluate('shopState.players.red.villages[0].resources.ble'),1000);
  await p.evaluate("shopState.players.red.gold=0;shopState.players.red.villages[0].resources.ble=9;Eredita.UI.render(shopState)");
  const snapshot=await p.evaluate('JSON.stringify(shopState.players.red)');await move(815,300,true);await p.click('[data-shop-sell=ble][data-quantity="10"]');assert.equal(await p.evaluate('JSON.stringify(shopState.players.red)'),snapshot);
  await p.click('.shop-manage');assert.equal(await p.evaluate("document.querySelector('#shop-modal-content').hidden"),false);assert.ok(await p.evaluate("document.querySelector('.companion-roster')"));
  assert.equal(await p.evaluate("document.querySelector('[data-buy-shop-item=voilier]')"),null,'Le voilier est également retiré de Gestion');
  await p.click('.shop-manage');
  // Activation clavier sur un article, puis fermeture avec restauration du focus.
  await p.evaluate("shopState.players.red.gold=5000;Eredita.UI.render(shopState);document.querySelector('[data-shop-object=tools-bois]').focus()");
  await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await p.evaluate('shopState.players.red.villages[0].equipment.tool'),'bois', await p.evaluate(`JSON.stringify({focus:document.activeElement.outerHTML.slice(0,250),managing:document.querySelector('.shop-scene').className,feedback:document.querySelector('.shop-feedback').textContent})`));
  await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.equal(await p.evaluate("document.querySelector('#shop-modal').hidden"),true);assert.equal(await p.evaluate('document.activeElement.id'),'open-shop-modal');
  await p.click('#open-shop-modal');
  for(const [width,height] of [[1440,1000],[844,390],[390,844]]){
    await p.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});await delay(250);
    assert.ok(await p.evaluate(`(()=>{const r=document.querySelector('.shop-modal-panel').getBoundingClientRect();return r.left>=0&&r.right<=${width}&&r.top>=0&&r.bottom<=${height}})()`),`Boutique entière sur ${width}×${height}`);
    await capture(`boutique-${width}x${height}`);
  }
  await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await p.evaluate(`(()=>{Object.assign(shopState,Eredita.Board.createState('classic'));shopState.phase='running';shopState.preparationRemaining=3600;Eredita.UI.render(shopState);})()`);
  assert.equal(await p.evaluate("document.querySelectorAll('#shop-village-nav button').length"),4);await p.click('[data-shop-village="3"]');assert.equal(await p.evaluate('shopState.selectedVillage.lane'),3);await capture('boutique-quatre-villages');
  await p.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await p.evaluate("getComputedStyle(document.querySelector('.shop-cutout')).animationName"),'none');
  assert.deepEqual(p.errors,[]);assert.deepEqual(p.consoleErrors,[]);assert.deepEqual(p.badResponses.filter(u=>/\/(assets|js|css)\//.test(u)),[]);
  console.log('Boutique illustrée : silhouettes, achats souris/clavier, 18 ventes, or partagé, villages, pièges inactifs, refus, gestion et trois formats validés.');
}finally{await browser?.close();await new Promise(r=>site.server.close(r));}}
run().catch(e=>{console.error(e);process.exitCode=1;});
