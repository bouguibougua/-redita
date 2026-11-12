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
  E.Board = { createState, getFormat, combatZ, combatPosition, widthScale, slotHitbox, idlePosition };

}());
