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

  function createPlayer(id, name) {
    const draw = E.Biomes.createInitialDraw();
    const player = {
      id,
      name,
      gold: E.Config.startingGold,
      selectedDeck: 0,
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
        residents: Array.from(
          { length: E.Config.startingPopulation },
          (_, index) => createResident(villageId, index + 1)
        ),
        jobs: { agriculture: 0, elevage: 0, peche: 0, chasse: 0 },
        jobTimers: { agriculture: 0, peche: 0 },
        maritime: { barque: 0, voilier: 0, filet: 0, filetTimer: 0 },
        resources: emptyResources(),
        buildings: [],
        damageSmoke: 0,
        destroyed: false
      };
    });
    return player;
  }

  function createState() {
    return {
      phase: "setup",
      paused: false,
      elapsed: 0,
      overtimeAccumulator: 0,
      players: {
        red: createPlayer("red", "Joueur Rouge"),
        blue: createPlayer("blue", "Joueur Bleu")
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

  E.Board = { createState };
}());
