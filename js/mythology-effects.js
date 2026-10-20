(function () {
  'use strict';
  const E = window.Eredita;
  const foe = id => id === 'red' ? 'blue' : 'red';
  const home = id => id === 'red' ? 0 : E.Config.movement.columnLength;
  const clone = value => JSON.parse(JSON.stringify(value));
  const cfg = () => E.Config.reinforcementPowers;
  const humans = village => village.residents.filter(person => !person.isLegend);
  const isHuman = entity => !entity.isLegend && !entity.animalType && !['chien', 'sanglier'].includes(entity.role);
  const offensive = entity => isHuman(entity) && (entity.stance === 'attack' || entity.mission === 'attaque' || ['guerrier', 'ravageur'].includes(entity.profession));
  const territory = position => position < E.Config.movement.columnLength / 2 ? 'red' : 'blue';
  const isBurned = (state, village) => Boolean(village && village.burnUntil > state.elapsed);
  const terrainVisualKey = village => String(Boolean(village.terrain?.river));
  function init(state) {
    state.mythology = { deaths: [], nextId: 1, executions: {}, resurrections: [] };
  }
  function runtime(state) { if (!state.mythology) init(state); return state.mythology; }
  const bindings = Object.freeze(Object.fromEntries(E.Mythology.all.map(legend => [legend.id,
    Object.freeze({ effectKey: legend.id, entryPoint: 'MythologyEffects.activate' })])));
  const getBinding = id => bindings[E.Mythology.get(id)?.id] || null;
  function targets(state, playerId, id) {
    const legend = E.Mythology.get(id), mode = legend?.gameplay.targetMode;
    if (!state?.players?.[playerId]) return [];
    if (mode === 'none') return [{}];
    if (mode === 'column') return state.players[playerId].villages
      .filter(v => legend.id !== 'u-diavulu' || !v.destroyed).map(v => ({ lane: v.lane }));
    const owners = mode === 'allied-region' ? [playerId] : mode === 'enemy-region' ? [foe(playerId)] : ['red', 'blue'];
    return owners.flatMap(ownerId => state.players[ownerId].villages.filter(v => !v.destroyed).map(v => ({ playerId: ownerId, lane: v.lane })));
  }
  function eligibleDeaths(state, playerId) {
    return (state.mythology?.deaths || []).filter(death => death.ownerId === playerId && death.human && !death.revived &&
      state.elapsed - death.at <= cfg().resurrectionWindow);
  }
  function deathCount(state, playerId, lane) {
    return (state.mythology?.deaths || []).filter(death => death.ownerId === playerId && death.lane === lane).length;
  }
  function quote(state, playerId, id, target = {}) {
    const legend = E.Mythology.get(id);
    let reason = !legend || !getBinding(id) || legend.implementation.status !== 'implemented' ? 'Pouvoir non configuré.' :
      state?.phase !== 'running' || !state.players?.[playerId] ? 'Partie inactive.' : state.paused ? 'Partie en pause.' : null;
    if (!reason && (!target || typeof target !== 'object' || Array.isArray(target) || !targets(state, playerId, id).some(candidate =>
      Object.keys(candidate).length === Object.keys(target).length && Object.entries(candidate).every(([key, value]) => target[key] === value)))) reason = 'Cible invalide.';
    if (!reason && id === 'anima-in-pena' && deathCount(state, playerId, target.lane) === 0) reason = 'Aucun mort allié dans cette colonne.';
    if (!reason && id === 'squadra-arozza' && !eligibleDeaths(state, playerId).length) reason = 'Aucun habitant à ressusciter dans la dernière minute.';
    if (!reason && id === 'i-lacrimenti' && deathCount(state, playerId, target.lane) === 0) reason = 'Aucun mort allié dans cette colonne.';
    return { allowed: !reason, reason: reason || 'Disponible', target: target && typeof target === 'object' ? { ...target } : {} };
  }
  function recordDeath(state, village, resident) {
    if (!state.mythology) return;
    const live = state.units.find(unit => unit.residentId === resident.id || unit === resident);
    const identity = `${village.ownerId}:${resident.residentId || resident.id}:${resident.mythologyForm || ''}`;
    if (runtime(state).deaths.some(death => death.identity === identity)) return;
    const person = live ? { ...resident, ...live, id: resident.id } : resident;
    runtime(state).deaths.push({ identity, ownerId: village.ownerId, originLane: village.lane,
      lane: live?.lane ?? village.lane, at: state.elapsed, human: isHuman(person), revived: false,
      resident: clone({ ...resident, unitId: null, hp: undefined, mythologyDeathRecorded: undefined }) });
  }
  function decorateUnit(state, resident, unit) {
    const multiplier = resident.mythologyStatMultiplier || 1;
    Object.assign(unit, { mythologyStatMultiplier: multiplier, mythologyScale: resident.mythologyScale || 1,
      mythologyLegendId: resident.mythologyLegendId || null, isLegend: Boolean(resident.isLegend),
      mythologyMagu: Boolean(resident.mythologyMagu) });
    unit.maxHp = unit.hp = (resident.isLegend ? resident.maxHp : unit.maxHp * multiplier) + (resident.mythologyHpBonus || 0);
    unit.damage = (resident.isLegend ? resident.mythologyDamage : unit.damage * multiplier) + (resident.mythologyDamageBonus || 0);
    unit.speed *= multiplier;
  }
  function summon(state, playerId, lane, id, stats = {}, position = null) {
    const role = stats.role || 'habitant';
    const unit = E.Units.create(playerId, lane, role);
    if (!unit) throw new Error('Archétype d’invocation absent : ' + role);
    Object.assign(unit, stats, { isLegend: true, mythologyLegendId: id, maxHp: stats.hp ?? unit.maxHp,
      position: position ?? cfg().regionSpawnByOwner[playerId] });
    state.units.push(unit); return unit;
  }
  function transformLupu(state, village, person) {
    village.residents = village.residents.filter(item => item !== person); village.population = humans(village).length;
    return summon(state, village.ownerId, village.lane, 'u-lupu-mannaru',
      { role: 'ravageur', hp: cfg().lupuHp, damage: cfg().lupuDamage, structuresOnly: true, mythologyScale: 1.25 });
  }
  function onResidentBorn(state, village, resident) {
    if (village.nextLupuCharges > 0) { village.nextLupuCharges--; transformLupu(state, village, resident); return false; }
    if (village.nextMaguCharges > 0) {
      village.nextMaguCharges--;
      Object.assign(resident, { mythologyStatMultiplier: cfg().maguStatMultiplier, mythologyScale: cfg().maguScale, mythologyMagu: true });
    }
    return true;
  }
  function protectionActive(state, ownerId) { return state.players[ownerId]?.mythologyProtectionUntil > state.elapsed; }
  function preventDeath(state, unit) {
    if (!isHuman(unit) || !protectionActive(state, unit.ownerId)) return false;
    unit.hp = unit.maxHp; unit.position = home(unit.ownerId); unit.lane = unit.originLane; unit.lanePosition = unit.originLane;
    unit.drowned = false; unit.waterOwner = unit.waterTransport = unit.transportHomeId = null;
    unit.redirectTarget = unit.redirectOrigin = null; unit.waitingForRedirect = false;
    return true;
  }
  function protectWorker(state, village, resident) {
    if (!isHuman(resident) || !protectionActive(state, village.ownerId)) return false;
    resident.workPosition = home(village.ownerId); resident.workPhase = null; resident.workTimer = 0;
    resident.carrying = null; resident.huntTargetPosition = null; resident.huntTargetLaneOffset = null;
    return true;
  }
  function onUnitDeath(state, unit) {
    if (!unit.isLegend && unit.residentId) return false;
    const village = state.players[unit.ownerId]?.villages[unit.originLane];
    if (village) recordDeath(state, village, unit);
    if (unit.mythologyLegendId !== 'u-surpatore' || unit.mythologyForm !== 'boar') return false;
    Object.assign(unit, { role: 'habitant', profession: 'habitant', animalType: null, animalId: null, mythologyForm: 'vampire',
      hp: cfg().vampireHp, maxHp: cfg().vampireHp, damage: cfg().vampireDamage, speed: cfg().vampireSpeed,
      drowned: false, waterOwner: null, waterTransport: null, transportHomeId: null, attackCooldown: 0 });
    return true;
  }
  function restorePending(state) {
    const data = runtime(state);
    data.resurrections = data.resurrections.filter(pending => {
      const villages = state.players[pending.ownerId].villages;
      const origin = villages[pending.originLane];
      const destination = origin && !origin.destroyed ? origin : villages.filter(v => !v.destroyed)
        .sort((a, b) => Math.abs(a.lane - pending.originLane) - Math.abs(b.lane - pending.originLane) || a.lane - b.lane)[0];
      if (!destination || isBurned(state, destination) || destination.population >= destination.populationMax) return true;
      const person = E.Economy.addResident(destination);
      const { id, name } = person;
      Object.assign(person, pending.resident, { id, name, unitId: null, mission: 'disponible', workPosition: null,
        workPhase: null, carrying: null, workTimer: 0 });
      return false;
    });
  }
  function burnColumn(state, lane) {
    for (const ownerId of ['red', 'blue']) {
      const village = state.players[ownerId].villages[lane];
      village.burnUntil = state.elapsed + cfg().burnDuration;
      village.slots.forEach(slot => { slot.content = null; });
      for (const resident of village.residents.slice()) {
        if (resident.unitId || !['agriculture', 'elevage', 'peche', 'chasse'].includes(resident.mission)) continue;
        if (resident.mission !== 'peche' && (!Number.isFinite(resident.workPosition) ||
          Math.abs(resident.workPosition - home(ownerId)) <= E.Config.combat.attackRange)) continue;
        if (!protectWorker(state, village, resident)) E.Economy.removeResident(state, ownerId, lane, resident.id);
      }
    }
    for (const unit of state.units) if (unit.hp > 0 && unit.lane === lane &&
      !(isHuman(unit) && Math.abs(unit.position - home(unit.ownerId)) <= E.Config.combat.attackRange)) unit.hp = 0;
    E.Combat.settleDeaths(state);
  }
  const handlers = {
    'u-mazzeru': (s, id) => { s.players[id].revealOffensive = true; },
    'a-stregha': (s, id, t) => { s.players[t.playerId].villages[t.lane].curseUntil = s.elapsed + cfg().stregaDuration; },
    'u-stregu': (s, id, t) => { s.players[t.playerId].villages[t.lane].blessingUntil = s.elapsed + cfg().streguDuration; },
    'a-fata': (s, id, t) => { const v = s.players[t.playerId].villages[t.lane]; v.terrain ||= {}; v.terrain.river = true; v.fataFishingMultiplier = cfg().fataFishingSpeed; },
    'l-orcu': (s, id, t) => summon(s, id, t.lane, 'l-orcu', { hp: cfg().orcuHp, damage: cfg().orcuDamage,
      speed: cfg().orcuSpeed, mythologyScale: 1.8 }, cfg().regionSpawnByOwner[t.playerId]),
    'u-magu': (s, id) => { s.players[id].villages.filter(v => !v.destroyed).forEach(v => { v.nextMaguCharges = (v.nextMaguCharges || 0) + cfg().maguResidentsPerVillage; }); },
    'u-surpatore': (s, id, t) => summon(s, id, t.lane, 'u-surpatore', { role: 'sanglier', mythologyForm: 'boar' }),
    'u-lupu-mannaru': (s, id, t) => {
      const v = s.players[id].villages[t.lane], person = v.residents.find(p => !p.isLegend && p.mission === 'disponible' &&
        !p.unitId && (!p.profession || p.profession === 'habitant'));
      if (person) transformLupu(s, v, person); else v.nextLupuCharges = (v.nextLupuCharges || 0) + 1;
    },
    'u-diavulu': (s, id, t) => burnColumn(s, t.lane),
    'a-stregha-bianca': (s, id) => { s.players[id].mythologyProtectionUntil = s.elapsed + cfg().biancaDuration; },
    'squadra-arozza': (s, id) => {
      eligibleDeaths(s, id).forEach(death => { death.revived = true; runtime(s).resurrections.push({ ownerId: id,
        originLane: death.originLane, resident: clone(death.resident) }); }); restorePending(s);
    },
    'anima-in-pena': (s, id, t) => {
      const v = s.players[id].villages[t.lane], count = deathCount(s, id, t.lane);
      for (let i = 0; i < count; i++) {
        const person = { id: `${v.id}-anima-${runtime(s).nextId++}`, name: 'Anima in Pena', mission: 'disponible', profession: 'habitant',
          tool: null, armor: null, unitId: null, workPosition: null, workTimer: 0, isLegend: true, mythologyLegendId: 'anima-in-pena',
          hp: cfg().animaHp, maxHp: cfg().animaHp, mythologyDamage: cfg().animaDps * E.Config.combat.attackInterval };
        v.residents.push(person);
      }
    },
    'a-mumma': (s, id) => { s.units.filter(u => u.ownerId !== id && u.hp > 0 && territory(u.position) === id).forEach(u => { u.mythologyRetreating = true; }); },
    'i-lacrimenti': (s, id, t) => {
      const count = deathCount(s, id, t.lane), hp = count * cfg().lacramantiHpPerDeath, damage = count * cfg().lacramantiDamagePerDeath;
      const affected = new Set();
      s.units.filter(u => u.ownerId === id && u.hp > 0 && u.lane === t.lane && isHuman(u)).forEach(u => {
        u.hp += hp; u.maxHp += hp; u.damage += damage;
        if (u.residentId) affected.add(u.residentId);
      });
      s.players[id].villages.forEach(v => v.residents.filter(p => !p.isLegend && (affected.has(p.id) || !p.unitId && v.lane === t.lane)).forEach(p => {
        p.mythologyHpBonus = (p.mythologyHpBonus || 0) + hp; p.mythologyDamageBonus = (p.mythologyDamageBonus || 0) + damage;
      }));
    },
    'u-fullettu': (s, id) => {
      const villages = s.players[id].villages.filter(v => !v.destroyed);
      for (let i = 0; i < cfg().fullettuCount; i++) {
        const v = villages[Math.floor(Math.random() * villages.length)];
        const half = E.Config.movement.columnLength / 2;
        const coast = E.Config.maritime.waterRanges[id];
        // Tirage sur la portion terrestre : une invocation ne doit pas naître dans l’eau.
        const min = id === 'red' ? 0 : v.biome === 'littoral' ? coast.max : half;
        const max = id === 'red' && v.biome === 'littoral' ? coast.min : id === 'red' ? half : E.Config.movement.columnLength;
        const position = id === 'red' ? min + Math.random() * (max - min) : max - Math.random() * (max - min);
        summon(s, id, v.lane, 'u-fullettu', { hp: cfg().fullettuHp, damage: cfg().fullettuDamage,
          speed: cfg().fullettuSpeed, mythologyScale: .65, mythologyGatherTimer: 0 }, position);
      }
    },
    'oeil-sainte-lucie': (s, id) => { s.players[id].revealCoasts = true; }
  };
  function activate(state, request) {
    const prior = Object.hasOwn(state.mythology?.executions || {}, request?.activationId) ? state.mythology.executions[request.activationId] : null;
    if (prior) return { ...prior };
    if (!request || typeof request.activationId !== 'string' || !request.activationId || request.epoch !== state.reinforcementEpoch) return { accepted: false, reason: 'stale-match' };
    const legend = E.Mythology.get(request.legendId), check = quote(state, request.playerId, legend?.id, request.target);
    if (!check.allowed) return { accepted: false, reason: check.reason };
    handlers[legend.id](state, request.playerId, check.target);
    const result = { accepted: true, activationId: request.activationId, legendId: legend.id };
    runtime(state).executions[request.activationId] = result;
    state.logs.unshift(`${state.players[request.playerId].name} invoque ${legend.name}.`);
    return { ...result };
  }
  function vision(state, viewerId, village) {
    if (!state.mythology) return { fraction: 1, people: true, all: true };
    const viewer = state.players[viewerId], full = viewerId === village.ownerId || Boolean(viewer?.revealCoasts && village.biome === 'littoral');
    return { fraction: full ? 1 : 0, people: full, all: full, offensive: Boolean(!full && viewer?.revealOffensive) };
  }
  function residentVisible(state, viewerId, village, person) {
    const known = vision(state, viewerId, village); return known.people || known.offensive && offensive(person);
  }
  function unitVisible(state, viewerId, unit) {
    if (!state.mythology) return true;
    if (unit.ownerId === viewerId || territory(unit.position) === viewerId) return true;
    return Boolean(vision(state, viewerId, state.players[unit.ownerId].villages[unit.lane]).all ||
      state.players[viewerId]?.revealOffensive && offensive(unit));
  }
  function productionMultiplier(state, village) {
    return (village.curseUntil > state.elapsed ? cfg().stregaMultiplier : 1) * (village.blessingUntil > state.elapsed ? cfg().streguMultiplier : 1);
  }
  function update(state, delta) {
    if (!state.mythology || state.phase !== 'running' || state.paused || state.preparationRemaining > 0) return;
    restorePending(state);
    for (const unit of state.units) {
      if (unit.hp <= 0 || unit.mythologyLegendId !== 'u-fullettu' || Math.abs(unit.position - home(foe(unit.ownerId))) > E.Config.combat.attackRange) continue;
      unit.mythologyGatherTimer += delta;
      const source = state.players[foe(unit.ownerId)].villages[unit.lane], destination = state.players[unit.ownerId].villages[unit.originLane];
      while (unit.mythologyGatherTimer >= cfg().fullettuGatherInterval) {
        unit.mythologyGatherTimer -= cfg().fullettuGatherInterval;
        const resource = E.Config.resources.find(key => source?.resources[key] > 0);
        if (!resource || !destination || destination.destroyed) break;
        const amount = Math.min(cfg().fullettuGatherAmount, source.resources[resource]);
        source.resources[resource] -= amount; destination.resources[resource] += amount;
      }
    }
  }
  E.MythologyEffects = Object.freeze({ bindings, getBinding, init, targets, quote, activate, update, recordDeath,
    onResidentBorn, decorateUnit, preventDeath, protectWorker, onUnitDeath, protectionActive, deathCount, vision, residentVisible, unitVisible,
    productionMultiplier, isBurned, terrainVisualKey });
}());
