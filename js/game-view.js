(function () {
  "use strict";
  const E = window.Eredita;
  let readState;
  let commands;
  const resourceLabels = { ble: "Blé", chataigne: "Châtaigne", raisin: "Raisin", viande: "Viande", poisson: "Poisson", lait: "Lait" };

  // Adaptateur de vue : relit la référence courante, y compris après un snapshot réseau.
  function villageInfo(playerId, lane) {
    const state = readState();
    const player = state.players[playerId];
    const village = player?.villages[lane];
    if (!village) return null;
    return {
      title: `${player.name} · Village ${lane + 1}`,
      biome: E.Biomes.labels[village.biome], level: village.level,
      hp: village.hp, maxHp: village.maxHp, destroyed: village.destroyed,
      population: village.population, populationMax: village.populationMax,
      resources: E.Config.resources.map((key) => ({ label: resourceLabels[key], amount: village.resources[key] })),
      buildings: village.buildings.map((building) => `${building.type} T${building.level}`)
    };
  }

  // Point d'extension pour la future carte active. Aucun coût/effet/règle ici.
  // Le futur adaptateur commun desktop/XR devra fournir les trois opérations métier.
  function createCardTargeting(adapter) {
    let activeCard = null;
    return {
      activate(cardId) {
        if (!adapter?.canActivate?.(readState(), cardId)) return false;
        activeCard = cardId;
        return true;
      },
      getTargets() { return activeCard === null ? [] : adapter.getTargets(readState(), activeCard); },
      confirm(target) {
        if (activeCard === null) return false;
        const result = adapter.play(commands, activeCard, target);
        if (result) activeCard = null;
        return result;
      },
      cancel() { activeCard = null; }
    };
  }

  E.GameView = {
    init({ getState, controller }) { readState = getState; commands = controller; },
    getState: () => readState(),
    getPlayerId: () => E.Network.playerId || "red",
    canControl(playerId) {
      const mode = E.Network.mode;
      return mode === "local" ? ["red", "blue"].includes(playerId)
        : mode === "solo" || mode === "host" ? playerId === "red"
          : mode === "guest" ? playerId === "blue" : false;
    },
    command(method, ...args) {
      const allowed = new Set([
        "selectDeck", "toggleBiome", "confirmBiomes", "start", "togglePause",
        "selectResident", "placeCrop", "placeLivestock", "slaughter", "build", "upgrade", "changeJob",
        "setProfession", "assignProfessionToAll", "setNextResidentProfession",
        "assignResidentMission", "assignAllResidents", "releaseResident", "releaseAllResidents", "setNextResidentMission",
        "sell", "buyResident", "buyShopItem", "buyAnimal", "buyEquipment", "buySpecialAnimal",
        "orderAnimal", "slaughterSpecialAnimal", "deploy", "chooseRedirect"
      ]);
      if (!allowed.has(method) || typeof commands[method] !== "function") return false;
      if (["selectDeck", "toggleBiome", "confirmBiomes"].includes(method)) {
        if (!this.canControl(args[0])) return false;
      } else if (method === "start" || method === "togglePause") {
        if (E.Network.mode === "guest") return false;
      } else if (method === "chooseRedirect") {
        if (E.Network.mode !== "local" && !String(args[0]).startsWith(`${this.getPlayerId()}-`)) return false;
      } else if (method !== "selectResident" && !this.canControl(readState().selectedVillage.playerId)) return false;
      // Les anciens contrôleurs retournent undefined ; préserver ce contrat,
      // mais ne jamais transformer un rejet explicite en confirmation XR.
      return commands[method](...args) !== false;
    },
    returnToLobby() {
      E.Network.leaveRoom();
      commands.restart();
    },
    setXRBoardWidth(width) {
      if (E.Network.mode === "guest" || !Number.isFinite(width)) return false;
      readState().xrBoardWidth = Math.max(E.Config.xr.minWidth, Math.min(E.Config.xr.maxWidth, width));
      E.Network.sendState(readState());
      return true;
    },
    villageInfo,
    selectVillage(playerId, lane) {
      if (!readState().players[playerId]?.villages[lane]) return false;
      commands.selectVillage(playerId, lane);
      return true;
    },
    createCardTargeting
  };
}());
