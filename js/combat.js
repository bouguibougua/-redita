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

  function moveLaterally(unit, targetLane, delta) {
    const distance = targetLane - unit.lanePosition;
    const donkeySpeed = unit.donkey ? 1 + E.Config.specialAnimals.ane.movementBonus : 1;
    const step = E.Config.combat.redirectSpeed * donkeySpeed * E.Transport.movementMultiplier(unit) * delta;
    if (Math.abs(distance) <= step) {
      unit.lanePosition = targetLane;
      unit.lane = targetLane;
      unit.redirectTarget = null;
      unit.redirectOrigin = null;
      return true;
    }
    unit.lanePosition += Math.sign(distance) * step;
    return false;
  }

  function nearestEnemyUnit(state, unit) {
    return state.units
      .filter((other) => other.ownerId !== unit.ownerId && other.hp > 0)
      .filter((other) => Math.abs(other.lanePosition - unit.lanePosition) < 0.12)
      .filter((other) => Math.abs(other.position - unit.position) <= E.Config.combat.detectionRange)
      .sort((a, b) => Math.abs(a.position - unit.position) - Math.abs(b.position - unit.position))[0] || null;
  }

  function attackInterval(unit) {
    return (unit.animalType || unit.role) === "chien" ? E.Config.specialAnimals.chien.attackInterval : E.Config.combat.attackInterval;
  }

  function isBoar(unit) {
    return (unit.animalType || unit.role) === "sanglier";
  }

  function triggerAttackVisual(unit) {
    if ((unit.visualAttackTimer || 0) > 0) return;
    unit.visualAttackSequence = (unit.visualAttackSequence || 0) + 1;
    unit.visualAttackTimer = E.Config.visualEffects.unitAttackDuration;
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
      lanePosition: unit.lanePosition,
      position: unit.position
    });
    state.unitDeathEffects = state.unitDeathEffects.slice(-32);
  }

  function tryAttackUnit(unit, enemyUnit, damageEvents, delta) {
    if (!enemyUnit || Math.abs(enemyUnit.position - unit.position) > E.Config.combat.attackRange) return false;
    if (unit.attackCooldown <= 0) {
      triggerAttackVisual(unit);
      damageEvents.push({ type: "unit", target: enemyUnit, amount: unit.damage });
      unit.attackCooldown = attackInterval(unit);
    }
    return true;
  }

  function moveToward(state, unit, target, delta) {
    const distance = target - unit.position;
    const step = unit.speed * E.Transport.movementMultiplier(unit) * delta;
    unit.position += Math.sign(distance) * Math.min(Math.abs(distance), step);
    E.Transport.updateUnitWaterState(state, unit);
  }

  function attackCrop(state, unit, village, damageEvents, delta) {
    if (!isBoar(unit) || !village || village.destroyed) return false;
    const slot = village.slots.find((entry) => entry.content?.category === "crop" && entry.content.hp > 0);
    if (!slot) return false;
    const position = E.Config.temporaryProduction.agricultureFieldPositionByOwner[village.ownerId];
    if (Math.abs(unit.position - position) <= E.Config.combat.attackRange) {
      if (unit.attackCooldown <= 0) {
        triggerAttackVisual(unit);
        damageEvents.push({ type: "crop", target: slot.content, amount: unit.damage });
        unit.attackCooldown = attackInterval(unit);
      }
    } else moveToward(state, unit, position, delta);
    return true;
  }

  function update(state, delta) {
    if (state.phase !== "running" || state.paused || !Number.isFinite(delta) || delta <= 0) return;
    const damageEvents = [];
    Object.values(state.players).forEach((player) => player.villages.forEach((village) => {
      village.damageSmoke = Math.max(0, (village.damageSmoke || 0) - delta);
    }));

    state.units.forEach((unit) => {
      if (unit.hp <= 0) return;
      unit.attackCooldown = Math.max(0, unit.attackCooldown - delta);
      unit.retaliationCooldown = Math.max(0, (unit.retaliationCooldown || 0) - delta);
      unit.visualAttackTimer = Math.max(0, (unit.visualAttackTimer || 0) - delta);
      unit.visualHitTimer = Math.max(0, (unit.visualHitTimer || 0) - delta);
      if (!E.Transport.updateUnitWaterState(state, unit)) return;

      const enemyUnit = nearestEnemyUnit(state, unit);
      if (unit.stance === "defense") {
        tryAttackUnit(unit, enemyUnit, damageEvents, delta);
        return;
      }

      const targetLane = resolveTargetLane(state, unit);
      if (targetLane === null) return;

      if (Math.abs(unit.lanePosition - targetLane) > 0.001) {
        moveLaterally(unit, targetLane, delta);
        E.Transport.updateUnitWaterState(state, unit);
        return;
      }

      const targetVillage = state.players[enemyId(unit.ownerId)].villages[targetLane];
      if (attackCrop(state, unit, targetVillage, damageEvents, delta)) return;
      if (tryAttackUnit(unit, enemyUnit, damageEvents, delta)) return;
      if ((unit.animalType || unit.role) === "chien" && unit.animalMission === "perturber") {
        const herd = E.Animals.targetHerd(state, unit, targetVillage);
        if (herd) {
          const position = E.Animals.fieldPosition(targetVillage);
          if (Math.abs(unit.position - position) > E.Config.combat.attackRange) moveToward(state, unit, position, delta);
        }
        // Sans élevage, le chien attend ; il ne détruit pas le village à sa place.
        return;
      }
      const villagePosition = unit.ownerId === "red" ? E.Config.movement.columnLength : 0;
      if (targetVillage && !targetVillage.destroyed && targetVillage.hp > 0 && Math.abs(villagePosition - unit.position) <= E.Config.combat.attackRange) {
        if (unit.retaliationCooldown <= 0) {
          damageEvents.push({ type: "unit", target: unit, amount: E.Config.combat.villageRetaliationDamagePerSecond });
          unit.retaliationCooldown = 1;
        }
        if (unit.attackCooldown <= 0) {
          triggerAttackVisual(unit);
          damageEvents.push({ type: "village", target: targetVillage, amount: unit.damage + (E.Config.units[unit.role].villageDamageBonus || 0) });
          unit.attackCooldown = attackInterval(unit);
        }
        return;
      }

      moveToward(state, unit, villagePosition, delta);
    });

    damageEvents.forEach((event) => {
      event.target.hp = Math.max(0, event.target.hp - event.amount);
      if (event.type === "unit" && event.amount > 0) triggerHitVisual(event.target);
      if (event.type === "village" && event.amount > 0) event.target.damageSmoke = E.Config.visualEffects.structureSmokeDuration;
    });

    Object.values(state.players).forEach((player) => player.villages.forEach((village) => {
      village.slots.forEach((slot) => {
        if (slot.content?.category === "crop" && slot.content.hp <= 0) slot.content = null;
      });
    }));

    state.units.filter((unit) => unit.hp <= 0).forEach((unit) => {
      const originVillage = state.players[unit.ownerId].villages[unit.originLane];
      if (!originVillage) return;
      queueDeathVisual(state, unit);
      if (unit.drowned) state.logs.unshift(`${unit.residentId ? "Un habitant" : "Une unité"} du village ${unit.originLane + 1} s’est noyé faute de place dans une embarcation.`);
      if (["chien", "sanglier"].includes(unit.animalType || unit.role)) E.Animals?.onUnitDeath(state, unit);
      else if (unit.residentId) E.Economy.removeResident(state, unit.ownerId, unit.originLane, unit.residentId);
      else originVillage.population = Math.max(0, originVillage.population - 1);
    });
    state.units = state.units.filter((unit) => unit.hp > 0);
    markDestroyedVillages(state);
    checkResult(state);
  }

  function markDestroyedVillages(state) {
    Object.values(state.players).forEach((player) => {
      player.villages.forEach((village) => {
        if (!village.destroyed && village.hp <= 0) {
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
      if (unit.ownerId === request.playerId && unit.lane === request.fromLane) {
        unit.redirectTarget = lane;
        unit.redirectOrigin = request.fromLane;
        unit.waitingForRedirect = false;
      }
    });
    return true;
  }

  E.Combat = { update, applyOvertime, chooseRedirect };
}());
