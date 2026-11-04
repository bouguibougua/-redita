(function () {
  'use strict';
  const E = window.Eredita;
  const fields = { tools:'tool', armors:'armor' };
  const isHuman = person => Boolean(person && !person.isLegend && !person.mythologyLegendId && !person.animalType && !['chien','sanglier','ane','charrette'].includes(person.role));

  // Older clients may still send a resident id. It validates the village but no longer limits the recipients.
  function selection(first,second,third) {
    return third === undefined ? {kind:first,type:second,residentId:null} : {kind:second,type:third,residentId:first};
  }
  function quote(state,playerId,lane,first,second,third) {
    const {kind,type,residentId}=selection(first,second,third);
    if(!Object.hasOwn(fields,kind)||!Object.hasOwn(E.Config.equipment[kind],type))return null;
    const player=state.players[playerId],village=player?.villages[lane];
    if(!village)return null;
    const item=E.Config.equipment[kind][type];
    const level=Math.max(0,...village.buildings.filter(b=>b.type==='artisanat').map(b=>b.level));
    const equipped=village.equipment?.[fields[kind]]===type;
    let reason=null;
    if(state.phase!=='running')reason='Partie inactive';
    else if(state.paused)reason='Partie en pause';
    else if(village.destroyed)reason='Village détruit';
    else if(level<item.requiredTier)reason=`Artisanat T${item.requiredTier} requis`;
    else if(residentId!=null&&!village.residents.some(r=>r.id===residentId))reason='Habitant absent de ce village';
    else if(equipped)reason='Déjà équipé dans ce village';
    else if(player.gold<item.gold)reason='Or insuffisant';
    return {...item,kind,type,equipped,residentId,recipients:village.residents.filter(isHuman).length,allowed:!reason,reason:reason||'Tous les habitants actuels et futurs · hors légendes'};
  }
  function applyVillage(village,resident) {
    if(!isHuman(resident))return false;
    for(const [kind,field] of Object.entries(fields)) {
      const type=village.equipment?.[field];
      if(type&&Object.hasOwn(E.Config.equipment[kind],type))resident[field]=type;
    }
    return true;
  }
  function buy(state,playerId,lane,first,second,third) {
    const purchase=quote(state,playerId,lane,first,second,third);
    if(!purchase?.allowed)return false;
    const player=state.players[playerId],village=player.villages[lane],field=fields[purchase.kind];
    player.gold-=purchase.gold;
    village.equipment={...(village.equipment||{}),[field]:purchase.type};
    // Update only the equipment contribution, preserving wounds, Artisanat and mythological bonuses.
    for(const unit of state.units) {
      if(unit.ownerId!==playerId||unit.originLane!==lane||unit.hp<=0||!isHuman(unit))continue;
      const before=bonuses(unit);unit[field]=purchase.type;const after=bonuses(unit),multiplier=unit.mythologyStatMultiplier||1;
      const hpDifference=(after.hp-before.hp)*multiplier;
      unit.maxHp+=hpDifference;unit.hp=Math.max(0,Math.min(unit.maxHp,unit.hp+hpDifference));
      unit.damage+=(after.damage-before.damage)*multiplier;
    }
    for(const resident of village.residents)if(isHuman(resident))resident[field]=purchase.type;
    return purchase;
  }
  function bonuses(resident) {
    const tool=resident&&E.Config.equipment.tools[resident.tool],armor=resident&&E.Config.equipment.armors[resident.armor];
    return {damage:tool?.damage||0,hp:armor?.hp||0,productionSpeed:resident?.tool==='bois'?tool?.productionBonus||0:0,productionYield:resident?.tool!=='bois'?tool?.productionBonus||0:0};
  }
  E.Equipment={quote,buy,bonuses,applyVillage,isHuman};
}());
