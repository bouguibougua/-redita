(function () {
  "use strict";

  const E = window.Eredita;
  let decisionTimer = 0;
  let lastAttackAt = [];
  let tutorialAttackCount = 0;

  function reset() {
    decisionTimer = 0;
    lastAttackAt = [];
    tutorialAttackCount = 0;
  }

  function prepareSetup(state) {
    reset();
    state.players.blue.name = "IA (Bleu)";
    state.players.blue.setupConfirmed = true;
  }

  function availableResident(state, lane) {
    if (E.Economy.getAvailableResidents(state, "blue", lane) <= 0) return null;
    return E.Economy.availableResidentList(state, "blue", lane)[0] || null;
  }

  function prepareWarrior(state, lane, resident) {
    const village = state.players.blue.villages[lane];
    if (E.Buildings.has(village, "artisanat")) {
      E.Economy.setProfession(state, "blue", lane, resident.id, "guerrier");
    }
  }

  function defend(state, village) {
    const lane = village.lane;
    const position = E.Config.combat.defensePositionByOwner.blue;
    const threat = state.units.filter((unit) => unit.ownerId === "red" && unit.hp > 0 &&
      unit.lane === lane &&
      unit.position >= E.Config.movement.columnLength - E.Config.ai.threatDistance);
    if (!threat.length) return false;
    const defenders = state.units.filter((unit) => unit.ownerId === "blue" && unit.hp > 0 &&
      unit.lane === lane && unit.stance === "defense").length;
    const resident = availableResident(state, lane);
    if (!resident || defenders >= Math.min(threat.length, E.Config.ai.maxDefendersPerLane)) return false;
    prepareWarrior(state, lane, resident);
    const mission = threat.some((unit) => unit.position > position + E.Config.combat.attackRange) ? "attaque" : "defense";
    return E.Economy.deployResident(state, "blue", lane, resident.id, mission);
  }

  function plantCrop(state, village) {
    if (village.slots.some((slot) => slot.content?.category === "crop")) return false;
    const type = E.Config.ai.cropPriority.find((crop) => E.Crops.isAllowedInBiome(crop, village.biome));
    if (!type) return false;
    const slotIndex = village.slots.findIndex((slot, index) => E.Crops.canPlace(state, "blue", village.lane, index, type));
    return slotIndex >= 0 && E.Crops.place(state, "blue", village.lane, slotIndex, type);
  }

  function manageVillage(state, village) {
    const lane = village.lane;
    if (village.destroyed) return false;
    if (defend(state, village)) return true;
    if (plantCrop(state, village)) return true;
    if (!E.Buildings.has(village, "artisanat") && E.Buildings.buildT1(state, "blue", lane, "artisanat")) return true;
    if (!village.jobs.agriculture && E.Economy.getAvailableResidents(state, "blue", lane) > E.Config.ai.reserveResidents &&
      E.Economy.assignJob(state, "blue", lane, "agriculture")) return true;

    const resource = E.Config.resources.find((type) => village.resources[type] >= E.Config.saleBatchSize);
    if (resource && E.Economy.sell(state, "blue", lane, resource)) return true;

    const attackers = state.units.filter((unit) => unit.ownerId === "blue" && unit.originLane === lane &&
      unit.stance === "attack" && unit.hp > 0).length;
    const tutorialMode = E.Network?.mode === "tutorial";
    const attackInterval = tutorialMode ? 60 : E.Config.ai.attackInterval;
    const ready = state.elapsed - (lastAttackAt[lane] ?? -Infinity) >= attackInterval;
    if (tutorialMode && tutorialAttackCount >= 3) return false;
    if (!ready || attackers >= E.Config.ai.maxAttackersPerLane ||
      E.Economy.getAvailableResidents(state, "blue", lane) <= E.Config.ai.reserveResidents) return false;
    const resident = availableResident(state, lane);
    if (!resident) return false;
    prepareWarrior(state, lane, resident);
    if (!E.Economy.deployResident(state, "blue", lane, resident.id, "attaque")) return false;
    lastAttackAt[lane] = state.elapsed;
    if (tutorialMode) tutorialAttackCount += 1;
    return true;
  }

  function chooseRedirects(state) {
    let changed = false;
    for (const request of state.pendingRedirects.filter((entry) => entry.playerId === "blue")) {
      const lane = request.candidates.slice().sort((left, right) =>
        state.players.red.villages[left].hp - state.players.red.villages[right].hp)[0];
      changed = E.Combat.chooseRedirect(state, request.key, lane) || changed;
    }
    return changed;
  }

  function update(state, delta) {
    if (state.phase !== "running" || state.paused) return false;
    let changed = chooseRedirects(state);
    decisionTimer += delta;
    if (decisionTimer < E.Config.ai.decisionInterval) return changed;
    decisionTimer -= E.Config.ai.decisionInterval;
    for (const village of state.players.blue.villages) {
      changed = manageVillage(state, village) || changed;
    }
    return changed;
  }

  E.AI = { reset, prepareSetup, update };
}());
