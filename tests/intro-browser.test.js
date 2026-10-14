'use strict';
// Vrai Canvas 2D, clavier/souris/tactile et ressources servies sous /-redita/.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser,delay}=require('../scripts/export-menu-gif.js');
async function run() {
  const site=await startStaticServer();let browser;
  const previewDir=process.env.EREDITA_INTRO_PREVIEW_DIR;
  async function screenshot(page,name) {
    if (!previewDir) return;
    fs.mkdirSync(previewDir,{recursive:true});
    const shot=await page.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(previewDir,name+'.png'),Buffer.from(shot.data,'base64'));
  }
  try {
    browser=await startBrowser();const page=browser.page;
    await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await page.send('Page.navigate',{url:site.url});
    await page.waitFor('window.Eredita?.Intro?.diagnostics.layout && window.Eredita?.GameView?.getState() && Eredita.MenuScene.diagnostics.ready');
    assert.equal(await page.evaluate('Eredita.Intro.active'),true,'Lecture automatique au premier chargement');
    assert.equal(await page.evaluate("document.querySelector('#main-menu').inert"),true);
    assert.equal(await page.evaluate('Eredita.MenuScene.diagnostics.active'),false,'Le décor 3D attend la fin de l’introduction');
    const state=await page.evaluate('JSON.stringify(Eredita.GameView.getState())');
    const start=Date.now();
    await page.waitFor("Eredita.Intro.diagnostics.phase==='logo'",12000);
    await page.waitFor('!Eredita.Intro.active',12000);
    assert.ok(Date.now()-start<9500,'Séquence de sept secondes et courte transition');
    assert.equal(await page.evaluate('JSON.stringify(Eredita.GameView.getState())'),state,'La présentation ne modifie pas la partie');
    assert.equal(await page.evaluate("document.querySelector('#main-menu').inert"),false);
    assert.equal(await page.evaluate("document.activeElement.matches('#main-menu [data-menu-screen=play]')"),true);
    assert.equal(await page.evaluate('Eredita.MenuScene.diagnostics.active'),true);

    // F9 relance ; cliquer à l’emplacement de JOUER doit seulement passer l’intro.
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'F9',code:'F9',windowsVirtualKeyCode:120});
    await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'F9',code:'F9',windowsVirtualKeyCode:120});
    await page.waitFor('Eredita.Intro.diagnostics.layout');
    const point=await page.evaluate("(()=>{const r=document.querySelector('[data-menu-screen=play]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
    await page.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
    await page.waitFor('!Eredita.Intro.active');
    assert.equal(await page.evaluate("document.querySelector('#menu-subscreen').hidden"),true,'Aucun clic transmis au menu');
    assert.equal(await page.evaluate('Eredita.Network.mode'),'pending');
    await page.evaluate('Eredita.Intro.replay()');
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await page.waitFor('!Eredita.Intro.active');
    // Une fin avant la résolution du chargement ne doit pas rouvrir l’intro.
    await page.evaluate('Eredita.Intro.replay();Eredita.Intro.skip();true');
    await page.waitFor('!Eredita.Intro.active');await delay(80);
    assert.equal(await page.evaluate("document.querySelector('#game-intro').hidden && !document.querySelector('#main-menu').inert"),true);

    await page.evaluate('Eredita.Intro.replay({paused:true})');
    for(const t of [.5,2.6,3.9,4.9,5.5,7]) {
      assert.equal(await page.evaluate(`Eredita.Intro.seek(${t})`),true);
      await screenshot(page,'intro-'+t);
    }
    // À 7 s, comparaison pixel par pixel avec le PNG original dessiné directement.
    const comparison=await page.evaluate(`(async()=>{
      const original=new Image();original.src=Eredita.Config.menu.logo;await original.decode();
      const actual=document.querySelector('#intro-canvas'),expected=document.createElement('canvas');expected.width=actual.width;expected.height=actual.height;
      const c=expected.getContext('2d'),r=Eredita.Intro.diagnostics.layout;c.setTransform(r.pixelRatio,0,0,r.pixelRatio,0,0);c.fillStyle='#050608';c.fillRect(0,0,r.viewportWidth,r.viewportHeight);c.drawImage(original,r.x,r.y,r.width,r.height);
      const a=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data,b=c.getImageData(0,0,expected.width,expected.height).data;
      let different=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])different++;
      return {different,aspect:r.width/r.height,originalAspect:original.width/original.height};
    })()`);
    assert.equal(comparison.different,0,'Le rendu final est exactement celui du PNG, sans déformation ni recoloration');
    assert.ok(Math.abs(comparison.aspect-comparison.originalAspect)<1e-10);
    await page.evaluate('Eredita.Intro.skip()');await page.waitFor('!Eredita.Intro.active');
    await page.click('[data-menu-screen="decks"]');await page.waitFor("!!document.querySelector('.deck-builder')");
    await page.click('#menu-back');await page.waitFor("!document.querySelector('#main-menu').hidden");
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.badResponses,[]);

    const mobile=await browser.newPage();
    await mobile.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
    await mobile.send('Emulation.setTouchEmulationEnabled',{enabled:true});
    await mobile.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await mobile.send('Page.navigate',{url:site.url+'?intro=preview'});
    await mobile.waitFor('window.Eredita?.Intro?.diagnostics.layout');
    assert.equal(await mobile.evaluate('Eredita.Intro.diagnostics.reducedMotion'),true);
    const bounds=await mobile.evaluate('Eredita.Intro.diagnostics.layout');
    assert.ok(bounds.x>=0 && bounds.x+bounds.width<=390 && bounds.y>=0 && bounds.y+bounds.height<=844);
    assert.ok(bounds.pixelRatio<=1.5);
    const staticFrame=await mobile.evaluate("document.querySelector('#intro-canvas').toDataURL()");
    await mobile.evaluate('Eredita.Intro.seek(3.5)');
    assert.equal(await mobile.evaluate("document.querySelector('#intro-canvas').toDataURL()"),staticFrame,'Mouvement réduit : logo statique, aucun ruban animé');
    await screenshot(mobile,'intro-mobile-reduit');
    await mobile.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:430}]});
    await mobile.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await mobile.waitFor('!Eredita.Intro.active');
    await mobile.evaluate('Eredita.Intro.replay()');await mobile.waitFor('!Eredita.Intro.active',3000);
    assert.equal(await mobile.evaluate("document.querySelector('#main-menu').inert"),false);
    assert.deepEqual(mobile.errors,[]);

    const fallback=await browser.newPage();
    await fallback.send('Page.addScriptToEvaluateOnNewDocument',{source:"const nativeContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return this.id==='intro-canvas'&&type==='2d'?null:nativeContext.call(this,type,...args);};"});
    await fallback.send('Page.navigate',{url:site.url+'?intro=preview'});
    await fallback.waitFor("window.Eredita?.Intro?.diagnostics.error==='Canvas 2D indisponible'");
    assert.equal(await fallback.evaluate("!document.querySelector('#intro-fallback').hidden && document.querySelector('#intro-fallback').naturalWidth===2172"),true);
    await fallback.click('#intro-skip');await fallback.waitFor('!Eredita.Intro.active');
    assert.deepEqual(fallback.errors,[]);

    const failed=await browser.newPage();
    await failed.send('Network.setBlockedURLs',{urls:['*/assets/eredita-logo.png']});
    await failed.send('Page.navigate',{url:site.url});
    await failed.waitFor("window.Eredita?.Intro?.diagnostics.error==='Logo indisponible' && !Eredita.Intro.active");
    assert.equal(await failed.evaluate("!document.querySelector('#main-menu').inert"),true,'Erreur d’asset : retour au menu sans blocage');
    assert.deepEqual(failed.errors,[]);
    console.log('Introduction : lecture complète, PNG final identique, clic/touche/tactile, relance, focus, mouvement réduit, repli et navigation sous /-redita/ validés.');
  } finally {await browser?.close();await new Promise(resolve=>site.server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
