(function () {
  "use strict";

  const E = window.Eredita;

  function buildT1(state, playerId, lane, type) {
    const player = state.players[playerId];
    const village = player && player.villages[lane];
    const config = E.Config.building;

    if (state.phase !== "running" || state.paused || !village || village.destroyed) return false;
    if (!config.types.includes(type) || village.buildings.length >= config.slots) return false;
    if (player.gold < config.T1.gold) return false;

    player.gold -= config.T1.gold;
    village.buildings.push({ type, level: 1, hpBonus: config.T1.hp });
    village.maxHp += config.T1.hp;
    village.hp += config.T1.hp;
    return true;
  }

  function has(village, type) {
    return village.buildings.some((building) => building.type === type);
  }

  function upgradeQuote(state, playerId, lane, index, resource) {
    const player = state.players[playerId];
    const village = player && player.villages[lane];
    const target = index === "village" ? village : village && village.buildings[index];
    if (!target || target.level >= 3) return null;
    const level = target.level + 1;
    const isVillage = index === "village";
    const cost = isVillage ? { gold: E.Config.villageUpgradeGold[level], resourceAmount: 0 } : E.Config.building[`T${level}`];
    const resourceType = cost.resourceType || (E.Config.buildingUpgradeResourceChoice ? resource : null);
    const affordable = player.gold >= cost.gold && (!cost.resourceAmount ||
      (E.Config.resources.includes(resourceType) && village.resources[resourceType] >= cost.resourceAmount));
    return { level, gold: cost.gold, resourceAmount: cost.resourceAmount, resourceType,
      allowed: state.phase === "running" && !state.paused && !village.destroyed && affordable };
  }

  function upgrade(state, playerId, lane, index, resource) {
    const quote = upgradeQuote(state, playerId, lane, index, resource);
    if (!quote || !quote.allowed) return false;
    const player = state.players[playerId];
    const village = player.villages[lane];
    player.gold -= quote.gold;
    if (quote.resourceAmount) village.resources[quote.resourceType] -= quote.resourceAmount;
    let addedHp;
    if (index === "village") {
      const next = E.Config.village[`T${quote.level}`];
      addedHp = next.hp - E.Config.village[`T${village.level}`].hp;
      village.level = quote.level;
      village.populationMax = next.populationMax;
    } else {
      const building = village.buildings[index];
      const next = E.Config.building[`T${quote.level}`];
      addedHp = next.hp - building.hpBonus;
      building.level = quote.level;
      building.hpBonus = next.hp;
    }
    village.maxHp += addedHp;
    village.hp += addedHp;
    return true;
  }

  E.Buildings = { buildT1, has, upgradeQuote, upgrade };
}());
