(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  const storageKey = 'eredita-game-layout-v1';
  const defaults = {
    desktop: { left:.20, right:.20, jobs:.27, village:.27, people:.32 },
    portrait: { left:.50, map:.42, jobs:.15, village:.15, people:.32 }
  };
  const definitions = [
    ['left','vertical','Largeur du panneau Habitants',1],
    ['right','vertical','Largeur des panneaux du village',-1],
    ['map','horizontal','Hauteur du terrain',1],
    ['jobs','horizontal','Hauteur du panneau Métiers',-1],
    ['village','horizontal','Hauteur du panneau Village',-1],
    ['people','horizontal','Répartition Habitants et Tâches',1],
    ['header','horizontal','Hauteur des fiches de villages',1],
    ['market','horizontal','Hauteur du panneau Construire',1],
    ['buildings','horizontal','Hauteur du panneau Bâtiments',1],
    ['inspector','horizontal','Hauteur des emplacements',1]
  ].map(([key,orientation,label,sign]) => ({key,orientation,label,sign}));
  const clamp = (value,min,max) => Math.min(Math.max(value,min),Math.max(min,max));
  let preferences = { desktop:{}, portrait:{} }, screen, grid, overlay, handles, mode, metrics={}, active=null, queued=false;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.version === 1) for (const key of Object.keys(defaults)) {
      for (const def of definitions) if (Number.isFinite(saved[key]?.[def.key])) preferences[key][def.key] = saved[key][def.key];
    }
  } catch (_) { /* Private browsing or unavailable storage keeps the default layout. */ }
  const current = () => ({...defaults[mode],...preferences[mode]});
  const rect = selector => screen.querySelector(selector)?.getBoundingClientRect();
  const px = (name,value) => screen.style.setProperty('--layout-'+name,Math.round(value*100)/100+'px');
  function persist() {
    try { localStorage.setItem(storageKey,JSON.stringify({version:1,...preferences})); } catch (_) {}
  }
  function refresh() {
    if (queued || !screen) return;
    queued=true;requestAnimationFrame(()=>{queued=false;apply();});
  }
  function apply(editedKey) {
    if (!screen || screen.hidden || !grid.clientWidth) return;
    const nextMode = matchMedia('(max-width:800px) and (orientation:portrait)').matches ? 'portrait' : 'desktop';
    if (active && nextMode!==mode) finish(false);
    mode=nextMode;
    const p=current(),short=innerHeight<=600&&mode==='desktop';
    if(mode==='desktop') px('header-height',clamp(p.header ? p.header*innerHeight : innerHeight*.10,short?50:82,Math.min(170,innerHeight*.21)));
    const g=grid.getBoundingClientRect(),w=g.width,h=g.height,gap=parseFloat(getComputedStyle(grid).columnGap)||8;
    if(w<=0||h<=0)return;
    let left,right,jobs,village,map;
    if(mode==='desktop'){
      const sideMin=w<1000?140:180,mapMin=Math.min(280,w*.36);
      right=clamp(p.right*w,sideMin,w-sideMin-mapMin-gap*2);
      left=clamp(p.left*w,sideMin,w-right-mapMin-gap*2);
      jobs=clamp(p.jobs*h,h<400?70:110,h-120-gap);
      village=clamp(p.village*h,h<400?70:110,h-110-gap);
      px('right',right);
    }else{
      left=clamp(p.left*w,Math.min(120,w*.40),w-Math.min(120,w*.40)-gap);
      map=clamp(p.map*h,100,h-160-gap*3);
      const remaining=h-map-gap*3;
      jobs=clamp(p.jobs*h,52,remaining-104);
      village=clamp(p.village*h,52,remaining-jobs-52);
      px('map-height',map);
    }
    px('left',left);px('jobs-height',jobs);px('village-height',village);
    const character=rect('.character-panel'),context=rect('.management-context');
    const availablePeople=Math.max(100,(character?.height||h)-(context?.height||0));
    const people=clamp(p.people*availablePeople,Math.min(80,availablePeople*.35),availablePeople-Math.min(125,availablePeople*.45));
    px('people-height',people);
    metrics={left:left/w,right:(right||0)/w,jobs:jobs/h,village:village/h,map:(map||0)/h,people:people/availablePeople,header:(rect('.game-topbar')?.height||0)/innerHeight};
    for(const key of ['market','buildings','inspector']){
      const selector={market:'#building-market',buildings:'#owned-buildings',inspector:'#village-inspector'}[key];
      if(Number.isFinite(p[key]))px(key==='buildings'?'buildings-height':key+'-height',clamp(p[key]*h,70,Math.max(90,h*.8)));
      else screen.style.removeProperty('--layout-'+(key==='buildings'?'buildings-height':key+'-height'));
      metrics[key]=(rect(selector)?.height||0)/h;
    }
    if(editedKey)preferences[mode][editedKey]=metrics[editedKey];
    positionHandles();
  }
  function place(key,x,y,width,height,visible=true){
    const el=handles.get(key),s=screen.getBoundingClientRect();
    el.hidden=!visible||width<1||height<1;
    if(el.hidden)return;
    Object.assign(el.style,{left:(x-s.left)+'px',top:(y-s.top)+'px',width:width+'px',height:height+'px'});
    el.setAttribute('aria-valuemin','0');el.setAttribute('aria-valuemax','100');el.setAttribute('aria-valuenow',String(Math.round((metrics[key]||0)*100)));
  }
  function positionHandles(){
    const g=grid.getBoundingClientRect(),people=rect('.character-panel'),board=rect('.board-panel'),jobs=rect('.management-professions'),village=rect('.management-village'),tools=rect('.side-panel'),residents=rect('.management-people'),header=rect('.game-topbar');
    if(!people||!board||!jobs||!village||!tools)return;
    const thickness=mode==='portrait'?12:10;
    place('left',people.right+(mode==='desktop'?(board.left-people.right):(tools.left-people.right))/2-thickness/2,people.top,thickness,people.height);
    place('right',board.right+(tools.left-board.right)/2-thickness/2,tools.top,thickness,g.height,mode==='desktop');
    place('map',g.left,board.bottom+(people.top-board.bottom)/2-thickness/2,g.width,thickness,mode==='portrait');
    place('jobs',jobs.left,jobs.top-thickness/2-3,jobs.width,thickness);
    place('village',village.left,village.top-thickness/2-3,village.width,thickness);
    if(residents)place('people',residents.left+4,residents.bottom-thickness/2,residents.width-8,thickness);
    place('header',header.left,header.bottom-thickness/2+4,header.width,thickness,mode==='desktop');
    for(const key of ['market','buildings','inspector']){
      const r=rect({market:'#building-market',buildings:'#owned-buildings',inspector:'#village-inspector'}[key]);
      const visible=r&&r.height>0&&r.bottom>tools.top+8&&r.bottom<tools.bottom-5;
      if(r)place(key,Math.max(r.left,tools.left)+5,r.bottom-thickness/2,Math.min(r.right,tools.right)-Math.max(r.left,tools.left)-10,thickness,visible);
      else handles.get(key).hidden=true;
    }
  }
  function setValue(key,value){preferences[mode][key]=value;apply(key);}
  function start(event){
    const el=event.target.closest('[data-layout-resize]');
    if(!el||event.button!==0||active)return;
    event.preventDefault();event.stopPropagation();apply();
    const def=definitions.find(d=>d.key===el.dataset.layoutResize),g=grid.getBoundingClientRect();
    const base=def.key==='people'?Math.max(100,(rect('.character-panel')?.height||g.height)-(rect('.management-context')?.height||0)):def.key==='header'?innerHeight:def.orientation==='vertical'?g.width:g.height;
    active={def,el,pointerId:event.pointerId,x:event.clientX,y:event.clientY,value:metrics[def.key],base,before:{...preferences[mode]},mode};
    el.setPointerCapture(event.pointerId);el.classList.add('is-dragging');document.body.classList.add('is-resizing-game');document.body.style.setProperty('--layout-cursor',def.orientation==='vertical'?'col-resize':'row-resize');
  }
  function move(event){
    if(!active||event.pointerId!==active.pointerId)return;
    event.preventDefault();const delta=active.def.orientation==='vertical'?event.clientX-active.x:event.clientY-active.y;
    setValue(active.def.key,active.value+delta*active.def.sign/active.base);
  }
  function finish(save){
    if(!active)return;
    const old=active;active=null;
    if(!save)preferences[old.mode]=old.before;
    old.el.classList.remove('is-dragging');document.body.classList.remove('is-resizing-game');document.body.style.removeProperty('--layout-cursor');
    if(old.el.hasPointerCapture(old.pointerId))old.el.releasePointerCapture(old.pointerId);
    if(save)persist();apply();
  }
  function reset(){
    if(active)finish(false);
    preferences={desktop:{},portrait:{}};persist();apply();
  }
  function resetOne(key){delete preferences[mode][key];persist();apply();}
  function init(){
    screen=document.querySelector('#game-screen');grid=screen?.querySelector('.game-layout');if(!grid)return;
    overlay=document.createElement('div');overlay.className='layout-resizers';handles=new Map();
    for(const def of definitions){
      const el=document.createElement('div');el.className='layout-resizer';el.dataset.layoutResize=def.key;el.tabIndex=0;el.setAttribute('role','separator');el.setAttribute('aria-orientation',def.orientation);el.setAttribute('aria-label',def.label);el.title=def.label+' · Glisser pour ajuster, double-clic pour rétablir';overlay.append(el);handles.set(def.key,el);
    }
    screen.append(overlay);
    overlay.addEventListener('pointerdown',start);overlay.addEventListener('pointermove',move);overlay.addEventListener('pointerup',e=>{if(active?.pointerId===e.pointerId)finish(true);});overlay.addEventListener('pointercancel',e=>{if(active?.pointerId===e.pointerId)finish(false);});overlay.addEventListener('lostpointercapture',()=>{if(active)finish(false);});
    overlay.addEventListener('dblclick',event=>{const el=event.target.closest('[data-layout-resize]');if(el){event.preventDefault();resetOne(el.dataset.layoutResize);}});
    screen.addEventListener('click',event=>{if(event.target.closest('[data-layout-reset]')){event.preventDefault();event.stopPropagation();reset();}});
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&active){event.preventDefault();event.stopPropagation();finish(false);return;}
      const el=event.target.closest?.('[data-layout-resize]');if(!el)return;
      const def=definitions.find(d=>d.key===el.dataset.layoutResize);
      if(event.key==='Home'){event.preventDefault();event.stopPropagation();resetOne(def.key);return;}
      const direction=def.orientation==='vertical'?({ArrowLeft:-1,ArrowRight:1}[event.key]):({ArrowUp:-1,ArrowDown:1}[event.key]);
      if(!direction)return;
      event.preventDefault();event.stopPropagation();apply();const g=grid.getBoundingClientRect(),base=def.key==='header'?innerHeight:def.key==='people'?(rect('.character-panel').height-rect('.management-context').height):def.orientation==='vertical'?g.width:g.height;
      setValue(def.key,metrics[def.key]+direction*def.sign*(event.shiftKey?36:12)/base);persist();
    },true);
    addEventListener('resize',()=>apply());addEventListener('blur',()=>finish(false));screen.addEventListener('scroll',refresh,true);
    const observer=new MutationObserver(refresh);observer.observe(screen,{attributes:true,attributeFilter:['hidden']});
    for(const selector of ['#residents-panel','.side-panel'])observer.observe(screen.querySelector(selector),{childList:true,subtree:true});
    const sizes=new ResizeObserver(()=>apply());sizes.observe(grid);sizes.observe(screen.querySelector('.game-topbar'));
    refresh();
  }
  E.GameLayout={refresh,reset,get diagnostics(){return {mode,metrics:{...metrics},custom:Object.values(preferences).some(p=>Object.keys(p).length>0),dragging:active?.def.key||null};}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}());
