'use strict';
// Vrai Canvas 2D et navigation pendant la révélation du logo du menu.
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
  async function checkPlacement(page) {
    const geometry=await page.evaluate("(()=>{const c=document.querySelector('#intro-canvas').getBoundingClientRect(),i=document.querySelector('#menu-title img').getBoundingClientRect();return {offset:Math.max(Math.abs(c.x-i.x),Math.abs(c.y-i.y),Math.abs(c.width-i.width),Math.abs(c.height-i.height)),filter:getComputedStyle(document.querySelector('#intro-canvas')).filter===getComputedStyle(document.querySelector('#menu-title img')).filter};})()");
    assert.ok(geometry.offset<1,'Le canvas et le logo occupent exactement la même place');
    assert.equal(geometry.filter,true,'Les ombres restent identiques');
  }
  try {
    browser=await startBrowser();const page=browser.page;
    await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await page.send('Page.navigate',{url:site.url});
    await page.waitFor('window.Eredita?.Intro?.diagnostics.layout && window.Eredita?.GameView?.getState()');
    assert.equal(await page.evaluate('Eredita.Intro.active'),true,'Lecture automatique au premier chargement');
    assert.equal(await page.evaluate("document.querySelector('#main-menu').inert"),false);
    assert.equal(await page.evaluate("document.querySelector('#game-intro')"),null,'Aucun écran séparé');
    const state=await page.evaluate('JSON.stringify(Eredita.GameView.getState())');
    await page.waitFor('!Eredita.Intro.active',5000);
    await page.waitFor('Eredita.MenuScene.diagnostics.ready');
    assert.equal(await page.evaluate('Eredita.MenuScene.diagnostics.active'),true);
    assert.equal(await page.evaluate('JSON.stringify(Eredita.GameView.getState())'),state);
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('#menu-title img')).opacity"),'1');
    assert.equal(await page.evaluate("document.querySelector('#intro-canvas').hidden"),true);

    await page.evaluate("document.querySelector('[data-menu-screen=play]').focus();Eredita.Intro.replay({paused:true})");
    assert.equal(await page.evaluate("document.activeElement.matches('[data-menu-screen=play]')"),true,'La révélation ne déplace pas le focus');
    assert.equal(await page.evaluate('Eredita.MenuScene.diagnostics.active'),true,'Le décor reste animé pendant la révélation');
    await checkPlacement(page);
    for(const t of [0,.3,.75,1.2,1.5]) {
      assert.equal(await page.evaluate('Eredita.Intro.seek('+t+')'),true);
      await screenshot(page,'logo-menu-'+t);
    }
    // Canvas transparent : le rendu final est le PNG original, sans fond ajouté.
    const comparison=await page.evaluate("(async()=>{const original=new Image();original.src=Eredita.Config.menu.logo;await original.decode();const actual=document.querySelector('#intro-canvas'),expected=document.createElement('canvas');expected.width=actual.width;expected.height=actual.height;const c=expected.getContext('2d'),r=Eredita.Intro.diagnostics.layout;c.setTransform(r.pixelRatio,0,0,r.pixelRatio,0,0);c.drawImage(original,r.x,r.y,r.width,r.height);const a=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data,b=c.getImageData(0,0,expected.width,expected.height).data;let different=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])different++;return {different,aspect:r.width/r.height,originalAspect:original.width/original.height};})()");
    assert.equal(comparison.different,0,'Le rendu final est exactement celui du PNG transparent');
    assert.ok(Math.abs(comparison.aspect-comparison.originalAspect)<1e-10);
    await page.evaluate('Eredita.Intro.seek(0.75)');
    const partial=await page.evaluate("(()=>{const c=document.querySelector('#intro-canvas'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let left=0,right=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const alpha=a[(y*c.width+x)*4+3];if(x<c.width/2)left+=alpha;if(x>c.width*.75)right+=alpha;}return {left,right,corner:a[3]};})()");
    assert.ok(partial.left>0,'La gauche du logo apparaît en premier');
    assert.equal(partial.right,0,'La droite reste masquée à mi-parcours');
    assert.equal(partial.corner,0,'Le fond du canvas reste transparent');
    await screenshot(page,'logo-menu-desktop');
    await page.evaluate('Eredita.Intro.skip()');
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('#menu-title img')).opacity"),'1');
    await page.evaluate('Eredita.Intro.replay();Eredita.Intro.skip();true');
    await delay(80);
    assert.equal(await page.evaluate("document.querySelector('#intro-canvas').hidden"),true,'Le chargement tardif ne rouvre pas le canvas');

    // Les clics activent immédiatement le menu pendant la révélation.
    await page.evaluate('Eredita.Intro.replay({paused:true})');
    await page.click('[data-menu-screen="play"]');
    await page.waitFor("!document.querySelector('#menu-subscreen').hidden && !Eredita.Intro.active");
    assert.equal(await page.evaluate('Eredita.Intro.replay()'),false);
    await page.click('#menu-back');
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'F9',code:'F9',windowsVirtualKeyCode:120});
    await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'F9',code:'F9',windowsVirtualKeyCode:120});
    await page.waitFor('Eredita.Intro.diagnostics.layout');
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await page.waitFor('!Eredita.Intro.active');
    await page.evaluate('Eredita.Intro.replay({paused:true})');
    await page.click('#menu-motion');
    await page.waitFor('!Eredita.Intro.active');
    assert.equal(await page.evaluate('Eredita.Intro.replay().then(()=>!Eredita.Intro.active)'),true,'Le réglage de pause est respecté');
    await page.click('#menu-motion');
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.badResponses,[]);

    const mobile=await browser.newPage();
    await mobile.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
    await mobile.send('Emulation.setTouchEmulationEnabled',{enabled:true});
    await mobile.send('Page.navigate',{url:site.url+'?intro=preview&intro-time=0.75'});
    await mobile.waitFor('window.Eredita?.Intro?.diagnostics.layout && Eredita.MenuScene.diagnostics.ready');
    await checkPlacement(mobile);
    assert.ok(await mobile.evaluate('Eredita.Intro.diagnostics.layout.pixelRatio<=1.5'));
    await screenshot(mobile,'logo-menu-mobile');
    await mobile.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:3,mobile:true});
    await delay(150);
    await checkPlacement(mobile);
    await mobile.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await mobile.waitFor('!Eredita.Intro.active');
    assert.equal(await mobile.evaluate("document.querySelector('#intro-canvas').hidden && getComputedStyle(document.querySelector('#menu-title img')).opacity==='1'"),true);
    await mobile.send('Page.navigate',{url:site.url+'?intro=preview'});
    await mobile.waitFor('window.Eredita?.Intro && Eredita.GameView?.getState()');
    assert.equal(await mobile.evaluate('Eredita.Intro.diagnostics.reducedMotion && !Eredita.Intro.active'),true);
    await mobile.click('[data-menu-screen="play"]');
    await mobile.waitFor("!document.querySelector('#menu-subscreen').hidden");
    assert.deepEqual(mobile.errors,[]);

    const fallback=await browser.newPage();
    await fallback.send('Page.addScriptToEvaluateOnNewDocument',{source:"const nativeContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return this.id==='intro-canvas'&&type==='2d'?null:nativeContext.call(this,type,...args);};"});
    await fallback.send('Page.navigate',{url:site.url+'?intro=preview'});
    await fallback.waitFor("window.Eredita?.Intro?.diagnostics.error==='Canvas 2D indisponible'");
    assert.equal(await fallback.evaluate("!Eredita.Intro.active && getComputedStyle(document.querySelector('#menu-title img')).opacity==='1' && document.querySelector('#menu-title img').naturalWidth===2172"),true);
    await fallback.click('[data-menu-screen="play"]');
    await fallback.waitFor("!document.querySelector('#menu-subscreen').hidden");
    assert.deepEqual(fallback.errors,[]);

    const failed=await browser.newPage();
    await failed.send('Network.setBlockedURLs',{urls:['*/assets/eredita-logo.png']});
    await failed.send('Page.navigate',{url:site.url});
    await failed.waitFor("window.Eredita?.Intro?.diagnostics.error==='Logo indisponible' && !Eredita.Intro.active");
    await failed.click('[data-menu-screen="play"]');
    await failed.waitFor("!document.querySelector('#menu-subscreen').hidden");
    assert.deepEqual(failed.errors,[]);
    console.log('Logo du menu : révélation transparente, PNG exact, placement desktop/mobile, navigation immédiate, focus, relance, mouvement réduit et replis validés.');
  } finally {await browser?.close();await new Promise(resolve=>site.server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
