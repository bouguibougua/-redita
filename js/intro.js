(function () {
  'use strict';
  const E = window.Eredita, cfg = E.Config.intro;
  const overlay=document.querySelector('#game-intro'),canvas=document.querySelector('#intro-canvas');
  const fallback=document.querySelector('#intro-fallback'),skipButton=document.querySelector('#intro-skip');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const query=new URLSearchParams(location.search);
  let active=false,closing=false,paused=false,seconds=0,reduced=false,error=null;
  let renderer=null,raf=null,finishTimer=null,startMs=0,lastDraw=-Infinity,generation=0;
  let focusBefore=null,locks=[],logoPromise=null;
  function loadLogo() {
    if (!logoPromise) logoPromise=new Promise((resolve,reject)=>{
      const image=new Image(),timer=setTimeout(()=>reject(new Error('Chargement du logo trop long')),cfg.logoLoadTimeoutMs);
      image.onload=()=>{clearTimeout(timer);resolve(image);};
      image.onerror=()=>{clearTimeout(timer);reject(new Error('Logo indisponible'));};
      image.src=E.Config.menu.logo;
    }).catch(e=>{logoPromise=null;throw e;});
    return logoPromise;
  }
  function phase() {
    if (closing) return 'transition';
    if (!active) return 'menu';
    if (reduced) return 'statique';
    return seconds < cfg.birthAt ? 'vide' : seconds < cfg.convergeAt ? 'encres' : seconds < cfg.revealAt ? 'convergence' : seconds < cfg.holdAt ? 'revelation' : 'logo';
  }
  function lockInterface() {
    focusBefore=document.activeElement;
    locks=Array.from(document.body.children).filter(el=>el!==overlay&&!['SCRIPT','AUDIO','NOSCRIPT'].includes(el.tagName)).map(el=>({el,inert:el.inert}));
    locks.forEach(({el})=>{el.inert=true;});
  }
  function finish(duration = reduced ? 0 : cfg.transitionMs) {
    if (!active || closing) return;
    closing=true;generation++;cancelAnimationFrame(raf);
    E.MenuScene?.refreshVisibility();
    overlay.style.setProperty('--intro-transition',`${duration}ms`);overlay.classList.add('is-leaving');
    const done=()=>{
      overlay.hidden=true;overlay.classList.remove('is-leaving');document.body.classList.remove('intro-running');
      locks.forEach(({el,inert})=>{el.inert=inert;});locks=[];
      active=false;closing=false;paused=false;
      renderer?.dispose();renderer=null;E.MenuScene?.refreshVisibility();
      const focus=focusBefore?.isConnected && focusBefore!==document.body && !focusBefore.closest('[hidden]') ? focusBefore : document.querySelector('#main-menu button');
      focus?.focus({preventScroll:true});
      overlay.dispatchEvent(new CustomEvent('eredita-intro-end'));
    };
    if (!duration) done();else finishTimer=setTimeout(done,duration);
  }
  function tick(now) {
    if (!active || closing || paused || document.hidden) return;
    seconds=Math.min(reduced?cfg.reducedDuration:cfg.duration,(now-startMs)/1000);
    const fps=innerWidth < cfg.mobileBreakpoint ? cfg.mobileFps : cfg.desktopFps;
    if (!reduced && now-lastDraw >= 1000/fps) { renderer?.draw(seconds);lastDraw=now; }
    if (seconds >= (reduced?cfg.reducedDuration:cfg.duration)) { renderer?.draw(reduced?cfg.duration:seconds,reduced);finish();return; }
    raf=requestAnimationFrame(tick);
  }
  async function replay({ atSeconds = 0, paused: freeze = false } = {}) {
    if (E.XR?.active || E.MenuVR?.active || document.querySelector('#main-menu').hidden || (E.Network && E.Network.mode!=='pending')) return false;
    cancelAnimationFrame(raf);clearTimeout(finishTimer);renderer?.dispose();renderer=null;
    if (!active) lockInterface();
    active=true;closing=false;paused=freeze;seconds=Math.max(0,Math.min(cfg.duration,Number(atSeconds)||0));reduced=reducedMotion.matches;error=null;
    const run=++generation;
    overlay.hidden=false;overlay.classList.remove('is-leaving');fallback.hidden=true;
    document.body.classList.add('intro-running');skipButton.focus({preventScroll:true});E.MenuScene?.refreshVisibility();
    try {
      const logo=await loadLogo();
      if (generation!==run || !active || closing) return false;
      renderer=E.IntroPaint.create(canvas,logo,cfg);
      if (!renderer) { fallback.hidden=false;reduced=true;error='Canvas 2D indisponible'; }
      renderer?.draw(reduced?cfg.duration:seconds,reduced);
      startMs=performance.now()-seconds*1000;lastDraw=-Infinity;
      if (!paused && !document.hidden) raf=requestAnimationFrame(tick);
      return true;
    } catch(e) { if (generation===run) { error=String(e.message||e);finish(0); } return false; }
  }
  function seek(value) {
    if (!active || closing || !renderer) return false;
    paused=true;cancelAnimationFrame(raf);seconds=Math.max(0,Math.min(cfg.duration,Number(value)||0));renderer.draw(seconds,reduced);return true;
  }
  function resume() {
    if (!active || closing || !renderer || !paused) return false;
    paused=false;startMs=performance.now()-seconds*1000;lastDraw=-Infinity;
    if (!document.hidden) raf=requestAnimationFrame(tick);return true;
  }
  function blockAndSkip(event) {
    if (!active) return;
    E.Audio?.play('menu');
    event.preventDefault();event.stopImmediatePropagation();
    if (!closing) finish(reduced?0:cfg.skipTransitionMs);
  }
  document.addEventListener('pointerdown',blockAndSkip,true);
  document.addEventListener('click',blockAndSkip,true);
  document.addEventListener('keydown',event=>{
    if (active) {
      if (!['Shift','Control','Alt','Meta'].includes(event.key)) blockAndSkip(event);
    } else if (event.key==='F9' && !event.repeat && !event.target.closest('input,textarea,[contenteditable]')) {
      event.preventDefault();replay();
    }
  },true);
  addEventListener('resize',()=>{ if (renderer && active && !closing) { renderer.resize();renderer.draw(seconds,reduced); } });
  document.addEventListener('visibilitychange',()=>{
    if (!active || closing || paused || !renderer) return;
    cancelAnimationFrame(raf);
    if (!document.hidden) { startMs=performance.now()-seconds*1000;raf=requestAnimationFrame(tick); }
  });
  reducedMotion.addEventListener('change',()=>{ if (active && !closing && reducedMotion.matches) { reduced=true;renderer?.draw(cfg.duration,true);finish(0); } });
  E.Intro={replay,seek,resume,skip:()=>finish(reduced?0:cfg.skipTransitionMs),
    get active(){return active;},get closing(){return closing;},
    get diagnostics(){return {active,closing,paused,seconds,phase:phase(),reducedMotion:reduced,logoSource:E.Config.menu.logo,layout:renderer?.layout||null,error};}
  };
  if (query.get('intro')==='0') overlay.hidden=true;
  else replay({atSeconds:query.get('intro')==='preview'?Number(query.get('intro-time')):0,paused:query.get('intro')==='preview'});
}());
