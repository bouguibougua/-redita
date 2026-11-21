(function () {
  "use strict";

  const E = window.Eredita;

  function emptyResources() {
    return Object.fromEntries(E.Config.resources.map((resource) => [resource, 0]));
  }

  function createResident(villageId, number) {
    return {
      id: `${villageId}-habitant-${number}`,
      name: `Habitant ${number}`,
      mission: "disponible",
      profession: "habitant",
      tool: null,
      armor: null,
      donkey: false,
      unitId: null,
      workPosition: null,
      workPhase: null,
      workTimer: 0,
      targetSlotIndex: null,
      carrying: null,
      workLaneOffset: 0,
      huntTargetPosition: null,
      huntTargetLaneOffset: null
    };
  }

  function createPlayer(id, name, draw = E.Biomes.createInitialDraw()) {
    const player = {
      id,
      name,
      gold: E.Config.startingGold,
      setupSelection: [],
      setupConfirmed: false,
      villages: []
    };

    player.villages = draw.map((biome, lane) => {
      const villageId = `${id}-${lane}`;
      return {
        id: villageId,
        ownerId: id,
        lane,
        biome,
        slots: E.Biomes.createSlots(biome),
        level: 1,
        hp: E.Config.village.T1.hp,
        maxHp: E.Config.village.T1.hp,
        population: E.Config.startingPopulation,
        populationMax: E.Config.village.T1.populationMax,
        populationTimer: 0,
        nextResidentMission: "disponible",
        nextResidentProfession: "habitant",
        nextResidentNumber: E.Config.startingPopulation + 1,
        nextAnimalNumber: 1,
        animals: [],
        waitingDonkeys: 0,
        residents: Array.from(
          { length: E.Config.startingPopulation },
          (_, index) => createResident(villageId, index + 1)
        ),
        jobs: { agriculture: 0, elevage: 0, peche: 0, chasse: 0 },
        jobTimers: { agriculture: 0, peche: 0 },
        maritime: { barque: 0, voilier: 0, filet: 0, filetTimer: 0 },
        equipment: { tool: null, armor: null },
        resources: emptyResources(),
        buildings: [],
        damageSmoke: 0,
        destroyed: false
      };
    });
    return player;
  }

  function getFormat(stateOrId) {
    const id = typeof stateOrId === "string" ? stateOrId : stateOrId?.format;
    return E.Config.formats[id] || E.Config.formats[E.Config.defaultFormat];
  }

  function createState(format = E.Config.defaultFormat) {
    if (!E.Config.formats[format]) format = E.Config.defaultFormat;
    const draw = format === "simplified" ? E.Biomes.createSimplifiedDraw() : null;
    return {
      format,
      phase: "setup",
      paused: false,
      elapsed: 0,
      preparationRemaining: 0,
      overtimeAccumulator: 0,
      xrBoardWidth: null,
      players: {
        red: createPlayer("red", "Joueur Rouge", draw?.red),
        blue: createPlayer("blue", "Joueur Bleu", draw?.blue)
      },
      units: [],
      unitDeathEffects: [],
      nextVisualEffectId: 1,
      selectedVillage: { playerId: "red", lane: 0 },
      selectedResidentId: "red-0-habitant-1",
      pendingPlacement: null,
      pendingRedirects: [],
      redirectDecisions: {},
      logs: ["Les territoires ont été tirés."],
      result: null
    };
  }

  function combatZ(position) {
    const cfg=E.Config.villagePresentation,p=E.Config.boardProjection,edge=cfg.regionCenter-cfg.front;
    const t=cfg.combatTransition,inner=p.originZ+t*p.positionScale;
    if(position<t)return -edge+(inner+edge)*position/t;
    if(position>100-t)return -inner+(edge+inner)*(position-(100-t))/t;
    return p.originZ+position*p.positionScale;
  }
  function combatPosition(z) {
    const cfg=E.Config.villagePresentation,p=E.Config.boardProjection,edge=cfg.regionCenter-cfg.front;
    const t=cfg.combatTransition,inner=p.originZ+t*p.positionScale;
    if(z<inner)return (z+edge)*t/(inner+edge);
    if(z>-inner)return 100-t+(z+inner)*t/(edge+inner);
    return (z-p.originZ)/p.positionScale;
  }
  // Les extrémités de la colonne correspondent aux portes des villages.
  function isOnBattlefield(point) {
    return point.position > 0 && point.position < E.Config.movement.columnLength;
  }
  function widthScale(state) { return getFormat(state).regions===E.Config.formats.simplified.regions ? E.Config.board.simplifiedWidthScale : 1; }
  function slotHitbox(state,village,index) {
    const cfg=E.Config.villagePresentation,slots=village.slots.length===2?cfg.slotsTwo:cfg.slotsFour;
    if(!slots[index])return null;
    const [offset,z]=slots[index],sign=village.ownerId==='red'?1:-1;
    return {offset,position:combatPosition(sign*(-cfg.regionCenter+z)),
      radius:village.slots[index].content?.category==='livestock'?E.Config.economicHitboxes.livestockRadius:E.Config.economicHitboxes.cropRadius};
  }
  function idlePosition(index,count) {
    const cfg=E.Config.villagePresentation,outer=count>12?Math.ceil(count*.57):count,inner=index>=outer;
    const total=inner?count-outer:outer,number=inner?index-outer:index,radius=count<=12?.76:inner?.64:1;
    const angle=2*Math.PI*number/Math.max(1,total)+(inner?.19:0);
    return {x:cfg.fire[0]+Math.cos(angle)*cfg.idleRadiusX*radius,z:cfg.fire[1]+Math.sin(angle)*cfg.idleRadiusZ*radius};
  }
  function waitingDonkeyPoints(village) {
    const { regionCenter, waitingDonkeySpots } = E.Config.villagePresentation;
    const sign = village.ownerId === "red" ? 1 : -1;
    return waitingDonkeySpots.slice(0, village.waitingDonkeys ?? 0).map(([x, z]) => ({
      lanePosition: village.lane,
      terrainOffset: x * sign,
      position: combatPosition((-regionCenter + z) * sign)
    }));
  }
  E.Board = { createState, getFormat, combatZ, combatPosition, isOnBattlefield, widthScale, slotHitbox, idlePosition, waitingDonkeyPoints };

}());

