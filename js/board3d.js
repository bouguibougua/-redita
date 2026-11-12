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
  let orbit = { angle: -Math.PI / 2, elevation: 0.88, distance: 18 };
  let cameraFitKey = "", cameraFitDistance = 18;
  let pointer = null;
  let dragged = false;
  let lastUnitUpdate = 0;
  let loadError = null;
  let lastWarriorFrame = null;
  const unitModels = new Map();
  const constructionSigns = [];
  let signViewer, signLocal;
  const handledDeathEffects = new Set();

  let baseLanes = 0;
  const baseMeshes = [];
  const laneCount = () => latestState?.players.red.villages.length || E.Config.formats[E.Config.defaultFormat].regions;
  const terrainWidthScale = () => laneCount() === E.Config.formats.simplified.regions ? E.Config.board.simplifiedWidthScale : 1;
  const laneSpacing = () => E.Config.board.laneSpacing * terrainWidthScale();
  const boardWidth = () => laneCount() * laneSpacing() + E.Config.board.rimMargin;
  const laneX = (lane) => (lane - (laneCount() - 1) / 2) * laneSpacing();
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
      E.CharacterHUD?.init(THREE);
      E.ConstructionSites?.init(THREE).then(loaded=>{if(loaded&&latestState)update(latestState,true);});
      ready = true;
      E.VillagerModel?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.FarmerModel?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.ShepherdModel?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.HunterModel?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.RavagerModel?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.WarriorModel?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.RoccapinaModel?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.OrcuModel?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.FullettuModel?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.LupuModel?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.SurpatoreModel?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.PlainTerrain?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.MountainTerrain?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.CoastTerrain?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.CropModels?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.LivestockModels?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.RowboatModel?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
      E.VillageModels?.init(THREE).then(loaded => { if (loaded && latestState) update(latestState, true); });
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
    signViewer = new THREE.Vector3(); signLocal = new THREE.Vector3();
    const backdrop = typeof getComputedStyle === "function"
      ? getComputedStyle(document.documentElement).getPropertyValue("--surface-deep").trim() || "#100e0b" : "#100e0b";
    scene.background = new THREE.Color(backdrop);
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.xr.enabled = true;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Carte");
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
    E.DiavuleEffects?.init(THREE, world);
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
    baseMeshes.splice(0).forEach(item => { item.removeFromParent(); disposeObject(item); });
    baseLanes = laneCount();
    const base = mesh(new THREE.BoxGeometry(baseLanes * laneSpacing() + E.Config.board.baseMargin, 0.42, 10.7), 0x44372a, { castShadow: false });
    base.position.y = -0.31;
    world.add(base);
    const rim = mesh(new THREE.BoxGeometry(boardWidth(), 0.16, 11.05), 0xb68a4d, { castShadow: false, metalness: 0.1 });
    rim.position.y = -0.48;
    world.add(rim); baseMeshes.push(base, rim);
  }

  function terrainTile(village) {
    const owner = village.ownerId;
    const z = owner === "red" ? -2.55 : 2.55;
    const group = new THREE.Group();
    group.position.set(laneX(village.lane), 0, z);
    group.userData = { playerId: owner, lane: village.lane, mapTarget: {kind: "village", playerId: owner, lane: village.lane} };

    const terrainModel = { plaine: E.PlainTerrain, montagne: E.MountainTerrain, littoral: E.CoastTerrain }[village.biome];
    const importedTerrain = terrainModel?.create(terrainWidthScale(), village.burnUntil > latestState.elapsed, owner);
    const tile = importedTerrain || mesh(new THREE.BoxGeometry(2.82 * terrainWidthScale(), 0.22, 4.85), village.burnUntil > latestState.elapsed ? 0x3c2219 : colors[village.biome], { castShadow: false });
    if (!importedTerrain) tile.position.y = -0.08;
    group.add(tile);

    const border = mesh(new THREE.BoxGeometry(2.92 * terrainWidthScale(), 0.08, 4.95), owner === "red" ? colors.red : colors.blue, { castShadow: false, metalness: 0.15 });
    border.position.y = -0.19;
    group.add(border);

    if (village.biome === "montagne" && !importedTerrain) addMountains(group, village.lane);
    if (village.biome === "plaine" && !importedTerrain) addPlainDetails(group, village.lane);
    if (village.biome === "littoral") addCoast(group, village, Boolean(importedTerrain));
    addMythologyTerrain(group, village);
    const outline = selectionOutline(2.92 * terrainWidthScale(), 4.95);
    outline.name = "village-selection-outline"; outline.position.y = .14; group.add(outline);
    addSlots(group, village);
    addVillageAndBuildings(group, village);
    // Espacer les éléments sans étirer les bâtiments, les cultures ou les animaux.
    group.children.forEach(item => { item.position.x *= terrainWidthScale(); });
    terrainGroup.add(group);
  }

  function viewerId(state) {
    return E.Network?.mode === "local" ? state.selectedVillage.playerId : E.Network?.playerId || "red";
  }

  function addMythologyTerrain(group, village) {
    const t = village.terrain || {};
    if (t.river) {
      const river = mesh(new THREE.BoxGeometry(2.65, 0.025, 0.17), 0x49a4bf, { castShadow: false });
      river.name = "mythology-river"; river.position.set(0, 0.055, 0); river.rotation.y = 0.13; group.add(river);
    }
    // Les modèles de terrain gèrent la terre calcinée. Les flammes dynamiques sont
    // séparées du terrain pour conserver leur animation lors d'une reconstruction.
    if (village.curseUntil > latestState.elapsed) {
      const curse = mesh(new THREE.BoxGeometry(2.76, 0.02, 4.77), 0x745296, { castShadow: false });
      curse.name = "mythology-cursed-terrain"; curse.position.y = 0.085; curse.material.transparent = true; curse.material.opacity = 0.3; group.add(curse);
    }
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

  function addCoast(group, village, importedTerrain = false) {
    const owner = village.ownerId;
    const waterZ = owner === "red" ? 1.46 : -1.46;
    if (!importedTerrain) {
      const water = mesh(new THREE.BoxGeometry(2.78 * terrainWidthScale(), 0.08, 1.82), 0x238eb0, { castShadow: false, roughness: 0.25, metalness: 0.1 });
      water.position.set(0, 0.08, waterZ);
      group.add(water);
      for (let index = 0; index < 5; index++) {
        const rock = mesh(new THREE.DodecahedronGeometry(0.08 + index * 0.012, 0), 0xcbbd9b);
        rock.position.set(-1 + index * 0.48, 0.17, waterZ + (index % 2 ? -0.47 : 0.39));
        group.add(rock);
      }
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
    if (type === 'barque') {
      const imported = E.RowboatModel?.create(owner);
      if (imported) return imported;
    }
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
    const cfg = E.Config.villagePresentation;
    const positions = village.slots.length === 2 ? cfg.slotsTwo : cfg.slotsFour;
    village.slots.forEach((slot, index) => {
      const first = group.children.length;
      const target = {kind:"slot", playerId:village.ownerId, lane:village.lane, slotIndex:index};
      const [x, localZ] = positions[index];
      const z = localZ * (village.ownerId === "red" ? 1 : -1);
      const marker = mesh(new THREE.CylinderGeometry(0.35, 0.39, 0.06, 16), village.burnUntil > latestState.elapsed ? 0x332721 : slot.type === "animal" ? 0x735f3c : 0x566744, { castShadow: false });
      marker.position.set(x, 0.1, z);
      marker.userData.xrTarget = { kind: "slot", playerId: village.ownerId, lane: village.lane, slotIndex: index };
      group.add(marker);
      if (slot.content?.category === "crop") {
        addCrop(group, slot.content.type, x, z, slot.content);
        const health=new THREE.Group();health.name='crop-health-ring';health.userData.cropHealthSlot=index;
        health.position.set(x,.145,z);health.rotation.x=-Math.PI/2;
        const track=new THREE.Mesh(new THREE.RingGeometry(.405,.445,64),new THREE.MeshBasicMaterial({color:0x263329,side:THREE.DoubleSide,depthWrite:false}));
        const fill=new THREE.Mesh(new THREE.RingGeometry(.409,.441,64),new THREE.MeshBasicMaterial({color:0x77d580,side:THREE.DoubleSide,depthWrite:false}));
        fill.position.z=.002;fill.rotation.z=Math.PI/2;fill.name='crop-health-fill';health.add(track,fill);group.add(health);
      }
      if (slot.content?.category === "livestock") addHerd(group, slot.content.type, slot.content.count, x, z);
      group.children.slice(first).forEach(object => { object.userData.mapTarget = target; });
      const highlight = selectionOutline(.80,.80);highlight.position.set(x,.16,z);
      highlight.name='map-object-highlight';highlight.userData.highlightTarget=target;group.add(highlight);
    });
  }

  function addCrop(group, type, x, z, content) {
    const importedCrop = E.CropModels?.create(type, content);
    if (importedCrop) {
      importedCrop.position.set(x, E.Config.cropModels[type].elevation, z);
      group.add(importedCrop);
      return importedCrop;
    }
    const crop = new THREE.Group();
    crop.name = `culture-${type}-simple`;
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
    return crop;
  }

  function addHerd(group, type, count, x, z) {
    const importedHerd = E.LivestockModels?.create(type, count);
    if (importedHerd) {
      importedHerd.position.set(x, E.Config.livestockModels[type].elevation, z);
      group.add(importedHerd);
      return;
    }
    const herd = new THREE.Group();
    herd.name = `elevage-${type}-simple`;
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
    const cfg = E.Config.villagePresentation, width = terrainWidthScale();
    const estate = new THREE.Group(); estate.name = 'village-courtyard';
    estate.rotation.y = village.ownerId === 'red' ? 0 : Math.PI;
    estate.userData = { playerId: village.ownerId, lane: village.lane, destroyed: village.destroyed };
    const wall = E.VillageModels?.createRampart(village.level, width, village.destroyed) || fallbackRampart(village, width);
    wall.position.set(0, cfg.elevation, (cfg.front + cfg.back) / 2);
    tagSelectable(wall, village.ownerId, village.lane);
    wall.userData.xrTarget = { kind: 'village', playerId: village.ownerId, lane: village.lane };
    wall.userData.mapTarget = {kind:'village',playerId:village.ownerId,lane:village.lane};
    wall.userData.villageHp = village.hp; wall.userData.villageMaxHp = village.maxHp;
    estate.add(wall);
    function addBuilding(type, tier) {
      const model = tier === 0 ? E.ConstructionSites.create(THREE,type) : buildingModel(type, tier, village.ownerId);
      const target = {kind:type==='village'?'village':'building',playerId:village.ownerId,lane:village.lane,buildingType:type};
      const position = cfg.buildings[type];
      model.name = type === 'village' ? 'hotel-village' : tier === 0 ? `chantier-${type}` : `batiment-${type}`;
      model.userData.buildingType = type; model.userData.buildingTier = tier;
      if(tier===0) {
        model.rotation.y=-Math.PI/2-estate.rotation.y;
        constructionSigns.push(model);
      }
      model.position.set(position[0] * width, cfg.elevation, position[1]);
      tagSelectable(model, village.ownerId, village.lane);
      model.userData.mapTarget=target;
      estate.add(model);
      if(type!=='village'){
        const highlight=selectionOutline(.76,.64);highlight.position.copy(model.position);highlight.position.y+=.025;
        highlight.name='map-object-highlight';highlight.userData.highlightTarget=target;estate.add(highlight);
      }
    }
    addBuilding('village', village.level);
    E.Config.building.types.forEach(type=>{
      const building=village.buildings.find(b=>b.type===type);
      if(building||!village.destroyed)addBuilding(type,building?.level||0);
    });
    const fire = E.VillageModels?.create(`feu_camp_t${village.level}`) || fallbackCampfire();
    fire.name = 'feu-de-camp'; fire.scale.setScalar(cfg.fireScale);
    fire.position.set(cfg.fire[0] * width, cfg.elevation, cfg.fire[1]);
    tagSelectable(fire, village.ownerId, village.lane);
    fire.userData.mapTarget = {kind:'village',playerId:village.ownerId,lane:village.lane};
    fire.userData.campfireTier = village.level; fire.visible = !village.destroyed;
    estate.add(fire);
    if (village.destroyed) estate.traverse(item => {
      if (item.material?.color && !item.userData.rampart_section) item.material.color.multiplyScalar(.45);
    });
    group.add(estate);
  }

  function fallbackCampfire() {
    const fire = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const log = mesh(new THREE.CylinderGeometry(.045, .05, .55, 6), colors.wood);
      log.rotation.set(0, i * Math.PI / 3, Math.PI / 2); log.position.y = .07; fire.add(log);
    }
    const flame = mesh(new THREE.ConeGeometry(.17, .47, 7), 0xffa42e);
    flame.position.y = .27; flame.material.emissive.setHex(0xff741c); flame.material.emissiveIntensity = .5;
    fire.add(flame); return fire;
  }

  function fallbackRampart(village, width) {
    const cfg = E.Config.villagePresentation, wall = new THREE.Group(); wall.name = 'remparts';
    const height = village.level === 1 ? .32 : .40, color = village.level === 1 ? colors.wood : colors.stone;
    const depth = cfg.front - cfg.back;
    for (const side of [-1, 1]) {
      const part = mesh(new THREE.BoxGeometry(.09, height, depth), color);
      part.position.set(side * cfg.wallHalfWidth * width, height / 2, 0); wall.add(part);
    }
    for (const side of [-1, 1]) {
      const part = mesh(new THREE.BoxGeometry(2 * cfg.wallHalfWidth * width, height, .09), color);
      part.position.set(0, village.destroyed ? .04 : height / 2, side * depth / 2);
      if (village.destroyed && side === 1) part.rotation.x = Math.PI / 2;
      wall.add(part);
    }
    return wall;
  }

  function idlePosition(index, count) {
    const cfg = E.Config.villagePresentation;
    const outerCount = count > 12 ? Math.ceil(count * .57) : count;
    const inner = index >= outerCount;
    const ringCount = inner ? count - outerCount : outerCount;
    const ringIndex = inner ? index - outerCount : index;
    const radius = count <= 12 ? .76 : inner ? .64 : 1;
    const angle = 2 * Math.PI * ringIndex / Math.max(1, ringCount) + (inner ? .19 : 0);
    return { x: cfg.fire[0] + Math.cos(angle) * cfg.idleRadiusX * radius,
      z: cfg.fire[1] + Math.sin(angle) * cfg.idleRadiusZ * radius };
  }

  // Le milieu de la colonne (eau/frontière) conserve son repère. Les extrémités
  // visuelles aboutissent à la porte, tandis que portée, vitesse et PV restent logiques.
  function combatZ(position) {
    const cfg = E.Config.villagePresentation, edge = cfg.regionCenter - cfg.front;
    const transition = cfg.combatTransition, inner = -4.35 + transition * .087;
    if (position < transition) return -edge + (inner + edge) * position / transition;
    if (position > 100 - transition) return -inner + (edge + inner) * (position - (100 - transition)) / transition;
    return -4.35 + position * .087;
  }

  function tagSelectable(object, playerId, lane) {
    Object.assign(object.userData, { playerId, lane, selectable: true });
    object.traverse((child) => { child.userData.selectionRoot = object; });
  }

  function buildingModel(type, tier, owner) {
    if (tier <= 3) {
      const imported = E.VillageModels?.create(type === 'village' ? `hotel_t${tier}` : `${type}_t${tier}`);
      if (imported) {
        imported.scale.setScalar(type === 'village' ? E.Config.villagePresentation.hotelScale : E.Config.villagePresentation.buildingScale);
        return imported;
      }
    }
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
    group.scale.setScalar(scale * .65);
    return group;
  }

  function updateUnits(state) {
    const active = new Set();
    const deployedResidents = new Set();
    const deployedAnimals = new Set();
    state.units.forEach((unit) => {
      if (unit.hp <= 0) return;
      if (E.MythologyEffects && !E.MythologyEffects.unitVisible(state, viewerId(state), unit)) return;
      const key = `unit-${unit.id}`;
      const resident = state.players[unit.ownerId]?.villages[unit.originLane]?.residents.find((entry) => entry.id === unit.residentId);
      const appearance = resident || unit;
      const swimming = (unit.animalType || unit.role) === "sanglier" && Boolean(unit.waterOwner);
      const figure = unitModel(key, unit.ownerId, appearance, unit.waterTransport, swimming);
      figure.position.set(laneX(unit.lanePosition), swimming ? -0.04 : 0.2, combatZ(unit.position));
      figure.rotation.y = unit.ownerId === "red" ? 0 : Math.PI;
      const moving = syncLocomotion(figure, true, !unit.waterTransport);
      figure.userData.farmer?.setHarvest(false);
      figure.userData.shepherd?.setHarvest(false);
      if (figure.userData.fullettu) {
        const source = state.players[unit.ownerId === 'red' ? 'blue' : 'red']?.villages[unit.lane];
        const destination = state.players[unit.ownerId]?.villages[unit.originLane];
        const enemyHome = unit.ownerId === 'red' ? E.Config.movement.columnLength : 0;
        const gathering = !moving && !unit.waterTransport && Math.abs(unit.position - enemyHome) <= E.Config.combat.attackRange &&
          destination && !destination.destroyed && E.Config.resources.some(resource => source?.resources[resource] > 0);
        figure.userData.fullettu.setHarvest(gathering, unit.mythologyGatherTimer || 0, E.Config.reinforcementPowers.fullettuGatherInterval);
      }
      if (!moving && unit.visualAttackTarget && unit.attackCooldown > 0) {
        figure.rotation.y = Math.atan2(laneX(unit.visualAttackTarget.lanePosition) - figure.position.x,
          combatZ(unit.visualAttackTarget.position) - figure.position.z);
      }
      figure.scale.setScalar(unit.mythologyScale || 1);
      updateMythologyAura(figure, appearance, unit.ownerId, state);
      syncUnitVisualState(figure, unit);
      figure.userData.mapTarget = unit.residentId ? {kind:'resident',playerId:unit.ownerId,lane:unit.originLane,residentId:unit.residentId} : null;
      E.CharacterHUD?.sync(figure, unit, unit.ownerId === viewerId(state));
      if (unit.residentId) deployedResidents.add(`${unit.ownerId}:${unit.residentId}`);
      if (unit.animalId != null) deployedAnimals.add(`${unit.ownerId}:${unit.animalId}`);
      active.add(key);
    });
    Object.values(state.players).forEach((player) => player.villages.forEach((village) => {
      if (village.destroyed) return;
      const known = E.MythologyEffects?.vision(state, viewerId(state), village);
      let localIndex = 0;
      const idleCount = village.residents.filter(r => !r.unitId && (!r.mission || r.mission === "disponible") && !(r.hp <= 0)).length;
      let fisherIndex = 0;
      const facing = player.id === "red" ? 1 : -1;
      village.residents.forEach((resident, index) => {
        if (known && !known.people && !E.MythologyEffects?.residentVisible(state, viewerId(state), village, resident)) return;
        if (resident.hp <= 0 || deployedResidents.has(`${player.id}:${resident.id}`) || resident.unitId) return;
        const key = `resident-${player.id}-${resident.id}`;
        const figure = unitModel(key, player.id, resident);
        markSelected(figure, resident.id === state.selectedResidentId && player.id === state.selectedVillage.playerId && village.lane === state.selectedVillage.lane);
        figure.userData.aroundCampfire = false;
        const isWorker = ["agriculture", "elevage", "chasse"].includes(resident.mission) && Number.isFinite(resident.workPosition);
        figure.userData.farmer?.setHarvest(isWorker && resident.mission === 'agriculture' && resident.workPhase === 'harvesting');
        figure.userData.shepherd?.setHarvest(isWorker && resident.mission === 'elevage' && resident.workPhase === 'harvesting');
        figure.scale.setScalar((isWorker ? 0.78 : 0.65) * (resident.mythologyScale || 1));
        updateMythologyAura(figure, resident, player.id, state);
        figure.rotation.y = facing === 1 ? 0 : Math.PI;
        if (isWorker) {
          const lateral = resident.mission === "chasse" ? (resident.workLaneOffset || 0) * 2.7 : (index % 2 ? 0.3 : -0.3);
          figure.position.set(laneX(village.lane) + lateral * terrainWidthScale(), 0.18, -4.35 + (resident.workPosition / 100) * 8.7);
        } else if (resident.mission === "peche") {
          // Fishermen stand on dry shoreline; this never puts a resident in the water.
          const row = Math.floor(fisherIndex / 7);
          const column = fisherIndex++ % 7;
          const bank = village.biome === 'littoral' ? .36 - row * .34 : .18 + row * .17;
          figure.position.set(laneX(village.lane) + (-1.08 + column * 0.36) * terrainWidthScale(), 0.18, facing * (-2.55 + bank));
        } else {
          const cfg = E.Config.villagePresentation, point = idlePosition(localIndex++, idleCount);
          figure.position.set(laneX(village.lane) + point.x * terrainWidthScale() * facing, .18,
            facing * (-cfg.regionCenter + point.z));
          figure.rotation.y = Math.atan2((cfg.fire[0] - point.x) * terrainWidthScale() * facing,
            (cfg.fire[1] - point.z) * facing);
          figure.scale.setScalar((idleCount > cfg.crowdedThreshold ? cfg.crowdedIdleScale : cfg.idleScale) * (resident.mythologyScale || 1));
          figure.userData.aroundCampfire = true;
        }
        syncLocomotion(figure, isWorker, true);
        figure.userData.mapTarget = {kind:'resident',playerId:player.id,lane:village.lane,residentId:resident.id};
        E.CharacterHUD?.sync(figure, E.CharacterHUD.getStats(state,village,resident), player.id === viewerId(state));
        active.add(key);
      });
      let animalIndex = 0;
      (village.animals || []).forEach((animal) => {
        if (known && !known.all) return;
        if (animal.hp <= 0 || animal.unitId || deployedAnimals.has(`${player.id}:${animal.id}`) || animal.mission !== "disponible") return;
        const key = `animal-${player.id}-${animal.id}`;
        const figure = unitModel(key, player.id, { animalType: animal.type });
        const row = Math.floor(animalIndex / 6);
        const column = animalIndex++ % 6;
        figure.scale.setScalar(0.8);
        figure.rotation.y = facing === 1 ? 0 : Math.PI;
        figure.position.set(laneX(village.lane) + (-1 + column * 0.38) * terrainWidthScale(), 0.18, facing * (-2.55 - 0.67 + row * 0.31));
        E.CharacterHUD?.sync(figure, {...animal,animalType:animal.type}, player.id === viewerId(state));
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
      const target = unit.visualAttackTarget;
      const targetPoint = target && Number.isFinite(target.position) && Number.isFinite(target.lanePosition)
        ? new THREE.Vector3(laneX(target.lanePosition), .47, combatZ(target.position)) : null;
      if (!figure.userData.locomotionMoving && targetPoint) {
        figure.rotation.y = Math.atan2(targetPoint.x - figure.position.x, targetPoint.z - figure.position.z);
      }
      characterAnimation(figure)?.attack(attackSequence, targetPoint);
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
      // Une transformation garde l'id de l'unité : la mort de son ancienne
      // forme doit avoir sa propre figurine, sans retirer la nouvelle vivante.
      const stillAlive = state.units.some(unit => unit.id === event.unitId && unit.hp > 0);
      let figure = stillAlive ? null : unitModels.get(liveKey);
      if (figure) {
        unitModels.delete(liveKey);
        unitModels.set(deathKey, figure);
      } else {
        const swimming = (event.animalType || event.role) === "sanglier" && Boolean(event.waterOwner);
        figure = unitModel(deathKey, event.ownerId, event, event.waterTransport, swimming);
      }
      const swimming = (event.animalType || event.role) === "sanglier" && Boolean(event.waterOwner);
      figure.position.set(laneX(event.lanePosition), swimming ? -0.04 : 0.2, combatZ(event.position));
      figure.rotation.set(0, event.ownerId === "red" ? 0 : Math.PI, 0);
      if (event.mythologyScale != null) figure.scale.setScalar(event.mythologyScale);
      figure.userData.dying = true;
      if (figure.userData.characterHud) figure.userData.characterHud.group.visible = false;
      characterAnimation(figure)?.die();
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
    const delta = lastWarriorFrame === null ? 0 : Math.max(0, (now - lastWarriorFrame) / 1000);
    lastWarriorFrame = now;
    const paused = Boolean(latestState?.paused || latestState?.phase && latestState.phase !== 'running');
    unitModels.forEach((figure, key) => {
      characterAnimation(figure)?.tick(delta, paused, figure.userData.dying);
      if (figure.userData.dying) {
        const animatedDeath = characterAnimation(figure)?.dying;
        const progress = animatedDeath ? characterAnimation(figure).deathProgress :
          Math.min(1, (now - figure.userData.deathStartedAt) / (effects.unitDeathDuration * 1000));
        const fall = Math.min(1, progress / 0.55);
        const easedFall = 1 - Math.pow(1 - fall, 3);
        if (!animatedDeath) {
          figure.rotation.x = 0;
          figure.rotation.z = figure.userData.deathSide * effects.unitDeathFallAngle * easedFall;
          figure.position.y = figure.userData.deathBaseY - 0.09 * easedFall;
        }
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
      figure.rotation.x = (!characterAnimation(figure) || figure.userData.simpleWalk || figure.userData.villager) && attackProgress >= 0 && attackProgress < 1 ? Math.sin(attackProgress * Math.PI) * effects.unitAttackTilt : 0;
      figure.rotation.z = 0;

      const hitProgress = figure.userData.hitStartedAt === undefined ? 1 :
        (now - figure.userData.hitStartedAt) / (effects.unitHitFlashDuration * 1000);
      if (hitProgress >= 0 && hitProgress < 1) {
        const flash = Math.sin(hitProgress * Math.PI * 5) > 0 ? 0.82 : 0.12;
        tintFigure(figure, flash);
      } else tintFigure(figure, 0);
    });
  }

  // Direction et animation communes à toutes les figurines ; aucun état logique modifié.
  function syncLocomotion(figure, canMove, canWalk) {
    const previous = figure.userData.locomotionPosition;
    const dx = previous ? figure.position.x - previous.x : 0;
    const dz = previous ? figure.position.z - previous.z : 0;
    const moving = canMove && Math.hypot(dx, dz) > E.Config.characterModels.warrior.movementEpsilon;
    if (moving) figure.userData.locomotionHeading = Math.atan2(dx, dz);
    if (canMove && figure.userData.locomotionHeading !== undefined) figure.rotation.y = figure.userData.locomotionHeading;
    if (!canMove) delete figure.userData.locomotionHeading;
    figure.userData.locomotionPosition = {x:figure.position.x, z:figure.position.z};
    figure.userData.locomotionMoving = moving;
    characterAnimation(figure)?.setMoving(moving && canWalk);
    return moving;
  }

  function addSimpleWalk(figure) {
    const cfg = E.Config.characterLocomotion;
    const parts = figure.children.filter(p => !/equipe|barque|voilier|bateau|sillage/i.test(p.name)).map(part =>
      ({part, y:part.position.y, x:part.rotation.x, z:part.rotation.z}));
    let moving = false, phase = 0;
    figure.userData.simpleWalk = {
      setMoving(value) { moving = Boolean(value); },
      attack() {}, die() {}, dispose() {},
      tick(delta, paused, dead) {
        if (paused) return;
        if (moving && !dead) phase += Math.min(delta, cfg.maxFrameDelta) * cfg.frequency;
        for (const {part,y,x,z} of parts) {
          const step = moving && !dead ? Math.sin(phase) : 0;
          part.position.y = y + Math.abs(step) * cfg.bob;
          if (/jambe|patte|bras/.test(part.name)) {
            const side = part.position.x < 0 ? -1 : 1;
            const end = part.position.z < 0 ? -1 : 1;
            part.rotation.x = x + step * cfg.limbSwing * side * end;
          } else part.rotation.z = z + step * cfg.sway;
        }
      }
    };
  }

  function characterAnimation(figure) {
    return figure.userData.villager || figure.userData.simpleWalk || figure.userData.roccapina || figure.userData.surpatore || figure.userData.lupu || figure.userData.fullettu || figure.userData.orcu || figure.userData.warrior || figure.userData.farmer || figure.userData.shepherd || figure.userData.hunter || figure.userData.ravager;
  }

  function unitModel(key, owner, appearance, waterTransport = null, swimming = false) {
    let figure = unitModels.get(key);
    const animalType = appearance.animalType || (["chien", "sanglier"].includes(appearance.role) ? appearance.role : null);
    const profession = appearance.profession || (E.Config.professions[appearance.role] ? appearance.role : "habitant");
    const tool = appearance.tool || null;
    const armor = appearance.armor || null;
    const donkey = !animalType && Boolean(appearance.donkey);
    if (animalType === "sanglier") waterTransport = null;
    const isRoccapina = appearance.mythologyLegendId === 'lion-roccapina';
    const isOrcu = appearance.mythologyLegendId === 'l-orcu';
    const isFullettu = appearance.mythologyLegendId === 'u-fullettu';
    const isLupu = appearance.mythologyLegendId === 'u-lupu-mannaru';
    const isSurpatore = appearance.mythologyLegendId === 'u-surpatore' && appearance.mythologyForm === 'vampire';
    const importedRavager = !animalType && !appearance.mythologyLegendId && profession === 'ravageur' && E.RavagerModel?.ready;
    const asset = isRoccapina && E.RoccapinaModel?.ready ? 'roccapina-glb' : isSurpatore && E.SurpatoreModel?.ready ? 'surpatore-glb' : isLupu && E.LupuModel?.ready ? 'lupu-glb' : isFullettu && E.FullettuModel?.ready ? 'fullettu-glb' : isOrcu && E.OrcuModel?.ready ? 'orcu-glb' : importedRavager ? 'ravageur-glb' : profession === 'guerrier' && E.WarriorModel?.ready ? 'guerrier-glb' : !animalType && profession === 'chasseur' && E.HunterModel?.ready ? 'chasseur-glb' : !animalType && profession === 'agriculteur' && E.FarmerModel?.ready ? 'agriculteur-glb' : !animalType && profession === 'berger' && E.ShepherdModel?.ready ? 'berger-glb' : !animalType && profession === 'habitant' && E.VillagerModel?.ready ? 'habitant-glb' : 'procedural';
    const visualSignature = `${owner}:${animalType || profession}:${tool || "none"}:${armor || "none"}:${waterTransport || "land"}:${donkey}:${swimming}:${appearance.mythologyLegendId || ''}:${appearance.mythologyForm || ''}:${asset}${waterTransport === 'barque' ? E.RowboatModel?.ready ? ':barque-glb' : ':barque-simple' : ''}`;
    if (figure && figure.userData.visualSignature === visualSignature) return figure;
    if (figure) {
      figure.removeFromParent();
      disposeObject(figure);
    }
    figure = isRoccapina && E.RoccapinaModel?.ready ? E.RoccapinaModel.create(owner) : isSurpatore && E.SurpatoreModel?.ready ? E.SurpatoreModel.create(owner) : isLupu && E.LupuModel?.ready ? E.LupuModel.create(owner) : isFullettu && E.FullettuModel?.ready ? E.FullettuModel.create(owner) : isOrcu && E.OrcuModel?.ready ? E.OrcuModel.create(owner) : importedRavager ? E.RavagerModel.create(owner, tool, armor) : null;
    if (figure) addHumanTransport(figure, owner, waterTransport, importedRavager && donkey);
    else figure = animalType ? animalModel(owner, animalType, waterTransport, swimming) : personModel(owner, profession, tool, armor, waterTransport, donkey);
    if (!characterAnimation(figure)) addSimpleWalk(figure);
    Object.assign(figure.userData, { visualKey: key, visualSignature, profession: animalType ? null : profession, animalType, tool, armor, waterTransport, donkey, swimming });
    unitModels.set(key, figure);
    unitGroup.add(figure);
    return figure;
  }

  function updateMythologyAura(figure, appearance, owner, state) {
    const magu = appearance.mythologyMagu;
    const bianca = !appearance.isLegend && E.MythologyEffects?.protectionActive(state, owner);
    let aura = figure.getObjectByName('mythology-aura');
    if (!aura && (magu || bianca)) {
      aura = new THREE.Group(); aura.name = 'mythology-aura';
      for (const [radius, color] of [[.38, 0xb45ae0], [.46, 0xe0bc65]]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .012, 4, 20),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .65, depthWrite: false }));
        ring.rotation.x = Math.PI / 2; ring.position.y = .2; aura.add(ring);
      }
      figure.add(aura);
    }
    if (aura) { aura.visible = Boolean(magu || bianca); aura.children[0].material.color.set(magu ? '#b45ae0' : '#69cb94'); }
    const legend = E.Mythology?.get(appearance.mythologyLegendId);
    if (legend && !figure.userData.preserveMythologyMaterial && !figure.userData.mythologyTinted) {
      figure.traverse(node => { if (node.isMesh && node.material?.color && !node.name.includes('halo')) {
        node.material.color.lerp(new THREE.Color(legend.visuals.primaryColor), .55);
      } });
      figure.userData.mythologyTinted = true;
    }
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
    if (profession === 'habitant') {
      const imported = E.VillagerModel?.create(owner, tool, armor);
      if (imported) return addHumanTransport(imported, owner, waterTransport, donkey);
    }
    if (profession === 'chasseur') {
      const imported = E.HunterModel?.create(owner, tool, armor);
      if (imported) return addHumanTransport(imported, owner, waterTransport, donkey);
    }
    if (profession === 'berger') {
      const imported = E.ShepherdModel?.create(owner, tool, armor);
      if (imported) return addHumanTransport(imported, owner, waterTransport, donkey);
    }
    if (profession === 'agriculteur') {
      const imported = E.FarmerModel?.create(owner, tool, armor);
      if (imported) return addHumanTransport(imported, owner, waterTransport, donkey);
    }
    if (profession === 'guerrier') {
      const imported = E.WarriorModel?.create(owner, tool, armor);
      if (imported) return addHumanTransport(imported, owner, waterTransport, donkey);
    }
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
    return addHumanTransport(group, owner, waterTransport, donkey);
  }

  function addHumanTransport(group, owner, waterTransport, donkey) {
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
      village.id, village.biome, village.level, village.destroyed,
      E.MythologyEffects?.terrainVisualKey(village) || "", village.burnUntil > state.elapsed, village.curseUntil > state.elapsed,
      E.MythologyEffects?.vision(state, viewerId(state), village)?.fraction ?? 1,
      village.buildings.map((building) => `${building.type}${building.level}`).join(","),
      `${village.maritime?.barque || 0}:${village.maritime?.voilier || 0}:${village.maritime?.filet || 0}`,
      village.slots.map((slot) => slot.content ? `${slot.content.category}:${slot.content.type}:${slot.content.count || 1}:${slot.content.level || 1}:${slot.content.hp > 0}` : "-").join(",")
    ].join("/"))).join("|");
  }

  function update(state, force = false) {
    latestState = state;
    if (!ready || !state) return;
    if (baseLanes !== laneCount()) addBoardBase();
    const nextSignature = signature(state);
    let visualsChanged = false;
    if (force || nextSignature !== structureSignature) {
      structureSignature = nextSignature;
      constructionSigns.length = 0;
      clearGroup(terrainGroup);
      Object.values(state.players).forEach((player) => player.villages.forEach(terrainTile));
      visualsChanged = true;
    }
    terrainGroup.children.forEach(region => {
      const selected = state.selectedVillage.playerId===region.userData.playerId && state.selectedVillage.lane===region.userData.lane;
      const outline=region.getObjectByName('village-selection-outline');
      if(outline)outline.visible=selected;
      const target=E.MapInteraction?.selection;
      region.traverse(object=>{
        if(object.userData.cropHealthSlot!==undefined){
          const crop=state.players[region.userData.playerId].villages[region.userData.lane].slots[object.userData.cropHealthSlot]?.content;
          const ratio=crop?.category==='crop'?Math.max(0,Math.min(1,crop.hp/crop.maxHp)):0;
          object.visible=ratio>0;object.userData.healthRatio=ratio;
          const fill=object.getObjectByName('crop-health-fill');
          fill.geometry.setDrawRange(0,Math.ceil(ratio*64)*6);
          fill.material.color.setHex(ratio>.5?0x77d580:ratio>.25?0xeac15a:0xe86956);
        }
        const tag=object.userData.highlightTarget;
        if(tag)object.visible=Boolean(target&&selected&&tag.kind===target.kind&&tag.slotIndex===target.slotIndex&&tag.buildingType===target.buildingType);
      });
      const wall = region.getObjectByName('remparts');
      const village = state.players[region.userData.playerId]?.villages[region.userData.lane];
      if (wall && village) { wall.userData.villageHp = village.hp; wall.userData.villageMaxHp = village.maxHp; }
    });
    const now = performance.now();
    if (force || now - lastUnitUpdate > 70) {
      lastUnitUpdate = now;
      updateUnits(state);
      visualsChanged = true;
    }
    if (xrPreview && visualsChanged) setXRPreview(true, true);
    updateMythologyTargets();
  }

  function updateMythologyTargets() {
    const targeting = E.MythologySession?.getTargeting();
    terrainGroup.children.forEach(group => {
      const valid = Boolean(targeting && !latestState.paused && !targeting.pending &&
        E.MythologySession.canTargetRegion(group.userData.playerId, group.userData.lane));
      let overlay = group.getObjectByName('mythology-target');
      if (valid && !overlay) {
        overlay = new THREE.Group(); overlay.name = 'mythology-target';
        const x = 1.39 * terrainWidthScale(), z = 2.38;
        const points = [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]].map(p => new THREE.Vector3(...p));
        const border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xffdd88, transparent: true, depthTest: false, depthWrite: false }));
        const fill = new THREE.Mesh(new THREE.PlaneGeometry(x * 2, z * 2), new THREE.MeshBasicMaterial({ color: 0xefcf7d, transparent: true, opacity: .08, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
        fill.rotation.x = -Math.PI / 2; fill.name = 'mythology-target-fill'; fill.renderOrder = 30; border.renderOrder = 31;
        overlay.position.y = .11; overlay.add(fill, border); group.add(overlay);
      }
      if (overlay) {
        overlay.visible = valid;
        const hover = targeting?.hover;
        const emphasized = hover && (targeting.mode === 'none' || hover.lane === group.userData.lane &&
          (targeting.mode === 'column' || hover.playerId === group.userData.playerId));
        overlay.getObjectByName('mythology-target-fill').material.opacity = emphasized ? .2 : .08;
      }
    });
  }

  function clearGroup(group) {
    while (group.children.length) {
      const child = group.children.pop();
      disposeObject(child);
    }
  }

  function disposeObject(object) {
    characterAnimation(object)?.dispose();
    E.CharacterHUD?.dispose(object);
    object.traverse((item) => {
      if (!item.userData.sharedGeometry) item.geometry?.dispose?.();
      if (Array.isArray(item.material)) item.material.forEach((entry) => entry.dispose?.());
      else item.material?.dispose?.();
    });
  }

  function bindControls() {
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      if(pointer){dragged=true;return;}
      pointer={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};
      dragged=false;canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove',event=>{
      if(!pointer){
        if(E.MythologySession?.getTargeting()){
          const region=regionAt(event.clientX,event.clientY);E.MythologySession.hoverRegion(region?.playerId,region?.lane);
        }
        canvas.style.cursor=E.MapInteraction?.selectable(targetAt(event.clientX,event.clientY),latestState)?'pointer':'grab';return;
      }
      if(pointer.id!==event.pointerId)return;
      if(Math.hypot(event.clientX-pointer.startX,event.clientY-pointer.startY)>6)dragged=true;
      if(dragged){
        orbit.angle-=(event.clientX-pointer.x)*.007;
        orbit.elevation=Math.max(.35,Math.min(1.25,orbit.elevation+(event.clientY-pointer.y)*.005));
        canvas.style.cursor='grabbing';
      }
      pointer.x=event.clientX;pointer.y=event.clientY;
    });
    canvas.addEventListener('pointerup',event=>{
      if(!pointer||pointer.id!==event.pointerId)return;
      if(!dragged)selectAt(event.clientX,event.clientY);
      pointer=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor='grab';
    });
    canvas.addEventListener('pointercancel',()=>{pointer=null;dragged=true;});
    canvas.addEventListener('lostpointercapture',()=>{pointer=null;});
    canvas.addEventListener('pointerleave',()=>E.MythologySession?.hoverRegion(null));
    canvas.addEventListener('wheel',event=>{
      event.preventDefault();orbit.distance=Math.max(11,Math.min(27,orbit.distance+event.deltaY*.012));
    },{passive:false});
  }

  function targetAt(clientX,clientY) {
    if(!ready)return null;
    const rect=renderer.domElement.getBoundingClientRect();
    const raycaster=new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),camera);
    world.updateMatrixWorld(true);
    for(const hit of raycaster.intersectObjects([unitGroup,terrainGroup],true)){
      let object=hit.object,target=null,visible=true;
      while(object){
        if(!object.visible||object.userData.dying){visible=false;break;}
        target ||= object.userData.mapTarget;
        object=object.parent;
      }
      if(visible&&target)return target;
    }
    return null;
  }

  function selectionOutline(width,depth) {
    const group=new THREE.Group();group.visible=false;
    for(const [thickness,opacity]of [[.10,.09],[.055,.22],[.022,.95]]){
      const m=new THREE.MeshBasicMaterial({color:0xffdc42,transparent:true,opacity,depthTest:false,depthWrite:false});
      for(const sign of [-1,1]){
        const x=new THREE.Mesh(new THREE.BoxGeometry(width,.004,thickness),m.clone());x.position.z=sign*depth/2;
        const z=new THREE.Mesh(new THREE.BoxGeometry(thickness,.004,depth),m.clone());z.position.x=sign*width/2;
        for(const line of [x,z]){line.renderOrder=5;line.raycast=()=>{};group.add(line);}
      }
      m.dispose();
    }
    return group;
  }

  function regionAt(clientX, clientY) {
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
    if (!hit) return null;
    let object = hit.object.userData.selectionRoot || hit.object;
    while (object && object.userData?.playerId === undefined) object = object.parent;
    return object?.userData?.playerId !== undefined ? { playerId: object.userData.playerId, lane: object.userData.lane } : null;
  }

  function selectAt(clientX, clientY) {
    if(E.MythologySession?.getTargeting()){
      const region=regionAt(clientX,clientY);
      if(region)E.MythologySession.targetRegion(region.playerId,region.lane);
      return;
    }
    const target=targetAt(clientX,clientY);
    if(target)E.MapInteraction?.select(target);
  }

  function updateCamera() {
    const direction = new THREE.Vector3(Math.sin(orbit.angle) * Math.cos(orbit.elevation),
      Math.sin(orbit.elevation), Math.cos(orbit.angle) * Math.cos(orbit.elevation));
    const fitKey = `${orbit.angle}:${orbit.elevation}:${camera.aspect}:${boardWidth()}`;
    if (cameraFitKey !== fitKey) {
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right);
      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      let distance = 0;
      for (const x of [-boardWidth() / 2, boardWidth() / 2]) for (const y of [-.1, 1.1]) for (const z of [-5.6, 5.6]) {
        const point = new THREE.Vector3(x, y, z), depth = point.dot(direction);
        distance = Math.max(distance, Math.abs(point.dot(right)) / (tangent * camera.aspect) + depth,
          Math.abs(point.dot(up)) / tangent + depth);
      }
      cameraFitDistance = distance * 1.07;
      cameraFitKey = fitKey;
    }
    // La distance d'orbite reste le zoom choisi par le joueur, autour du cadrage adapté à l'écran.
    camera.position.copy(direction.multiplyScalar(cameraFitDistance * orbit.distance / 18));
    camera.position.y += .1;
    camera.lookAt(0, .1, 0);
  }

  function resize() {
    if (!renderer || renderer.xr.isPresenting || !container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  }

  // Rotation autour de la verticale locale uniquement : les panneaux restent
  // plantés dans le sol et lisibles en vue horizontale, verticale et en XR.
  function faceConstructionSigns(viewCamera) {
    viewCamera.getWorldPosition(signViewer);
    for (const sign of constructionSigns) {
      signLocal.copy(signViewer);
      sign.parent.worldToLocal(signLocal).sub(sign.position);
      if (signLocal.x * signLocal.x + signLocal.z * signLocal.z > 1e-6)
        sign.rotation.y = Math.atan2(signLocal.x, signLocal.z);
    }
  }

  function animate(timestamp, xrFrame) {
    onFrame?.(timestamp);
    E.XR?.update(timestamp, xrFrame);
    if ((!enabled && !E.XR?.active) || !renderer) return;
    // L'horloge tourne toujours ; seul le dessin du plateau masqué est évité.
    if (!E.XR?.active && (E.MenuVR?.active || container.getClientRects().length === 0)) return;
    animateUnitEffects();
    if (!E.XR?.active) updateCamera();
    const viewCamera = E.XR?.active ? renderer.xr.getCamera() : camera;
    faceConstructionSigns(viewCamera);
    E.DiavuleEffects?.update(latestState, laneX, terrainWidthScale(), viewCamera);
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

  E.Board3D = {
    getBoardWidth: boardWidth, targetAt, init, update, toggle, setMode, setXRPreview, resize,
    getXRContext: () => ready ? { THREE, renderer, scene, camera, world, terrainGroup,
      getBoardDimensions: () => ({ width: boardWidth(), depth: 11.05 }) } : null,
    get ready() { return ready; }, get enabled() { return enabled; }, get error() { return loadError; } };
}());
