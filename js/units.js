(function () {
  "use strict";

  const E = window.Eredita;
  let nextUnitId = 1;

  function create(ownerId, lane, role, options = {}) {
    const animalType = ["chien", "sanglier"].includes(options.animalType || role) ? options.animalType || role : null;
    const stats = animalType ? E.Config.specialAnimals[animalType] : E.Config.units[role];
    if (!stats) return null;

    const stance = options.stance || "attack";
    const guardPosition = E.Config.combat.defensePositionByOwner[ownerId];
    const equipment = E.Equipment.bonuses(animalType ? null : options);
    const donkey = !animalType && Boolean(options.donkey);

    return {
      id: nextUnitId++,
      ownerId,
      role,
      profession: options.profession || role,
      tool: animalType ? null : options.tool || null,
      armor: animalType ? null : options.armor || null,
      donkey,
      animalType,
      animalId: animalType ? options.animalId || null : null,
      residentId: animalType ? null : options.residentId || null,
      stance,
      lane,
      originLane: lane,
      lanePosition: lane,
      position: stance === "defense"
        ? guardPosition
        : ownerId === "red" ? 0 : E.Config.movement.columnLength,
      hp: stats.hp + equipment.hp,
      maxHp: stats.hp + equipment.hp,
      damage: stats.damage + equipment.damage,
      speed: stats.speed * (1 + (donkey ? E.Config.specialAnimals.ane.movementBonus : 0)),
      attackCooldown: 0,
      retaliationCooldown: 0,
      visualAttackTimer: 0,
      visualAttackSequence: 0,
      visualHitTimer: 0,
      visualHitSequence: 0,
      waterOwner: null,
      waterTransport: null,
      transportHomeId: null,
      drowned: false,
      redirectTarget: null,
      redirectOrigin: null,
      waitingForRedirect: false
    };
  }

  E.Units = { create };
}());
