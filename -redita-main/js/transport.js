(function () {
  "use strict";

  const E = window.Eredita;
  const vesselTypes = ["barque", "voilier"];

  function maritimeState(village) {
    if (!village.maritime) village.maritime = { barque: 0, voilier: 0, filet: 0, filetTimer: 0 };
    return village.maritime;
  }

  function buildingLevel(village, type) {
    return Math.max(0, ...village.buildings.filter((building) => building.type === type).map((building) => building.level));
  }

  function unlockReason(village, item) {
    if (item.unlock === "artisanat-ou-boucherie-t1" && buildingLevel(village, "artisanat") < 1 && buildingLevel(village, "boucherie") < 1) {
      return "Artisanat T1 ou Boucherie T1 requis";
    }
    if (item.unlock === "boucherie-t1" && buildingLevel(village, "boucherie") < 1) return "Boucherie T1 requise";
    if (item.unlock === "boucherie-t3" && buildingLevel(village, "boucherie") < 3) return "Boucherie T3 requise";
    return null;
  }

  function shopQuote(state, playerId, lane, type) {
    const player = state.players[playerId];
    const village = player?.villages[lane];
    const item = E.Config.maritime.shop[type];
    if (!village || !item) return null;
    const count = maritimeState(village)[type] || 0;
    let reason = null;
    if (state.phase !== "running") reason = "Partie inactive";
    else if (state.paused) reason = "Partie en pause";
    else if (village.destroyed) reason = "Village détruit";
    else if (village.biome !== "littoral") reason = "Littoral requis";
    else reason = unlockReason(village, item);
    if (!reason && item.max !== null && count >= item.max) reason = "Limite atteinte";
    if (!reason && player.gold < item.gold) reason = "Or insuffisant";
    return { ...item, type, count, allowed: !reason, reason: reason || "Disponible" };
  }

  function buy(state, playerId, lane, type) {
    const quote = shopQuote(state, playerId, lane, type);
    if (!quote?.allowed) return false;
    const player = state.players[playerId];
    const village = player.villages[lane];
    player.gold -= quote.gold;
    maritimeState(village)[type] += 1;
    return quote;
  }

  function fleetCapacity(village) {
    const fleet = maritimeState(village);
    return vesselTypes.reduce((total, type) => total + fleet[type] * E.Config.maritime.shop[type].capacity, 0);
  }

  function waterOwnerAt(state, lane, position) {
    for (const ownerId of ["red", "blue"]) {
      const village = state.players[ownerId]?.villages[lane];
      const range = E.Config.maritime.waterRanges[ownerId];
      if (village?.biome === "littoral" && position >= range.min && position <= range.max) return ownerId;
    }
    return null;
  }

  function occupiedSeats(state, village, type, ignoredUnit) {
    return state.units.filter((unit) => unit !== ignoredUnit && unit.hp > 0 && unit.transportHomeId === village.id && unit.waterTransport === type).length;
  }

  function boardUnit(state, unit) {
    const village = state.players[unit.ownerId]?.villages[unit.originLane];
    if (!village || village.biome !== "littoral") return false;
    const fleet = maritimeState(village);
    for (const type of vesselTypes) {
      const capacity = fleet[type] * E.Config.maritime.shop[type].capacity;
      if (occupiedSeats(state, village, type, unit) < capacity) {
        unit.waterTransport = type;
        unit.transportHomeId = village.id;
        return true;
      }
    }
    return false;
  }

  function updateUnitWaterState(state, unit) {
    const waterOwner = waterOwnerAt(state, unit.lane, unit.position);
    unit.waterOwner = waterOwner;
    if (!waterOwner) {
      unit.waterTransport = null;
      unit.transportHomeId = null;
      unit.swimming = false;
      return true;
    }
    if ((unit.animalType || unit.role) === "sanglier") {
      unit.waterTransport = null;
      unit.transportHomeId = null;
      unit.swimming = true;
      return true;
    }
    if (unit.waterTransport) return true;
    if (boardUnit(state, unit)) return true;
    unit.hp = 0;
    unit.drowned = true;
    return false;
  }

  function updateFishingNets(village, delta) {
    const maritime = maritimeState(village);
    if (village.biome !== "littoral" || maritime.filet <= 0) return;
    const item = E.Config.maritime.shop.filet;
    maritime.filetTimer += delta;
    while (maritime.filetTimer >= item.interval) {
      maritime.filetTimer -= item.interval;
      village.resources.poisson += maritime.filet * item.fishAmount;
    }
  }

  function movementMultiplier(unit) {
    return (unit.animalType || unit.role) === "sanglier" && unit.waterOwner ? E.Config.specialAnimals.sanglier.waterSpeedMultiplier : 1;
  }

  E.Transport = { maritimeState, buildingLevel, shopQuote, buy, fleetCapacity, waterOwnerAt, updateUnitWaterState, updateFishingNets, movementMultiplier };
}());
