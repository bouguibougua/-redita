'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser,delay}=require('../scripts/export-menu-gif');
(async()=>{
 const site=await startStaticServer();let browser;
 try{
  browser=await startBrowser();const p=browser.page;
  await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await p.send('Page.navigate',{url:site.url+'?intro=0'});await p.waitFor('window.Eredita?.GameView?.getState()',60000);
  await p.click('[data-menu-screen="play"]');await p.click('#training-button');
  await p.evaluate(`(()=>{const E=Eredita,s=window.shopState=E.GameView.getState();s.phase='running';s.preparationRemaining=3600;s.paused=false;s.players.red.gold=20000;s.selectedVillage={playerId:'red',lane:0};
   for(const v of s.players.red.villages){v.biome='littoral';v.slots=E.Biomes.createSlots('littoral');v.buildings=['bergerie','artisanat','boucherie'].map(type=>({type,level:3}));for(const r of E.Config.resources)v.resources[r]=2110;}E.UI.render(s);})()`);
  await p.click('#open-shop-modal');await p.waitFor('document.querySelector("#shop-modal").dataset.modelsReady==="true"&&Eredita.IllustratedShop.scene3D?.diagnostics.drawCalls>0',90000);
  assert.deepEqual(await p.evaluate('Eredita.IllustratedShop.scene3D.diagnostics.errors'),{});
  const diag=id=>p.evaluate(`Eredita.IllustratedShop.scene3D.diagnostics.items[${JSON.stringify(id)}]`);
  async function point(id,side=0){return p.evaluate(`(()=>{const shop=Eredita.IllustratedShop.scene3D,id=${JSON.stringify(id)},r=document.querySelector('.shop-3d-canvas').getBoundingClientRect();const [x,y,w,h]=shop.diagnostics.items[id].hitBounds;
   const xs=${side<0?'[.28,.18,.38,.45,.5]':side>0?'[.72,.82,.62,.55,.5]':'[.5,.3,.7,.2,.8,.4,.6,.1,.9]'};
   for(const v of [.4,.3,.5,.2,.6,.1,.7,.8,.9])for(const u of xs){const px=Math.round(r.x+(x+w*u)/1672*r.width),py=Math.round(r.y+(y+h*v)/941*r.height);if(shop.hit({clientX:px,clientY:py})===id)return {x:px,y:py};}return null;})()`);}
  async function move(id,side=0){const pos=await point(id,side);assert.ok(pos,`Article pointable : ${id}`);await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});await p.waitFor(`Eredita.IllustratedShop.scene3D.diagnostics.hovered===${JSON.stringify(id)}&&Eredita.IllustratedShop.scene3D.diagnostics.items[${JSON.stringify(id)}].hoverAmount>.8`);return pos;}
  async function capture(name){if(!process.env.EREDITA_SHOP_PREVIEW_DIR)return;fs.mkdirSync(process.env.EREDITA_SHOP_PREVIEW_DIR,{recursive:true});const shot=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(process.env.EREDITA_SHOP_PREVIEW_DIR,name+'.png'),Buffer.from(shot.data,'base64'));}
  const decor=await p.evaluate('Eredita.IllustratedShop.scene3D.root.children[0].matrixWorld.elements.slice()');
  const ids=await p.evaluate('Eredita.ShopArt.map(item=>item.id)');
  assert.equal((await diag('chien')).source,'assets/models/shop/collier.glb');
  const corner=await p.evaluate(`(()=>{
    const shop=Eredita.IllustratedShop.scene3D;
    const r=document.querySelector('.shop-3d-canvas').getBoundingClientRect();
    const [x,y]=shop.diagnostics.items.filet.hitBounds;
    const at=(px,py)=>shop.hit({clientX:r.x+px/1672*r.width,clientY:r.y+py/941*r.height});
    return [at(x+2,y+2),at(x-2,y-2)];
  })()`);
  assert.deepEqual(corner,['filet',null],'Le coin vide du rectangle est sélectionnable, le décor voisin ne l’est pas');
  const foreground = await p.evaluate(`(()=>{
    const shop=Eredita.IllustratedShop.scene3D;
    const r=document.querySelector('.shop-3d-canvas').getBoundingClientRect();
    const [cx,cy,cw,ch]=shop.diagnostics.items.vache.hitBounds;
    const [px,py,pw,ph]=shop.diagnostics.items.cochon.hitBounds;
    const x=(Math.max(cx,px)+Math.min(cx+cw,px+pw))/2;
    const y=(Math.max(cy,py)+Math.min(cy+ch,py+ph))/2;
    return shop.hit({clientX:r.x+x/1672*r.width,clientY:r.y+y/941*r.height});
  })()`);
  assert.equal(foreground,'cochon','Le cochon est prioritaire dans la zone commune à la vache');
  for(const id of ids){await move(id);const item=await diag(id);assert.ok(item.displayScale[0]>1.07,id+' : agrandissement');assert.ok(item.displayPosition[2]>.3,id+' : avance');}
  const left=await move('armors-cuir',-1);await delay(220);const leftRotation=(await diag('armors-cuir')).displayRotation[1];
  const right=await move('armors-cuir',1);await delay(220);const rightRotation=(await diag('armors-cuir')).displayRotation[1];
  assert.ok(right.x>left.x&&rightRotation>leftRotation+.015,'Le même objet suit le curseur à gauche et à droite');
  assert.equal(await p.evaluate("document.querySelector('.shop-hover-frame')"),null,'La zone rectangulaire est invisible pendant le survol');
  await capture('boutique-hover-cuir');
  assert.deepEqual(await p.evaluate('Eredita.IllustratedShop.scene3D.root.children[0].matrixWorld.elements.slice()'),decor,'Le décor reste fixe');
  const locked=await move('tools-bronze');assert.equal((await diag('tools-bronze')).allowed,false);
  const gold=await p.evaluate('shopState.players.red.gold');
  await p.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...locked});await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...locked});
  assert.equal(await p.evaluate('shopState.players.red.gold'),gold,'Le survol ne débloque pas un achat');
  const sale=await p.evaluate(`(()=>{const r=document.querySelector('[data-shop-sell="raisin"][data-quantity="100"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',...sale});await p.waitFor('Eredita.IllustratedShop.scene3D.diagnostics.hovered==="raisin"');
  await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:10,y:10});await p.waitFor('Eredita.IllustratedShop.scene3D.diagnostics.hovered===null');await p.waitFor('Eredita.IllustratedShop.scene3D.diagnostics.items.raisin.hoverAmount<.002');
  const resting=await diag('raisin');assert.ok(resting.hoverAmount<.002);assert.ok(Math.abs(resting.displayScale[0]-1)<.001);
  await p.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await move('ane');
  const still=await diag('ane');assert.deepEqual(still.displayScale,[1,1,1]);assert.deepEqual(still.displayRotation,[0,0,0]);assert.deepEqual(still.displayPosition,[0,0,0]);
  await p.send('Emulation.setEmulatedMedia',{features:[]});
  assert.deepEqual(p.errors,[]);assert.deepEqual(p.consoleErrors,[]);assert.deepEqual(p.badResponses.filter(u=>/\/(assets|js|css)\//.test(u)),[]);
  console.log('Survol boutique : 22 zones invisibles, agrandissement, profondeur, suivi du curseur, retour au repos, paniers, objets verrouillés, décor fixe et mouvements réduits validés.');
 }finally{await browser?.close();await new Promise(r=>site.server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
