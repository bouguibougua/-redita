'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { startStaticServer, startBrowser } = require('../scripts/export-menu-gif.js');
async function run() {
  const site = await startStaticServer(); let browser;
  async function screenshot(page, name, selector) {
    if (!process.env.EREDITA_MYTHOLOGY_PREVIEW_DIR) return;
    fs.mkdirSync(process.env.EREDITA_MYTHOLOGY_PREVIEW_DIR, { recursive: true });
    const clip = selector ? await page.evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:3};})()`) : null;
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? {clip} : {}) });
    fs.writeFileSync(path.join(process.env.EREDITA_MYTHOLOGY_PREVIEW_DIR, name + '.png'), Buffer.from(data, 'base64'));
  }
  try {
    browser = await startBrowser(); const page = browser.page;
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: site.url + '?intro=0' });
    await page.waitFor("document.readyState==='complete' && window.Eredita?.MenuScene?.diagnostics.ready && Eredita.GameView?.getState()");
    assert.equal(await page.evaluate('Eredita.Mythology.all.length'), 16);
    assert.equal(await page.evaluate('Eredita.Cards'), undefined);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-card').length"), 0, 'No new interface mounted automatically');
    const before = await page.evaluate('JSON.stringify(Eredita.GameView.getState())');
    await page.evaluate(`(() => {
      const d = window.mythologyPreview = document.createElement('dialog');
      d.style.cssText = 'width:760px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);padding:16px;border:1px solid #b5965c;background:#15140f;overflow:auto;box-sizing:border-box';
      d.append(Eredita.MythologyUI.createPair('u-mazzeru'));
      document.body.append(d); d.showModal();
    })()`);
    await page.waitFor("[...document.querySelectorAll('.mythology-card img')].every(img => img.complete && img.naturalWidth > 0)");
    const transforms = await page.evaluate(`(() => {
      const cards = [...document.querySelectorAll('.mythology-card')];
      return cards.map(card => ({
        title: card.querySelector('h3').textContent,
        card: getComputedStyle(card).transform,
        heading: getComputedStyle(card.querySelector('header')).transform,
        power: getComputedStyle(card.querySelector('.mythology-power')).transform,
        status: getComputedStyle(card.querySelector('.mythology-status')).transform,
        art: getComputedStyle(card.querySelector('.mythology-illustration-crop')).transform,
        clipping: getComputedStyle(card.querySelector('.mythology-illustration-crop')).overflow,
        image: card.querySelector('img').getAttribute('src')
      }));
    })()`);
    assert.equal(transforms[0].art, 'none');
    assert.equal(transforms[1].art, 'matrix(-1, 0, 0, 1, 0, 0)');
    for (const card of transforms) {
      for (const part of ['card','heading','power','status']) assert.equal(card[part], 'none');
      assert.equal(card.title, 'U Mazzeru'); assert.equal(card.clipping, 'hidden');
      assert.equal(card.image, 'assets/mythology/u-mazzeru.webp');
    }
    await screenshot(page, 'mazzeru-gauche-droite');
    // Inspecter les cinq recadrages sur le vrai moteur de mise en page.
    await page.evaluate(`(() => {
      const grid = document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px';
      Eredita.Mythology.all.filter(x=>x.visuals.normal).forEach(x=>grid.append(Eredita.MythologyUI.createCard(x.id)));
      mythologyPreview.replaceChildren(grid);mythologyPreview.style.width='1120px';grid.querySelectorAll('img').forEach(img=>img.loading='eager');
    })()`);
    await page.waitFor("[...document.querySelectorAll('.mythology-card img')].every(img=>img.complete && img.naturalWidth>0)");
    await screenshot(page, 'illustrations-disponibles');
    await page.evaluate("mythologyPreview.replaceChildren(Eredita.MythologyUI.createPair('u-stregu'))");
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-card img').length"), 2);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-missing').length"), 0);
    assert.equal(await page.evaluate("[...document.querySelectorAll('.mythology-status')].every(el=>el.textContent==='Pouvoir disponible')"), true);
    assert.equal(await page.evaluate('JSON.stringify(Eredita.GameView.getState())'), before);
    await screenshot(page, 'pouvoir-et-image-manquants');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.evaluate("mythologyPreview.replaceChildren(Eredita.MythologyUI.createPair('squadra-arozza'))");
    await page.waitFor("[...document.querySelectorAll('.mythology-card img')].every(img=>img.complete && img.naturalWidth>0)");
    assert.ok(await page.evaluate('mythologyPreview.scrollWidth <= mythologyPreview.clientWidth + 1'), 'No horizontal overflow on mobile');
    await screenshot(page, 'paire-mobile');
    await page.evaluate('mythologyPreview.close();mythologyPreview.remove()');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.click('[data-menu-screen="legends"]');
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-collection .mythology-card').length"), 16);
    assert.match(await page.evaluate("getComputedStyle(document.querySelector('.legends-screen')).backgroundImage"), /\/-redita\/assets\/deck-library\.webp/);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-codex-description p').length"), 2, 'Le grimoire présente les effets et leurs limites en paragraphes');
    await page.waitFor("document.querySelector('.mythology-codex-feature img').complete");
    const control = '.mythology-codex-crystal', stage = '.mythology-codex-crystal-stage';
    await page.waitFor("document.querySelector('" + stage + "').dataset.ready==='true'");
    const powerLayout = await page.evaluate(`(() => {
      const feature=document.querySelector('.mythology-codex-feature');
      window.codexArt=feature.querySelector('img');
      return {image:codexArt.getBoundingClientRect().x,description:feature.querySelector('.mythology-codex-description').textContent};
    })()`);
    assert.equal(await page.evaluate(`document.querySelector('${stage}').dataset.color`), '#c73d4d', 'Le cristal reprend la couleur du catalogue');
    await page.send('Input.dispatchMouseEvent', {type:'mouseMoved',x:30,y:30});
    await page.waitFor(`document.querySelector('${stage}').dataset.magic==='true' && document.querySelector('${stage}').dataset.lightning==='false'`);
    await page.evaluate(`window.ambientPaints=0;window.ambientObserver=new MutationObserver(records=>ambientPaints+=records.length);
      ambientObserver.observe(document.querySelector('${stage}'),{attributes:true,attributeFilter:['data-phase']});`);
    await page.waitFor('ambientPaints>=3');
    await page.evaluate('ambientObserver.disconnect()');
    await screenshot(page, 'grimoire-magie-permanente');
    await screenshot(page, 'cristal-particules-permanentes', stage);
    const hover = await page.evaluate(`(() => {const r=document.querySelector('${control}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await page.send('Input.dispatchMouseEvent', {type:'mouseMoved', ...hover});
    await page.waitFor(`document.querySelector('${stage}').dataset.phase==='enchanted'`);
    assert.equal(await page.evaluate(`document.querySelector('${stage}').dataset.lightning`), 'true', 'Les éclairs s’allument au survol');
    await screenshot(page, 'grimoire-desktop');
    await screenshot(page, 'cristal-eclairs-surface', stage);
    await page.send('Input.dispatchMouseEvent', {type:'mouseMoved',x:30,y:30});
    await page.waitFor(`document.querySelector('${stage}').dataset.lightning==='false' && document.querySelector('${stage}').dataset.magic==='true'`);
    await page.click(control);
    const run = await page.evaluate(`document.querySelector('${stage}').dataset.run`);
    await page.evaluate(`document.querySelector('${control}').click();document.querySelector('${control}').click()`);
    assert.equal(await page.evaluate(`document.querySelector('${stage}').dataset.run`), run, 'Les clics répétés ne doublent pas l’éclatement');
    await page.waitFor(`document.querySelector('.mythology-codex-feature').dataset.view==='story' && document.querySelector('${control}').getAttribute('aria-disabled')==='false'`);
    const story = await page.evaluate(`(() => {
      const feature=document.querySelector('.mythology-codex-feature'), image=feature.querySelector('img').getBoundingClientRect();
      return {sameImage:feature.querySelector('img')===codexArt,x:image.x,
        crystal:feature.querySelector('${control}').getBoundingClientRect().right,
        copy:feature.querySelector('.mythology-codex-copy').getBoundingClientRect().left,
        imageRight:image.right,text:feature.querySelector('.mythology-codex-story').textContent};
    })()`);
    assert.equal(story.sameImage, true, 'L’illustration reste intacte pendant le glissement');
    assert.ok(story.x < powerLayout.image - 100 && story.crystal < story.x && story.copy > story.imageRight, 'Histoire : cristal à gauche, illustration déplacée à gauche, récit à droite');
    assert.match(story.text, /Mandrache/); assert.doesNotMatch(story.text, /Source|Université|Fogacci|https?:/);
    await screenshot(page, 'grimoire-histoire-desktop');
    await page.send('Input.dispatchMouseEvent', {type:'mouseMoved',x:30,y:30});
    assert.equal(await page.evaluate(`document.querySelector('${stage}').dataset.lightning`), 'false', 'Le focus reçu par clic ne maintient pas les éclairs après la sortie du pointeur');
    assert.ok(await page.evaluate(`(() => {const body=document.querySelector('.mythology-codex-story');body.scrollTop=body.scrollHeight;
      return body.lastElementChild.getBoundingClientRect().bottom<=body.getBoundingClientRect().bottom+1;})()`), 'Le récit complet peut être lu jusqu’au dernier paragraphe');
    await page.click(control);
    await page.waitFor(`document.querySelector('.mythology-codex-feature').dataset.view==='power' && document.querySelector('${control}').getAttribute('aria-disabled')==='false'`);
    assert.equal(await page.evaluate("document.querySelector('.mythology-codex-description').textContent"), powerLayout.description);
    assert.ok(Math.abs(await page.evaluate("document.querySelector('.mythology-codex-feature img').getBoundingClientRect().x") - powerLayout.image) < 1, 'L’image retrouve exactement sa position initiale');
    await page.evaluate(`document.querySelector('${control}').focus()`);
    for (const [key,code,target] of [['Enter','Enter','story'],[' ','Space','power']]) {
      const windowsVirtualKeyCode = key === 'Enter' ? 13 : 32;
      await page.send('Input.dispatchKeyEvent', {type:'keyDown',key,code,windowsVirtualKeyCode,text:key === 'Enter' ? '\r' : ' '});
      await page.send('Input.dispatchKeyEvent', {type:'keyUp',key,code,windowsVirtualKeyCode});
      await page.waitFor(`document.querySelector('.mythology-codex-feature').dataset.view==='${target}' && document.querySelector('${control}').getAttribute('aria-disabled')==='false'`);
    }
    await page.click('.mythology-roster-card[data-legend-id="a-stregha-bianca"]');
    assert.equal(await page.evaluate("document.querySelector('.mythology-codex-video').getAttribute('src')"), null, 'Le MP4 n’est pas téléchargé avant le clic');
    await page.evaluate(`window.cinemaVideo=document.querySelector('.mythology-codex-video');window.cinemaImage=document.querySelector('.mythology-codex-feature img');
      window.flashPeak=0;window.flashUntil=performance.now()+6000;
      requestAnimationFrame(function sample(){const node=document.querySelector('.mythology-codex-media-flash');
        if(node)flashPeak=Math.max(flashPeak,Number.parseFloat(getComputedStyle(node).opacity));
        if(performance.now()<flashUntil)requestAnimationFrame(sample);});`);
    await page.click(control);
    await page.waitFor(`document.querySelector('.mythology-codex-feature').dataset.view==='story' && document.querySelector('.mythology-illustration.has-motion') && !cinemaVideo.paused && cinemaVideo.readyState>=2 && document.querySelector('${control}').getAttribute('aria-disabled')==='false'`);
    assert.deepEqual(await page.evaluate('({muted:cinemaVideo.muted,loop:cinemaVideo.loop,inline:cinemaVideo.playsInline,width:cinemaVideo.videoWidth,height:cinemaVideo.videoHeight})'),
      {muted:true,loop:true,inline:true,width:1024,height:586});
    assert.match(await page.evaluate('cinemaVideo.currentSrc'), /\/-redita\/assets\/mythology\/a-stregha-bianca-motion\.mp4$/);
    assert.ok(await page.evaluate('flashPeak>0 && flashPeak<=.29'), 'Un flash blanc léger accompagne la révélation de la vidéo');
    await page.evaluate('window.cinemaAt=cinemaVideo.currentTime;window.cinemaFrames=cinemaVideo.getVideoPlaybackQuality().totalVideoFrames');
    await page.waitFor('cinemaVideo.currentTime>cinemaAt+.2 && cinemaVideo.getVideoPlaybackQuality().totalVideoFrames>cinemaFrames+2');
    await screenshot(page, 'bianca-video-desktop');
    await page.evaluate('cinemaVideo.currentTime=cinemaVideo.duration-.15');
    await page.waitFor('cinemaVideo.currentTime<1 && !cinemaVideo.paused');
    await page.evaluate('flashPeak=0;flashUntil=performance.now()+6000');
    await page.click(control);
    await page.waitFor(`document.querySelector('.mythology-codex-feature').dataset.view==='power' && document.querySelector('${control}').getAttribute('aria-disabled')==='false'`);
    assert.equal(await page.evaluate("cinemaVideo.paused && !document.querySelector('.mythology-illustration.has-motion') && document.querySelector('.mythology-codex-feature img')===cinemaImage"), true, 'Le retour restaure exactement la même image et arrête la vidéo');
    assert.ok(await page.evaluate('flashPeak>0 && flashPeak<=.29'), 'Le retour à l’image utilise le même flash léger');
    await screenshot(page, 'bianca-retour-image');
    await page.evaluate(`cinemaVideo.play=()=>Promise.reject(new DOMException('Lecture bloquée pour ce test','NotAllowedError'));`);
    await page.click(control);
    await page.waitFor(`document.querySelector('.mythology-codex-feature').dataset.view==='story' && document.querySelector('${control}').getAttribute('aria-disabled')==='false'`);
    assert.equal(await page.evaluate("cinemaVideo.paused && !document.querySelector('.mythology-illustration.has-motion')"), true, 'Une lecture refusée conserve l’image sans erreur JavaScript');
    await page.click('.mythology-roster-card[data-legend-id="u-diavulu"]');
    assert.equal(await page.evaluate("document.querySelector('.mythology-codex-description').textContent"), 'Anéantit le village de votre adversaire.');
    const gif = await page.evaluate(`(async () => {
      const response=await fetch(Eredita.Mythology.get('u-diavulu').visuals.motion.gif);
      if(!response.ok)throw new Error('GIF de U Diavule absent');
      const data=await response.arrayBuffer();
      if(typeof ImageDecoder==='undefined')return {header:String.fromCharCode(...new Uint8Array(data,0,6))};
      const decoder=new ImageDecoder({data,type:'image/gif'});await decoder.tracks.ready;
      const track=decoder.tracks.selectedTrack,canvas=document.createElement('canvas');canvas.width=160;canvas.height=107;
      const g=canvas.getContext('2d'),samples=[];
      for(const frameIndex of [0,15]){const frame=await decoder.decode({frameIndex});g.drawImage(frame.image,0,0,160,107);samples.push(g.getImageData(0,0,160,107).data);frame.image.close();}
      function difference(x0,y0,x1,y1){let sum=0,n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)for(let c=0;c<3;c++){const at=(y*160+x)*4+c;sum+=Math.abs(samples[0][at]-samples[1][at]);n++;}return sum/n;}
      const result={frames:track.frameCount,animated:track.animated,forever:track.repetitionCount===Infinity,hand:difference(116,28,145,70),background:difference(8,8,65,85)};
      decoder.close();return result;
    })()`);
    if(gif.frames){assert.equal(gif.frames,60);assert.equal(gif.animated,true);assert.equal(gif.forever,true);assert.ok(gif.hand>gif.background+.1,'La flamme change tandis que le personnage et le décor restent stables');}
    else assert.match(gif.header,/GIF8[79]a/);
    await page.evaluate("window.diavuleVideo=document.querySelector('.mythology-codex-video');window.diavuleImage=document.querySelector('.mythology-codex-feature img')");
    await page.click(control);
    await page.waitFor(`document.querySelector('.mythology-illustration.has-motion') && !diavuleVideo.paused && document.querySelector('${control}').getAttribute('aria-disabled')==='false'`);
    assert.deepEqual(await page.evaluate('({width:diavuleVideo.videoWidth,height:diavuleVideo.videoHeight,loop:diavuleVideo.loop,muted:diavuleVideo.muted})'),{width:960,height:640,loop:true,muted:true});
    assert.match(await page.evaluate('diavuleVideo.currentSrc'),/u-diavulu-motion\.mp4$/);
    await screenshot(page,'diavule-flamme-desktop');
    await page.click(control);
    await page.waitFor(`document.querySelector('.mythology-codex-feature').dataset.view==='power' && document.querySelector('${control}').getAttribute('aria-disabled')==='false'`);
    assert.equal(await page.evaluate("diavuleVideo.paused && !document.querySelector('.mythology-illustration.has-motion') && document.querySelector('.mythology-codex-feature img')===diavuleImage"),true);
    assert.equal(await page.evaluate("document.querySelector('.mythology-codex-description').textContent"),'Anéantit le village de votre adversaire.');
    await page.click('.mythology-roster-card[data-legend-id="u-mazzeru"]');
    assert.equal(await page.evaluate("cinemaVideo.paused && !cinemaVideo.hasAttribute('src')"), true, 'Changer de légende libère la source vidéo');
    await page.send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    const lore = await page.evaluate(`(() => {
      const results=[];
      for (const card of document.querySelectorAll('.mythology-roster-card')) {
        card.click(); document.querySelector('${control}').click();
        const legend=Eredita.Mythology.get(card.dataset.legendId), body=document.querySelector('.mythology-codex-story');
        if(legend.visuals.motion && (document.querySelector('video').hasAttribute('src') || !document.querySelector('video').paused)) throw new Error('Lecture automatique en mouvement réduit');
        results.push({id:legend.id,subtitle:body.querySelector('p').textContent,
          paragraphs:[...body.querySelectorAll('p')].slice(1).map(p=>p.textContent),
          expected:legend.lore,view:document.querySelector('.mythology-codex-feature').dataset.view});
      }
      return results;
    })()`);
    for (const item of lore) {
      assert.equal(item.view, 'story'); assert.equal(item.subtitle, item.expected.subtitle);
      assert.deepEqual(item.paragraphs, item.expected.paragraphs, 'Récit complet et correctement associé : ' + item.id);
      assert.doesNotMatch(item.paragraphs.join(' '), /Sources?\s*:|Université de Corse|corse-evasion\.fr|Corsicatheque|Corsica Linea|\+1/);
    }
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-codex-crystal canvas').length"), 1, 'Une seule instance 3D pour les seize légendes');
    await page.send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await page.click('.mythology-roster-card[data-legend-id="u-mazzeru"]');
    await page.evaluate(`document.querySelector('${control}').click();document.querySelector('.mythology-roster-card[data-legend-id="u-stregu"]').click()`);
    await page.evaluate('new Promise(resolve=>setTimeout(resolve,1300))');
    assert.equal(await page.evaluate("document.querySelector('.mythology-codex-feature').dataset.view"), 'power', 'Changer de légende annule la transition précédente');
    assert.equal(await page.evaluate("document.querySelector('.mythology-codex-feature h3').textContent"), 'U Stregu');
    await page.click('[data-mythology-filter="vision"]');
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-roster-card:not([hidden])').length"), 2);
    await page.click('.mythology-roster-card[data-legend-id="oeil-sainte-lucie"]');
    assert.equal(await page.evaluate("document.querySelector('.mythology-codex-feature h3').textContent"), 'Œil de Sainte-Lucie');
    await page.evaluate("document.querySelector('.mythology-roster-card[data-legend-id=oeil-sainte-lucie]').focus()");
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft' });
    assert.equal(await page.evaluate("document.querySelector('.mythology-codex-feature h3').textContent"), 'U Mazzeru');
    await page.click('[data-mythology-filter="enchantement"]');
    assert.equal(await page.evaluate("[...document.querySelectorAll('.mythology-roster-card:not([hidden])')].every(card=>Eredita.Mythology.get(card.dataset.legendId).gameplay.category==='enchantement')"), true);
    assert.equal(await page.evaluate('JSON.stringify(Eredita.GameView.getState())'), before, 'Reading and filtering the grimoire never changes a game');
    await screenshot(page, 'grimoire-categorie');
    await page.click('[data-mythology-filter="all"]');
    await page.evaluate(`(() => {
      for (const card of document.querySelectorAll('.mythology-roster-card')) {
        card.click();
        const feature = document.querySelector('.mythology-codex-feature');
        const description = feature.querySelector('.mythology-codex-description');
        if (!description.textContent.trim() || description.scrollWidth > description.clientWidth + 1) throw new Error('Description illisible : ' + card.dataset.legendId);
      }
    })()`);
    await page.click('.mythology-roster-card[data-legend-id="u-diavulu"]');
    assert.equal(await page.evaluate("document.querySelector('.mythology-codex-description').textContent"), 'Anéantit le village de votre adversaire.', 'La description spéciale de U Diavule est conservée');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.evaluate("document.querySelector('.legends-panel').scrollTop=0");
    await screenshot(page, 'grimoire-mobile');
    assert.ok(await page.evaluate("document.querySelector('.legends-panel').scrollWidth<=document.querySelector('.legends-panel').clientWidth"));
    await page.click('.mythology-roster-card[data-legend-id="a-fata"]');
    await page.waitFor("document.querySelector('.mythology-codex-feature h3').textContent==='A Fata'");
    await page.send('Emulation.setTouchEmulationEnabled', {enabled:true});
    const touch = await page.evaluate(`(() => {const e=document.querySelector('${control}');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await page.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[touch]});
    await page.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
    await page.waitFor(`document.querySelector('.mythology-codex-feature').dataset.view==='story' && document.querySelector('${control}').getAttribute('aria-disabled')==='false'`);
    assert.match(await page.evaluate("document.querySelector('.mythology-codex-story').textContent"), /Rizzanese/);
    assert.ok(await page.evaluate("document.querySelector('.legends-panel').scrollWidth<=document.querySelector('.legends-panel').clientWidth"), 'Le récit et le cristal restent dans l’écran mobile');
    await screenshot(page, 'grimoire-histoire-mobile');
    await page.click('.mythology-roster-card[data-legend-id="a-stregha-bianca"]');
    await page.evaluate(`document.querySelector('${control}').scrollIntoView({block:'center',behavior:'instant'})`);
    const movieTouch = await page.evaluate(`(() => {const r=document.querySelector('${control}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await page.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[movieTouch]});
    await page.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
    await page.waitFor(`document.querySelector('.mythology-illustration.has-motion') && !document.querySelector('.mythology-codex-video').paused && document.querySelector('${control}').getAttribute('aria-disabled')==='false'`);
    assert.equal(await page.evaluate('document.querySelector(".mythology-codex-video").playsInline && document.querySelector(".mythology-codex-video").muted'), true);
    assert.ok(await page.evaluate("document.querySelector('.legends-panel').scrollWidth<=document.querySelector('.legends-panel').clientWidth"), 'La vidéo conserve le parallélogramme sans débordement mobile');
    await screenshot(page, 'bianca-video-mobile');
    await page.click('.mythology-roster-card[data-legend-id="u-diavulu"]');
    await page.evaluate(`document.querySelector('${control}').scrollIntoView({block:'center',behavior:'instant'})`);
    await page.click(control);
    await page.waitFor(`document.querySelector('.mythology-illustration.has-motion') && !document.querySelector('.mythology-codex-video').paused && document.querySelector('${control}').getAttribute('aria-disabled')==='false'`);
    assert.ok(await page.evaluate("document.querySelector('.legends-panel').scrollWidth<=document.querySelector('.legends-panel').clientWidth"));
    await screenshot(page,'diavule-flamme-mobile');
    await page.send('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:'reduce'}] });
    await page.click('.mythology-roster-card[data-legend-id="u-magu"]');
    assert.equal(await page.evaluate("document.querySelector('.mythology-codex-feature h3').textContent"), 'U Magu');
    assert.match(await page.evaluate("document.querySelector('.mythology-codex-description').textContent"), /Un seul nouvel habitant par village/);
    assert.ok(await page.evaluate("document.querySelector('.legends-panel').scrollWidth<=document.querySelector('.legends-panel').clientWidth"), 'Les descriptions détaillées tiennent sur mobile');
    await page.evaluate("document.querySelector('#menu-back').scrollIntoView({block:'center'})");
    await page.click('#menu-back');
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-codex-crystal canvas').length"), 0, 'Le renderer est libéré à la fermeture du grimoire');
    await page.click('[data-menu-screen="legends"]');
    await page.waitFor(`document.querySelector('${stage}').dataset.ready==='true'`);
    assert.equal(await page.evaluate("document.querySelectorAll('.mythology-codex-crystal canvas').length"), 1);
    await page.click('#menu-back');
    await page.click('[data-menu-screen="play"]');
    await page.waitFor("!!document.querySelector('#training-button')");
    await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.evaluate("Eredita.GameView.command('confirmBiomes','red','keep');Eredita.GameView.command('start')");
    await page.waitFor("Eredita.GameView.getState().phase==='running' && Eredita.GameView.getState().preparationRemaining>0");
    assert.equal(await page.evaluate('Eredita.GameView.getState().players.red.cards'), undefined);
    assert.equal(await page.evaluate('Eredita.MythologySession.diagnostics.privateView.pendingCount'), 1);
    assert.deepEqual(page.errors, []); assert.deepEqual(page.badResponses, []);
    console.log('Grimoire : cristal, récits, vidéo H.264 en boucle, flashs aller-retour, image de secours, mobile tactile, mouvement réduit, nettoyage et lancement de partie sous /-redita/ validés.');
  } finally { await browser?.close(); await new Promise(resolve => site.server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
