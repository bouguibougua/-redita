(function () {
  "use strict";

  const E = window.Eredita;
  const cropResources = { chataignier: "chataigne", ble: "ble", vignoble: "raisin" };
  const economicMissions = ["agriculture", "elevage", "peche", "chasse"];

  function isBoosted(resident, mission) {
    return Boolean(resident && E.Config.professions[resident.profession || "habitant"]?.missions.includes(mission));
  }

  function workBonus(village, resident, mission) {
    if (!isBoosted(resident, mission)) return 0;
    const profession = E.Config.professions[resident.profession];
    return (profession.biome === village.biome ? profession.biomeBonus : profession.workBonus) || 0;
  }

  function canSetProfession(state, playerId, lane, residentId, profession) {
    const village = state.players[playerId]?.villages[lane];
    const resident = getResident(state, playerId, lane, residentId);
    const definition = E.Config.professions[profession];
    return Boolean(state.phase === "running" && !state.paused && village && !village.destroyed &&
      resident && !resident.unitId && definition && (!definition.requires || E.Buildings.has(village, definition.requires)));
  }

  function setProfession(state, playerId, lane, residentId, profession) {
    if (!canSetProfession(state, playerId, lane, residentId, profession)) return false;
    getResident(state, playerId, lane, residentId).profession = profession;
    return true;
  }

  // TEMP_BALANCE_VALUE — les multiplicateurs de l'âne suivent les bonus existants (GDD §44).
  function donkeyMultiplier(resident, bonus) {
    return 1 + (resident.donkey ? E.Config.specialAnimals.ane[bonus] : 0);
  }

  function assignProfessionToAll(state, playerId, lane, profession) {
    const village = state.players[playerId]?.villages[lane];
    if (!village || !E.Config.professions[profession]) return 0;
    return village.residents.reduce((changed, resident) => {
      const currentProfession = resident.profession || "habitant";
      const engagedInCombat = resident.unitId || ["attaque", "defense"].includes(resident.mission);
      if (engagedInCombat || currentProfession === profession) return changed;
      // Une attribution groupée ne remplace jamais un métier existant.
      // « Sans métier » est l'action explicite qui retire les métiers.
      if (profession !== "habitant" && currentProfession !== "habitant") return changed;
      return changed + Number(setProfession(state, playerId, lane, resident.id, profession));
    }, 0);
  }

  function setNextResidentMission(state, playerId, lane, mission) {
    const village = state.players[playerId]?.villages[lane];
    if (state.phase !== "running" || state.paused || !village || village.destroyed ||
      (mission !== "disponible" && !E.Config.jobs[mission] && !["attaque", "defense"].includes(mission))) return false;
    village.nextResidentMission = mission;
    return true;
  }

  function setNextResidentProfession(state, playerId, lane, profession) {
    const village = state.players[playerId]?.villages[lane];
    if (state.phase !== "running" || state.paused || !village || village.destroyed || !E.Config.professions[profession]) return false;
    village.nextResidentProfession = profession;
    return true;
  }

  function saleQuote(village, resource) {
    if (!E.Config.resources.includes(resource)) return null;
    const amount = Math.min(E.Config.saleBatchSize, Math.max(0, village.resources[resource]));
    const levels = village.buildings.filter((building) => E.Config.saleBuildingResources[building.type]?.includes(resource)).map((building) => building.level);
    const bonus = Math.max(0, ...levels) * E.Config.saleBonusPerLevel;
    return { amount, gold: amount * E.Config.resourceSaleValues[resource] * (1 + bonus) };
  }

  function sell(state, playerId, lane, resource) {
    const player = state.players[playerId];
    const village = player?.villages[lane];
    if (state.phase !== "running" || state.paused || !village || village.destroyed) return false;
    const quote = saleQuote(village, resource);
    if (!quote || quote.amount <= 0) return false;
    village.resources[resource] = Math.max(0, village.resources[resource] - quote.amount);
    player.gold += quote.gold;
    return quote;
  }

  function deployResident(state, playerId, lane, residentId, mission) {
    const village = state.players[playerId]?.villages[lane];
    const resident = getResident(state, playerId, lane, residentId);
    if (state.phase !== "running" || state.paused || !village || village.destroyed || !resident ||
      resident.mission !== "disponible" || resident.unitId || !["attaque", "defense"].includes(mission)) return false;
    const role = isBoosted(resident, mission) ? resident.profession : "habitant";
    const unit = E.Units.create(playerId, lane, role, {
      residentId,
      stance: mission === "defense" ? "defense" : "attack",
      profession: resident.profession || "habitant",
      tool: resident.tool,
      armor: resident.armor,
      donkey: resident.donkey
    });
    if (!unit) return false;
    resident.mission = mission;
    resident.unitId = unit.id;
    state.units.push(unit);
    return true;
  }

  function villagePosition(ownerId) {
    return ownerId === "red" ? 0 : E.Config.movement.columnLength;
  }

  function assignedWorkers(village) {
    return Object.values(village.jobs).reduce((total, count) => total + count, 0);
  }

  function deployedResidents(state, playerId, lane) {
    return state.units.filter((unit) =>
      unit.ownerId === playerId &&
      unit.originLane === lane &&
      unit.hp > 0 &&
      !unit.animalType &&
      !unit.residentId
    ).length;
  }

  function getResident(state, playerId, lane, residentId) {
    const player = state.players[playerId];
    const village = player && player.villages[lane];
    return village && village.residents.find((resident) => resident.id === residentId) || null;
  }

  function availableResidentList(state, playerId, lane) {
    const player = state.players[playerId];
    const village = player && player.villages[lane];
    if (!village || village.destroyed) return [];
    return village.residents.filter((resident) => resident.mission === "disponible" && !resident.unitId);
  }

  function getAvailableResidents(state, playerId, lane) {
    const player = state.players[playerId];
    const village = player && player.villages[lane];
    if (!village || village.destroyed) return 0;
    return Math.max(0, availableResidentList(state, playerId, lane).length - deployedResidents(state, playerId, lane));
  }

  function hasContent(village, category) {
    return village.slots.some((slot) => slot.content && slot.content.category === category);
  }

  function jobRequirementMet(village, job) {
    const definition = E.Config.jobs[job];
    if (!definition) return false;
    if (job === "agriculture") return hasContent(village, "crop");
    if (job === "elevage") return hasContent(village, "livestock");
    // La pêche en rivière sera ajoutée avec la carte Rivière.
    if (job === "peche") return village.biome === "littoral";
    if (job === "chasse") return true;
    return false;
  }

  function canAssignJob(state, playerId, lane, job) {
    const player = state.players[playerId];
    const village = player && player.villages[lane];
    return Boolean(
      state.phase === "running" &&
      !state.paused &&
      village &&
      !village.destroyed &&
      getAvailableResidents(state, playerId, lane) > 0 &&
      jobRequirementMet(village, job)
    );
  }

  function canAssignResidentJob(state, playerId, lane, residentId, job) {
    const resident = getResident(state, playerId, lane, residentId);
    return Boolean(
      resident &&
      resident.mission === "disponible" &&
      !resident.unitId &&
      canAssignJob(state, playerId, lane, job)
    );
  }

  function assignResidentJob(state, playerId, lane, residentId, job) {
    if (!canAssignResidentJob(state, playerId, lane, residentId, job)) return false;
    const village = state.players[playerId].villages[lane];
    const resident = getResident(state, playerId, lane, residentId);
    resident.mission = job;
    resident.workTimer = 0;
    if (job === "agriculture" || job === "elevage") {
      resident.workPosition = villagePosition(playerId);
      resident.workLaneOffset = 0;
      resident.workPhase = "toField";
      resident.workTimer = 0;
      resident.targetSlotIndex = null;
      resident.carrying = null;
    } else if (job === "chasse") {
      resident.workPosition = villagePosition(playerId);
      resident.workLaneOffset = 0;
      resident.workPhase = "hunting";
      resident.workTimer = 0;
      resident.huntTargetPosition = null;
      resident.huntTargetLaneOffset = null;
    }
    village.jobs[job] += 1;
    return true;
  }

  function assignJob(state, playerId, lane, job) {
    const resident = availableResidentList(state, playerId, lane)[0];
    return resident ? assignResidentJob(state, playerId, lane, resident.id, job) : false;
  }

  function assignAllAvailableResidents(state, playerId, lane, mission) {
    const availableCount = getAvailableResidents(state, playerId, lane);
    const residentIds = availableResidentList(state, playerId, lane).slice(0, availableCount).map((resident) => resident.id);
    return residentIds.reduce((assigned, residentId) => {
      const changed = E.Config.jobs[mission]
        ? assignResidentJob(state, playerId, lane, residentId, mission)
        : deployResident(state, playerId, lane, residentId, mission);
      return assigned + Number(changed);
    }, 0);
  }

  function unassignResidentJob(state, playerId, lane, residentId) {
    const player = state.players[playerId];
    const village = player && player.villages[lane];
    const resident = getResident(state, playerId, lane, residentId);
    if (
      state.phase !== "running" ||
      state.paused ||
      !village ||
      !resident ||
      !economicMissions.includes(resident.mission)
    ) return false;
    village.jobs[resident.mission] = Math.max(0, village.jobs[resident.mission] - 1);
    resident.mission = "disponible";
    resident.workPosition = null;
    resident.workPhase = null;
    resident.workTimer = 0;
    resident.targetSlotIndex = null;
    resident.carrying = null;
    resident.workLaneOffset = 0;
    resident.huntTargetPosition = null;
    resident.huntTargetLaneOffset = null;
    return true;
  }

  function unassignJob(state, playerId, lane, job) {
    const player = state.players[playerId];
    const village = player && player.villages[lane];
    if (state.phase !== "running" || state.paused || !village || !village.jobs[job]) return false;
    const resident = village.residents.find((item) => item.mission === job);
    return resident ? unassignResidentJob(state, playerId, lane, resident.id) : false;
  }

  function addResident(village, state = null) {
    const number = village.nextResidentNumber++;
    const resident = {
      id: `${village.id}-habitant-${number}`,
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
    village.residents.push(resident);
    village.population = village.residents.length;
    if (state) {
      const mission = village.nextResidentMission || "disponible";
      const profession = village.nextResidentProfession || "habitant";
      if (profession !== "habitant") setProfession(state, village.ownerId, village.lane, resident.id, profession);
      if (E.Config.jobs[mission]) assignResidentJob(state, village.ownerId, village.lane, resident.id, mission);
      else if (["attaque", "defense"].includes(mission)) deployResident(state, village.ownerId, village.lane, resident.id, mission);
    }
    return resident;
  }

  function canBuyResident(state, playerId, lane, resource) {
    const player = state.players[playerId];
    const village = player?.villages[lane];
    const cost = E.Config.residentPurchase;
    return Boolean(state.phase === "running" && !state.paused && village && !village.destroyed &&
      E.Config.resources.includes(resource) && village.population < village.populationMax &&
      player.gold >= cost.gold && village.resources[resource] >= cost.resourceAmount);
  }

  function buyResident(state, playerId, lane, resource) {
    if (!canBuyResident(state, playerId, lane, resource)) return false;
    const player = state.players[playerId];
    const village = player.villages[lane];
    const cost = E.Config.residentPurchase;
    player.gold -= cost.gold;
    village.resources[resource] -= cost.resourceAmount;
    return addResident(village, state);
  }

  function removeResident(state, playerId, lane, residentId) {
    const player = state.players[playerId];
    const village = player && player.villages[lane];
    if (!village) return false;
    const index = village.residents.findIndex((resident) => resident.id === residentId);
    if (index < 0) return false;
    const [resident] = village.residents.splice(index, 1);
    if (economicMissions.includes(resident.mission)) {
      village.jobs[resident.mission] = Math.max(0, village.jobs[resident.mission] - 1);
    }
    village.population = village.residents.length;
    return true;
  }

  function updatePopulation(state, delta) {
    Object.values(state.players).forEach((player) => {
      if (state.tutorial?.populationLocked && player.id === "red") return;
      const livingVillages = player.villages.filter((village) => !village.destroyed);
      const interval = E.Config.population.generationByLivingVillages[livingVillages.length];
      if (!interval) return;

      livingVillages.forEach((village) => {
        if (village.population >= village.populationMax) {
          village.populationTimer = 0;
          return;
        }
        village.populationTimer += delta;
        while (village.populationTimer >= interval && village.population < village.populationMax) {
          addResident(village, state);
          village.populationTimer -= interval;
        }
      });
    });
  }

  function bergerieBonus(village) {
    const levels = village.buildings
      .filter((building) => building.type === "bergerie")
      .map((building) => building.level);
    if (!levels.length) return 0;
    return { 1: 0.1, 2: 0.2, 3: 0.3 }[Math.max(...levels)] || 0;
  }

  function moveWorker(resident, target, speed, delta) {
    const distance = target - resident.workPosition;
    const step = speed * delta;
    if (Math.abs(distance) <= step) {
      resident.workPosition = target;
      return true;
    }
    resident.workPosition += Math.sign(distance) * step;
    return false;
  }

  function cropCount(village, type) {
    return village.slots.filter((slot) => slot.content?.category === "crop" && slot.content.type === type && slot.content.hp > 0).length;
  }

  function animalCounts(village) {
    const counts = Object.fromEntries(Object.keys(E.Config.livestock).map((type) => [type, 0]));
    village.slots.forEach((slot) => {
      const content = slot.content;
      if (content?.category === "livestock" && content.hp > 0 && Object.hasOwn(counts, content.type)) counts[content.type] += content.count;
    });
    return counts;
  }

  function dairyAnimalCount(village) {
    return Object.entries(animalCounts(village)).reduce((sum, [type, count]) => sum + (E.Config.livestock[type].milkInterval ? count : 0), 0);
  }

  function chooseWorkSlot(village, resident, workerIndex) {
    const slots = village.slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.content?.hp > 0 && (resident.mission === "agriculture"
        ? slot.content.category === "crop"
        : slot.content.category === "livestock" && E.Livestock.get(slot.content.type)?.milkInterval));
    if (!slots.length) return null;
    const current = slots.find(({ index }) => index === resident.targetSlotIndex);
    return current || slots[workerIndex % slots.length];
  }

  function updateWorkerTrip(village, resident, workerIndex, delta) {
    const target = chooseWorkSlot(village, resident, workerIndex);
    const home = villagePosition(village.ownerId);
    if (resident.workPosition === null) resident.workPosition = home;
    const config = E.Config.temporaryProduction;
    const field = config.agricultureFieldPositionByOwner[village.ownerId];
    const farming = resident.mission === "agriculture";
    const profession = E.Config.professions[resident.profession || "habitant"];
    const movementSpeed = E.Config.movement.inhabitantSpeed * (1 + (isBoosted(resident, resident.mission) ? profession.speedBonus || 0 : 0)) * donkeyMultiplier(resident, "movementBonus");

    // Une récolte déjà chargée reste livrée même si sa source disparaît.
    if (resident.workPhase === "toVillage") {
      if (moveWorker(resident, home, movementSpeed, delta)) {
        if (resident.carrying?.resource) village.resources[resident.carrying.resource] += resident.carrying.amount;
        resident.carrying = null;
        resident.workPhase = "villageStop";
        resident.workTimer = 0;
      }
      return;
    }

    if (resident.workPhase === "villageStop") {
      resident.workTimer += delta;
      if (resident.workTimer >= config.agricultureVillageStopDuration) {
        resident.workTimer = 0;
        resident.workPhase = "toField";
      }
      return;
    }

    if (!target) {
      resident.workTimer = 0;
      resident.targetSlotIndex = null;
      resident.workPhase = moveWorker(resident, home, movementSpeed, delta) ? "waitingForWork" : "toVillage";
      return;
    }
    if (resident.targetSlotIndex !== target.index) resident.workTimer = 0;
    resident.targetSlotIndex = target.index;
    if (!resident.workPhase || resident.workPhase === "waitingForWork") resident.workPhase = "toField";

    if (resident.workPhase === "toField") {
      if (moveWorker(resident, field, movementSpeed, delta)) {
        resident.workPhase = "harvesting";
        resident.workTimer = 0;
      }
      return;
    }

    if (resident.workPhase === "harvesting") {
      const bonus = workBonus(village, resident, resident.mission);
      const equipment = E.Equipment.bonuses(resident);
      const duration = farming
        ? config.agricultureHarvestDuration / (1 + bonus + bergerieBonus(village))
        : E.Livestock.get(target.slot.content.type).milkInterval;
      resident.workTimer += delta * (1 + equipment.productionSpeed);
      if (resident.workTimer >= duration) {
        resident.workTimer = 0;
        resident.carrying = {
          resource: farming ? cropResources[target.slot.content.type] : "lait",
          amount: farming
            ? cropCount(village, target.slot.content.type) * config.agricultureAmountPerTrip * (1 + equipment.productionYield) * donkeyMultiplier(resident, "workBonus")
            : dairyAnimalCount(village) * config.milkAmountPerAnimal * (1 + bonus + bergerieBonus(village)) * (1 + equipment.productionYield) * donkeyMultiplier(resident, "workBonus")
        };
        resident.workPhase = "toVillage";
      }
      return;
    }

  }

  function updateWorkerTrips(village, delta) {
    ["agriculture", "elevage"].forEach((mission) => village.residents
      .filter((resident) => resident.mission === mission)
      .forEach((resident, index) => updateWorkerTrip(village, resident, index, delta)));
  }

  function updateFishing(village, delta) {
    const workers = village.jobs.peche;
    if (!workers || village.biome !== "littoral") return;
    const interval = E.Config.temporaryProduction.fishingInterval;
    village.residents.filter((resident) => resident.mission === "peche").forEach((resident) => {
      const equipment = E.Equipment.bonuses(resident);
      resident.workTimer += delta * (1 + equipment.productionSpeed);
      const fisherYield = (1 + workBonus(village, resident, "peche")) * (1 + equipment.productionYield) * donkeyMultiplier(resident, "workBonus");
      while (resident.workTimer >= interval) {
        resident.workTimer -= interval;
        village.resources.poisson += E.Config.temporaryProduction.fishAmountPerWorker * fisherYield;
      }
    });
  }

  function reproductionInterval(village, content, animal) {
    const herdFactor = content.type === "vache" ? 1 : Math.pow(0.95, Math.floor(content.count / 2));
    const biomeSpeed = village.biome === animal.preferredBiome ? 0.05 : 0;
    const shepherdSpeed = village.residents.filter((resident) => resident.mission === "elevage")
      .reduce((sum, resident) => sum + workBonus(village, resident, "elevage"), 0);
    return animal.reproductionInterval * herdFactor /
      (1 + biomeSpeed + shepherdSpeed + bergerieBonus(village));
  }

  function updateHerd(village, content, delta) {
    const animal = E.Livestock.get(content.type);
    if (!animal || content.hp <= 0) return;

    content.reproductionProgress += delta;
    let interval = reproductionInterval(village, content, animal);
    while (content.reproductionProgress >= interval) {
      content.reproductionProgress -= interval;
      content.count += 1;
      E.Livestock.refreshHp(content);
      interval = reproductionInterval(village, content, animal);
    }

  }

  function chooseHuntTarget(village, resident) {
    const config = E.Config.temporaryProduction;
    const area = config.huntingAreaByOwner[village.ownerId];
    const water = E.Config.maritime.waterRanges[village.ownerId];
    const minimum = village.biome === "littoral" && village.ownerId === "blue" ? Math.max(area.min, water.max + 0.5) : area.min;
    const maximum = village.biome === "littoral" && village.ownerId === "red" ? Math.min(area.max, water.min - 0.5) : area.max;
    resident.huntTargetPosition = minimum + Math.random() * (maximum - minimum);
    resident.huntTargetLaneOffset = (Math.random() * 2 - 1) * config.huntingLaneOffset;
  }

  function updateHunting(village, delta) {
    const config = E.Config.temporaryProduction;
    village.residents.filter((resident) => resident.mission === "chasse").forEach((resident) => {
      if (!Number.isFinite(resident.workPosition)) resident.workPosition = villagePosition(village.ownerId);
      if (!Number.isFinite(resident.workLaneOffset)) resident.workLaneOffset = 0;
      if (!Number.isFinite(resident.huntTargetPosition) || !Number.isFinite(resident.huntTargetLaneOffset)) chooseHuntTarget(village, resident);

      const movementSpeed = (isBoosted(resident, "chasse") ? E.Config.movement.hunterSpeed : E.Config.movement.inhabitantSpeed) * donkeyMultiplier(resident, "movementBonus");
      const reachedPosition = moveWorker(resident, resident.huntTargetPosition, movementSpeed, delta);
      const lateralDistance = resident.huntTargetLaneOffset - resident.workLaneOffset;
      const lateralStep = config.huntingLateralSpeed * donkeyMultiplier(resident, "movementBonus") * delta;
      const reachedLane = Math.abs(lateralDistance) <= lateralStep;
      resident.workLaneOffset = reachedLane ? resident.huntTargetLaneOffset : resident.workLaneOffset + Math.sign(lateralDistance) * lateralStep;
      if (reachedPosition && reachedLane) chooseHuntTarget(village, resident);

      const equipment = E.Equipment.bonuses(resident);
      resident.workTimer += delta * (1 + equipment.productionSpeed);
      while (resident.workTimer >= config.huntingInterval) {
        resident.workTimer -= config.huntingInterval;
        const amount = isBoosted(resident, "chasse") ? config.huntingSpecialistAmount : config.huntingBaseAmount;
        village.resources.viande += amount * (1 + equipment.productionYield) * donkeyMultiplier(resident, "workBonus");
      }
    });
  }

  function updateProduction(state, delta) {
    Object.values(state.players).forEach((player) => {
      player.villages.filter((village) => !village.destroyed).forEach((village) => {
        updateWorkerTrips(village, delta);
        updateFishing(village, delta);
        E.Transport.updateFishingNets(village, delta);
        updateHunting(village, delta);
        village.slots.forEach((slot, slotIndex) => {
          if (slot.content?.category !== "livestock") return;
          const penalty = E.Animals?.harassment(state, village, slotIndex)?.penalty || 0;
          updateHerd(village, slot.content, delta * (1 - penalty));
        });
      });
    });
  }

  function update(state, delta) {
    updatePopulation(state, delta);
    updateProduction(state, delta);
  }

  E.Economy = {
    cropCount, animalCounts, dairyAnimalCount,
    isBoosted, workBonus, canSetProfession, setProfession, assignProfessionToAll,
    setNextResidentMission, setNextResidentProfession, saleQuote, sell, deployResident,
    update,
    updatePopulation,
    updateProduction,
    getAvailableResidents,
    getResident,
    availableResidentList,
    jobRequirementMet,
    canAssignJob,
    canAssignResidentJob,
    assignResidentJob,
    assignJob,
    assignAllAvailableResidents,
    unassignResidentJob, canBuyResident, buyResident,
    addResident,
    removeResident,
    unassignJob
  };
}());
