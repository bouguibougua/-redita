(function(){
 'use strict';
 const E=window.Eredita,cfg=()=>E.Config.badOmen;
 const keyOf=(owner,type,id)=>`${owner}:${type}:${id}`;
 function init(s){s.badOmen={nextProjectileId:1,projectiles:[]};}
 function markOf(s,t){return t.entity.badOmen||canonical(s,t)?.badOmen||null;}
 function canonical(s,t){if(t.kind!=='unit')return t.entity;const u=t.entity,v=s.players[u.ownerId]?.villages[u.originLane];return u.residentId?v?.residents.find(r=>r.id===u.residentId):u.animalId?v?.animals?.find(a=>a.id===u.animalId):u;}
 function unitKey(u){return u.residentId?keyOf(u.ownerId,'resident',u.residentId):u.animalId?keyOf(u.ownerId,'animal',u.animalId):keyOf(u.ownerId,'unit',u.id+':'+(u.mythologyForm||''));}
 function characters(s){
  const out=[];
  for(const u of s.units)if(u.hp>0)out.push({key:unitKey(u),ownerId:u.ownerId,kind:'unit',entity:u,renderKey:'unit-'+u.id,
   point:{position:u.position,lanePosition:u.lanePosition,terrainOffset:u.terrainOffset||0}});
  for(const p of Object.values(s.players))for(const v of p.villages){if(v.destroyed)continue;
   const cfg=E.Config.villagePresentation,sign=p.id==='red'?1:-1;
   const idleCount=v.residents.filter(r=>!r.unitId&&(!r.mission||r.mission==='disponible')&&!(r.hp<=0)).length;
   let localIndex=0,fisherIndex=0,animalIndex=0;
   for(const r of v.residents){if(r.unitId||r.hp<=0)continue;const index=v.residents.indexOf(r),working=['agriculture','elevage','chasse'].includes(r.mission)&&Number.isFinite(r.workPosition);
    let offset,z;
    if(working){offset=r.mission==='chasse'?(r.workLaneOffset||0)*2.7:index%2?.3:-.3;z=E.Config.boardProjection.originZ+r.workPosition*E.Config.boardProjection.positionScale;}
    else if(r.mission==='peche'){const row=Math.floor(fisherIndex/7),column=fisherIndex++%7,bank=v.biome==='littoral'?.36-row*.34:.18+row*.17;offset=-1.08+column*.36;z=sign*(-cfg.regionCenter+bank);}
    else {const point=E.Board.idlePosition(localIndex++,idleCount);offset=point.x*sign;z=sign*(-cfg.regionCenter+point.z);}
    out.push({key:keyOf(p.id,'resident',r.id),ownerId:p.id,kind:'resident',village:v,entity:r,renderKey:`resident-${p.id}-${r.id}`,point:{position:E.Board.combatPosition(z),lanePosition:v.lane,terrainOffset:offset}});
   }
   for(const animal of v.animals||[])if(!animal.unitId&&animal.hp>0){const row=Math.floor(animalIndex/6),column=animalIndex++%6;
    out.push({key:keyOf(p.id,'animal',animal.id),ownerId:p.id,kind:'animal',village:v,entity:animal,renderKey:`animal-${p.id}-${animal.id}`,point:{position:E.Board.combatPosition(sign*(-cfg.regionCenter-.67+row*.31)),lanePosition:v.lane,terrainOffset:-1+column*.38}});
   }
  }
  return out.filter(t=>stats(s,t).hp>0);
 }
 function villageTarget(s,owner,lane){const v=s.players[owner]?.villages[lane];return v&&!v.destroyed&&v.hp>0?{key:keyOf(owner,'village',lane),ownerId:owner,kind:'village',entity:v,point:{position:owner==='red'?0:100,lanePosition:lane,terrainOffset:0}}:null;}
 function find(s,key){const t=characters(s).find(t=>t.key===key);if(t)return t;const match=typeof key==='string'&&key.match(/^(red|blue):village:(\d+)$/);return match?villageTarget(s,match[1],Number(match[2])):null;}
 function stats(s,t){return t.kind==='resident'?E.Economy.residentStats(s,t.village,t.entity):t.entity;}
 function distance(s,a,b){const width=E.Board.widthScale(s),spacing=E.Config.board.laneSpacing;
  return Math.hypot(((b.lanePosition-a.lanePosition)*spacing+(b.terrainOffset||0)-(a.terrainOffset||0))*width,E.Board.combatZ(b.position)-E.Board.combatZ(a.position))/E.Config.boardProjection.positionScale;
 }
 function setHp(s,t,hp){const st=stats(s,t);if(t.kind==='resident'&&!t.entity.isLegend)t.entity.combatHealthRatio=Math.max(0,hp)/st.maxHp;else t.entity.hp=Math.max(0,hp);}
 function applyMark(s,t,owner){const old=markOf(s,t);const mark=old||{ownerId:owner};t.entity.badOmen=mark;const c=canonical(s,t);if(c)c.badOmen=mark;}
 function onDeath(s,entity,ownerId,fallback){const mark=entity.badOmen||fallback?.badOmen;if(!mark)return;
  delete entity.badOmen;if(fallback)delete fallback.badOmen;
  for(const u of s.units)if(cfg().growthRecipients==='living-allied-mazzeri'&&u.hp>0&&u.ownerId===mark.ownerId&&u.ownerId!==ownerId&&u.mythologyLegendId==='u-mazzeru'){
   u.maxHp+=cfg().maxHpPerDeath;u.omenGrowthTimer=cfg().growthPulseDuration;u.omenGrowthSequence=(u.omenGrowthSequence||0)+1;
  }
 }
 function removeLocal(s,t){
  if(t.kind==='resident')E.Economy.removeResident(s,t.ownerId,t.village.lane,t.entity.id);
  else if(t.kind==='animal'){onDeath(s,t.entity,t.ownerId);E.MythologyEffects?.recordDeath(s,t.village,{...t.entity,animalType:t.entity.type,role:t.entity.type});t.village.animals=t.village.animals.filter(a=>a!==t.entity);}
 }
 function enforce(s){
  for(const t of characters(s)){const st=stats(s,t),mark=markOf(s,t);if(!mark)continue;
   t.entity.badOmen=mark;
   if(st.hp>0&&st.hp<=st.maxHp*cfg().thresholdRatio+1e-9){
    if(t.kind==='resident'&&E.MythologyEffects?.protectionActive(s,t.ownerId)&&!t.entity.isLegend){E.MythologyEffects.protectWorker(s,t.village,t.entity);continue;}
    setHp(s,t,0);t.entity.badOmenExecuted=true;
    if(t.kind!=='unit')removeLocal(s,t);
   }
  }
 }
 function hit(s,sourceOwner,targetKey,amount){const t=find(s,targetKey);if(!t)return false;
  const hp=stats(s,t).hp;if(t.kind==='village'){t.entity.hp=Math.max(0,hp-amount);t.entity.damageSmoke=E.Config.visualEffects.structureSmokeDuration;return true;}applyMark(s,t,sourceOwner);setHp(s,t,hp-amount);
  t.entity.visualHitSequence=(t.entity.visualHitSequence||0)+1;t.entity.visualHitTimer=E.Config.visualEffects.unitHitFlashDuration;
  if(t.kind!=='unit'&&hp-amount<=0){
   if(t.kind==='resident'&&E.MythologyEffects?.protectWorker(s,t.village,t.entity)&&E.MythologyEffects.protectionActive(s,t.ownerId)){delete t.entity.combatHealthRatio;return true;}
   removeLocal(s,t);
  }
  return true;
 }
 function shoot(s,u,t){if(!s.badOmen)init(s);const duration=Math.max(cfg().minFlightDuration,distance(s,u,t.point)/cfg().projectileSpeed);
  s.badOmen.projectiles.push({id:s.badOmen.nextProjectileId++,sourceId:u.id,ownerId:u.ownerId,targetKey:t.key,from:{position:u.position,lanePosition:u.lanePosition,terrainOffset:u.terrainOffset||0},target:{...t.point},duration,remaining:duration+cfg().releaseDelay,damage:u.damage});
  u.visualAttackSequence=(u.visualAttackSequence||0)+1;u.visualAttackTimer=E.Config.visualEffects.unitAttackDuration;u.visualAttackTarget={...t.point};u.attackCooldown=cfg().shotInterval;
 }
 function updateProjectiles(s,delta){if(!s.badOmen)return;
  for(const p of s.badOmen.projectiles){const t=find(s,p.targetKey);if(!t){p.remaining=0;continue;}p.target={...t.point};p.remaining-=delta;if(p.remaining<=1e-9)hit(s,p.ownerId,p.targetKey,p.damage);}
  s.badOmen.projectiles=s.badOmen.projectiles.filter(p=>p.remaining>1e-9);
 }
 function mazzeruTurn(s,u){
  const target=characters(s).filter(t=>t.ownerId!==u.ownerId&&!markOf(s,t)).sort((a,b)=>distance(s,u,a.point)-distance(s,u,b.point)||a.key.localeCompare(b.key))[0];
  u.mazzeruMarking=Boolean(target);
  const ordinary=target||characters(s).filter(t=>t.ownerId!==u.ownerId&&Math.abs(t.point.lanePosition-u.lanePosition)<.12&&distance(s,u,t.point)<=E.Config.combat.professionAttackRanges.chasseur)
   .sort((a,b)=>distance(s,u,a.point)-distance(s,u,b.point)||a.key.localeCompare(b.key))[0];
  if(!ordinary)return false;
  if(u.attackCooldown<=0)shoot(s,u,ordinary);return true;
 }
 E.BadOmen={villageTarget,init,characters,find,stats,markOf,distance,applyMark,onDeath,enforce,hit,shoot,updateProjectiles,mazzeruTurn};
}());
