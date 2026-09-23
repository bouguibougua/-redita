(function () {
  "use strict";

  const E = window.Eredita;
  const enemyId = (ownerId) => ownerId === "red" ? "blue" : "red";
  const villageAt = (state, playerId, lane) => state.players[playerId]?.villages?.[lane];
  const definition = (type) => Object.hasOwn(E.Config.specialAnimals, type) ? E.Config.specialAnimals[type] : null;
  const isAnimal = (unit) => ["chien", "sanglier"].includes(unit.animalType || unit.role);
  const fieldPosition = (village) => E.Config.temporaryProduction.agricultureFieldPositionByOwner[village.ownerId];

  function inactiveReason(state, village) {
    if (!village) return "Village introuvable";
    if (state.phase !== "running") return "Partie inactive";
    if (state.paused) return "Partie en pause";
    if (village.destroyed) return "Village détruit";
    return null;
  }

  function purchaseQuote(state, playerId, lane, type, residentId) {
    const item = definition(type);
    const village = villageAt(state, playerId, lane);
    if (!item || !village) return null;
    const resident = village.residents.find((entry) => entry.id === residentId);
    let reason = inactiveReason(state, village);
    if (!reason && E.Transport.buildingLevel(village, "bergerie") < item.requiredTier) reason = `Bergerie T${item.requiredTier} requise`;
    if (!reason && type === "ane") {
      if (!resident) reason = "Sélectionnez un habitant du village";
      else if (resident.unitId || ["attaque", "defense"].includes(resident.mission)) reason = "Habitant engagé au combat";
      else if (resident.donkey) reason = "Cet habitant possède déjà un âne";
    }
    if (!reason && state.players[playerId].gold < item.gold) reason = "Or insuffisant";
    return { ...item, type, residentId, allowed: !reason, reason: reason || "Disponible" };
  }

  function buy(state, playerId, lane, type, residentId) {
    const quote = purchaseQuote(state, playerId, lane, type, residentId);
    if (!quote?.allowed) return false;
    const village = villageAt(state, playerId, lane);
    let animal = null;
    if (type === "ane") village.residents.find((entry) => entry.id === residentId).donkey = true;
    else {
      village.animals ||= [];
      village.nextAnimalNumber ||= 1;
      animal = { id: `${village.id}-animal-${village.nextAnimalNumber++}`, type, mission: "disponible", unitId: null };
      village.animals.push(animal);
    }
    state.players[playerId].gold -= quote.gold;
    return { ...quote, animal };
  }

  function livingHerds(village) {
    if (!village || village.destroyed) return [];
    return village.slots.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot.content?.category === "livestock" && slot.content.hp > 0 && slot.content.count > 0);
  }

  function orderQuote(state, playerId, lane, animalId, mission, slotIndex) {
    const village = villageAt(state, playerId, lane);
    const animal = village?.animals?.find((entry) => entry.id === animalId);
    let reason = inactiveReason(state, village);
    if (!reason && !animal) reason = "Animal introuvable dans ce village";
    if (!reason && (animal.unitId || animal.mission !== "disponible")) reason = "Animal déjà engagé";
    const missions = animal?.type === "chien" ? ["attaque", "defense", "garde", "perturber"] : ["attaque"];
    if (!reason && !missions.includes(mission)) reason = "Mission incompatible";
    if (!reason && mission === "garde" && !livingHerds(village).some((herd) => herd.index === slotIndex)) reason = "Enclos allié vivant requis";
    if (!reason && mission === "perturber" && !livingHerds(villageAt(state, enemyId(playerId), lane)).length) reason = "Aucun élevage ennemi sur cette ligne";
    return { allowed: !reason, reason: reason || "Disponible" };
  }

  function targetHerd(state, unit, village) {
    const herds = livingHerds(village);
    const target = unit.targetVillageId === village?.id && herds.find((herd) => herd.index === unit.targetSlotIndex);
    const next = target || herds[0];
    unit.targetVillageId = next ? village.id : null;
    unit.targetSlotIndex = next ? next.index : null;
    return next || null;
  }

  function deploy(state, playerId, lane, animalId, mission, slotIndex) {
    if (!orderQuote(state, playerId, lane, animalId, mission, slotIndex).allowed) return false;
    const village = villageAt(state, playerId, lane);
    const animal = village.animals.find((entry) => entry.id === animalId);
    const unit = E.Units.create(playerId, lane, animal.type, {
      animalType: animal.type, animalId: animal.id,
      stance: ["defense", "garde"].includes(mission) ? "defense" : "attack"
    });
    if (!unit) return false;
    unit.animalMission = mission;
    if (mission === "garde") {
      unit.targetVillageId = village.id;
      unit.targetSlotIndex = slotIndex;
      unit.position = fieldPosition(village);
    } else if (mission === "perturber") targetHerd(state, unit, villageAt(state, enemyId(playerId), lane));
    animal.mission = mission;
    animal.unitId = unit.id;
    state.units.push(unit);
    return unit;
  }

  function slaughter(state, playerId, lane, animalId) {
    const village = villageAt(state, playerId, lane);
    const animal = village?.animals?.find((entry) => entry.id === animalId);
    if (inactiveReason(state, village) || !animal || animal.type !== "sanglier" || animal.unitId || animal.mission !== "disponible") return false;
    village.animals = village.animals.filter((entry) => entry !== animal);
    const meat = definition("sanglier").meatAtDeath;
    village.resources.viande += meat;
    return { animalId, meat };
  }

  function harassment(state, village, slotIndex) {
    const content = village?.slots[slotIndex]?.content;
    if (!village || village.destroyed || content?.category !== "livestock" || content.hp <= 0 || content.count <= 0) return { stacks: 0, penalty: 0 };
    const dogs = state.units.filter((unit) => (unit.animalType || unit.role) === "chien" && unit.animalMission === "perturber" && unit.hp > 0
      && unit.ownerId !== village.ownerId && unit.targetVillageId === village.id && unit.targetSlotIndex === slotIndex
      && Math.abs(unit.lanePosition - village.lane) < 0.12 && Math.abs(unit.position - fieldPosition(village)) <= E.Config.combat.attackRange);
    const dog = definition("chien");
    const stacks = Math.min(dog.maxStacks, dogs.length);
    return { stacks, penalty: stacks * (content.type === "chevre" ? dog.goatPenalty : dog.harassmentPenalty) };
  }

  function onUnitDeath(state, unit) {
    if (!isAnimal(unit) || unit.animalDeathHandled) return;
    unit.animalDeathHandled = true;
    const village = villageAt(state, unit.ownerId, unit.originLane);
    if (!village) return;
    village.animals = (village.animals || []).filter((animal) => animal.id !== unit.animalId && animal.unitId !== unit.id);
    if ((unit.animalType || unit.role) === "sanglier") village.resources.viande += definition("sanglier").meatAtDeath;
  }

  function onVillageDestroyed(village) {
    (village.animals || []).forEach((animal) => {
      if (!animal.unitId && animal.type === "sanglier") village.resources.viande += definition("sanglier").meatAtDeath;
    });
    village.animals = (village.animals || []).filter((animal) => animal.unitId);
  }

  E.Animals = { purchaseQuote, buy, orderQuote, deploy, slaughter, harassment, targetHerd, fieldPosition, isAnimal, onUnitDeath, onVillageDestroyed };
}());
