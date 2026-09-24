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
    villageInfo,
    selectVillage(playerId, lane) {
      if (!readState().players[playerId]?.villages[lane]) return false;
      commands.selectVillage(playerId, lane);
      return true;
    },
    createCardTargeting
  };
}());
