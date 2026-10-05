(function () {
  "use strict";

  const E = window.Eredita = window.Eredita || {};
  let THREE;
  let container;
  let renderer;
  let scene;
  let camera;
  let world;
  let terrainGroup;
  let unitGroup;
  let latestState;
  let structureSignature = "";
  let ready = false;
  let enabled = true;
  let onSelectVillage = null;
  let onFrame = null;
  let xrPreview = false;
  let orbit = { angle: -0.72, elevation: 0.88, distance: 18 };
  let pointer = null;
  let dragged = false;
  let lastUnitUpdate = 0;
  let loadError = null;
  const unitModels = new Map();
  const handledDeathEffects = new Set();

  const laneX = (lane) => (lane - 1.5) * 3;
  const colors = {
    montagne: 0x77766d,
    plaine: 0x708a49,
    littoral: 0x68845c,
    red: 0x9e4039,
    blue: 0x3f7298,
    stone: 0xc8b78f,
    roof: 0xa95736,
    wood: 0x70482b
  };

  function init(options = {}) {
    container = options.container || document.querySelector("#battlefield-3d");
    onSelectVillage = options.onSelectVillage || null;
    onFrame = options.onFrame || null;
    if (!container) return;
    import("./vendor/three.module.min.js").then((module) => {
      THREE = module;
      setup();
      ready = true;
      E.XR?.refreshAvailability();
      setMode(enabled);
      if (latestState) update(latestState, true);
    }).catch((error) => {
      loadError = String(error?.stack || error);
      enabled = false;
      container.innerHTML = '<p class="three-error">La vue 3D n’a pas pu être chargée. La vue 2D reste disponible.</p>';
      setMode(false);
      E.XR?.refreshAvailability();
      const button = document.querySelector("#toggle-board-view");
      if (button) button.disabled = true;
    });
  }

  function setup() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x172019);
    scene.fog = new THREE.Fog(0x172019, 19, 32);
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.xr.enabled = true;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Plateau Eredità en trois dimensions");
    container.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffedcc, 0x26362b, 2.1));
    const sun = new THREE.DirectionalLight(0xffe1aa, 2.8);
    sun.position.set(-8, 14, -8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    scene.add(sun);

    world = new THREE.Group();
    terrainGroup = new THREE.Group();
    unitGroup = new THREE.Group();
    world.add(terrainGroup, unitGroup);
    scene.add(world);
    addBoardBase();
    bindControls();
    new ResizeObserver(resize).observe(container);
    resize();
    renderer.setAnimationLoop(animate);
  }

  function material(color, roughness = 0.82, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  function mesh(geometry, color, options = {}) {
    const item = new THREE.Mesh(geometry, material(color, options.roughness, options.metalness));
    item.castShadow = options.castShadow !== false;
    item.receiveShadow = options.receiveShadow !== false;
    return item;
  }

  function addBoardBase() {
    const base = mesh(new THREE.BoxGeometry(13.3, 0.42, 10.7), 0x44372a, { castShadow: false });
    base.position.y = -0.31;
    world.add(base);
    const rim = mesh(new THREE.BoxGeometry(13.65, 0.16, 11.05), 0xb68a4d, { castShadow: false, metalness: 0.1 });
    rim.position.y = -0.48;
    world.add(rim);
  }

  function terrainTile(village) {
    const owner = village.ownerId;
    const z = owner === "red" ? -2.55 : 2.55;
    const group = new THREE.Group();
    group.position.set(laneX(village.lane), 0, z);
    group.userData = { playerId: owner, lane: village.lane };

    const tile = mesh(new THREE.BoxGeometry(2.82, 0.22, 4.85), colors[village.biome], { castShadow: false });
    tile.position.y = -0.08;
    group.add(tile);

    const border = mesh(new THREE.BoxGeometry(2.92, 0.08, 4.95), owner === "red" ? colors.red : colors.blue, { castShadow: false, metalness: 0.15 });
    border.position.y = -0.19;
    group.add(border);

    if (village.biome === "montagne") addMountains(group, village.lane);
    if (village.biome === "plaine") addPlainDetails(group, village.lane);
    if (village.biome === "littoral") addCoast(group, village);
    addSlots(group, village);
    addVillageAndBuildings(group, village);
    terrainGroup.add(group);
  }

  function seeded(lane, index) {
    const value = Math.sin((lane + 1) * 91.7 + index * 37.3) * 43758.5453;
    return value - Math.floor(value);
  }

  function addMountains(group, lane) {
    for (let index = 0; index < 5; index++) {
      const height = 0.45 + seeded(lane, index) * 0.5;
      const mountain = mesh(new THREE.ConeGeometry(0.25 + height * 0.15, height, 5), index % 2 ? 0x716f68 : 0x918d82);
      mountain.position.set(-1.02 + (index % 3) * 0.92, height / 2 + 0.04, -1.55 + Math.floor(index / 3) * 3.2);
      group.add(mountain);
    }
  }

  function addPlainDetails(group, lane) {
    for (let index = 0; index < 7; index++) {
      const shrub = mesh(new THREE.SphereGeometry(0.09 + seeded(lane, index) * 0.07, 6, 5), index % 2 ? 0x526b35 : 0x8c9b4f);
      shrub.position.set(-1.1 + seeded(lane + 2, index) * 2.2, 0.13, -2 + seeded(lane + 5, index) * 4);
      group.add(shrub);
    }
  }

  function addCoast(group, village) {
    const owner = village.ownerId;
    const waterZ = owner === "red" ? 1.46 : -1.46;
    const water = mesh(new THREE.BoxGeometry(2.78, 0.08, 1.82), 0x238eb0, { castShadow: false, roughness: 0.25, metalness: 0.1 });
    water.position.set(0, 0.08, waterZ);
    group.add(water);
    for (let index = 0; index < 5; index++) {
      const rock = mesh(new THREE.DodecahedronGeometry(0.08 + index * 0.012, 0), 0xcbbd9b);
      rock.position.set(-1 + index * 0.48, 0.17, waterZ + (index % 2 ? -0.47 : 0.39));
      group.add(rock);
    }
    const maritime = E.Transport.maritimeState(village);
    for (let index = 0; index < maritime.voilier; index++) {
      const boat = boatModel("voilier", owner);
      boat.position.set(-0.85 + index * 0.42, 0.11, waterZ + (index % 2 ? 0.34 : -0.28));
      group.add(boat);
    }
    for (let index = 0; index < maritime.barque; index++) {
      const boat = boatModel("barque", owner);
      boat.position.set(0.63 + (index % 2) * 0.38, 0.11, waterZ + (Math.floor(index / 2) ? 0.34 : -0.28));
      group.add(boat);
    }
    for (let index = 0; index < Math.min(3, maritime.filet); index++) {
      const net = mesh(new THREE.TorusGeometry(0.12 + index * 0.025, 0.012, 5, 12), 0xdce9dd, { castShadow: false });
      net.rotation.x = Math.PI / 2;
      net.position.set((index - 1) * 0.28, 0.15, waterZ + 0.2);
      group.add(net);
    }
  }

  function boatModel(type, owner) {
    const boat = new THREE.Group();
    boat.name = `transport-${type}`;
    const hull = mesh(new THREE.BoxGeometry(type === "voilier" ? 0.42 : 0.3, 0.1, type === "voilier" ? 0.68 : 0.48), owner === "red" ? 0x7a372c : 0x315a74);
    hull.position.y = 0.05;
    hull.rotation.x = 0.05;
    boat.add(hull);
    if (type === "voilier") {
      const mast = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6), colors.wood);
      mast.position.y = 0.34;
      const sail = mesh(new THREE.PlaneGeometry(0.34, 0.38), 0xf1e3bd, { castShadow: false });
      sail.material.side = THREE.DoubleSide;
      sail.position.set(0.18, 0.38, 0);
      sail.rotation.y = Math.PI / 2;
      boat.add(mast, sail);
    }
    return boat;
  }

  function addSlots(group, village) {
    const positions = village.slots.length === 2
      ? [[-0.48, 0], [0.48, 0]]
      : [[-0.55, -0.62], [0.55, -0.62], [-0.55, 0.5], [0.55, 0.5]];
    village.slots.forEach((slot, index) => {
      const [x, z] = positions[index];
      const marker = mesh(new THREE.CylinderGeometry(0.35, 0.39, 0.06, 16), slot.type === "animal" ? 0x735f3c : 0x566744, { castShadow: false });
      marker.position.set(x, 0.1, z);
      marker.userData.xrTarget = { kind: "slot", playerId: village.ownerId, lane: village.lane, slotIndex: index };
      group.add(marker);
      if (slot.content?.category === "crop") addCrop(group, slot.content.type, x, z);
      if (slot.content?.category === "livestock") addHerd(group, slot.content.type, slot.content.count, x, z);
    });
  }

  function addCrop(group, type, x, z) {
    const crop = new THREE.Group();
    const cropColor = { ble: 0xd8b94f, chataignier: 0x45612d, vignoble: 0x814a78 }[type] || 0x7c9b43;
    for (let index = 0; index < 7; index++) {
      const stem = mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.25, 5), cropColor);
      stem.position.set((index % 3 - 1) * 0.12, 0.16, (Math.floor(index / 3) - 1) * 0.12);
      crop.add(stem);
    }
    if (type === "chataignier") {
      crop.clear();
      const trunk = mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.3, 7), colors.wood);
      trunk.position.y = 0.2;
      const crown = mesh(new THREE.SphereGeometry(0.25, 8, 6), cropColor);
      crown.position.y = 0.45;
      crop.add(trunk, crown);
    }
    crop.position.set(x, 0.08, z);
    group.add(crop);
  }

  function addHerd(group, type, count, x, z) {
    const herd = new THREE.Group();
    const animalColor = { chevre: 0xe7dfc8, cochon: 0xc98d86, vache: 0x8b694f }[type] || 0xd9d0b8;
    const shown = Math.min(3, count);
    for (let index = 0; index < shown; index++) {
      const animal = new THREE.Group();
      const body = mesh(new THREE.SphereGeometry(0.11, 8, 6), animalColor);
      body.scale.set(1.35, 0.85, 0.8);
      body.position.y = 0.18;
      const head = mesh(new THREE.SphereGeometry(0.065, 7, 5), type === "vache" ? 0x493528 : animalColor);
      head.position.set(0.13, 0.21, 0);
      animal.add(body, head);
      animal.position.set((index - (shown - 1) / 2) * 0.18, 0.06, (index % 2) * 0.13 - 0.06);
      herd.add(animal);
    }
    herd.position.set(x, 0.08, z);
    group.add(herd);
  }

  function addVillageAndBuildings(group, village) {
    const outerZ = village.ownerId === "red" ? -1.82 : 1.82;
    const villageModel = buildingModel("village", village.level, village.ownerId);
    villageModel.position.set(-0.72, 0.12, outerZ);
    if (village.damageSmoke > 0) addStructureSmoke(villageModel, 0);
    tagSelectable(villageModel, village.ownerId, village.lane);
    villageModel.userData.xrTarget = { kind: "village", playerId: village.ownerId, lane: village.lane };
    group.add(villageModel);
    village.buildings.forEach((building, index) => {
      const model = buildingModel(building.type, building.level, village.ownerId);
      model.scale.setScalar(0.72);
      model.position.set(-0.03 + index * 0.52, 0.1, outerZ);
      if (village.damageSmoke > 0) addStructureSmoke(model, index + 1);
      tagSelectable(model, village.ownerId, village.lane);
      group.add(model);
    });
    if (village.destroyed) group.traverse((item) => {
      if (item.material?.color) item.material.color.multiplyScalar(0.32);
    });
  }

  function addStructureSmoke(model, seed) {
    for (let index = 0; index < 3; index++) {
      const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(0.09 + index * 0.025, 7, 5),
        new THREE.MeshStandardMaterial({ color: 0x777a73, transparent: true, opacity: 0.48, roughness: 1, depthWrite: false })
      );
      smoke.castShadow = false;
      smoke.receiveShadow = false;
      smoke.position.set((index - 1) * 0.07, 0.68 + index * 0.1, 0.02);
      smoke.userData.smoke = { baseX: smoke.position.x, baseY: smoke.position.y, phase: (seed * 0.23 + index * 0.31) % 1 };
      model.add(smoke);
    }
  }

  function tagSelectable(object, playerId, lane) {
    object.userData = { playerId, lane, selectable: true };
    object.traverse((child) => { child.userData.selectionRoot = object; });
  }

  function buildingModel(type, tier, owner) {
    const group = new THREE.Group();
    const scale = 0.72 + tier * 0.14;
    const stone = owner === "red" ? 0xd0b38d : 0xb8c6c8;
    const bodyWidth = type === "village" ? 0.55 + tier * 0.11 : 0.48 + tier * 0.08;
    const bodyHeight = 0.35 + tier * 0.16;
    const body = mesh(new THREE.BoxGeometry(bodyWidth, bodyHeight, 0.48 + tier * 0.05), stone);
    body.position.y = bodyHeight / 2;
    group.add(body);
    const roofColor = type === "boucherie" ? 0x8f3531 : type === "artisanat" ? 0x8d5a34 : colors.roof;
    const roof = mesh(new THREE.ConeGeometry(bodyWidth * 0.76, 0.25, 4), roofColor);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.86;
    roof.position.y = bodyHeight + 0.1;
    group.add(roof);
    const door = mesh(new THREE.BoxGeometry(0.13, 0.2, 0.025), colors.wood);
    door.position.set(0, 0.11, -0.255 - tier * 0.025);
    group.add(door);

    if (type === "village") {
      for (let index = 0; index < tier; index++) {
        const tower = mesh(new THREE.BoxGeometry(0.2, 0.34 + index * 0.07, 0.2), stone);
        tower.position.set(-bodyWidth / 2 + 0.11 + index * 0.2, bodyHeight + 0.08 + index * 0.035, 0.05);
        group.add(tower);
      }
    } else if (type === "bergerie") {
      const fence = mesh(new THREE.TorusGeometry(0.38 + tier * 0.04, 0.025, 5, 12, Math.PI), colors.wood);
      fence.rotation.x = Math.PI / 2;
      fence.position.set(0.25, 0.08, 0.05);
      group.add(fence);
    } else if (type === "artisanat") {
      const chimney = mesh(new THREE.BoxGeometry(0.11, 0.4 + tier * 0.06, 0.11), 0x776b5b);
      chimney.position.set(0.18, bodyHeight + 0.13, 0.08);
      group.add(chimney);
    } else if (type === "boucherie") {
      const awning = mesh(new THREE.BoxGeometry(bodyWidth * 0.8, 0.04, 0.2), 0xb84037);
      awning.rotation.x = -0.25;
      awning.position.set(0, bodyHeight * 0.62, -0.34);
      group.add(awning);
    }
    group.scale.setScalar(scale);
    return group;
  }

  function updateUnits(state) {
    const active = new Set();
    const deployedResidents = new Set();
    const deployedAnimals = new Set();
    state.units.forEach((unit) => {
      if (unit.hp <= 0) return;
      const key = `unit-${unit.id}`;
      const resident = state.players[unit.ownerId]?.villages[unit.originLane]?.residents.find((entry) => entry.id === unit.residentId);
      const appearance = resident || unit;
      const swimming = (unit.animalType || unit.role) === "sanglier" && Boolean(unit.waterOwner);
      const figure = unitModel(key, unit.ownerId, appearance, unit.waterTransport, swimming);
      markSelected(figure, Boolean(unit.residentId && unit.residentId === state.selectedResidentId && unit.ownerId === state.selectedVillage.playerId && unit.originLane === state.selectedVillage.lane));
      figure.position.set(laneX(unit.lanePosition), swimming ? -0.04 : 0.2, -4.35 + (unit.position / 100) * 8.7);
      figure.rotation.y = unit.ownerId === "red" ? 0 : Math.PI;
      syncUnitVisualState(figure, unit);
      if (unit.residentId) deployedResidents.add(`${unit.ownerId}:${unit.residentId}`);
      if (unit.animalId != null) deployedAnimals.add(`${unit.ownerId}:${unit.animalId}`);
      active.add(key);
    });
    Object.values(state.players).forEach((player) => player.villages.forEach((village) => {
      if (village.destroyed) return;
      let localIndex = 0;
      let fisherIndex = 0;
      const facing = player.id === "red" ? 1 : -1;
      village.residents.forEach((resident, index) => {
        if (resident.hp <= 0 || deployedResidents.has(`${player.id}:${resident.id}`) || resident.unitId) return;
        const key = `resident-${player.id}-${resident.id}`;
        const figure = unitModel(key, player.id, resident);
        markSelected(figure, resident.id === state.selectedResidentId && player.id === state.selectedVillage.playerId && village.lane === state.selectedVillage.lane);
        const isWorker = ["agriculture", "elevage", "chasse"].includes(resident.mission) && Number.isFinite(resident.workPosition);
        figure.scale.setScalar(isWorker ? 0.78 : 0.65);
        figure.rotation.y = facing === 1 ? 0 : Math.PI;
        if (isWorker) {
          const lateral = resident.mission === "chasse" ? (resident.workLaneOffset || 0) * 2.7 : (index % 2 ? 0.3 : -0.3);
          figure.position.set(laneX(village.lane) + lateral, 0.18, -4.35 + (resident.workPosition / 100) * 8.7);
        } else if (resident.mission === "peche" && village.biome === "littoral") {
          // Fishermen stand on dry shoreline; this never puts a resident in the water.
          const row = Math.floor(fisherIndex / 7);
          const column = fisherIndex++ % 7;
          figure.position.set(laneX(village.lane) - 1.08 + column * 0.36, 0.18, facing * (-2.55 + 0.36 - row * 0.34));
        } else {
          const row = Math.floor(localIndex / 7);
          const column = localIndex++ % 7;
          figure.position.set(laneX(village.lane) - 1.05 + column * 0.35, 0.18, facing * (-2.55 - 1.28 + row * 0.23));
        }
        active.add(key);
      });
      let animalIndex = 0;
      (village.animals || []).forEach((animal) => {
        if (animal.hp <= 0 || animal.unitId || deployedAnimals.has(`${player.id}:${animal.id}`) || animal.mission !== "disponible") return;
        const key = `animal-${player.id}-${animal.id}`;
        const figure = unitModel(key, player.id, { animalType: animal.type });
        const row = Math.floor(animalIndex / 6);
        const column = animalIndex++ % 6;
        figure.scale.setScalar(0.8);
        figure.rotation.y = facing === 1 ? 0 : Math.PI;
        figure.position.set(laneX(village.lane) - 1 + column * 0.38, 0.18, facing * (-2.55 - 0.67 + row * 0.31));
        active.add(key);
      });
    }));
    syncDeathModels(state, active);
    unitModels.forEach((figure, key) => {
      if (active.has(key)) return;
      if (figure.userData.dying) return;
      unitModels.delete(key);
      figure.removeFromParent();
      disposeObject(figure);
    });
  }

  function effectClock() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function syncUnitVisualState(figure, unit) {
    const now = effectClock();
    const attackSequence = unit.visualAttackSequence || 0;
    const hitSequence = unit.visualHitSequence || 0;
    if ((unit.visualAttackTimer || 0) > 0 && figure.userData.attackSequence !== attackSequence) {
      figure.userData.attackSequence = attackSequence;
      figure.userData.attackStartedAt = now;
    }
    if ((unit.visualHitTimer || 0) > 0 && figure.userData.hitSequence !== hitSequence) {
      figure.userData.hitSequence = hitSequence;
      figure.userData.hitStartedAt = now;
    }
  }

  function syncDeathModels(state, active) {
    (state.unitDeathEffects || []).forEach((event) => {
      if (handledDeathEffects.has(event.id)) return;
      handledDeathEffects.add(event.id);
      const liveKey = `unit-${event.unitId}`;
      const deathKey = `death-${event.id}`;
      let figure = unitModels.get(liveKey);
      if (figure) {
        unitModels.delete(liveKey);
        unitModels.set(deathKey, figure);
      } else {
        const swimming = (event.animalType || event.role) === "sanglier" && Boolean(event.waterOwner);
        figure = unitModel(deathKey, event.ownerId, event, event.waterTransport, swimming);
      }
      const swimming = (event.animalType || event.role) === "sanglier" && Boolean(event.waterOwner);
      figure.position.set(laneX(event.lanePosition), swimming ? -0.04 : 0.2, -4.35 + (event.position / 100) * 8.7);
      figure.rotation.set(0, event.ownerId === "red" ? 0 : Math.PI, 0);
      figure.userData.dying = true;
      figure.userData.deathStartedAt = effectClock();
      figure.userData.deathBaseY = figure.position.y;
      figure.userData.deathSide = event.id % 2 ? 1 : -1;
      active.add(deathKey);
    });
    if (handledDeathEffects.size > 96) {
      const retained = new Set((state.unitDeathEffects || []).map((event) => event.id));
      [...handledDeathEffects].forEach((id) => { if (!retained.has(id)) handledDeathEffects.delete(id); });
    }
  }

  function tintFigure(figure, amount) {
    figure.traverse((item) => {
      const materials = Array.isArray(item.material) ? item.material : item.material ? [item.material] : [];
      materials.forEach((entry) => {
        if (!entry.color) return;
        if (entry.userData.visualBaseColor === undefined) entry.userData.visualBaseColor = entry.color.getHex();
        entry.color.setHex(entry.userData.visualBaseColor).lerp(new THREE.Color(0xff1717), amount);
      });
    });
  }

  function animateUnitEffects(now = effectClock()) {
    const effects = E.Config.visualEffects;
    unitModels.forEach((figure, key) => {
      if (figure.userData.dying) {
        const progress = Math.min(1, (now - figure.userData.deathStartedAt) / (effects.unitDeathDuration * 1000));
        const fall = Math.min(1, progress / 0.55);
        const easedFall = 1 - Math.pow(1 - fall, 3);
        figure.rotation.x = 0;
        figure.rotation.z = figure.userData.deathSide * effects.unitDeathFallAngle * easedFall;
        figure.position.y = figure.userData.deathBaseY - 0.09 * easedFall;
        tintFigure(figure, effects.unitDeathRedMix);
        if (progress >= 1) {
          unitModels.delete(key);
          figure.removeFromParent();
          disposeObject(figure);
        }
        return;
      }

      const attackProgress = figure.userData.attackStartedAt === undefined ? 1 :
        (now - figure.userData.attackStartedAt) / (effects.unitAttackDuration * 1000);
      figure.rotation.x = attackProgress >= 0 && attackProgress < 1 ? Math.sin(attackProgress * Math.PI) * effects.unitAttackTilt : 0;
      figure.rotation.z = 0;

      const hitProgress = figure.userData.hitStartedAt === undefined ? 1 :
        (now - figure.userData.hitStartedAt) / (effects.unitHitFlashDuration * 1000);
      if (hitProgress >= 0 && hitProgress < 1) {
        const flash = Math.sin(hitProgress * Math.PI * 5) > 0 ? 0.82 : 0.12;
        tintFigure(figure, flash);
      } else tintFigure(figure, 0);
    });
  }

  function unitModel(key, owner, appearance, waterTransport = null, swimming = false) {
    let figure = unitModels.get(key);
    const animalType = appearance.animalType || (["chien", "sanglier"].includes(appearance.role) ? appearance.role : null);
    const profession = appearance.profession || (E.Config.professions[appearance.role] ? appearance.role : "habitant");
    const tool = appearance.tool || null;
    const armor = appearance.armor || null;
    const donkey = !animalType && Boolean(appearance.donkey);
    if (animalType === "sanglier") waterTransport = null;
    const visualSignature = `${owner}:${animalType || profession}:${tool || "none"}:${armor || "none"}:${waterTransport || "land"}:${donkey}:${swimming}`;
    if (figure && figure.userData.visualSignature === visualSignature) return figure;
    if (figure) {
      figure.removeFromParent();
      disposeObject(figure);
    }
    figure = animalType ? animalModel(owner, animalType, waterTransport, swimming) : personModel(owner, profession, tool, armor, waterTransport, donkey);
    figure.userData = { visualSignature, profession: animalType ? null : profession, animalType, tool, armor, waterTransport, donkey, swimming };
    unitModels.set(key, figure);
    unitGroup.add(figure);
    return figure;
  }

  function markSelected(figure, selected) {
    let halo = figure.getObjectByName("selection-halo");
    if (!halo && selected) {
      halo = new THREE.Mesh(
        new THREE.RingGeometry(0.26, 0.35, 24),
        new THREE.MeshBasicMaterial({ color: 0xffdf3f, side: THREE.DoubleSide, depthTest: false })
      );
      halo.name = "selection-halo";
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.025;
      halo.renderOrder = 20;
      figure.add(halo);
    }
    if (halo) halo.visible = selected;
  }

  function animalModel(owner, type, waterTransport = null, swimming = false) {
    const group = new THREE.Group();
    group.name = `animal-${type}`;
    const boar = type === "sanglier";
    const donkey = type === "ane";
    const coat = boar ? 0x574134 : donkey ? 0x969084 : 0xb68a59;
    const dark = boar ? 0x322820 : donkey ? 0x554f49 : 0x4b3325;
    const teamColor = owner === "red" ? colors.red : colors.blue;
    const part = (name, geometry, color, x, y, z) => {
      const item = mesh(geometry, color);
      item.name = `${type}-${name}`;
      item.position.set(x, y, z);
      group.add(item);
      return item;
    };
    const box = (name, size, color, x, y, z) => part(name, new THREE.BoxGeometry(...size), color, x, y, z);
    const body = part("corps", new THREE.SphereGeometry(1, 9, 7), coat, 0, boar ? 0.2 : 0.24, 0);
    body.scale.set(boar ? 0.15 : 0.09, boar ? 0.13 : 0.1, boar ? 0.24 : 0.2);
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        box(`patte-${side}-${end}`, [0.045, boar ? 0.12 : 0.2, 0.052], dark, side * (boar ? 0.1 : 0.065), boar ? 0.085 : 0.115, end * 0.13);
      }
    }
    const neck = box("cou", [boar ? 0.14 : 0.1, donkey ? 0.2 : 0.12, 0.12], coat, 0, donkey ? 0.36 : 0.26, 0.17);
    neck.rotation.x = donkey ? -0.28 : -0.12;
    const headY = donkey ? 0.46 : boar ? 0.255 : 0.345;
    const head = part("tete", new THREE.SphereGeometry(1, 8, 6), coat, 0, headY, 0.225);
    head.scale.set(boar ? 0.105 : 0.075, donkey ? 0.1 : 0.08, boar ? 0.13 : 0.1);
    box("museau", [boar ? 0.115 : 0.08, boar ? 0.085 : 0.06, 0.105], donkey ? 0xc8c1b4 : dark, 0, headY - 0.026, 0.32);
    box("truffe", [boar ? 0.087 : 0.056, 0.042, 0.018], 0x292421, 0, headY - 0.019, 0.376);
    for (const side of [-1, 1]) {
      const earHeight = donkey ? 0.22 : boar ? 0.075 : 0.1;
      const ear = part(`oreille-${side}`, new THREE.ConeGeometry(donkey ? 0.029 : 0.04, earHeight, 4), coat, side * 0.053, headY + 0.07 + earHeight / 2, 0.2);
      ear.rotation.z = -side * (donkey ? 0.13 : 0.35);
      box(`oeil-${side}`, [0.011, 0.024, 0.025], 0x191713, side * (boar ? 0.095 : 0.069), headY + 0.015, 0.274);
    }
    const tail = box("queue", [0.025, boar ? 0.1 : 0.16, 0.025], dark, 0, donkey ? 0.16 : 0.29, -0.245);
    tail.rotation.x = donkey ? 0.25 : -0.75;
    if (boar) {
      box("soies", [0.055, 0.048, 0.31], dark, 0, 0.328, -0.02);
      for (const side of [-1, 1]) {
        const tusk = part(`defense-${side}`, new THREE.ConeGeometry(0.025, 0.11, 6), 0xe8dcb9, side * 0.088, 0.263, 0.326);
        tusk.rotation.z = -side * 0.38;
      }
      box("marque-equipe", [0.16, 0.026, 0.14], teamColor, 0, 0.336, 0.04);
    } else if (donkey) {
      box("criniere", [0.035, 0.17, 0.045], dark, 0, 0.38, 0.104);
      box("couverture", [0.2, 0.035, 0.23], teamColor, 0, 0.34, -0.015);
      for (const side of [-1, 1]) {
        box(`panier-${side}`, [0.095, 0.12, 0.15], 0xb38b52, side * 0.12, 0.24, -0.025);
        box(`panier-bord-${side}`, [0.105, 0.023, 0.16], 0xd4b67d, side * 0.12, 0.302, -0.025);
      }
    } else {
      box("poitrail", [0.075, 0.09, 0.027], 0xe4d1a9, 0, 0.26, 0.235);
      box("collier", [0.13, 0.035, 0.13], teamColor, 0, 0.3, 0.183);
    }
    if (waterTransport && !boar) {
      const boat = boatModel(waterTransport, owner);
      boat.position.set(0, -0.025, 0.065);
      boat.scale.setScalar(1.15);
      group.add(boat);
    }
    if (swimming && boar) {
      const wake = mesh(new THREE.TorusGeometry(0.245, 0.012, 5, 18), 0xc9e8e5, { castShadow: false });
      wake.name = "sillage-nage";
      wake.rotation.x = Math.PI / 2;
      wake.scale.set(0.85, 1.4, 1);
      wake.position.y = 0.16;
      group.add(wake);
    }
    return group;
  }

  function personModel(owner, profession, tool = null, armor = null, waterTransport = null, donkey = false) {
    const group = new THREE.Group();
    const teamColor = owner === "red" ? colors.red : colors.blue;
    const clothColor = {
      habitant: 0xb99570, agriculteur: 0xd1aa42, berger: 0x5f7952,
      pecheur: 0x4d8a9b, chasseur: 0x3f6439, guerrier: 0x596479, ravageur: 0x61443e
    }[profession] || 0xb99570;
    const toolColor = { bois: 0xb98542, bronze: 0xc28b43, fer: 0xd2e0e4 }[tool] || 0x816347;
    const metal = tool === "bronze" || tool === "fer" ? 0.65 : 0;
    const part = (name, geometry, color, x, y, z, options = {}) => {
      const item = mesh(geometry, color, options);
      item.name = name;
      item.position.set(x, y, z);
      group.add(item);
      return item;
    };
    const box = (name, size, color, x, y, z, options) => part(name, new THREE.BoxGeometry(...size), color, x, y, z, options);
    const cylinder = (name, radii, height, color, x, y, z, options) => part(name, new THREE.CylinderGeometry(...radii, height, 7), color, x, y, z, options);
    const implement = (name, size, x, y, z) => box(name, size, toolColor, x, y, z, { metalness: metal, roughness: metal ? 0.38 : 0.85 });

    cylinder("tunique", [0.085, 0.12], 0.26, clothColor, 0, 0.26, 0);
    part("visage", new THREE.SphereGeometry(0.075, 8, 6), 0xd5aa7a, 0, 0.455, 0.008);
    box("bottes", [0.16, 0.09, 0.095], 0x493829, 0, 0.07, 0.015);
    box("bras-gauche", [0.048, 0.18, 0.065], clothColor, -0.112, 0.28, 0);
    box("bras-droit", [0.048, 0.18, 0.065], clothColor, 0.112, 0.28, 0);
    box("ceinture", [0.2, 0.033, 0.16], 0x4d3929, 0, 0.185, 0);

    if (profession === "agriculteur") {
      cylinder("chapeau-paille-bord", [0.16, 0.16], 0.025, 0xe4c36e, 0, 0.506, 0);
      cylinder("chapeau-paille", [0.074, 0.098], 0.075, 0xc69f4d, 0, 0.546, 0);
      box("tablier", [0.13, 0.2, 0.025], 0x8c6f36, 0, 0.22, 0.1);
      implement("fourche-manche", [0.024, 0.43, 0.024], 0.16, 0.3, 0.03);
      implement("fourche-traverse", [0.13, 0.025, 0.024], 0.16, 0.45, 0.03);
      [-0.05, 0, 0.05].forEach((offset) => implement("fourche-dent", [0.016, 0.105, 0.024], 0.16 + offset, 0.49, 0.03));
    } else if (profession === "berger") {
      box("cape-laine", [0.24, 0.27, 0.06], 0xd9d0ac, 0, 0.265, -0.08);
      cylinder("bonnet-berger", [0.065, 0.091], 0.095, 0x54704c, 0, 0.522, 0);
      implement("houlette-manche", [0.026, 0.44, 0.026], 0.165, 0.3, 0);
      part("houlette-courbe", new THREE.TorusGeometry(0.056, 0.014, 5, 9, Math.PI * 1.4), toolColor, 0.207, 0.52, 0, { metalness: metal });
      cylinder("seau-lait", [0.058, 0.045], 0.105, 0x9d9580, -0.17, 0.2, 0.045);
    } else if (profession === "pecheur") {
      cylinder("bob-bord", [0.12, 0.12], 0.028, 0xdbd6ba, 0, 0.51, 0);
      cylinder("bob", [0.073, 0.09], 0.058, 0x538c9e, 0, 0.546, 0);
      const rod = implement("canne-peche", [0.018, 0.59, 0.018], 0.15, 0.44, 0.1);
      rod.rotation.x = 0.52;
      box("fil-peche", [0.005, 0.24, 0.005], 0xe1dccb, 0.15, 0.576, 0.246);
      cylinder("panier-poisson", [0.067, 0.06], 0.115, 0xac8652, -0.17, 0.2, 0.015);
    } else if (profession === "chasseur") {
      part("capuche", new THREE.ConeGeometry(0.105, 0.17, 7), 0x35552e, 0, 0.53, -0.018);
      box("cape-chasseur", [0.18, 0.24, 0.045], 0x35552e, 0, 0.29, -0.086);
      const bow = part("arc", new THREE.TorusGeometry(0.145, 0.018, 5, 11, Math.PI), toolColor, 0.17, 0.3, 0.02, { metalness: metal });
      bow.rotation.z = -Math.PI / 2;
      box("corde-arc", [0.007, 0.29, 0.007], 0xe3d5af, 0.17, 0.3, 0.02);
      cylinder("carquois", [0.038, 0.038], 0.23, 0x755234, -0.08, 0.32, -0.125);
      box("fleches", [0.035, 0.13, 0.015], 0xe4d4a3, -0.08, 0.476, -0.125);
    } else if (profession === "guerrier") {
      cylinder("casque-guerrier", [0.068, 0.092], 0.08, 0x686653, 0, 0.52, 0);
      box("crete-guerrier", [0.035, 0.09, 0.13], teamColor, 0, 0.598, -0.01);
      implement("epee", [0.036, 0.31, 0.018], 0.16, 0.39, 0.055);
      implement("garde-epee", [0.105, 0.024, 0.028], 0.16, 0.255, 0.055);
      box("bouclier", [0.14, 0.205, 0.038], toolColor, -0.16, 0.28, 0.09, { metalness: metal });
      box("embleme-bouclier", [0.035, 0.17, 0.008], teamColor, -0.16, 0.28, 0.113);
    } else if (profession === "ravageur") {
      cylinder("bandeau-ravageur", [0.077, 0.083], 0.039, 0x923e32, 0, 0.486, 0);
      box("pan-bandeau", [0.06, 0.14, 0.023], 0x923e32, 0.048, 0.4, -0.082);
      box("epaules-fourrure", [0.255, 0.068, 0.15], 0x463b32, 0, 0.375, 0);
      implement("hache-manche", [0.031, 0.44, 0.031], 0.17, 0.31, 0.045);
      const axe = implement("hache-lame", [0.165, 0.12, 0.037], 0.215, 0.48, 0.045);
      axe.rotation.z = -0.12;
    } else {
      cylinder("cheveux", [0.059, 0.078], 0.049, 0x604331, 0, 0.505, -0.008);
      box("sac-habitant", [0.1, 0.14, 0.065], 0x866242, -0.12, 0.22, -0.01);
      if (tool) {
        implement("outil-manche", [0.027, 0.29, 0.027], 0.16, 0.29, 0.04);
        implement("outil-tete", [0.125, 0.07, 0.055], 0.16, 0.44, 0.04);
      }
    }

    if (armor) {
      const armorColor = { cuir: 0x87532f, maille: 0x919ca0, fer: 0xcbd8df }[armor] || 0x87532f;
      const armorMetal = armor === "cuir" ? 0 : armor === "maille" ? 0.45 : 0.75;
      box(`armure-${armor}`, [0.18, 0.19, 0.19], armorColor, 0, 0.29, 0, { metalness: armorMetal, roughness: armor === "cuir" ? 0.95 : 0.37 });
      if (armor === "cuir") {
        box("sangle-cuir", [0.026, 0.2, 0.016], 0xd1a05d, 0, 0.29, 0.105);
      } else if (armor === "maille") {
        for (let row = 0; row < 3; row++) {
          box("rang-maille", [0.177, 0.015, 0.013], 0x49585c, 0, 0.235 + row * 0.053, 0.103);
        }
      } else {
        box("epauliere-fer-gauche", [0.08, 0.065, 0.13], armorColor, -0.12, 0.37, 0, { metalness: 0.75 });
        box("epauliere-fer-droite", [0.08, 0.065, 0.13], armorColor, 0.12, 0.37, 0, { metalness: 0.75 });
        box("casque-fer-nuque", [0.13, 0.11, 0.055], armorColor, 0, 0.46, -0.05, { metalness: 0.75 });
      }
    }
    // The owner's scarf stays visible even with plate armor and profession clothing.
    box("echarpe-equipe", [0.21, 0.035, 0.14], teamColor, 0, 0.391, 0.01);
    if (donkey) {
      const companion = animalModel(owner, "ane");
      companion.position.set(-0.31, 0, -0.07);
      companion.scale.setScalar(0.85);
      group.add(companion);
    }
    if (waterTransport) {
      const boat = boatModel(waterTransport, owner);
      boat.scale.setScalar(waterTransport === "voilier" ? 1.15 : 1);
      if (donkey) {
        boat.scale.x *= 2.6;
        boat.position.x = -0.09;
      }
      boat.position.y = -0.03;
      group.add(boat);
    }
    return group;
  }

  function signature(state) {
    return Object.values(state.players).flatMap((player) => player.villages.map((village) => [
      village.id, village.biome, village.level, village.destroyed, village.damageSmoke > 0,
      village.buildings.map((building) => `${building.type}${building.level}`).join(","),
      `${village.maritime?.barque || 0}:${village.maritime?.voilier || 0}:${village.maritime?.filet || 0}`,
      village.slots.map((slot) => slot.content ? `${slot.content.category}:${slot.content.type}:${slot.content.count || 1}` : "-").join(",")
    ].join("/"))).join("|");
  }

  function update(state, force = false) {
    latestState = state;
    if (!ready || !state) return;
    const nextSignature = signature(state);
    let visualsChanged = false;
    if (force || nextSignature !== structureSignature) {
      structureSignature = nextSignature;
      clearGroup(terrainGroup);
      Object.values(state.players).forEach((player) => player.villages.forEach(terrainTile));
      visualsChanged = true;
    }
    const now = performance.now();
    if (force || now - lastUnitUpdate > 70) {
      lastUnitUpdate = now;
      updateUnits(state);
      visualsChanged = true;
    }
    if (xrPreview && visualsChanged) setXRPreview(true, true);
  }

  function clearGroup(group) {
    while (group.children.length) {
      const child = group.children.pop();
      disposeObject(child);
    }
  }

  function disposeObject(object) {
    object.traverse((item) => {
      item.geometry?.dispose?.();
      if (Array.isArray(item.material)) item.material.forEach((entry) => entry.dispose?.());
      else item.material?.dispose?.();
    });
  }

  function bindControls() {
    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      dragged = false;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
      orbit.angle -= dx * 0.007;
      orbit.elevation = Math.max(0.35, Math.min(1.25, orbit.elevation + dy * 0.005));
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    });
    canvas.addEventListener("pointerup", (event) => {
      if (!dragged) selectAt(event.clientX, event.clientY);
      pointer = null;
    });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      orbit.distance = Math.max(11, Math.min(27, orbit.distance + event.deltaY * 0.012));
    }, { passive: false });
  }

  function selectAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(terrainGroup.children, true).find((entry) => {
      let object = entry.object;
      while (object) {
        if (object.userData?.selectable || object.userData?.playerId) return true;
        object = object.parent;
      }
      return false;
    });
    if (!hit) return;
    let object = hit.object.userData.selectionRoot || hit.object;
    while (object && object.userData?.playerId === undefined) object = object.parent;
    if (object?.userData?.playerId !== undefined) onSelectVillage?.(object.userData.playerId, object.userData.lane);
  }

  function updateCamera() {
    const horizontal = Math.cos(orbit.elevation) * orbit.distance;
    camera.position.set(Math.sin(orbit.angle) * horizontal, Math.sin(orbit.elevation) * orbit.distance, Math.cos(orbit.angle) * horizontal);
    camera.lookAt(0, 0, 0);
  }

  function resize() {
    if (!renderer || renderer.xr.isPresenting || !container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  }

  function animate(timestamp, xrFrame) {
    onFrame?.(timestamp);
    E.XR?.update(timestamp, xrFrame);
    if ((!enabled && !E.XR?.active) || !renderer) return;
    const time = performance.now() / 1200;
    terrainGroup?.traverse((item) => {
      const smoke = item.userData?.smoke;
      if (!smoke) return;
      const progress = (time + smoke.phase) % 1;
      item.position.y = smoke.baseY + progress * 0.48;
      item.position.x = smoke.baseX + Math.sin(time * 3 + smoke.phase * 9) * 0.035;
      item.scale.setScalar(0.72 + progress * 0.8);
      item.material.opacity = 0.5 * (1 - progress);
    });
    animateUnitEffects();
    if (!E.XR?.active) updateCamera();
    renderer.render(scene, camera);
  }

  function setMode(useThree) {
    enabled = Boolean(useThree && ready);
    const battlefield = document.querySelector("#battlefield");
    battlefield?.classList.toggle("three-mode", enabled);
    if (container) container.hidden = !enabled;
    const button = document.querySelector("#toggle-board-view");
    if (button) {
      button.textContent = enabled ? "Vue 2D" : ready ? "Vue 3D" : "Chargement 3D…";
      button.setAttribute("aria-pressed", String(enabled));
    }
    if (enabled) resize();
  }

  function toggle() {
    if (ready) setMode(!enabled);
  }

  function setXRPreview(value, force = false) {
    if (xrPreview === value && !force) return;
    xrPreview = value;
    world?.traverse((item) => {
      const materials = Array.isArray(item.material) ? item.material : [item.material];
      materials.filter(Boolean).forEach((entry) => {
        if (value && !entry.userData.xrOriginal) {
          entry.userData.xrOriginal = { transparent: entry.transparent, opacity: entry.opacity, depthWrite: entry.depthWrite };
          entry.transparent = true;
          entry.opacity *= E.Config.xr.previewOpacity;
          entry.depthWrite = false;
          entry.needsUpdate = true;
        } else if (!value && entry.userData.xrOriginal) {
          Object.assign(entry, entry.userData.xrOriginal);
          delete entry.userData.xrOriginal;
          entry.needsUpdate = true;
        }
      });
    });
  }

  E.Board3D = { init, update, toggle, setMode, setXRPreview, resize,
    getXRContext: () => ready ? { THREE, renderer, scene, camera, world, terrainGroup } : null,
    get ready() { return ready; }, get enabled() { return enabled; }, get error() { return loadError; } };
}());
