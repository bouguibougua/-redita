'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { startStaticServer, startBrowser, delay } = require('../scripts/export-menu-gif.js');

function pcm(name) {
  const file = fs.readFileSync(path.join(__dirname, '../assets/audio/interface', name));
  for (let offset=12; offset+8<=file.length;) {
    const size=file.readUInt32LE(offset+4);
    if (file.toString('ascii',offset,offset+4)==='data') return file.subarray(offset+8,offset+8+size);
    offset += 8 + size + size%2;
  }
  throw new Error('Données PCM absentes');
}
for (const [source,inverted,trimStartSeconds] of [['page-turn.wav','page-turn-reverse.wav',0],['sword.wav','sword-reverse.wav',.20]]) {
  const forward=pcm(source), reverse=pcm(inverted);
  // Les sources sont mono, PCM 16 bits, 44 100 Hz ; l’épée inversée commence à 0,20 s.
  const trimmedBytes=Math.round(trimStartSeconds*44100)*2;
  assert.equal(forward.length-trimmedBytes, reverse.length);
  for (let i=0; i<reverse.length; i+=2) assert.equal(forward.readInt16LE(i), reverse.readInt16LE(reverse.length-2-i), inverted+' conserve exactement les échantillons inversés après découpe');
}

const observePlayback = `
  window.effectCalls=[];
  const nativePlay=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...args){
    const result=nativePlay.apply(this,args);
    if (this.src.endsWith('.wav')) {
      const call={source:this.src.split('/').at(-1),volume:this.volume,element:this,started:false};
      window.effectCalls.push(call);
      result.then(()=>{call.started=true;},error=>{call.error=error.name;});
    }
    return result;
  };
`;
async function run() {
  const site=await startStaticServer(); let browser;
  async function watch(page) {
    // Isoler la lecture audio des déplacements du menu pendant son apparition.
    await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await page.send('Page.addScriptToEvaluateOnNewDocument',{source:observePlayback});
    await page.send('Page.navigate',{url:site.url+'?intro=0'});
    await page.waitFor("document.readyState==='complete' && window.Eredita?.Audio && Eredita.MenuScene?.diagnostics.ready && Eredita.GameView?.getState()");
  }
  async function click(page,selector) {
    await page.evaluate('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"center"})');
    await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    await page.click(selector);
  }
  async function expectSound(page,selector,name) {
    const before=await page.evaluate('effectCalls.length');
    await click(page,selector);
    await page.waitFor('effectCalls.length==='+String(before+1)+' && effectCalls.at(-1).started');
    assert.equal(await page.evaluate('effectCalls.at(-1).source'),name);
    assert.equal(await page.evaluate('effectCalls.at(-1).volume===Eredita.Config.audio.effectVolume'),true);
  }
  try {
    browser=await startBrowser(); const page=browser.page;
    await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await watch(page);
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('#main-menu')).userSelect"),'none');
    await expectSound(page,'[data-menu-screen="legends"]','sword.wav');
    const title=await page.evaluate("(()=>{getSelection().removeAllRanges();const r=document.querySelector('#menu-subtitle').getBoundingClientRect();return {left:r.left+2,right:r.right-2,y:r.y+r.height/2};})()");
    await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:title.left,y:title.y,button:'left',buttons:1,clickCount:1});
    await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:title.right,y:title.y,buttons:1});
    await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:title.right,y:title.y,button:'left',clickCount:1});
    assert.equal(await page.evaluate('getSelection().toString()'),'','Glisser sur un titre du menu ne sélectionne aucun mot');
    await expectSound(page,'.mythology-roster-card[data-legend-id="u-mazzeru"]','page-turn.wav');
    await expectSound(page,'.mythology-roster-card[data-legend-id="u-mazzeru"]','page-turn.wav');
    await expectSound(page,'.mythology-roster-card[data-legend-id="u-magu"]','page-turn.wav');
    const count=await page.evaluate('effectCalls.length');
    await click(page,'[data-mythology-filter="vision"]');
    await click(page,'[data-mythology-filter="all"]');
    assert.equal(await page.evaluate('effectCalls.length'),count,'Changer de filtre ne joue pas de page automatiquement');
    await page.evaluate('document.querySelector(\'.mythology-roster-card[data-legend-id="u-mazzeru"]\').focus()');
    for (const key of ['ArrowRight','Enter',' ']) {
      const before=await page.evaluate('effectCalls.length');
      await page.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key===' '?'Space':key});
      await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key===' '?'Space':key});
      await page.waitFor('effectCalls.length==='+String(before+1)+' && effectCalls.at(-1).started');
      assert.equal(await page.evaluate('effectCalls.at(-1).source'),'page-turn.wav','Un seul son de papier au clavier');
    }
    await expectSound(page,'#menu-back','sword-reverse.wav');
    await expectSound(page,'#menu-motion','sword.wav');
    await expectSound(page,'[data-menu-screen="play"]','sword.wav');
    await expectSound(page,'.play-lobby [data-match-format="classic"]','sword.wav');
    await expectSound(page,'#open-multiplayer','sword.wav');
    await expectSound(page,'#connection-screen [data-match-format="simplified"]','sword.wav');
    await expectSound(page,'#join-online','sword.wav');
    await expectSound(page,'#connection-back','sword-reverse.wav');
    await expectSound(page,'[data-menu-screen="play"]','sword.wav');
    await expectSound(page,'#menu-back','sword-reverse.wav');
    await expectSound(page,'#main-menu [data-open-xr]','sword.wav');
    await expectSound(page,'#xr-close','sword-reverse.wav');
    const beforeMute=await page.evaluate('effectCalls.length');
    await click(page,'#menu-sound');
    assert.equal(await page.evaluate('Eredita.Audio.muted && effectCalls.every(c=>c.element.paused)'),true,'Couper le son arrête aussi les effets en cours');
    await click(page,'[data-menu-screen="legends"]');
    await click(page,'.mythology-roster-card[data-legend-id="u-magu"]');
    assert.equal(await page.evaluate('effectCalls.length'),beforeMute,'Aucun effet de menu ou de page pendant la sourdine');
    await click(page,'#menu-back');
    await expectSound(page,'#menu-sound','sword.wav');
    await expectSound(page,'[data-menu-screen="play"]','sword.wav');
    await expectSound(page,'#training-button','sword.wav');
    await click(page,'[data-setup-action="keep"][data-player="red"]');
    await click(page,'#start-game');
    await click(page,'#open-shop-modal');
    await expectSound(page,'#close-shop-modal','sword-reverse.wav');
    await page.evaluate("for(let i=0;i<12;i++) Eredita.Audio.playEffect('sword')");
    assert.equal(await page.evaluate('effectCalls.filter(c=>!c.element.paused).length<=Eredita.Config.audio.maxEffectVoices'),true,'Les clics rapides ne créent pas une accumulation illimitée');
    await page.evaluate('Eredita.Audio.setMuted(true)');
    assert.equal(await page.evaluate('effectCalls.every(c=>c.element.paused)'),true);
    assert.deepEqual(page.errors,[]); assert.deepEqual(page.badResponses,[]);

    const mobile=await browser.newPage();
    await mobile.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await mobile.send('Emulation.setTouchEmulationEnabled',{enabled:true});
    await watch(mobile);
    async function tap(selector,name) {
      const before=await mobile.evaluate('effectCalls.length');
      const point=await mobile.evaluate('(()=>{const b=document.querySelector('+JSON.stringify(selector)+');b.scrollIntoView({block:"center"});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
      await mobile.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
      await mobile.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await mobile.waitFor('effectCalls.length==='+String(before+1)+' && effectCalls.at(-1).started');
      assert.equal(await mobile.evaluate('effectCalls.at(-1).source'),name);
    }
    await tap('[data-menu-screen="legends"]','sword.wav');
    await tap('.mythology-roster-card[data-legend-id="u-mazzeru"]','page-turn.wav');
    await tap('.mythology-roster-card[data-legend-id="u-mazzeru"]','page-turn.wav');
    await delay(80);
    assert.equal(await mobile.evaluate('effectCalls.length'),3,'Un seul effet par toucher');
    await tap('#menu-back','sword-reverse.wav');
    assert.equal(await mobile.evaluate('effectCalls.length'),4,'Retour joue uniquement l’épée inversée sur tactile');
    assert.deepEqual(mobile.errors,[]); assert.deepEqual(mobile.badResponses,[]);
    console.log('Audio : pages des légendes au clic, au clavier et au toucher, relecture, filtres silencieux, retours sans doublon et sourdine validés.');
  } finally { await browser?.close(); await new Promise(resolve=>site.server.close(resolve)); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
