(function () {
  "use strict";

  const E = window.Eredita;
  let state = E.Board.createState();
  let previousTimestamp = performance.now();
  let networkAccumulator = 0;
  let pendingBulkTasks = [];
  const localViewMethods = new Set(["selectVillage", "selectResident"]);
  const guestCommands = new Set(["selectDeck", "toggleBiome", "confirmBiomes", "placeCrop", "placeLivestock", "slaughter", "changeJob", "assignResidentMission", "assignAllResidents", "releaseResident", "releaseAllResidents", "build", "setProfession", "assignProfessionToAll", "setNextResidentMission", "setNextResidentProfession", "sell", "buyResident", "buyShopItem", "buyAnimal", "buyEquipment", "buySpecialAnimal", "orderAnimal", "slaughterSpecialAnimal", "upgrade", "deploy", "chooseRedirect"]);

  function addLog(message) {
    state.logs.unshift(message);
    state.logs = state.logs.slice(0, 30);
  }

  const controller = {
    selectDeck(playerId, deckIndex) {
      const player = state.players[playerId];
      if (state.phase !== "setup" || !player || player.setupConfirmed || ![0, 1, 2].includes(deckIndex)) return;
      player.selectedDeck = deckIndex;
      E.UI.render(state);
    },

    toggleBiome(playerId, lane) {
      const player = state.players[playerId];
      if (state.phase !== "setup" || !player || player.setupConfirmed) return;
      const currentIndex = player.setupSelection.indexOf(lane);
      if (currentIndex >= 0) player.setupSelection.splice(currentIndex, 1);
      else if (player.setupSelection.length < 2) player.setupSelection.push(lane);
      E.UI.render(state);
    },

    confirmBiomes(playerId, action) {
      const player = state.players[playerId];
      if (state.phase !== "setup" || !player || player.setupConfirmed) return;
      if (action === "exchange") {
        if (!player.setupSelection.length || player.setupSelection.length > 2) return;
        player.setupSelection.forEach((lane) => {
          const village = player.villages[lane];
          village.biome = E.Biomes.randomBiome(village.biome);
          village.slots = E.Biomes.createSlots(village.biome);
        });
      }
      player.setupSelection = [];
      player.setupConfirmed = true;
      E.UI.render(state);
    },

    start() {
      if (!state.players.red.setupConfirmed || !state.players.blue.setupConfirmed) return;
      E.Audio?.play("game");
      state.phase = "running";
      state.elapsed = 0;
      previousTimestamp = performance.now();
      addLog("La partie commence. Les huit villages sont debout.");
      E.UI.render(state);
    },

    togglePause() {
      if (state.phase !== "running") return;
      state.paused = !state.paused;
      previousTimestamp = performance.now();
      E.UI.render(state);
    },

    selectVillage(playerId, lane) {
      state.selectedVillage = { playerId, lane };
      const village = state.players[playerId] && state.players[playerId].villages[lane];
      state.selectedResidentId = village && village.residents[0] ? village.residents[0].id : null;
      state.pendingPlacement = null;
      E.UI.render(state);
    },

    selectResident(residentId) {
      const { playerId, lane } = state.selectedVillage;
      if (!E.Economy.getResident(state, playerId, lane, residentId)) return;
      state.selectedResidentId = residentId;
      E.UI.render(state);
    },

    placeCrop(type, slotIndex) {
      const { playerId, lane } = state.selectedVillage;
      const previous = state.players[playerId]?.villages[lane]?.slots[slotIndex]?.content;
      if (E.Crops.place(state, playerId, lane, slotIndex, type)) {
        const crop = E.Crops.get(type);
        const replaced = previous?.category === "crop" ? ` à la place de ${E.Crops.get(previous.type).label.toLowerCase()}` : "";
        addLog(`${state.players[playerId].name} plante ${crop.label.toLowerCase()}${replaced} en ligne ${lane + 1}.`);
      }
      E.UI.render(state);
    },

    placeLivestock(type, slotIndex) {
      const { playerId, lane } = state.selectedVillage;
      if (E.Livestock.place(state, playerId, lane, slotIndex, type)) {
        const animal = E.Livestock.get(type);
        addLog(`${state.players[playerId].name} implante ${animal.label.toLowerCase()} en ligne ${lane + 1}.`);
      }
      E.UI.render(state);
    },

    changeJob(job, direction) {
      const { playerId, lane } = state.selectedVillage;
      const changed = direction === "add"
        ? E.Economy.assignJob(state, playerId, lane, job)
        : E.Economy.unassignJob(state, playerId, lane, job);
      if (changed) {
        const definition = E.Config.jobs[job];
        const verb = direction === "add" ? "devient" : "n’est plus";
        addLog(`Un habitant du village ${lane + 1} ${verb} ${definition.role.toLowerCase()}.`);
      }
      E.UI.render(state);
    },

    assignResidentMission(residentId, mission) {
      const { playerId, lane } = state.selectedVillage;
      const resident = E.Economy.getResident(state, playerId, lane, residentId);
      if (!resident) return;

      let changed = false;
      if (E.Config.jobs[mission]) {
        changed = E.Economy.assignResidentJob(state, playerId, lane, residentId, mission);
      } else if (mission === "attaque" || mission === "defense") {
        changed = E.Economy.deployResident(state, playerId, lane, residentId, mission);
      }

      if (changed) {
        const label = mission === "attaque" ? "attaquer" : mission === "defense" ? "défendre" : E.Config.jobs[mission].label.toLowerCase();
        addLog(`${resident.name} du village ${lane + 1} reçoit la mission : ${label}.`);
      }
      E.UI.render(state);
    },

    releaseResident(residentId) {
      const { playerId, lane } = state.selectedVillage;
      const resident = E.Economy.getResident(state, playerId, lane, residentId);
      if (resident && E.Economy.unassignResidentJob(state, playerId, lane, residentId)) {
        addLog(`${resident.name} du village ${lane + 1} redevient disponible.`);
      }
      E.UI.render(state);
    },

    releaseAllResidents() {
      const { playerId, lane } = state.selectedVillage;
      const village = state.players[playerId]?.villages[lane];
      if (!village || state.phase !== "running" || state.paused) return;
      const residentIds = village.residents.filter((resident) => Object.hasOwn(E.Config.jobs, resident.mission)
        && !pendingBulkTasks.some((task) => task.playerId === playerId && task.lane === lane && task.residentId === resident.id)).map((resident) => resident.id);
      queueBulkTasks(playerId, lane, residentIds, "release");
      if (residentIds.length) addLog(`${residentIds.length} habitant${residentIds.length > 1 ? "s" : ""} du village ${lane + 1} redeviennent disponibles progressivement.`);
      E.UI.render(state);
    },

    build(type) {
      const { playerId, lane } = state.selectedVillage;
      state.pendingPlacement = null;
      if (E.Buildings.buildT1(state, playerId, lane, type)) {
        addLog(`${state.players[playerId].name} construit ${buildingName(type)} en ligne ${lane + 1}.`);
      }
      E.UI.render(state);
    },

    setProfession(residentId, profession) {
      const { playerId, lane } = state.selectedVillage;
      if (E.Economy.setProfession(state, playerId, lane, residentId, profession)) {
        addLog(`${E.Economy.getResident(state, playerId, lane, residentId).name} : ${E.Config.professions[profession].label}.`);
      }
      E.UI.render(state);
    },

    sell(resource) {
      const { playerId, lane } = state.selectedVillage;
      const sale = E.Economy.sell(state, playerId, lane, resource);
      if (sale) addLog(`Vente du village ${lane + 1} : +${sale.gold.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} or.`);
      E.UI.render(state);
    },

    assignProfessionToAll(profession) {
      const { playerId, lane } = state.selectedVillage;
      const changed = E.Economy.assignProfessionToAll(state, playerId, lane, profession);
      if (changed > 0) addLog(profession === "habitant"
        ? `${changed} habitant${changed > 1 ? "s" : ""} du village ${lane + 1} perdent leur métier.`
        : `${changed} habitant${changed > 1 ? "s" : ""} du village ${lane + 1} reçoivent le métier ${E.Config.professions[profession].label.toLowerCase()}.`);
      E.UI.render(state);
    },

    setNextResidentMission(mission) {
      const { playerId, lane } = state.selectedVillage;
      if (E.Economy.setNextResidentMission(state, playerId, lane, mission)) E.UI.render(state);
    },

    setNextResidentProfession(profession) {
      const { playerId, lane } = state.selectedVillage;
      if (E.Economy.setNextResidentProfession(state, playerId, lane, profession)) E.UI.render(state);
    },

    assignAllResidents(mission) {
      const { playerId, lane } = state.selectedVillage;
      if (state.phase !== "running" || state.paused || (!E.Config.jobs[mission] && !["attaque", "defense"].includes(mission))) return;
      if (E.Config.jobs[mission] && !E.Economy.canAssignJob(state, playerId, lane, mission)) return;
      const availableCount = E.Economy.getAvailableResidents(state, playerId, lane);
      const residentIds = E.Economy.availableResidentList(state, playerId, lane).slice(0, availableCount)
        .map((resident) => resident.id)
        .filter((id) => !pendingBulkTasks.some((task) => task.playerId === playerId && task.lane === lane && task.residentId === id));
      queueBulkTasks(playerId, lane, residentIds, mission);
      if (residentIds.length) {
        const label = mission === "attaque" ? "attaquer" : mission === "defense" ? "défendre" : E.Config.jobs[mission]?.label.toLowerCase();
        addLog(`${residentIds.length} habitant${residentIds.length > 1 ? "s" : ""} du village ${lane + 1} reçoivent progressivement la mission : ${label}.`);
      }
      E.UI.render(state);
    },

    slaughter(slotIndex, amount) {
      const { playerId, lane } = state.selectedVillage;
      const result = E.Livestock.slaughter(state, playerId, lane, slotIndex, amount);
      if (result) addLog(`${result.quantity} animal${result.quantity > 1 ? "aux" : ""} abattu${result.quantity > 1 ? "s" : ""} au village ${lane + 1} : +${result.meat} viande.`);
      E.UI.render(state);
    },

    buyResident(resource) {
      const { playerId, lane } = state.selectedVillage;
      const resident = E.Economy.buyResident(state, playerId, lane, resource);
      if (resident) addLog(`${resident.name} rejoint le village ${lane + 1} pour 50 or et 50 unités de ressource.`);
      E.UI.render(state);
    },

    buyShopItem(type) {
      const { playerId, lane } = state.selectedVillage;
      const purchase = E.Transport.buy(state, playerId, lane, type);
      if (purchase) addLog(`${state.players[playerId].name} achète ${purchase.label.toLowerCase()} pour le Littoral de la ligne ${lane + 1}.`);
      E.UI.render(state);
    },

    buyAnimal(type) {
      const { playerId, lane } = state.selectedVillage;
      const purchase = E.Livestock.buy(state, playerId, lane, type);
      if (purchase) addLog(`${E.Config.livestock[type].shortLabel} : un animal rejoint l’enclos ${purchase.slotIndex + 1} du village ${lane + 1}.`);
      E.UI.render(state);
    },

    buyEquipment(residentId, kind, type) {
      const { playerId, lane } = state.selectedVillage;
      const purchase = E.Equipment.buy(state, playerId, lane, residentId, kind, type);
      if (purchase) addLog(`${E.Economy.getResident(state, playerId, lane, residentId).name} équipe : ${E.Config.equipment[kind][type].label}.`);
      E.UI.render(state);
    },

    buySpecialAnimal(type, residentId) {
      const { playerId, lane } = state.selectedVillage;
      const purchase = E.Animals.buy(state, playerId, lane, type, residentId);
      if (purchase) addLog(`${E.Config.specialAnimals[type].label} acheté au village ${lane + 1}${type === "ane" ? ` pour ${E.Economy.getResident(state, playerId, lane, residentId).name}` : ""}.`);
      E.UI.render(state);
    },

    orderAnimal(animalId, mission, slotIndex) {
      const { playerId, lane } = state.selectedVillage;
      if (E.Animals.deploy(state, playerId, lane, animalId, mission, slotIndex)) addLog(`Animal du village ${lane + 1} : ${mission === "garde" ? `garde de l’enclos ${slotIndex + 1}` : mission}.`);
      E.UI.render(state);
    },

    slaughterSpecialAnimal(animalId) {
      const { playerId, lane } = state.selectedVillage;
      if (E.Animals.slaughter(state, playerId, lane, animalId)) addLog(`Sanglier abattu au village ${lane + 1} : +${E.Config.specialAnimals.sanglier.meatAtDeath} viande.`);
      E.UI.render(state);
    },

    upgrade(index, resource) {
      const { playerId, lane } = state.selectedVillage;
      if (E.Buildings.upgrade(state, playerId, lane, index, resource)) addLog(`Amélioration du ${index === "village" ? "village" : "bâtiment"} en ligne ${lane + 1}.`);
      E.UI.render(state);
    },

    deploy(role) {
      if (state.phase !== "running" || state.paused) return;
      const { playerId, lane } = state.selectedVillage;
      state.pendingPlacement = null;
      const village = state.players[playerId].villages[lane];
      const stats = E.Config.units[role];
      if (!village || village.destroyed || E.Economy.getAvailableResidents(state, playerId, lane) < 1 || !stats) return;
      if (stats.requires && !E.Buildings.has(village, stats.requires)) return;

      const resident = E.Economy.availableResidentList(state, playerId, lane)[0];
      if (!resident || !E.Economy.deployResident(state, playerId, lane, resident.id, "attaque")) return;
      addLog(`${resident.name} devient ${stats.label.toLowerCase()} et part attaquer en ligne ${lane + 1}.`);
      E.UI.render(state);
    },

    chooseRedirect(key, lane) {
      if (E.Combat.chooseRedirect(state, key, lane)) addLog(`Les troupes prennent la route de la ligne ${lane + 1}.`);
      E.UI.render(state);
    },

    restart() {
      E.Audio?.play("menu");
      pendingBulkTasks = [];
      state = E.Board.createState();
      if (E.Network.mode === "solo") E.AI.prepareSetup(state);
      previousTimestamp = performance.now();
      E.UI.render(state);
    }
  };

  function buildingName(type) {
    return { bergerie: "une Bergerie", artisanat: "un Artisanat", boucherie: "une Boucherie" }[type] || "un bâtiment";
  }

  function queueBulkTasks(playerId, lane, residentIds, mission) {
    residentIds.forEach((residentId, index) => pendingBulkTasks.push({ playerId, lane, residentId, mission, due: state.elapsed + index * E.Config.bulkTaskInterval }));
    processBulkTasks();
  }

  function processBulkTasks() {
    if (state.phase !== "running" || state.paused) return;
    const due = pendingBulkTasks.filter((task) => task.due <= state.elapsed);
    pendingBulkTasks = pendingBulkTasks.filter((task) => task.due > state.elapsed);
    let changed = false;
    due.forEach((task) => {
      changed = (task.mission === "release"
        ? E.Economy.unassignResidentJob(state, task.playerId, task.lane, task.residentId)
        : E.Config.jobs[task.mission]
          ? E.Economy.assignResidentJob(state, task.playerId, task.lane, task.residentId, task.mission)
          : E.Economy.deployResident(state, task.playerId, task.lane, task.residentId, task.mission)) || changed;
    });
    if (changed) E.UI.render(state);
  }

  function update(delta) {
    state.elapsed += delta;
    processBulkTasks();
    E.Economy.update(state, delta);
    E.Combat.update(state, delta);
    E.Tutorial?.update(state, delta);
    if ((E.Network.mode === "solo" || (E.Network.mode === "tutorial" && E.Tutorial?.freePlay)) && E.AI.update(state, delta)) E.UI.render(state);

    if (state.phase !== "running") return;
    if (state.tutorial?.noTimer) return;
    if (state.elapsed >= E.Config.overtime.start) {
      state.overtimeAccumulator += delta;
      while (state.overtimeAccumulator >= E.Config.overtime.interval && state.phase === "running") {
        state.overtimeAccumulator -= E.Config.overtime.interval;
        E.Combat.applyOvertime(state);
      }
    }
  }

  function viewState() {
    return {
      selectedVillage: state.selectedVillage,
      selectedResidentId: state.selectedResidentId,
      pendingPlacement: state.pendingPlacement
    };
  }

  function restoreView(view) {
    if (!view?.selectedVillage) return;
    state.selectedVillage = view.selectedVillage;
    state.selectedResidentId = view.selectedResidentId;
    state.pendingPlacement = view.pendingPlacement;
  }

  function onlineAllowed(method, args, playerId, view) {
    if (!guestCommands.has(method)) return false;
    if (["selectDeck", "toggleBiome", "confirmBiomes"].includes(method)) return args[0] === playerId;
    if (method === "chooseRedirect") return String(args[0] || "").startsWith(`${playerId}-`);
    return view?.selectedVillage?.playerId === playerId;
  }

  function applyRemoteCommand(message) {
    if (E.Network.mode !== "host" || !onlineAllowed(message.method, message.args || [], message.playerId, message.view)) return;
    const hostView = viewState();
    restoreView(message.view);
    controller[message.method](...(message.args || []));
    restoreView(hostView);
    E.UI.render(state);
    E.Network.sendState(state);
  }

  const onlineController = new Proxy(controller, {
    get(target, method) {
      if (typeof target[method] !== "function") return target[method];
      return (...args) => {
        if (E.Network.mode === "local" || E.Network.mode === "pending") return target[method](...args);
        if (E.Network.mode === "tutorial") {
          if (!E.Tutorial?.allow(method, args, state)) return;
          if (E.Tutorial?.freePlay) {
            if (method === "chooseRedirect" && !String(args[0] || "").startsWith("red-")) return;
            if (!localViewMethods.has(method) && method !== "chooseRedirect" && state.selectedVillage?.playerId !== "red") return;
          }
          const result = target[method](...args);
          E.Tutorial?.afterAction(method, args, state);
          return result;
        }
        if (E.Network.mode === "solo") {
          if (["selectDeck", "toggleBiome", "confirmBiomes"].includes(method) && args[0] !== "red") return;
          if (method === "chooseRedirect" && !String(args[0] || "").startsWith("red-")) return;
          if (!localViewMethods.has(method) && !["selectDeck", "toggleBiome", "confirmBiomes", "start", "togglePause", "restart", "chooseRedirect"].includes(method) && state.selectedVillage?.playerId !== "red") return;
          return target[method](...args);
        }
        if (localViewMethods.has(method)) return target[method](...args);
        if (["selectDeck", "toggleBiome", "confirmBiomes"].includes(method)) {
          if (args[0] !== E.Network.playerId) return;
        } else if (["start", "togglePause", "restart"].includes(method)) {
          if (E.Network.mode !== "host") return;
        } else if (state.selectedVillage?.playerId !== E.Network.playerId && method !== "chooseRedirect") {
          return;
        }
        if (E.Network.mode === "guest") return E.Network.sendCommand(method, args, viewState());
        const result = target[method](...args);
        E.Network.sendState(state);
        return result;
      };
    }
  });

  function frame(timestamp) {
    const rawDelta = (timestamp - previousTimestamp) / 1000;
    previousTimestamp = timestamp;
    if (state.phase === "running" && !state.paused) {
      if (E.Network.mode !== "guest") update(Math.min(rawDelta, E.Config.simulation.maxDelta));
    }
    E.UI.renderFrame(state);
    E.Tutorial?.render(state);
    E.Board3D?.update(state);
    if (E.Network.mode === "host") {
      networkAccumulator += rawDelta;
      if (networkAccumulator >= 0.1) {
        networkAccumulator = 0;
        E.Network.sendState(state);
      }
    }
    requestAnimationFrame(frame);
  }

  E.Network.init({
    onReady(session) {
      if (session.mode === "solo") E.AI.prepareSetup(state);
      if (session.mode === "tutorial") E.Tutorial.start(state);
      if (session.mode === "guest") {
        state.selectedVillage = { playerId: "blue", lane: 0 };
        state.selectedResidentId = state.players.blue.villages[0].residents[0]?.id || null;
      }
      E.UI.render(state);
      if (session.mode === "host") E.Network.sendState(state);
    },
    onState(snapshot) {
      if (E.Network.mode !== "guest" || !snapshot) return;
      const guestView = viewState();
      state = snapshot;
      restoreView(guestView);
      previousTimestamp = performance.now();
      E.UI.render(state);
    },
    onCommand: applyRemoteCommand,
    onStateRequest() { E.Network.sendState(state); }
  });
  E.UI.init(onlineController);
  E.Tutorial?.init({ controller: onlineController });
  E.Board3D?.init({ container: document.querySelector("#battlefield-3d") });
  E.UI.render(state);
  requestAnimationFrame(frame);
}());
