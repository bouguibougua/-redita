(function () {
  "use strict";

  const E = window.Eredita;

  function enemyId(ownerId) {
    return ownerId === "red" ? "blue" : "red";
  }

  function livingEnemyLanes(state, ownerId) {
    return state.players[enemyId(ownerId)].villages
      .filter((village) => !village.destroyed)
      .map((village) => village.lane);
  }

  function redirectKey(ownerId, fromLane) {
    return `${ownerId}-${fromLane}`;
  }

  function requestRedirect(state, unit, candidates) {
    const key = redirectKey(unit.ownerId, unit.lane);
    const priorChoice = state.redirectDecisions[key];
    if (candidates.includes(priorChoice)) {
      unit.redirectTarget = priorChoice;
      unit.redirectOrigin = unit.lane;
      unit.waitingForRedirect = false;
      return priorChoice;
    }

    if (!state.pendingRedirects.some((request) => request.key === key)) {
      state.pendingRedirects.push({ key, playerId: unit.ownerId, fromLane: unit.lane, candidates });
    }
    unit.waitingForRedirect = true;
    return null;
  }

  function resolveTargetLane(state, unit) {
    const directVillage = state.players[enemyId(unit.ownerId)].villages[unit.lane];
    if (directVillage && !directVillage.destroyed) return unit.lane;

    const living = livingEnemyLanes(state, unit.ownerId);
    if (!living.length) return null;
    const nearestDistance = Math.min(...living.map((lane) => Math.abs(lane - unit.lane)));
    const nearest = living.filter((lane) => Math.abs(lane - unit.lane) === nearestDistance);

    if (nearest.length > 1) {
      return requestRedirect(state, unit, nearest);
    }

    unit.waitingForRedirect = false;
    unit.redirectTarget = nearest[0];
    unit.redirectOrigin = unit.lane;
    return nearest[0];
  }

  function moveLaterally(state, unit, targetLane, delta) {
    const donkeySpeed = unit.donkey ? 1 + E.Config.specialAnimals.ane.movementBonus : 1;
    const reached=E.CharacterAI.moveLane(state,unit,targetLane,E.Config.combat.redirectSpeed*donkeySpeed*E.Transport.movementMultiplier(unit),delta);
    if(reached){unit.lanePosition=targetLane;unit.lane=targetLane;unit.redirectTarget=null;unit.redirectOrigin=null;}
    return reached;
  }

  function attackRange(unit) {
    if(unit.mythologyLegendId==='u-mazzeru')return E.Config.combat.professionAttackRanges.chasseur;
    const professionRange = !unit.animalType && !unit.isLegend && !unit.mythologyLegendId &&
      E.Config.combat.professionAttackRanges[unit.profession || unit.role];
    return professionRange || E.Config.combat.attackRange;
  }

  function unitDistance(state,a,b) {
    return E.CharacterAI.distance(state,a,b)/E.Config.boardProjection.positionScale;
  }
  function moveTowardEnemy(state,unit,enemy,delta) {
    const key = 'unit:' + enemy.id;
    const reach = Math.max(attackRange(unit) * E.Config.boardProjection.positionScale * E.Config.characterAI.attackContactRatio,
      E.CharacterAI.radius(unit)+E.CharacterAI.radius(enemy)+E.Config.characterAI.gap);
    if (unit.aiTarget !== key || !unit.aiGoal || E.CharacterAI.distance(state,unit.aiGoal,enemy) > reach * E.Config.characterAI.goalTrackingRatio ||
      !E.CharacterAI.free(state,unit.aiGoal,unit)) {
      unit.aiTarget = key;
      unit.aiGoal = E.CharacterAI.sample(state,unit,{...enemy,lanePosition:unit.lanePosition,
        terrainOffset:((enemy.lanePosition-unit.lanePosition)*E.Config.board.laneSpacing)+(enemy.terrainOffset||0)},reach,reach);
    }
    if(unit.aiGoal)moveToFieldPoint(state,unit,{offset:unit.aiGoal.terrainOffset,position:unit.aiGoal.position},delta);
  }

  function nearestEnemyUnit(state, unit) {
    const fieldOnly = unit.mythologyLegendId === 'u-mazzeru';
    return state.units
      .filter(other => other.ownerId !== unit.ownerId && other.hp > 0)
      .filter(other => !fieldOnly || E.Board.isOnBattlefield(other))
      .filter(other => unitDistance(state,unit,other) <= Math.max(E.Config.combat.detectionRange, attackRange(unit)))
      .sort((a,b) => unitDistance(state,unit,a) - unitDistance(state,unit,b))[0] || null;
  }

  function attackInterval(unit) {
    if(unit.mythologyLegendId==='u-mazzeru')return E.Config.badOmen.shotInterval;
    return (unit.animalType || unit.role) === "chien" ? E.Config.specialAnimals.chien.attackInterval : E.Config.combat.attackInterval;
  }

  function isBoar(unit) {
    return (unit.animalType || unit.role) === "sanglier";
  }

  function triggerAttackVisual(unit, target = null) {
    if ((unit.visualAttackTimer || 0) > 0) return;
    unit.visualAttackSequence = (unit.visualAttackSequence || 0) + 1;
    unit.visualAttackTimer = E.Config.visualEffects.unitAttackDuration;
    if (target) {
      unit.visualAttackTarget = { position: target.position, lanePosition: target.lanePosition, ...(target.terrainOffset!==undefined?{terrainOffset:target.terrainOffset}:{}) };
    }
  }

  function triggerHitVisual(unit) {
    if ((unit.visualHitTimer || 0) > 0) return;
    unit.visualHitSequence = (unit.visualHitSequence || 0) + 1;
    unit.visualHitTimer = E.Config.visualEffects.unitHitFlashDuration;
  }

  function queueDeathVisual(state, unit) {
    state.unitDeathEffects ||= [];
    state.nextVisualEffectId ||= 1;
    state.unitDeathEffects.push({
      id: state.nextVisualEffectId++,
      unitId: unit.id,
      ownerId: unit.ownerId,
      role: unit.role,
      profession: unit.profession,
      tool: unit.tool,
      armor: unit.armor,
      donkey: unit.donkey,
      animalType: unit.animalType,
      animalId: unit.animalId,
      waterTransport: unit.waterTransport,
      waterOwner: unit.waterOwner,
      ...(unit.mythologyLegendId ? { isLegend: unit.isLegend, mythologyLegendId: unit.mythologyLegendId } : {}),
      ...(unit.mythologyForm ? { mythologyForm: unit.mythologyForm } : {}),
      ...(unit.mythologyScale ? { mythologyScale: unit.mythologyScale } : {}),
      terrainOffset: unit.terrainOffset || 0,
      lanePosition: unit.lanePosition,
      position: unit.position
    });
    state.unitDeathEffects = state.unitDeathEffects.slice(-32);
  }

  function tryAttackUnit(state, unit, enemyUnit, damageEvents, delta) {
    if (!enemyUnit) return false;
    const contact=(E.CharacterAI.radius(unit)+E.CharacterAI.radius(enemyUnit)+E.Config.characterAI.gap+E.Config.characterAI.arrivalEpsilon)/E.Config.boardProjection.positionScale;
    if(unitDistance(state,unit,enemyUnit)>Math.max(attackRange(unit),contact)+1e-7)return false;
    if (unit.attackCooldown <= 0) {
      if(unit.mythologyLegendId==='u-mazzeru' && E.BadOmen){
        const target=E.BadOmen.characters(state).find(t=>t.kind==='unit'&&t.entity===enemyUnit);if(target)E.BadOmen.shoot(state,unit,target);
      }else{triggerAttackVisual(unit, enemyUnit);damageEvents.push({ type: "unit", target: enemyUnit, amount: unit.damage });}
      unit.attackCooldown = attackInterval(unit);
    }
    return true;
  }

  function moveToward(state, unit, target, delta) {
    const step=unit.speed*E.Transport.movementMultiplier(unit)*delta;
    const logical=unit.position+Math.sign(target-unit.position)*Math.min(Math.abs(target-unit.position),step);
    const physicalSpeed=Math.abs(E.Board.combatZ(logical)-E.Board.combatZ(unit.position))/E.Config.boardProjection.positionScale/delta;
    E.CharacterAI.moveUnit(state,unit,{position:target,lanePosition:unit.lanePosition,terrainOffset:unit.terrainOffset||0},physicalSpeed,delta);
    E.Transport.updateUnitWaterState(state, unit);
  }

  function attackCrop(state, unit, village, damageEvents, delta) {
    const ravager = !unit.isLegend && !unit.mythologyLegendId && !unit.animalType && (unit.profession || unit.role) === 'ravageur';
    const lupu = unit.mythologyLegendId === 'u-lupu-mannaru';
    if (ravager || lupu) return attackEconomicSlot(state,unit,village,damageEvents,delta);
    if (!isBoar(unit) || !village || village.destroyed) return false;
    const slot = village.slots.find((entry) => entry.content?.category === "crop" && entry.content.hp > 0);
    if (!slot) return false;
    const position = E.Config.temporaryProduction.agricultureFieldPositionByOwner[village.ownerId];
    if (Math.abs(unit.position - position) <= E.Config.combat.attackRange) {
      if (unit.attackCooldown <= 0) {
        triggerAttackVisual(unit);
        damageEvents.push({ type: "crop", target: slot.content, amount: unit.damage + (ravager ? E.Config.units.ravageur.villageDamageBonus || 0 : 0) });
        unit.attackCooldown = attackInterval(unit);
      }
    } else moveToward(state, unit, position, delta);
    return true;
  }

  function fieldDistance(state,unit,target) {
    return Math.hypot((target.offset-(unit.terrainOffset||0))*E.Board.widthScale(state),E.Board.combatZ(target.position)-E.Board.combatZ(unit.position));
  }
  function moveToFieldPoint(state,unit,target,delta,stopRadius=0) {
    const distance=fieldDistance(state,unit,target), fraction=distance>0?Math.max(0,distance-stopRadius)/distance:0;
    const destination={lanePosition:unit.lanePosition,terrainOffset:(unit.terrainOffset||0)+(target.offset-(unit.terrainOffset||0))*fraction,
      position:E.Board.combatPosition(E.Board.combatZ(unit.position)+(E.Board.combatZ(target.position)-E.Board.combatZ(unit.position))*fraction)};
    E.CharacterAI.moveUnit(state,unit,destination,unit.speed*E.Transport.movementMultiplier(unit),delta);
    E.Transport.updateUnitWaterState(state,unit);
  }

  function attackEconomicSlot(state,unit,village,events,delta) {
    const targets=(!village || village.destroyed)?[]:village.slots.flatMap((slot,slotIndex)=>
      ['crop','livestock'].includes(slot.content?.category)&&slot.content.hp>0?
      [{...E.Board.slotHitbox(state,village,slotIndex),slotIndex,slot}]:[]);
    const previous=unit.economicTarget;
    const visible=targets.filter(t=>fieldDistance(state,unit,t)<=t.radius+Math.max(E.Config.combat.detectionRange,attackRange(unit))*E.Config.boardProjection.positionScale);
    const target=targets.find(t=>previous?.playerId===village.ownerId&&previous.lane===village.lane&&previous.slotIndex===t.slotIndex)||
      visible.sort((a,b)=>fieldDistance(state,unit,a)-fieldDistance(state,unit,b)||a.slotIndex-b.slotIndex)[0];
    if(!target) {
      if(previous)unit.returningFromField=true;
      delete unit.economicTarget;
      if(unit.returningFromField && Math.abs(unit.terrainOffset||0)>.0001){moveToFieldPoint(state,unit,{offset:0,position:unit.position},delta);return true;}
      delete unit.returningFromField;
      return false;
    }
    unit.economicTarget={playerId:village.ownerId,lane:village.lane,slotIndex:target.slotIndex};
    const reach=target.radius+E.Config.economicHitboxes.contactReach;
    const key=`slot:${village.ownerId}:${village.lane}:${target.slotIndex}`;
    if(unit.aiTarget!==key || !unit.aiGoal || !E.CharacterAI.free(state,unit.aiGoal,unit)) {
      unit.aiTarget=key;
      unit.aiGoal=E.CharacterAI.sample(state,unit,{lanePosition:village.lane,terrainOffset:target.offset,position:target.position},reach*E.Config.characterAI.economicContactRatio,reach*E.Config.characterAI.economicContactRatio);
    }
    if(fieldDistance(state,unit,target)>reach+1e-9) {
      if(unit.aiGoal)moveToFieldPoint(state,unit,{offset:unit.aiGoal.terrainOffset,position:unit.aiGoal.position},delta);
    }
    else if(unit.attackCooldown<=0) {
      triggerAttackVisual(unit,{position:target.position,lanePosition:village.lane,terrainOffset:target.offset});
      events.push({type:target.slot.content.category,target:target.slot.content,amount:unit.damage+(E.Config.units.ravageur.villageDamageBonus||0)});
      unit.attackCooldown=attackInterval(unit);
    }
    return true;
  }

  function recruitNearbyResidents(state) {
    Object.values(state.players).forEach(player=>player.villages.forEach(village=>{
      if(village.destroyed||E.MythologyEffects?.isBurned(state,village))return;
      village.residents.forEach(resident=>{
        if(resident.unitId||resident.isLegend||['attaque','defense'].includes(resident.mission))return;
        const point=E.CharacterAI.residentPoint(state,village,resident);
        const scout={...point,ownerId:player.id,profession:resident.profession};
        const threatened=state.units.some(other=>other.ownerId!==player.id&&other.hp>0&&!other.structuresOnly&&
          unitDistance(state,scout,other)<=Math.max(E.Config.combat.detectionRange,attackRange(scout),attackRange(other)));
        if(threatened)E.Economy.startProximityDefense(state,village,resident,point.position);

      });
    }));
  }

  function defendLocally(state,unit,damageEvents,completed,delta) {
    const anchor=unit.autoDefense,range=Math.max(E.Config.combat.detectionRange,attackRange(unit));
    const enemy=state.units.filter(other=>other.ownerId!==unit.ownerId&&other.hp>0&&
      unitDistance(state,anchor,other)<=range)
      .sort((a,b)=>Math.abs(a.position-unit.position)-Math.abs(b.position-unit.position))[0];
    if(enemy){
      if(!tryAttackUnit(state,unit,enemy,damageEvents,delta))moveTowardEnemy(state,unit,enemy,delta);
    }else{
      moveToFieldPoint(state,unit,{position:anchor.position,offset:anchor.terrainOffset||0},delta);
      if(unitDistance(state,unit,anchor)<E.Config.characterAI.arrivalEpsilon/E.Config.boardProjection.positionScale &&
        !state.units.some(other=>other.ownerId!==unit.ownerId&&other.hp>0&&!other.structuresOnly&&
          unitDistance(state,unit,other)<=Math.max(E.Config.combat.detectionRange,attackRange(other))))completed.push(unit);
    }
  }

  function vampireTurn(state,unit,events,delta) {
    if(!E.BadOmen)return false;
    let target=E.BadOmen.find(state,unit.vampireTargetKey);
    if(!target || target.ownerId===unit.ownerId) {
      target=E.BadOmen.characters(state).filter(t=>t.ownerId!==unit.ownerId&&E.BadOmen.distance(state,unit,t.point)<=Math.max(E.Config.combat.detectionRange,attackRange(unit)))
        .sort((a,b)=>E.BadOmen.distance(state,unit,a.point)-E.BadOmen.distance(state,unit,b.point))[0];
      unit.vampireTargetKey=target?.key||null;
    }
    if(!target)return false;
    const point=target.point;
    if(Math.abs(unit.lanePosition-point.lanePosition)>.001){moveLaterally(state,unit,point.lanePosition,delta);E.Transport.updateUnitWaterState(state,unit);return true;}
    if(E.BadOmen.distance(state,unit,point)>attackRange(unit)){moveToFieldPoint(state,unit,{offset:point.terrainOffset||0,position:point.position},delta);return true;}
    if(unit.attackCooldown<=0){triggerAttackVisual(unit,point);events.push({type:'omen',source:unit,key:target.key,amount:unit.damage});unit.attackCooldown=attackInterval(unit);}
    return true;
  }

  function update(state, delta) {
    if (state.phase !== "running" || state.paused || state.preparationRemaining > 0 || !Number.isFinite(delta) || delta <= 0) return;
    E.CharacterAI.resolve(state);
    E.BadOmen?.updateProjectiles(state,delta);
    recruitNearbyResidents(state);
    E.Buildings.updateArtisanatBonuses(state);
    const damageEvents = [];
    const completedDefenses = [];
    const completedRecalls = [];
    Object.values(state.players).forEach((player) => player.villages.forEach((village) => {
      village.damageSmoke = Math.max(0, (village.damageSmoke || 0) - delta);
    }));

    state.units.forEach((unit) => {
      if (unit.hp <= 0) return;
      unit.attackCooldown = Math.max(0, unit.attackCooldown - delta);
      if(unit.omenGrowthTimer>0)unit.omenGrowthTimer=Math.max(0,unit.omenGrowthTimer-delta);
      unit.retaliationCooldown = Math.max(0, (unit.retaliationCooldown || 0) - delta);
      unit.visualAttackTimer = Math.max(0, (unit.visualAttackTimer || 0) - delta);
      unit.visualHitTimer = Math.max(0, (unit.visualHitTimer || 0) - delta);
      if (!E.Transport.updateUnitWaterState(state, unit)) return;

      if (unit.returningToVillage) {
        const resident = E.Economy.getResident(state, unit.ownerId, unit.originLane, unit.residentId);
        const origin = state.players[unit.ownerId]?.villages[unit.originLane];
        if (!resident || !origin || origin.destroyed) { unit.returningToVillage = false; return; }
        const destination = resident.pendingMission === 'defense' && (!resident.pendingProfession || resident.pendingProfession === resident.profession) ? E.Config.combat.defensePositionByOwner[unit.ownerId] :
          unit.ownerId === 'red' ? 0 : E.Config.movement.columnLength;
        if (Math.abs(unit.position - destination) > 0.001) moveToward(state, unit, destination, delta);
        else if (Math.abs(unit.lanePosition - unit.originLane) > 0.001) moveLaterally(state, unit, unit.originLane, delta);
        if (Math.abs(unit.position - destination) <= 0.001 && Math.abs(unit.lanePosition - unit.originLane) <= 0.001) completedRecalls.push(unit);
        return;
      }

      if (unit.mythologyRetreating) {
        const destination = unit.ownerId === 'red' ? 0 : E.Config.movement.columnLength;
        moveToward(state, unit, destination, delta);
        if (Math.abs(unit.position - destination) <= E.Config.combat.attackRange) unit.mythologyRetreating = false;
        return;
      }
      if (unit.mythologyLegendId === 'u-fullettu') {
        moveToward(state, unit, unit.ownerId === 'red' ? E.Config.movement.columnLength : 0, delta);
        return; // Le follet récolte ; ses 0 dégâts ne déclenchent aucune attaque.
      }

      if(unit.mythologyLegendId==='u-mazzeru' && E.BadOmen?.mazzeruTurn(state,unit))return;
      if(unit.mythologyLegendId==='u-surpatore' && unit.mythologyForm==='vampire' && vampireTurn(state,unit,damageEvents,delta))return;
      if(unit.autoDefense){defendLocally(state,unit,damageEvents,completedDefenses,delta);return;}
      const enemyUnit = nearestEnemyUnit(state, unit);
      if (unit.stance === "defense") {
        tryAttackUnit(state,unit,enemyUnit,damageEvents,delta);
        return;
      }

      const targetLane = resolveTargetLane(state, unit);
      if (targetLane === null) return;

      if (Math.abs(unit.lanePosition - targetLane) > 0.001) {
        moveLaterally(state, unit, targetLane, delta);
        E.Transport.updateUnitWaterState(state, unit);
        return;
      }

      const targetVillage = state.players[enemyId(unit.ownerId)].villages[targetLane];
      if (attackCrop(state, unit, targetVillage, damageEvents, delta)) return;
      if (!unit.structuresOnly && enemyUnit) {
        if(!tryAttackUnit(state,unit,enemyUnit,damageEvents,delta))moveTowardEnemy(state,unit,enemyUnit,delta);
        return;
      }
      if ((unit.animalType || unit.role) === "chien" && unit.animalMission === "perturber") {
        const herd = E.Animals.targetHerd(state, unit, targetVillage);
        if (herd) {
          const position = E.Animals.fieldPosition(targetVillage);
          if (Math.abs(unit.position - position) > E.Config.combat.attackRange) moveToward(state, unit, position, delta);
        }
        // Sans élevage, le chien attend ; il ne détruit pas le village à sa place.
        return;
      }
      if(!unit.aiTarget?.startsWith('unit:village:')) {delete unit.aiGoal; delete unit.aiTarget;}
      const villagePosition = unit.ownerId === "red" ? E.Config.movement.columnLength : 0;
      const gate={position:villagePosition,lanePosition:targetLane,terrainOffset:0};
      const gateDistance=unitDistance(state,unit,gate);
      if (targetVillage && !targetVillage.destroyed && targetVillage.hp > 0 && gateDistance <= attackRange(unit)) {
        if (gateDistance <= E.Config.combat.attackRange && unit.retaliationCooldown <= 0) {
          damageEvents.push({ type: "unit", target: unit, amount: E.Config.combat.villageRetaliationDamagePerSecond });
          unit.retaliationCooldown = 1;
        }
        if (unit.attackCooldown <= 0) {
          if(unit.mythologyLegendId==='u-mazzeru'&&E.BadOmen)E.BadOmen.shoot(state,unit,E.BadOmen.villageTarget(state,targetVillage.ownerId,targetLane));
          else {triggerAttackVisual(unit, { position: villagePosition, lanePosition: targetLane });
          damageEvents.push({ type: "village", target: targetVillage, amount: unit.damage + (E.Config.units[unit.role].villageDamageBonus || 0) });}
          unit.attackCooldown = attackInterval(unit);
        }
        return;
      }

      // Les remparts occupent la largeur de la colonne : une formation décalée
      // voit leur façade et rejoint une place autour de la porte.
      const facadeRadius=E.Config.characterAI.columnHalfWidth*E.Board.widthScale(state)/E.Config.boardProjection.positionScale;
      if(gateDistance <= Math.max(E.Config.combat.detectionRange,attackRange(unit))+facadeRadius) {
        moveTowardEnemy(state,unit,{...gate,id:'village:'+targetLane},delta);
      } else moveToward(state, unit, villagePosition, delta);
    });

    damageEvents.forEach((event) => {
      if(event.type==='omen'){E.BadOmen.hit(state,event.source,event.key,event.amount);return;}
      event.target.hp = Math.max(0, event.target.hp - event.amount);
      if (event.type === "unit" && event.amount > 0) triggerHitVisual(event.target);
      if (event.type === "village" && event.amount > 0) event.target.damageSmoke = E.Config.visualEffects.structureSmokeDuration;
    });

    Object.values(state.players).forEach((player) => player.villages.forEach((village) => {
      village.slots.forEach((slot) => {
        if (["crop","livestock"].includes(slot.content?.category) && slot.content.hp <= 0) slot.content = null;
      });
    }));

    E.CharacterAI.resolve(state);
    settleDeaths(state);
    completedDefenses.filter(unit=>unit.hp>0&&state.units.includes(unit)).forEach(unit=>E.Economy.finishProximityDefense(state,unit));
    completedRecalls.filter(unit => unit.hp > 0 && state.units.includes(unit)).forEach(unit => E.Economy.completeRecall(state, unit));
  }

  function settleDeaths(state) {
    E.BadOmen?.enforce(state);
    state.units.filter((unit) => unit.hp <= 0).forEach((unit) => {
      const originVillage = state.players[unit.ownerId].villages[unit.originLane];
      if (!originVillage) return;
      if (E.MythologyEffects?.preventDeath(state, unit)) return;
      queueDeathVisual(state, unit);
      if (E.MythologyEffects?.onUnitDeath(state, unit)) return;
      if (unit.drowned) state.logs.unshift(`${unit.residentId ? "Un habitant" : "Une unité"} du village ${unit.originLane + 1} s’est noyé faute de place dans une embarcation.`);
      if (["chien", "sanglier"].includes(unit.animalType || unit.role)) E.Animals?.onUnitDeath(state, unit);
      else if (unit.residentId) {
        if (!E.Economy.removeResident(state, unit.ownerId, unit.originLane, unit.residentId)) E.MythologyEffects?.recordDeath(state, originVillage, { ...unit, id: unit.residentId });
      }
      else if (!unit.isLegend) originVillage.population = Math.max(0, originVillage.population - 1);
    });
    state.units = state.units.filter((unit) => unit.hp > 0);
    markDestroyedVillages(state);
    checkResult(state);
  }

  function markDestroyedVillages(state) {
    Object.values(state.players).forEach((player) => {
      player.villages.forEach((village) => {
        if (!village.destroyed && village.hp <= 0) {
          village.residents.filter(resident => !resident.unitId).forEach(resident => E.MythologyEffects?.recordDeath(state, village, resident));
          (village.animals||[]).filter(a=>!a.unitId).forEach(a=>E.BadOmen?.onDeath(state,a,player.id));
          E.Animals?.onVillageDestroyed(village);
          village.destroyed = true;
          village.population = 0;
          village.residents = [];
          village.jobs = { agriculture: 0, elevage: 0, peche: 0, chasse: 0 };
          state.logs.unshift(`${player.name} perd son village de la ligne ${village.lane + 1}.`);
        }
      });
    });
  }

  function checkResult(state) {
    const redAlive = state.players.red.villages.some((village) => !village.destroyed);
    const blueAlive = state.players.blue.villages.some((village) => !village.destroyed);
    if (redAlive && blueAlive) return;

    state.phase = "ended";
    if (!redAlive && !blueAlive) state.result = "draw";
    else state.result = redAlive ? "red" : "blue";
  }

  function applyOvertime(state) {
    Object.values(state.players).forEach((player) => {
      player.villages.forEach((village) => {
        if (!village.destroyed) {
          village.hp = Math.max(0, village.hp - village.maxHp * E.Config.overtime.damagePercent);
        }
      });
    });
    state.logs.unshift("L’Overtime affaiblit tous les villages encore debout.");
    markDestroyedVillages(state);
    checkResult(state);
  }

  function chooseRedirect(state, key, lane) {
    const request = state.pendingRedirects.find((item) => item.key === key);
    if (!request || !request.candidates.includes(lane)) return false;
    state.redirectDecisions[key] = lane;
    state.pendingRedirects = state.pendingRedirects.filter((item) => item.key !== key);
    state.units.forEach((unit) => {
      if (unit.ownerId === request.playerId && unit.lane === request.fromLane && !unit.returningToVillage) {
        unit.redirectTarget = lane;
        unit.redirectOrigin = request.fromLane;
        unit.waitingForRedirect = false;
      }
    });
    return true;
  }

  E.Combat = { update, applyOvertime, chooseRedirect, settleDeaths };
}());
