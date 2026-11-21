(function () {
  "use strict";
  const E = window.Eredita, C = E.Config.illustratedShop, art = E.ShopArt;
  const money = value => Number(value || 0).toLocaleString('fr-FR',{maximumFractionDigits:2});
  let controller, getState, root, scene, advanced, wallet, status, donkeyStock, lastGold, lastOwner, previousFocus;
  let hovered = null, alpha = null, hitContext, imageReady = false, pending = null, messageUntil = 0, syncSignature = '';
  let scene3D = null, sceneLoading = null;
  const nodes = new Map(), masks = new Map();
  const position = ([x,y,w,h]) => `left:${x/C.width*100}%;top:${y/C.height*100}%;width:${w/C.width*100}%;height:${h/C.height*100}%`;
  function imageMarkup(item) {
    const [x,y,w,h] = item.bounds, clip = item.path || `M${x} ${y}h${w}v${h}h-${w}Z`;
    masks.set(item.id,new Path2D(clip));
    const source = `<image href="${C.merchandise}" x="0" y="0" width="${C.width}" height="${C.height}"/>`;
    // Le masque soustrait la tête du corps avant de lui appliquer son petit mouvement propre.
    const head = item.head ? `<mask id="body-${item.id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${C.width}" height="${C.height}"><rect width="${C.width}" height="${C.height}" fill="white"/><path d="${item.head}" fill="black" stroke="white" stroke-width="4"/></mask><clipPath id="head-${item.id}"><path d="${item.head}"/></clipPath>` : '';
    const metal=['tools','armors'].includes(item.kind);
    const shine=metal?`<mask id="shine-${item.id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${C.width}" height="${C.height}" style="mask-type:alpha">${source}</mask><linearGradient id="glint-${item.id}"><stop stop-color="white" stop-opacity="0"/><stop offset=".5" stop-color="#fff1c9" stop-opacity=".65"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>`:'';
    return `<svg viewBox="${x} ${y} ${w} ${h}" aria-hidden="true"><defs><clipPath id="cut-${item.id}"><path d="${clip}"/></clipPath>${head}${shine}</defs><g clip-path="url(#cut-${item.id})" class="shop-cutout">${item.head ? `<g mask="url(#body-${item.id})">${source}</g><g class="shop-animal-head" clip-path="url(#head-${item.id})">${source}</g>` : source}${metal?`<g mask="url(#shine-${item.id})"><rect class="shop-metal-glint" x="${x-60}" y="${y}" width="60" height="${h}" fill="url(#glint-${item.id})" style="--glint-travel:${w+120}px"/></g>`:''}</g></svg>`;
  }
  function init(commands, readState) {
    controller = commands; getState = readState;
    root = document.querySelector('#shop-modal');
    E.ShopTransactions?.subscribe(receipt=>{
      if(root.hidden)return;
      const selection=getState().selectedVillage;
      if(receipt.playerId!==selection.playerId)return;
      if(receipt.accepted){
        goldEffect(receipt.deltaGold);
        if(receipt.lane===selection.lane){
          pulse(nodes.get(receipt.itemId),'shop-confirmed');
        }
      }else if(receipt.lane===selection.lane)say('Transaction refusée · les conditions ont changé');
      pending=null;
    });
    const panel = root.querySelector('.shop-modal-panel'), head = root.querySelector('.shop-modal-head'), nav = root.querySelector('#shop-village-nav');
    root.classList.add('illustrated-shop');
    scene = document.createElement('div'); scene.className = 'shop-scene'; scene.setAttribute('aria-label','Échoppe corse');
    scene.style.setProperty('--shop-hover-ms',`${C.hoverDuration}ms`);
    scene.style.setProperty('--shop-hover-scale',C.hoverScale);
    scene.style.setProperty('--shop-gold-ms',`${C.goldDuration}ms`);
    scene.style.backgroundImage = `url("${C.background}")`;
    panel.prepend(scene); scene.append(head); head.insertBefore(nav,head.lastElementChild);
    const hud = document.createElement('div'); hud.className = 'shop-hud';
    hud.innerHTML = '<div class="shop-time"><span aria-hidden="true">◆</span><b data-shop-clock></b><small data-shop-phase></small></div><div class="shop-wallet" aria-label="Or global"><span class="shop-coin" aria-hidden="true">✦</span><b data-shop-balance></b><div class="shop-gold-effects" aria-hidden="true"></div></div>';
    head.insertBefore(hud,head.lastElementChild); wallet = hud.querySelector('.shop-wallet');
    const layer = document.createElement('div'); layer.className = 'shop-merchandise'; scene.append(layer);
    art.forEach((item,index)=>{
      const button = document.createElement('button');
      button.type='button'; button.className=`shop-object shop-object-${item.kind}`;
      button.dataset.shopObject=item.id; button.style.cssText=position(item.bounds);
      button.style.setProperty('--idle-delay',`${-index*.37}s`);
      button.setAttribute('aria-label',item.kind==='resource'?item.label:`Acheter ${item.label}`);
      button.innerHTML=imageMarkup(item); layer.append(button); nodes.set(item.id,button);
      button.addEventListener('click',event=>{event.stopPropagation(); activate(item);});
      button.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();if(!event.repeat)activate(item);}});
      button.addEventListener('focus',()=>setHover(item));
      button.addEventListener('blur',()=>setHover(null));
      if (item.kind!=='resource') {
        const label=document.createElement('span'); label.className='shop-nameplate';
        label.dataset.shopLabel=item.id;
        label.style.cssText=`left:${item.labelAt[0]/C.width*100}%;top:${item.labelAt[1]/C.height*100}%;`;
        label.textContent=item.label; layer.append(label);
      }
    });
    // Les lattes et poteaux restent immobiles, devant les animaux, sans boucher leurs interstices.
    layer.insertAdjacentHTML('beforeend',`<svg class="shop-fence" viewBox="0 0 ${C.width} ${C.height}" aria-hidden="true"><defs><clipPath id="shop-fence-cut"><path d="M0 675L28 680L28 826L0 819ZM301 679L347 685L344 853L307 861ZM0 694L340 699L339 733L0 728ZM0 756L339 750L340 791L0 791Z"/></clipPath></defs><image href="${C.master}" width="${C.width}" height="${C.height}" clip-path="url(#shop-fence-cut)"/></svg>`);
    const baskets=document.createElement('div'); baskets.className='shop-baskets';
    art.filter(item=>item.kind==='resource').forEach(item=>{
      const group=document.createElement('section'); group.className='shop-basket'; group.dataset.shopBasket=item.id;
      group.style.cssText=position([item.bounds[0]+7,741,163,139]);
      group.setAttribute('aria-label',`Vendre ${item.label}`);
      group.innerHTML=`<h3>${item.label}<small>Stock <b data-illustrated-stock="${item.id}">0</b></small></h3>${E.Config.shopSaleQuantities.map(q=>`<button type="button" data-shop-sell="${item.id}" data-quantity="${q}"><span>×${q}</span><span data-sale-gain>+0 <i aria-hidden="true">✦</i></span></button>`).join('')}`;
      baskets.append(group);
    }); scene.append(baskets);
    const utilities=document.createElement('div'); utilities.className='shop-utilities';
    utilities.innerHTML='<span class="shop-donkey-stock" data-shop-donkey-stock></span><div class="shop-feedback" role="status" aria-live="polite"></div><button type="button" class="shop-manage" aria-expanded="false" aria-controls="shop-modal-content">Gestion & compagnons <span aria-hidden="true">↗</span></button>';
    scene.append(utilities); status=utilities.querySelector('.shop-feedback'); donkeyStock=utilities.querySelector('[data-shop-donkey-stock]');
    advanced=root.querySelector('#shop-modal-content'); advanced.hidden=true;
    utilities.querySelector('.shop-manage').addEventListener('click',()=>{
      const open=advanced.hidden; advanced.hidden=!open; scene.classList.toggle('shop-managing',open);
      utilities.querySelector('.shop-manage').setAttribute('aria-expanded',String(open));
      utilities.querySelector('.shop-manage').innerHTML=open?'← Revenir à l’échoppe':'Gestion & compagnons <span aria-hidden="true">↗</span>';
      setHover(null);
      scene3D?.setVisible(!open);
    });
    baskets.addEventListener('click',event=>{
      const button=event.target.closest('[data-shop-sell]'); if(!button)return;
      const state=getState(),{playerId,lane}=state.selectedVillage,village=state.players[playerId].villages[lane];
      const amount=Number(button.dataset.quantity),quote=E.Economy.saleQuote(village,button.dataset.shopSell,amount);
      if(!canManage(state)||!quote?.amount){refuse(button,canManage(state)?`Stock insuffisant pour vendre ×${amount}`:'Gestion indisponible');return;}
      pending={owner:playerId,lane,id:button.dataset.shopSell,label:`Vente de ${amount} ${art.find(a=>a.id===button.dataset.shopSell).label.toLowerCase()}`,gold:state.players[playerId].gold,before:village.resources[button.dataset.shopSell],direction:1,expires:performance.now()+5000};
      controller.sell(button.dataset.shopSell,amount);
    });
    scene.addEventListener('pointermove',event=>{
      if(event.target.closest('.shop-modal-head,.shop-utilities')||!advanced.hidden){setHover(null);return;}
      const basket=event.target.closest('[data-shop-basket]');
      setHover(basket?art.find(item=>item.id===basket.dataset.shopBasket):hit(event),event);
    });
    scene.addEventListener('pointerleave',()=>setHover(null));
    window.addEventListener('blur',()=>setHover(null));
    baskets.addEventListener('focusin',event=>{
      const group=event.target.closest('[data-shop-basket]');
      if(group)setHover(art.find(item=>item.id===group.dataset.shopBasket));
    });
    baskets.addEventListener('focusout',event=>{if(!event.relatedTarget?.closest?.('[data-shop-basket]'))setHover(null);});
    scene.addEventListener('click',event=>{
      if(event.target.closest('button,select,label,.shop-modal-head,.shop-baskets,.shop-utilities')||!advanced.hidden)return;
      const item=hit(event);if(item)activate(item);
    });
    root.addEventListener('keydown',event=>{
      if(root.hidden)return;
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key!=='Tab')return;
      const all=[...root.querySelectorAll('button,select,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=all[0],last=all.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
    const img=new Image();img.onload=()=>{
      const canvas=document.createElement('canvas');canvas.width=C.width;canvas.height=C.height;
      hitContext=canvas.getContext('2d',{willReadFrequently:true}); hitContext.drawImage(img,0,0,C.width,C.height);
      alpha=hitContext.getImageData(0,0,C.width,C.height).data; imageReady=true;root.dataset.artReady='true';
    };img.onerror=()=>{root.dataset.artReady='error';say('Illustrations indisponibles. La vue Gestion reste accessible.');};img.src=C.merchandise;
    new MutationObserver(()=>scene3D?.setVisible(!root.hidden&&advanced.hidden)).observe(root,{attributes:true,attributeFilter:['hidden']});
  }
  function ensureScene() {
    if(!E.Config.shopScene?.enabled||!E.ShopScene||sceneLoading)return;
    sceneLoading=E.ShopScene.create(scene).then(runtime=>{
      scene3D=runtime;scene.classList.add('shop-has-3d');root.dataset.sceneReady='true';
      runtime.setVisible(!root.hidden&&advanced.hidden);syncSignature='';sync(getState());
      return runtime.loaded.then(()=>{root.dataset.modelsReady='true';});
    }).catch(error=>{root.dataset.sceneReady='error';console.warn('Boutique 3D : vue illustrée conservée.',error);});
  }
  function canManage(state) {
    const {playerId,lane}=state.selectedVillage;
    return state.phase==='running'&&!state.paused&&!state.players[playerId]?.villages[lane]?.destroyed&&
      (E.Network.mode==='local'||playerId===(E.Network.playerId||'red'));
  }
  function quote(item,state) {
    const {playerId,lane}=state.selectedVillage;
    if(item.kind==='inactive')return {allowed:false,reason:'Catalogue · mécanique à venir'};
    if(item.kind==='animal')return E.Livestock.purchaseQuote(state,playerId,lane,item.id);
    if(item.kind==='special')return E.Animals.purchaseQuote(state,playerId,lane,item.id);
    if(item.kind==='tools'||item.kind==='armors')return E.Equipment.quote(state,playerId,lane,item.kind,item.type);
    if(item.kind==='transport')return E.Transport.shopQuote(state,playerId,lane,item.id);
    return {allowed:canManage(state),reason:'Choisissez une quantité sur le panier'};
  }
  function activate(item) {
    const state=getState(),q=quote(item,state),button=nodes.get(item.id);
    if(q?.soldOut)return;
    if(item.kind==='resource'){scene.querySelector(`[data-shop-sell="${item.id}"]`)?.focus();return;}
    if(!canManage(state)||!q?.allowed){refuse(button,q?.reason||'Gestion indisponible');return;}
    const {playerId,lane}=state.selectedVillage;
    pending={owner:playerId,lane,id:item.id,label:item.label,gold:state.players[playerId].gold,before:inventory(item,state),direction:-1,expires:performance.now()+5000};
    if(item.kind==='animal')controller.buyAnimal(item.id);
    else if(item.kind==='special')controller.buySpecialAnimal(item.id);
    else if(item.kind==='tools'||item.kind==='armors')controller.buyEquipment(item.kind,item.type);
    else if(item.kind==='transport')controller.buyShopItem(item.id);
  }
  function inventory(item,state) {
    const {playerId,lane}=state.selectedVillage,v=state.players[playerId].villages[lane];
    if(item.kind==='resource')return v.resources[item.id];
    if(item.kind==='animal')return v.slots.reduce((n,s)=>n+(s.content?.type===item.id?s.content.count:0),0);
    if(item.kind==='special')return item.id==='ane'?E.Animals.waitingDonkeyCount(v)+E.Animals.assignedDonkeyCount(v):(v.animals||[]).filter(a=>a.type===item.id).length;
    if(item.kind==='tools'||item.kind==='armors')return v.equipment[item.kind==='tools'?'tool':'armor'];
    return v.maritime?.[item.id]||0;
  }
  function hit(event) {
    if(scene3D?.ready)return art.find(item=>item.id===scene3D.hit(event))||null;
    if(!imageReady)return null;
    const rect=scene.querySelector('.shop-merchandise').getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*C.width,y=(event.clientY-rect.top)/rect.height*C.height;
    if(x<0||y<0||x>=C.width||y>=C.height||alpha[(Math.floor(y)*C.width+Math.floor(x))*4+3]<36)return null;
    // Les paniers et la clôture sont devant les animaux. Les interstices restent traversables.
    if((x<347&&y>694&&y<733)||(x<340&&y>750&&y<791)||(x>301&&x<347&&y>680&&y<861))return null;
    return [...art].reverse().find(item=>!nodes.get(item.id).hidden&&hitContext.isPointInPath(masks.get(item.id),x,y))||null;
  }
  function setHover(item,event) {
    if(item&&nodes.get(item.id)?.hidden)item=null;
    // Actualiser le point même sans changer d'objet : il pilote l'inclinaison.
    scene3D?.setHover(item?.id||null,event);
    if(hovered===item)return;
    if(hovered)nodes.get(hovered.id)?.classList.remove('is-hovered');
    hovered=item;scene.classList.toggle('over-merchandise',Boolean(item));
    if(item){nodes.get(item.id).classList.add('is-hovered');if(item.kind!=='inactive')particles(item.bounds[0]+item.bounds[2]/2,item.bounds[1]+item.bounds[3]*.55);}
  }
  function particles(x,y) {
    if(scene3D?.ready)return;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||scene.querySelectorAll('.shop-spark').length>25)return;
    for(let i=0;i<C.particles;i++){
      const heightRatio=scene.querySelector('.shop-merchandise').getBoundingClientRect().height/scene.getBoundingClientRect().height;
      const spark=document.createElement('i');spark.className='shop-spark';spark.style.cssText=`left:${x/C.width*100}%;top:${y/C.height*100*heightRatio}%;--dx:${(i-2)*11}px;--dy:${-12-i*6}px;--delay:${i*35}ms`;
      scene.append(spark);setTimeout(()=>spark.remove(),850);
    }
  }
  function pulse(node,name) {if(!node)return;node.classList.remove(name);void node.offsetWidth;node.classList.add(name);setTimeout(()=>node.classList.remove(name),600);}
  function say(message) {status.textContent=message;messageUntil=performance.now()+4500;}
  function refuse(button,message) {pulse(button,'shop-refused');say(message);}
  function goldEffect(delta) {
    const box=wallet.querySelector('.shop-gold-effects');
    while(box.childElementCount>=4)box.firstElementChild.remove();
    const float=document.createElement('span');float.className=delta>0?'gold-gain':'gold-loss';
    float.textContent=`${delta>0?'+':'−'}${money(Math.abs(delta))}`;box.append(float);setTimeout(()=>float.remove(),C.goldDuration);
  }
  function open() {previousFocus=document.activeElement;lastGold=undefined;pending=null;syncSignature='';ensureScene();scene3D?.setVisible(advanced.hidden);sync(getState());root.querySelector('#close-shop-modal').focus();}
  function close() {root.hidden=true;scene3D?.setVisible(false);setHover(null);pending=null;lastGold=undefined;previousFocus?.focus();}
  function sync(state) {
    if(!root||root.hidden||!state)return;
    const {playerId,lane}=state.selectedVillage,player=state.players[playerId],village=player?.villages[lane];if(!village)return;
    scene.querySelector('[data-shop-clock]').textContent=document.querySelector('#game-clock').textContent;
    scene.querySelector('[data-shop-phase]').textContent=state.paused?'En pause':document.querySelector('#phase-label').textContent;
    if(performance.now()>messageUntil)status.textContent=village.destroyed?'Village détruit':state.paused?'Partie en pause':`Village ${lane+1} · stocks locaux, or partagé`;
    if(pending&&(performance.now()>pending.expires||pending.owner!==playerId||pending.lane!==lane))pending=null;
    const waitingDonkeys=E.Animals.waitingDonkeyCount(village);
    const nextSignature=JSON.stringify([playerId,lane,player.gold,state.phase,state.paused,village.destroyed,E.MythologyEffects?.isBurned(state,village),village.equipment,village.equipmentPurchases,village.buildings.map(b=>[b.type,b.level]),[village.maritime?.barque,village.maritime?.filet],
      E.Config.resources.map(r=>Math.floor(village.resources[r]||0)),village.slots.map(s=>[s.content?.type,s.content?.count]),village.animals,waitingDonkeys,village.residents.map(r=>[r.id,r.name,r.donkey,r.unitId,r.mission,r.profession,r.hp,r.combatHealthRatio])]);
    if(syncSignature===nextSignature)return;syncSignature=nextSignature;
    if(lastOwner!==playerId){lastGold=undefined;pending=null;lastOwner=playerId;}
    if(!E.ShopTransactions&&lastGold!==undefined&&Math.abs(player.gold-lastGold)>.001){
      const delta=player.gold-lastGold;goldEffect(delta);
      const item=pending&&art.find(a=>a.id===pending.id);
      if(pending&&item&&Math.sign(delta)===pending.direction&&inventory(item,state)!==pending.before){
        pulse(nodes.get(pending.id),'shop-confirmed');
        if(item)particles(item.bounds[0]+item.bounds[2]/2,item.bounds[1]+item.bounds[3]/2);
        say(`${pending.label} · ${delta>0?'+' : '−'}${money(Math.abs(delta))} or`);pending=null;
      }
    }
    lastGold=player.gold;
    wallet.querySelector('[data-shop-balance]').textContent=money(player.gold);
    donkeyStock.textContent=`Ânes à la base · ${waitingDonkeys}`;
    art.forEach(item=>{
      const node=nodes.get(item.id),q=quote(item,state),allowed=canManage(state)&&q?.allowed;
      const hadFocus=document.activeElement===node;
      scene3D?.setState(item.id,{allowed,sold:Boolean(q?.soldOut),count:q?.count});
      node.hidden=Boolean(q?.soldOut);
      if(node.hidden&&hovered===item)setHover(null);
      if(node.hidden&&hadFocus)root.querySelector('#close-shop-modal').focus();
      node.setAttribute('aria-disabled',String(!allowed));node.classList.toggle('shop-equipped',Boolean(q?.equipped));
      node.classList.toggle('shop-catalog-only',item.kind==='inactive');
      const label=item.label;
      node.setAttribute('aria-label',item.kind==='resource'?`${label} · stock ${money(village.resources[item.id])}`:`${item.kind==='inactive'?label:`Acheter ${label}`} · ${q?.reason||'Indisponible'}`);
      const plate=scene.querySelector(`[data-shop-label="${item.id}"]`);
      if(plate)plate.hidden=node.hidden;
      if(plate){let count='';if(item.kind==='transport')count=` · ${q?.count||0}`;
        else if(item.kind==='special'&&item.id!=='ane')count=` · ${(village.animals||[]).filter(a=>a.type===item.id).length}`;
        else if(item.kind==='animal')count=` · ${village.slots.reduce((n,s)=>n+(s.content?.type===item.id?s.content.count:0),0)}`;
        plate.textContent=label+count;plate.classList.toggle('catalog-plate',item.kind==='inactive');}
    });
    E.Config.resources.forEach(resource=>{
      scene.querySelector(`[data-illustrated-stock="${resource}"]`).textContent=money(Math.floor(village.resources[resource]||0));
      scene.querySelectorAll(`[data-shop-sell="${resource}"]`).forEach(button=>{
        const q=E.Economy.saleQuote(village,resource,Number(button.dataset.quantity));
        button.setAttribute('aria-disabled',String(!canManage(state)||!q?.amount));
        // Même stock insuffisant, afficher le gain d'un lot entier calculé par le devis central.
        const preview=q?.amount?q:E.Economy.saleQuote({...village,resources:{...village.resources,[resource]:Number(button.dataset.quantity)}},resource,Number(button.dataset.quantity));
        button.querySelector('[data-sale-gain]').innerHTML=`+${money(preview?.gold)} <i aria-hidden="true">✦</i>`;
        button.setAttribute('aria-label',`Vendre ${button.dataset.quantity} ${art.find(a=>a.id===resource).label}, gagner ${money(preview?.gold)} or${!q?.amount?' · stock insuffisant':''}`);
      });
    });
    if(performance.now()>messageUntil)status.textContent=village.destroyed?'Village détruit':state.paused?'Partie en pause':`Village ${lane+1} · stocks locaux, or partagé`;
  }
  E.IllustratedShop={init,open,close,sync,get scene3D(){return scene3D;}};
}());
