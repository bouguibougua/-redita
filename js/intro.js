(function () {
  'use strict';
  const E = window.Eredita, cfg = E.Config.intro;
  const menu=document.querySelector('#main-menu'),title=document.querySelector('#menu-title');
  const canvas=document.querySelector('#intro-canvas');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const query=new URLSearchParams(location.search);
  let active=false,paused=false,seconds=0,reduced=false,error=null;
  let renderer=null,raf=null,startMs=0,lastDraw=-Infinity,generation=0,logoPromise=null;
  function loadLogo() {
    if (!logoPromise) logoPromise=new Promise((resolve,reject)=>{
      const image=new Image(),timer=setTimeout(()=>reject(new Error('Chargement du logo trop long')),cfg.logoLoadTimeoutMs);
      image.onload=()=>{clearTimeout(timer);resolve(image);};
      image.onerror=()=>{clearTimeout(timer);reject(new Error('Logo indisponible'));};
      image.src=E.Config.menu.logo;
    }).catch(e=>{logoPromise=null;throw e;});
    return logoPromise;
  }
  function finish() {
    generation++;cancelAnimationFrame(raf);
    title.classList.remove('logo-revealing');canvas.hidden=true;
    active=false;paused=false;renderer?.dispose();renderer=null;
  }
  function tick(now) {
    if (!active || paused || document.hidden) return;
    seconds=Math.min(cfg.duration,(now-startMs)/1000);
    const fps=innerWidth < cfg.mobileBreakpoint ? cfg.mobileFps : cfg.desktopFps;
    if (now-lastDraw >= 1000/fps) { renderer?.draw(seconds);lastDraw=now; }
    if (seconds >= cfg.duration) { finish();return; }
    raf=requestAnimationFrame(tick);
  }
  async function replay({ atSeconds = 0, paused: freeze = false } = {}) {
    if (E.XR?.active || E.MenuVR?.active || menu.hidden || (E.Network && E.Network.mode!=='pending')) return false;
    finish();
    seconds=Math.max(0,Math.min(cfg.duration,Number(atSeconds)||0));error=null;
    reduced=reducedMotion.matches || document.querySelector('#menu-motion').getAttribute('aria-pressed')==='true';
    if (reduced) return true;
    active=true;paused=freeze;
    const run=++generation;
    title.classList.add('logo-revealing');
    try {
      const logo=await loadLogo();
      if (generation!==run || !active) return false;
      renderer=E.IntroPaint.create(canvas,logo,cfg);
      if (!renderer) { error='Canvas 2D indisponible';finish();return false; }
      renderer.draw(seconds);canvas.hidden=false;
      startMs=performance.now()-seconds*1000;lastDraw=-Infinity;
      if (!paused && !document.hidden) raf=requestAnimationFrame(tick);
      return true;
    } catch(e) { if (generation===run) { error=String(e.message||e);finish(); } return false; }
  }
  function seek(value) {
    if (!active || !renderer) return false;
    paused=true;cancelAnimationFrame(raf);seconds=Math.max(0,Math.min(cfg.duration,Number(value)||0));renderer.draw(seconds);return true;
  }
  function resume() {
    if (!active || !renderer || !paused) return false;
    paused=false;startMs=performance.now()-seconds*1000;lastDraw=-Infinity;
    if (!document.hidden) raf=requestAnimationFrame(tick);return true;
  }
  document.addEventListener('keydown',event=>{
    if (event.key==='F9' && !event.repeat && !event.target.closest('input,textarea,[contenteditable]')) {
      event.preventDefault();replay();
    } else if (active && event.key==='Escape') finish();
  });
  new ResizeObserver(()=>{ if (renderer && active) { renderer.resize();renderer.draw(seconds); } }).observe(title);
  new MutationObserver(()=>{ if (menu.hidden && active) finish(); }).observe(menu,{attributes:true,attributeFilter:['hidden']});
  const motionButton=document.querySelector('#menu-motion');
  new MutationObserver(()=>{
    if (active && motionButton.getAttribute('aria-pressed')==='true') { reduced=true;finish(); }
  }).observe(motionButton,{attributes:true,attributeFilter:['aria-pressed']});
  document.addEventListener('visibilitychange',()=>{
    if (!active || paused || !renderer) return;
    cancelAnimationFrame(raf);
    if (!document.hidden) { startMs=performance.now()-seconds*1000;raf=requestAnimationFrame(tick); }
  });
  reducedMotion.addEventListener('change',()=>{ if (active && reducedMotion.matches) { reduced=true;finish(); } });
  E.Intro={replay,seek,resume,skip:finish,
    get active(){return active;},
    get diagnostics(){return {active,paused,seconds,phase:active?'revelation':'menu',reducedMotion:reduced,logoSource:E.Config.menu.logo,layout:renderer?.layout||null,error};}
  };
  if (query.get('intro')==='0') finish();
  else replay({atSeconds:query.get('intro')==='preview'?Number(query.get('intro-time')):0,paused:query.get('intro')==='preview'});
}());
