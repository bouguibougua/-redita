(function () {
  "use strict";
  const E = window.Eredita;
  const cfg = () => E.Config.cardGame;
  const foe = id => id === "red" ? "blue" : "red";
  const cropTypes = { "champ-ble": "ble", chataignier: "chataignier", vignoble: "vignoble" };
  const vesselTypes = { barque: "barque", voilier: "voilier", "filet-peche": "filet" };
  const terrainKeys = { riviere: "river", moulin: "mill", "tour-genoise": "tower", sentier: "trail" };
  const professions = ["agriculteur", "berger", "pecheur", "guerrier", "ravageur", "chasseur"];
  const residentCards = [...professions, "ane", "outil-bois", "outil-bronze", "outil-fer", "armure-cuir", "armure-maille", "armure-fer"];

  const terrain = village => village.terrain || {};
  const isBurned = (state, village) => Boolean(village && village.burnUntil > state.elapsed);
  const productionMultiplier = (state, village) => village.curseUntil > state.elapsed ? 0.5 : 1;

  // Only geometry changes rebuild the board; damage to an existing structure does not.
  function terrainVisualKey(village) {
    const t = terrain(village);
    return [!!t.river, !!t.mill, !!t.tower, !!t.trail, (t.traps || []).map(trap => trap.position).join(",")].join("/");
  }

  function cost(id) {
    if (E.Config.building.types.includes(id)) return E.Config.building.T1.gold;
    if (vesselTypes[id]) return E.Config.maritime.shop[vesselTypes[id]].gold;
    if (["ane", "chien", "sanglier"].includes(id)) return E.Config.specialAnimals[id].gold;
    if (id.startsWith("outil-")) return E.Config.equipment.tools[id.slice(6)]?.gold || 0;
    if (id.startsWith("armure-")) return E.Config.equipment.armors[id.slice(7)]?.gold || 0;
    if (id === "habitant") return E.Config.residentPurchase.gold;
    if (cropTypes[id]) return E.Config.cropPlacementCost;
    if (E.Config.livestock[id]) return E.Config.livestockPlacementCost;
    return cfg().terrainCosts[id] || 0;
  }

  function quote(state, playerId, id, target = {}) {
    const player = state.players[playerId];
    const village = player?.villages[target.lane];
    const card = E.Cards.get(id);
    let reason = !card ? "Carte inconnue" : !village || !Number.isInteger(target.lane) ? "Choisissez votre village" :
      target.playerId && target.playerId !== playerId ? "Cible adverse interdite" : village.destroyed ? "Village détruit" :
        state.phase !== "running" ? "Partie inactive" : state.paused ? "Partie en pause" : isBurned(state, village) ? "Terrain brûlé : attendez sa restauration" : null;
    const resident = village?.residents.find(person => person.id === target.residentId);
    const t = village && terrain(village);
    const gold = cost(id);
    let resource, resourceAmount = 0;
    if (!reason) {
      if (cropTypes[id]) {
        if (!E.Crops.canPlace(state, playerId, target.lane, target.slotIndex, cropTypes[id])) reason = "Choisissez un slot libre compatible avec cette culture";
      } else if (E.Config.livestock[id]) {
        const slot = village.slots[target.slotIndex];
        const sameHerd = slot?.content?.category === "livestock" && slot.content.type === id && slot.content.hp > 0;
        if (!sameHerd && !E.Livestock.canPlace(state, playerId, target.lane, target.slotIndex, id)) reason = "Choisissez un enclos compatible";
      } else if (E.Config.building.types.includes(id)) {
        if (village.buildings.length >= E.Config.building.slots) reason = "Les trois emplacements de bâtiments sont occupés";
      } else if (professions.includes(id)) {
        if (!E.Economy.canSetProfession(state, playerId, target.lane, target.residentId, id)) reason = "Habitant local et bâtiment du métier requis";
        else if (resident.profession === id) reason = "Cet habitant possède déjà ce métier";
      } else if (id === "habitant") {
        resource = target.resource;
        resourceAmount = E.Config.residentPurchase.resourceAmount;
        if (!E.Economy.canBuyResident(state, playerId, target.lane, resource)) reason = `Population pleine ou ressources insuffisantes (${resourceAmount} ressources locales)`;
      } else if (vesselTypes[id]) {
        const q = E.Transport.shopQuote(state, playerId, target.lane, vesselTypes[id]);
        if (!q?.allowed) reason = q?.reason || "Embarcation incompatible";
      } else if (["ane", "chien", "sanglier"].includes(id)) {
        const q = E.Animals.purchaseQuote(state, playerId, target.lane, id, target.residentId);
        if (!q?.allowed) reason = q?.reason || "Animal incompatible";
      } else if (id.startsWith("outil-") || id.startsWith("armure-")) {
        const tools = id.startsWith("outil-");
        const q = E.Equipment.quote(state, playerId, target.lane, target.residentId, tools ? "tools" : "armors", id.slice(tools ? 6 : 7));
        if (!q?.allowed) reason = q?.reason || "Sélectionnez un habitant local";
      } else if (terrainKeys[id]) {
        if (t[terrainKeys[id]]) reason = "Cet aménagement existe déjà";
        else if (id === "riviere" && !["plaine", "montagne"].includes(village.biome)) reason = "Rivière : Plaine ou Montagne uniquement";
        else if (id === "moulin" && !t.river) reason = "Une Rivière est nécessaire";
        else if (id === "sentier" && village.biome !== "montagne") reason = "Sentier : Montagne uniquement";
      } else if (id === "piege") {
        if ((t.traps || []).length >= cfg().trapLimit) reason = "Limite de pièges atteinte";
        const position = target.position ?? E.Config.combat.defensePositionByOwner[playerId];
        const limits = E.Config.temporaryProduction.huntingAreaByOwner[playerId];
        if (!Number.isFinite(position) || position < limits.min || position > limits.max || E.Transport.waterOwnerAt(state, target.lane, position)) reason = "Placez le piège sur votre terre";
      } else if (id === "charrette") {
        const ids = target.residentIds;
        if (!Array.isArray(ids) || !ids.length || ids.length > cfg().cartCapacity || new Set(ids).size !== ids.length ||
          ids.some(residentId => !E.Economy.availableResidentList(state, playerId, target.lane).some(person => person.id === residentId))) reason = "Choisissez de 1 à 8 habitants disponibles de ce village";
      } else if (id === "a-stregha" || id === "u-diavulu") {
        const enemy = state.players[foe(playerId)].villages[target.targetLane];
        if (!Number.isInteger(target.targetLane) || !enemy || enemy.destroyed) reason = "Choisissez une région adverse vivante";
      } else if (id === "oeil-sainte-lucie" && village.biome !== "littoral") reason = "Utilisable depuis un Littoral uniquement";
      else if (id === "squadra-arozza" && !eligibleDeaths(state, playerId, village).length) reason = "Aucun habitant mort dans la période de résurrection";
    }
    if (!reason && player.gold < gold) reason = "Or insuffisant";
    return { allowed: !reason, reason: reason || "Disponible", gold, resource, resourceAmount };
  }

  function targets(state, playerId, id) {
    const result = [];
    for (const village of state.players[playerId]?.villages || []) {
      const base = { lane: village.lane };
      if (cropTypes[id] || E.Config.livestock[id]) village.slots.forEach((_, slotIndex) => result.push({ ...base, slotIndex }));
      else if (residentCards.includes(id)) village.residents.forEach(person => result.push({ ...base, residentId: person.id }));
      else if (id === "habitant") E.Config.resources.forEach(resource => result.push({ ...base, resource }));
      else if (["a-stregha", "u-diavulu"].includes(id)) state.players[foe(playerId)].villages.forEach(enemy => result.push({ ...base, targetLane: enemy.lane }));
      else if (id === "charrette") {
        const available = E.Economy.availableResidentList(state, playerId, village.lane).slice(0, cfg().cartCapacity);
        for (let count = available.length; count >= 1; count--) result.push({ ...base, residentIds: available.slice(0, count).map(person => person.id) });
      }
      else result.push(base);
    }
    return result;
  }

  function apply(state, playerId, id, target) {
    const q = quote(state, playerId, id, target);
    if (!q.allowed) return false;
    const village = state.players[playerId].villages[target.lane];
    let success = true, servicePaid = false;
    if (cropTypes[id]) success = E.Crops.place(state, playerId, target.lane, target.slotIndex, cropTypes[id]);
    else if (E.Config.livestock[id]) {
      const slot = village.slots[target.slotIndex];
      if (slot.content) {
        const addedHp = E.Config.livestock[id].hpPerAnimal;
        slot.content.count++; slot.content.hp += addedHp; slot.content.maxHp += addedHp;
      } else success = E.Livestock.place(state, playerId, target.lane, target.slotIndex, id);
    } else if (professions.includes(id)) success = E.Economy.setProfession(state, playerId, target.lane, target.residentId, id);
    else if (E.Config.building.types.includes(id)) { success = E.Buildings.buildT1(state, playerId, target.lane, id); servicePaid = true; }
    else if (id === "habitant") { success = E.Economy.buyResident(state, playerId, target.lane, target.resource); servicePaid = true; }
    else if (vesselTypes[id]) { success = E.Transport.buy(state, playerId, target.lane, vesselTypes[id]); servicePaid = true; }
    else if (["ane", "chien", "sanglier"].includes(id)) { success = E.Animals.buy(state, playerId, target.lane, id, target.residentId); servicePaid = true; }
    else if (id.startsWith("outil-") || id.startsWith("armure-")) {
      const tools = id.startsWith("outil-");
      success = E.Equipment.buy(state, playerId, target.lane, target.residentId, tools ? "tools" : "armors", id.slice(tools ? 6 : 7)); servicePaid = true;
    } else if (terrainKeys[id]) {
      village.terrain ||= {};
      const hp = cfg().terrainHp[id];
      village.terrain[terrainKeys[id]] = { type: id, hp: hp || null, maxHp: hp || null };
    } else if (id === "piege") {
      village.terrain ||= {}; village.terrain.traps ||= [];
      village.terrain.traps.push({ position: target.position ?? E.Config.combat.defensePositionByOwner[playerId] });
    } else if (id === "charrette") createCart(state, village, target.residentIds);
    else if (id === "u-mazzeru") state.players[playerId].revealPeopleUntil = state.elapsed + cfg().effectDuration;
    else if (id === "a-stregha") state.players[foe(playerId)].villages[target.targetLane].curseUntil = state.elapsed + cfg().effectDuration;
    else if (id === "oeil-sainte-lucie") state.players[playerId].revealCoasts = true;
    else if (id === "u-diavulu") burnColumn(state, playerId, village, target.targetLane);
    else if (id === "squadra-arozza") resurrect(state, playerId, village);
    else return false;
    if (success && !servicePaid) state.players[playerId].gold -= q.gold;
    return Boolean(success);
  }

  function recordDeath(state, village, resident) {
    if (!state.cardGameStarted) return;
    state.casualties ||= [];
    if (state.casualties.some(death => death.resident.id === resident.id)) return;
    state.casualties.push({ ownerId: village.ownerId, originLane: village.lane, at: state.elapsed,
      resident: { id: resident.id, profession: resident.profession, tool: resident.tool, armor: resident.armor }, revived: false });
  }

  function eligibleDeaths(state, playerId, village) {
    const windowSeconds = village.biome === "plaine" ? cfg().plainsResurrectionWindow : cfg().resurrectionWindow;
    return (state.casualties || []).filter(death => death.ownerId === playerId && !death.revived && state.elapsed - death.at <= windowSeconds);
  }

  function resurrect(state, playerId, village) {
    state.pendingResurrections ||= [];
    for (const death of eligibleDeaths(state, playerId, village)) {
      death.revived = true;
      state.pendingResurrections.push({ ownerId: playerId, originLane: death.originLane, resident: { ...death.resident } });
    }
    restorePending(state);
  }

  function restorePending(state) {
    state.pendingResurrections = (state.pendingResurrections || []).filter(pending => {
      const villages = state.players[pending.ownerId].villages;
      const origin = villages[pending.originLane];
      const candidates = origin && !origin.destroyed ? [origin] : villages.filter(village => !village.destroyed)
        .sort((a, b) => Math.abs(a.lane - pending.originLane) - Math.abs(b.lane - pending.originLane) || a.lane - b.lane);
      const village = candidates[0];
      if (!village || isBurned(state, village) || village.population >= village.populationMax) return true;
      const resident = E.Economy.addResident(village);
      resident.profession = pending.resident.profession || "habitant";
      resident.tool = pending.resident.tool || null; resident.armor = pending.resident.armor || null;
      return false;
    });
  }

  function burnColumn(state, playerId, source, lane) {
    for (const ownerId of ["red", "blue"]) {
      const village = state.players[ownerId].villages[lane];
      village.burnUntil = state.elapsed + cfg().effectDuration;
      village.slots.forEach(slot => { slot.content = null; });
      for (const resident of village.residents.slice()) {
        const unit = state.units.find(unit => unit.id === resident.unitId);
        if (!unit || unit.lane === lane) E.Economy.removeResident(state, ownerId, lane, resident.id);
      }
      village.animals = (village.animals || []).filter(animal => animal.unitId);
    }
    for (const unit of state.units) if (unit.lane === lane) {
      if (unit.isCart) { releaseCart(state, unit); unit.hp = 0; }
      unit.hp = 0;
      if (unit.residentId) E.Economy.removeResident(state, unit.ownerId, unit.originLane, unit.residentId);
      if (unit.animalType) E.Animals.onUnitDeath(state, unit);
    }
    // Les bâtiments ordinaires et le village utilisent déjà un même réservoir de PV.
    if (source.biome === "montagne") {
      const enemy = state.players[foe(playerId)].villages[lane];
      enemy.hp = Math.max(0, enemy.hp - cfg().diavuluMountainDamage);
    }
    E.Combat.settleDeaths(state);
  }

  function createCart(state, village, residentIds) {
    const stats = E.Config.units.charrette;
    const cart = E.Units.create(village.ownerId, village.lane, "habitant");
    Object.assign(cart, stats, { role: "charrette", profession: "habitant", maxHp: stats.hp, isCart: true, passengers: [] });
    for (const id of residentIds) {
      const person = village.residents.find(person => person.id === id);
      const role = E.Economy.isBoosted(person, "attaque") ? person.profession : "habitant";
      const passenger = E.Units.create(village.ownerId, village.lane, role, { ...person, residentId: id });
      person.unitId = passenger.id; person.mission = "attaque";
      cart.passengers.push(passenger);
    }
    state.units.push(cart);
    updateArtisanatBonuses(state);
  }

  function releaseCart(state, cart) {
    if (!cart.passengers?.length) return;
    for (const passenger of cart.passengers) {
      passenger.position = cart.position; passenger.lane = cart.lane; passenger.lanePosition = cart.lanePosition;
      state.units.push(passenger);
    }
    cart.passengers = [];
    cart.hp = 0;
  }

  function movementMultiplier(state, unit) {
    const territoryOwner = unit.position < E.Config.movement.columnLength / 2 ? "red" : "blue";
    const village = state.players[territoryOwner]?.villages[unit.lane];
    let multiplier = unit.slowUntil > state.elapsed ? cfg().trapSlowMultiplier : 1;
    if (village?.ownerId === unit.ownerId && terrain(village).trail) multiplier *= 1 + cfg().trailSpeedBonus;
    if (unit.isCart && village?.biome === "montagne") multiplier *= cfg().cartMountainMultiplier;
    return multiplier;
  }

  function updateArtisanatBonuses(state) {
    const bonus = E.Config.building.artisanatBonus;
    const units = state.units.flatMap(unit => unit.isCart ? [unit, ...(unit.passengers || [])] : [unit]);
    for (const unit of units) {
      if (unit.hp <= 0 || unit.isCart || unit.animalType || ["chien", "sanglier"].includes(unit.role)) continue;
      const village = state.players[unit.ownerId]?.villages[unit.lane];
      const active = village && !village.destroyed && E.Buildings.has(village, "artisanat");
      const hpBonus = active ? bonus.hp : 0, damageBonus = active ? bonus.damage : 0;
      const difference = hpBonus - (unit.artisanatHpBonus || 0);
      const damageDifference = damageBonus - (unit.artisanatDamageBonus || 0);
      if (!difference && !damageDifference) continue;
      // Même convention que les améliorations : conserver les dégâts déjà subis.
      unit.maxHp += difference;
      unit.hp = Math.max(0, Math.min(unit.maxHp, unit.hp + difference));
      unit.damage += damageDifference;
      unit.artisanatHpBonus = hpBonus; unit.artisanatDamageBonus = damageBonus;
    }
  }

  function vision(state, viewerId, village) {
    if (!state.cardGameStarted || viewerId === village.ownerId) return { fraction: 1, people: true, all: true };
    const viewer = state.players[viewerId];
    const full = Boolean(viewer?.revealCoasts && village.biome === "littoral");
    const local = viewer?.villages[village.lane];
    const fraction = full ? 1 : terrain(local || {}).tower ? (local.biome === "littoral" ? cfg().coastalTowerRevealFraction : cfg().towerRevealFraction) : 0;
    return { fraction, people: full || viewer?.revealPeopleUntil > state.elapsed, all: full };
  }

  function unitVisible(state, viewerId, unit) {
    if (!state.cardGameStarted || unit.ownerId === viewerId) return true;
    const village = state.players[unit.ownerId]?.villages[unit.lane];
    const visible = vision(state, viewerId, village);
    const frontier = E.Config.movement.columnLength / 2;
    if (unit.ownerId === "red") return unit.position >= frontier - frontier * visible.fraction;
    return unit.position <= frontier + frontier * visible.fraction;
  }

  function update(state) {
    if (!state.cardGameStarted || state.phase !== "running" || state.paused || state.preparationRemaining > 0) return;
    restorePending(state);
    state.casualties = (state.casualties || []).filter(death => state.elapsed - death.at <= cfg().plainsResurrectionWindow);
    for (const player of Object.values(state.players)) for (const village of player.villages) {
      const traps = terrain(village).traps;
      if (!traps) continue;
      village.terrain.traps = traps.filter(trap => {
        const victim = state.units.find(unit => unit.ownerId !== village.ownerId && unit.hp > 0 && unit.lane === village.lane && Math.abs(unit.position - trap.position) <= cfg().trapRange);
        if (!victim) return true;
        victim.hp = Math.max(0, victim.hp - cfg().trapDamage);
        victim.slowUntil = state.elapsed + cfg().trapSlowDuration;
        return false;
      });
    }
  }

  E.CardEffects = { quote, apply, targets, cost, terrain, terrainVisualKey, isBurned, productionMultiplier, recordDeath,
    update, vision, unitVisible, movementMultiplier, updateArtisanatBonuses, releaseCart, residentCards };
}());