// Géométrie partagée par la simulation, le ciblage et les rendus ; aucune dépendance à Three.js.
(function () {
  'use strict';
  const E = window.Eredita, cfg = () => E.Config.characterAI;
  const width = state => E.Board.widthScale(state);
  function world(state, point) {
    return { x: ((point.lanePosition || 0) * E.Config.board.laneSpacing + (point.terrainOffset || 0)) * width(state), z: E.Board.combatZ(point.position) };
  }
  function point(state, x, z, lane) {
    return { lanePosition: lane, terrainOffset: x / width(state) - lane * E.Config.board.laneSpacing, position: E.Board.combatPosition(z) };
  }
  function distance(state, a, b) {
    const p = world(state, a), q = world(state, b);
    return Math.hypot(q.x - p.x, q.z - p.z);
  }
  function residentPoint(state, village, resident) {
    const c = E.Config.villagePresentation, sign = village.ownerId === 'red' ? 1 : -1;
    if (['agriculture', 'elevage', 'chasse'].includes(resident.mission) && Number.isFinite(resident.workPosition)) {
      if (resident.mission === 'chasse') return { lanePosition: village.lane, terrainOffset: (resident.workLaneOffset || 0) * 2.7,
        position: E.Board.combatPosition(E.Config.boardProjection.originZ + resident.workPosition * E.Config.boardProjection.positionScale) };
      return { lanePosition: village.lane, terrainOffset: resident.workTerrainOffset ?? 0, position: resident.workPosition };
    }
    if (resident.bodyPoint) return resident.bodyPoint;
    let offset, z;
    const locals = village.residents.filter(r => !r.unitId && !(r.hp <= 0));
    if (resident.mission === 'peche') {
      const index = locals.filter(r => r.mission === 'peche').indexOf(resident), row = Math.floor(index / 7), column = index % 7;
      offset = -1.08 + column * .36; z = sign * (-c.regionCenter + (village.biome === 'littoral' ? .36 - row * .34 : .18 + row * .17));
    } else {
      const idle = locals.filter(r => !['agriculture', 'elevage', 'chasse', 'peche'].includes(r.mission));
      const p = E.Board.idlePosition(Math.max(0, idle.indexOf(resident)), idle.length);
      offset = p.x * sign; z = sign * (-c.regionCenter + p.z);
    }
    return { lanePosition: village.lane, terrainOffset: offset, position: E.Board.combatPosition(z) };
  }
  function animalPoint(state, village, animal) {
    if (animal.bodyPoint) return animal.bodyPoint;
    const index = village.animals.filter(a => !a.unitId && a.hp > 0).indexOf(animal), sign = village.ownerId === 'red' ? 1 : -1;
    return { lanePosition: village.lane, terrainOffset: -1 + index % 6 * .38,
      position: E.Board.combatPosition(sign * (-E.Config.villagePresentation.regionCenter - .67 + Math.floor(index / 6) * .31)) };
  }
  function radius(entity) { return ((entity.animalType || entity.type && E.Config.specialAnimals[entity.type]) ? cfg().animalRadius : cfg().bodyRadius) * (entity.mythologyScale || 1); }
  function bodies(state) {
    const result = state.units.filter(u => u.hp > 0).map(entity => ({ entity, kind: 'unit', point: entity, radius: radius(entity), lane: entity.lanePosition }));
    for (const player of Object.values(state.players)) for (const village of player.villages) {
      if (village.destroyed) continue;
      for (const r of village.residents) if (!r.unitId && !(r.hp <= 0)) result.push({ entity: r, village, kind: 'resident', point: residentPoint(state, village, r), radius: radius(r), lane: village.lane });
      for (const a of village.animals || []) if (!a.unitId && a.hp > 0) result.push({ entity: a, village, kind: 'animal', point: animalPoint(state, village, a), radius: radius(a), lane: village.lane });
    }
    return result;
  }
  function write(body, p) {
    const e = body.entity;
    if (body.kind === 'unit') { e.position = p.position; e.terrainOffset = p.terrainOffset; }
    else if (body.kind === 'resident' && ['agriculture', 'elevage', 'chasse'].includes(e.mission) && Number.isFinite(e.workPosition)) {
      if (e.mission === 'chasse') { e.workPosition = (E.Board.combatZ(p.position) - E.Config.boardProjection.originZ) / E.Config.boardProjection.positionScale; e.workLaneOffset = p.terrainOffset / 2.7; }
      else { e.workPosition = p.position; e.workTerrainOffset = p.terrainOffset; }
    } else e.bodyPoint = { ...p };
    body.point = p;
  }
  function bounded(state, body, p) {
    if(!body.crossColumn) p.terrainOffset = Math.max(-cfg().columnHalfWidth, Math.min(cfg().columnHalfWidth, p.terrainOffset));
    if (body.kind === 'unit' && !body.entity.autoDefense) p.position = Math.max(0, Math.min(100, p.position));
    return p;
  }
  function free(state, candidate, entity, all = bodies(state), reserve = false) {
    const r = radius(entity);
    return all.every(b => b.entity === entity || distance(state, candidate, b.point) >= r + b.radius + cfg().gap - 1e-8) &&
      (!reserve || all.every(b => b.entity === entity || !b.entity.aiGoal || distance(state, candidate, b.entity.aiGoal) >= r + b.radius + cfg().gap));
  }
  function sample(state, entity, center, minRadius, maxRadius, all = bodies(state)) {
    const c = world(state, center), start = Math.random() * Math.PI * 2;
    for (let i = 0; i < cfg().placementAttempts; i++) {
      const angle = start + i * cfg().sampleAngle, r = minRadius + Math.sqrt(Math.random()) * (maxRadius - minRadius);
      const p = point(state, c.x + Math.cos(angle) * r, c.z + Math.sin(angle) * r, center.lanePosition);
      if (Math.abs(p.terrainOffset) <= cfg().columnHalfWidth && free(state, p, entity, all, true)) return p;
    }
    return null; // Zone occupée : attendre une place, sans superposer les personnages.
  }
  function move(state, body, target, speed, delta) {
    const all = bodies(state).filter(b => b.entity !== body.entity), r = radius(body.entity), scale = E.Config.boardProjection.positionScale;
    let budget = speed * scale * delta;
    while (budget > 1e-8) {
      const from = world(state, body.point), to = world(state, target), dist = Math.hypot(to.x - from.x, to.z - from.z);
      if (dist < cfg().arrivalEpsilon) { write(body, { ...target }); return true; }
      const step = Math.min(budget, cfg().moveStep, dist), angle = Math.atan2(to.z - from.z, to.x - from.x);
      const preferred = String(body.entity.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 2 ? 1 : -1;
      let next = null;
      for (const turn of cfg().steeringAngles) {
        const a = angle + turn * preferred, x = from.x + Math.cos(a) * step, z = from.z + Math.sin(a) * step;
        const p = bounded(state, body, point(state, x, z, body.lane)), w = world(state, p);
        // Test du segment entier : aucun passage à travers un corps, même avec un grand delta.
        if (all.every(other => {
          const q = world(state, other.point), dx = w.x - from.x, dz = w.z - from.z, length = dx * dx + dz * dz;
          const t = length ? Math.max(0, Math.min(1, ((q.x-from.x)*dx+(q.z-from.z)*dz)/length)) : 0;
          return Math.hypot(q.x-from.x-dx*t,q.z-from.z-dz*t) >= r+other.radius+cfg().gap-1e-8;
        })) { next = p; break; }
      }
      if (!next) return false;
      write(body, next); budget -= step;
    }
    return distance(state, body.point, target) < cfg().arrivalEpsilon;
  }
  function moveUnit(state, unit, target, speed, delta) { return move(state, { entity: unit, point: unit, kind: 'unit', lane: unit.lanePosition }, target, speed, delta); }
  function moveLane(state,unit,targetLane,speed,delta) {
    const offset=unit.formationOffset||0, lane=unit.lanePosition;
    const reached=move(state,{entity:unit,point:unit,kind:'unit',lane,crossColumn:true},
      {position:unit.position,lanePosition:lane,terrainOffset:(targetLane-lane)*E.Config.board.laneSpacing+offset},
      speed*E.Config.board.laneSpacing*width(state)/E.Config.boardProjection.positionScale,delta);
    unit.lanePosition=lane+((unit.terrainOffset||0)-offset)/E.Config.board.laneSpacing;
    unit.terrainOffset=offset;
    return reached;
  }
  function moveResident(state, village, resident, target, speed, delta) { return move(state, { entity: resident, village, point: residentPoint(state,village,resident), kind:'resident', lane:village.lane }, target, speed, delta); }
  function resolve(state) {
    const all = bodies(state);
    // Répare aussi les apparitions, téléportations et anciens snapshots sans hitboxes.
    for (let pass = 0; pass < cfg().separationPasses; pass++) {
      let changed = false;
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j], p = world(state,a.point), q = world(state,b.point), d = Math.hypot(q.x-p.x,q.z-p.z), min = a.radius+b.radius+cfg().gap;
        if (d >= min - 1e-7) continue;
        const angle = (i+j) * cfg().sampleAngle, dx = d ? (q.x-p.x)/d : Math.cos(angle), dz = d ? (q.z-p.z)/d : Math.sin(angle);
        const pinned = body => body.kind==='unit' && (state.preparationRemaining>0 || body.entity.mazzeruMarking || body.entity.stance==='defense');
        const aPinned=pinned(a), bPinned=pinned(b);
        const share = aPinned && !bPinned ? 0 : bPinned && !aPinned ? 1 : .5;
        const push = min-d+cfg().arrivalEpsilon;
        write(a, bounded(state,a,point(state,p.x-dx*push*share,p.z-dz*push*share,a.lane)));
        write(b, bounded(state,b,point(state,q.x+dx*push*(1-share),q.z+dz*push*(1-share),b.lane)));
        changed = true;
      }
      if (!changed) break;
    }
  }
  function spawn(state, unit) {
    const all=bodies(state), original={position:unit.position,lanePosition:unit.lanePosition,terrainOffset:unit.terrainOffset||0};
    if(!free(state,original,unit,all)) {
      const step=(radius(unit)*2+cfg().gap)/width(state);
      let found=null;
      for(let row=0;row<cfg().placementAttempts&&!found;row++) {
        for(let i=0;i*step<=cfg().columnHalfWidth&&!found;i++)for(const side of i?[1,-1]:[1]) {
          const p={...original,terrainOffset:side*i*step,
            position:original.position+(unit.ownerId==='red'?1:-1)*row*step/E.Config.boardProjection.positionScale};
          if(free(state,p,unit,all)) {found=p;break;}
        }
      }
      if(found) {unit.position=found.position;unit.terrainOffset=found.terrainOffset;}
    }
    unit.formationOffset=unit.terrainOffset||0;
  }

  E.CharacterAI = { world, point, distance, residentPoint, animalPoint, bodies, radius, free, sample, moveUnit, moveLane, moveResident, resolve, spawn };
}());
