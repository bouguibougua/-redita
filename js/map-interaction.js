(function () {
  'use strict';
  const E=window.Eredita;
  const resources={ble:'Blé',chataigne:'Châtaigne',raisin:'Raisin',viande:'Viande',poisson:'Poisson',lait:'Lait'};
  let selection=null, card=null, resource='ble', signature='';
  const sameVillage=(a,b)=>a?.playerId===b?.playerId&&a?.lane===b?.lane;
  function selectable(target,state=E.GameView?.getState()) {
    const village=state?.players[target?.playerId]?.villages[target?.lane];
    return Boolean(state?.phase==='running'&&village&&!village.destroyed&&E.GameView?.canControl(target.playerId));
  }
  function ensureCard() {
    if(card)return;
    card=document.createElement('section');card.id='map-selection';card.className='map-selection';card.hidden=true;
    card.setAttribute('aria-label','Élément sélectionné sur la carte');
    document.querySelector('#battlefield').append(card);
    card.addEventListener('click',event=>{
      const button=event.target.closest('[data-map-action]');if(!button||button.disabled)return;
      const action=button.dataset.mapAction,s=E.GameView.getState();
      if(action==='close'){selection=null;update(s);return;}
      if(!selection||!selectable(selection,s)||!sameVillage(selection,s.selectedVillage))return;
      const v=s.players[selection.playerId].villages[selection.lane];
      if(action==='upgrade-crop')E.GameView.command('upgradeCrop',selection.slotIndex);
      if(action==='plant')E.GameView.command('placeCrop',button.dataset.type,selection.slotIndex);
      if(action==='livestock')E.GameView.command('placeLivestock',button.dataset.type,selection.slotIndex);
      if(action==='build')E.GameView.command('build',selection.buildingType);
      if(action==='upgrade-building')E.GameView.command('upgrade',selection.kind==='village'?'village':v.buildings.findIndex(b=>b.type===selection.buildingType),resource);
      if(action==='tasks')document.querySelector('.management-tasks')?.scrollIntoView({block:'nearest'});
      if(action==='slot-details')document.querySelector('#slot-options')?.scrollIntoView({block:'nearest'});
      update(E.GameView.getState());E.Board3D?.update(E.GameView.getState());
    });
    card.addEventListener('change',event=>{if(event.target.matches('[data-map-upgrade-resource]')){resource=event.target.value;update(E.GameView.getState());}});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selection){selection=null;update(E.GameView.getState());}});
  }
  function select(target) {
    const s=E.GameView.getState();if(!selectable(target,s))return false;
    const v=s.players[target.playerId].villages[target.lane];
    if(target.kind==='slot'&&!v.slots[target.slotIndex])return false;
    if(target.kind==='resident'&&!v.residents.some(r=>r.id===target.residentId))return false;
    if(target.kind==='building'&&!E.Config.building.types.includes(target.buildingType))return false;
    if(!['village','slot','building','resident'].includes(target.kind))return false;
    if(!sameVillage(target,s.selectedVillage)&&!E.GameView.selectVillage(target.playerId,target.lane))return false;
    if(target.kind==='resident')E.GameView.command('selectResident',target.residentId);
    if(target.kind==='slot')E.UI.openMapSlot(target.playerId,target.lane,target.slotIndex);
    selection={...target};signature='';update(s);E.Board3D?.update(s,true);
    return true;
  }
  function action(label,name,allowed=true,details='',extra='') {
    return `<button type="button" data-map-action="${name}" ${allowed?'':'disabled'} ${extra}>${label}${details?`<small>${details}</small>`:''}</button>`;
  }
  function upgrade(v,s,index) {
    const q=E.Buildings.upgradeQuote(s,v.ownerId,v.lane,index,resource);
    return q?action(`Améliorer → T${q.level}`,'upgrade-building',q.allowed,`${q.gold} or${q.resourceAmount?` + ${q.resourceAmount} ${resources[q.resourceType]}`:''}`):'<small>Niveau maximum · T3</small>';
  }
  function update(s) {
    ensureCard();
    if(!selection||!selectable(selection,s)||!sameVillage(selection,s.selectedVillage)){
      selection=null;card.hidden=true;signature='';return;
    }
    const t=selection,v=s.players[t.playerId].villages[t.lane];
    let title='',info='',buttons='';
    if(t.kind==='slot'){
      const slot=v.slots[t.slotIndex],c=slot?.content;if(!slot){selection=null;return update(s);}
      title=`Slot ${t.slotIndex+1}`;
      if(c?.category==='crop'){
        title=E.Config.crops[c.type].label+` · N${E.Crops.levelOf(c)}`;
        info=`${Math.ceil(c.hp)}/${c.maxHp} PV · Rendement ×${E.Crops.yieldOf(c)}`;
        const q=E.Crops.upgradeQuote(s,t.playerId,t.lane,t.slotIndex);
        buttons=action(q.nextLevel<=3?`Améliorer → N${q.nextLevel}`:'Niveau maximum · N3','upgrade-crop',q.allowed,q.gold?`${q.gold} or`:'' );
      } else if(c) {title=E.Config.livestock[c.type].label;info=`${c.count} animaux · ${Math.ceil(c.hp)} PV`;
      } else {
        info='Emplacement disponible';
        if(slot.type==='free')buttons+=Object.entries(E.Config.crops).filter(([type])=>E.Crops.isAllowedInBiome(type,v.biome)).map(([type,crop])=>action(`${crop.icon} ${crop.shortLabel}`,'plant',E.Crops.canPlace(s,t.playerId,t.lane,t.slotIndex,type),`${E.Config.cropLevels[1].gold} or`,`data-type="${type}"`)).join('');
        buttons+=Object.entries(E.Config.livestock).map(([type,animal])=>action(`${animal.icon} ${animal.shortLabel}`,'livestock',E.Livestock.canPlace(s,t.playerId,t.lane,t.slotIndex,type),'',`data-type="${type}"`)).join('');
      }
      buttons+=action('Gestion du terrain','slot-details');
    } else if(t.kind==='building'){
      const i=v.buildings.findIndex(b=>b.type===t.buildingType),b=v.buildings[i],d=E.Config.building.descriptions[t.buildingType];
      title=`${d.label} · ${b?`T${b.level}`:'Chantier'}`;info=d.purpose;
      if(b){
        if(b.level<3)buttons=`<label>Ressource<select data-map-upgrade-resource>${E.Config.resources.map(k=>`<option value="${k}" ${k===resource?'selected':''}>${resources[k]}</option>`).join('')}</select></label>`;
        buttons+=upgrade(v,s,i);
      } else {const q=E.Buildings.buildQuote(s,t.playerId,t.lane,t.buildingType);buttons=action('Construire','build',q.allowed,`${q.gold} or`);}
    } else if(t.kind==='resident'){
      const r=v.residents.find(r=>r.id===t.residentId);if(!r){selection=null;return update(s);}
      const stats=E.CharacterHUD.getStats(s,v,r);
      title=r.name;info=`${E.Config.professions[r.profession]?.label||'Sans métier'} · ${Math.ceil(stats.hp)}/${Math.ceil(stats.maxHp)} PV`;
      buttons=action('Tâches et métier','tasks');
    } else {title=`Village ${t.lane+1} · T${v.level}`;info=`${Math.ceil(v.hp)}/${v.maxHp} PV`;buttons=upgrade(v,s,'village');}
    const html=`<header><strong>${title}</strong><button type="button" data-map-action="close" aria-label="Fermer la fiche">×</button></header><p>${info}</p><div class="map-actions">${buttons}</div>`;
    if(html!==signature){signature=html;card.innerHTML=html;}
    card.hidden=false;card.dataset.kind=t.kind;
  }
  function fromDOM(event) {
    if(E.MythologySession?.getTargeting())return;
    if(event.target.closest('#map-selection'))return;
    let el=event.target.closest('[data-unit-id]');
    if(el){const u=E.GameView.getState().units.find(u=>String(u.id)===el.dataset.unitId);if(u?.residentId)return select({kind:'resident',playerId:u.ownerId,lane:u.originLane,residentId:u.residentId});return;}
    el=event.target.closest('[data-map-resident]');
    if(el)return select({kind:'resident',playerId:el.dataset.player,lane:Number(el.dataset.lane),residentId:el.dataset.mapResident});
    el=event.target.closest('[data-slot-visual]');
    if(el)return select({kind:'slot',playerId:el.dataset.player,lane:Number(el.dataset.lane),slotIndex:Number(el.dataset.slotIndex)});
    el=event.target.closest('[data-terrain-building]');
    if(el){const r=el.closest('.region');const type=el.dataset.terrainBuilding;return select({kind:['village','campfire'].includes(type)?'village':'building',buildingType:type,playerId:r.dataset.player,lane:Number(r.dataset.lane)});}
    el=event.target.closest('.region[data-player]');
    if(el)return select({kind:'village',playerId:el.dataset.player,lane:Number(el.dataset.lane)});
  }
  E.MapInteraction={select,selectable,update,fromDOM,get selection(){return selection;}};
}());
