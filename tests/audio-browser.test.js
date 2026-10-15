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
for (const [source,inverted] of [['page-turn.wav','page-turn-reverse.wav'],['sword.wav','sword-reverse.wav']]) {
  const forward=pcm(source), reverse=pcm(inverted);
  assert.equal(forward.length, reverse.length);
  for (let i=0; i<forward.length; i+=2) assert.equal(forward.readInt16LE(i), reverse.readInt16LE(reverse.length-2-i), inverted+' conserve exactement les échantillons en sens inverse');
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
    await page.send('Page.addScriptToEvaluateOnNewDocument',{source:observePlayback});
    await page.send('Page.navigate',{url:site.url+'?intro=0'});
    await page.waitFor('window.Eredita?.Audio && Eredita.GameView?.getState() && Eredita.MenuScene?.diagnostics.ready');
  }
  async function click(page,selector) {
    await page.evaluate('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"center"})');
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
    await expectSound(page,'[data-menu-screen="decks"]','sword.wav');
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('#deck-search')).userSelect"),'text','La recherche reste sélectionnable et modifiable');
    const title=await page.evaluate("(()=>{getSelection().removeAllRanges();const r=document.querySelector('#menu-subtitle').getBoundingClientRect();return {left:r.left+2,right:r.right-2,y:r.y+r.height/2};})()");
    await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:title.left,y:title.y,button:'left',buttons:1,clickCount:1});
    await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:title.right,y:title.y,buttons:1});
    await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:title.right,y:title.y,button:'left',clickCount:1});
    assert.equal(await page.evaluate('getSelection().toString()'),'','Glisser sur un titre du menu ne sélectionne aucun mot');
    await expectSound(page,'.deck-collection [data-quantity="habitant"][data-delta="1"]','page-turn.wav');
    await expectSound(page,'.deck-current [data-quantity="habitant"][data-delta="-1"]','page-turn-reverse.wav');
    for (let i=0;i<4;i++) await expectSound(page,'.deck-collection [data-quantity="habitant"][data-delta="1"]','page-turn.wav');
    const count=await page.evaluate('effectCalls.length');
    await page.evaluate('document.querySelector(\'.deck-collection [data-quantity="habitant"][data-delta="1"]\').click()');
    assert.equal(await page.evaluate('effectCalls.length'),count,'Une quantité bloquée ne joue aucun effet');
    await click(page,'.deck-collection [data-open-card="habitant"]');
    await expectSound(page,'.deck-modal-actions [data-delta="-1"]','page-turn-reverse.wav');
    await click(page,'.deck-modal-close');
    await click(page,'.deck-filters [data-filter="Mythologique"]');
    const myth=await page.evaluate('Eredita.Cards.mythological[0].id');
    await expectSound(page,'.deck-collection [data-toggle-myth="'+myth+'"]','page-turn.wav');
    await expectSound(page,'.deck-myth-remove','page-turn-reverse.wav');
    await expectSound(page,'[data-use-starter]','page-turn.wav');
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
    await click(page,'[data-menu-screen="decks"]');
    await click(page,'.deck-current [data-quantity="agriculteur"][data-delta="-1"]');
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
    await tap('[data-menu-screen="decks"]','sword.wav');
    await tap('.deck-collection [data-quantity="habitant"][data-delta="1"]','page-turn.wav');
    await tap('.deck-current [data-quantity="habitant"][data-delta="-1"]','page-turn-reverse.wav');
    await delay(80);
    assert.equal(await mobile.evaluate('effectCalls.length'),3,'Un seul effet par toucher');
    await tap('#menu-back','sword-reverse.wav');
    assert.equal(await mobile.evaluate('effectCalls.length'),4,'Retour joue uniquement l’épée inversée sur tactile');
    assert.deepEqual(mobile.errors,[]); assert.deepEqual(mobile.badResponses,[]);
    console.log('Audio : pages et épée inversées exactes, ajouts/retraits, retours sans doublon, menus non sélectionnables, saisie préservée, sourdine et tactile validés.');
  } finally { await browser?.close(); await new Promise(resolve=>site.server.close(resolve)); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
