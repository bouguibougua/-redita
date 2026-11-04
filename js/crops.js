(function () {
  "use strict";

  const E = window.Eredita;

  function get(type) {
    return Object.hasOwn(E.Config.crops, type) ? E.Config.crops[type] : null;
  }

  function levelOf(content) {
    return Number.isInteger(content?.level) && Object.hasOwn(E.Config.cropLevels, content.level) ? content.level : 1;
  }

  function yieldOf(content) {
    return E.Config.cropLevels[levelOf(content)].yield;
  }

  function context(state, playerId, lane, slotIndex) {
    const player = Object.hasOwn(state.players, playerId) ? state.players[playerId] : null;
    const village = Number.isInteger(lane) ? player?.villages?.[lane] : null;
    const slot = Number.isInteger(slotIndex) ? village?.slots?.[slotIndex] : null;
    return { player, village, slot };
  }

  function active(state, village) {
    return state.phase === "running" && !state.paused && village && !village.destroyed;
  }

  function isAllowedInBiome(type, biome) {
    const crop = get(type);
    return Boolean(crop && crop.allowedBiomes.includes(biome));
  }

  function canPlace(state, playerId, lane, slotIndex, type) {
    const { player, village, slot } = context(state, playerId, lane, slotIndex);

    return Boolean(
      active(state, village) &&
      !E.MythologyEffects?.isBurned(state, village) &&
      slot &&
      slot.type === "free" &&
      (!slot.content || (slot.content.category === "crop" && slot.content.type !== type)) &&
      isAllowedInBiome(type, village.biome) &&
      player.gold >= E.Config.cropLevels[1].gold
    );
  }

  function hasAvailableSlot(state, playerId, lane, type) {
    const player = state.players[playerId];
    const village = player && player.villages[lane];
    if (!village || !isAllowedInBiome(type, village.biome)) return false;
    return village.slots.some((slot, index) => canPlace(state, playerId, lane, index, type));
  }

  function place(state, playerId, lane, slotIndex, type) {
    if (!canPlace(state, playerId, lane, slotIndex, type)) return false;
    const crop = get(type);
    const { player, slot } = context(state, playerId, lane, slotIndex);
    const gold = E.Config.cropLevels[1].gold;
    player.gold -= gold;
    slot.content = {
      category: "crop",
      type,
      level: 1,
      investedGold: gold,
      hp: crop.hp,
      maxHp: crop.hp,
      source: "prototype-direct"
    };
    return true;
  }

  function upgradeQuote(state, playerId, lane, slotIndex) {
    const { player, village, slot } = context(state, playerId, lane, slotIndex);
    const content = slot?.content;
    if (content?.category !== "crop" || !get(content.type)) return null;
    const level = levelOf(content), nextLevel = level + 1, next = E.Config.cropLevels[nextLevel];
    const reason = !active(state, village) ? "Partie inactive ou en pause"
      : content.hp <= 0 ? "Culture détruite"
        : E.MythologyEffects?.isBurned(state, village) ? "Terrain brûlé"
          : !next ? "Niveau maximum"
            : player.gold < next.gold ? "Or insuffisant" : null;
    return { level, nextLevel, gold: next?.gold ?? 0, yield: next?.yield ?? yieldOf(content), allowed: !reason, reason };
  }

  function upgrade(state, playerId, lane, slotIndex) {
    const quote = upgradeQuote(state, playerId, lane, slotIndex);
    if (!quote?.allowed) return false;
    const { player, slot } = context(state, playerId, lane, slotIndex);
    player.gold -= quote.gold;
    slot.content.level = quote.nextLevel;
    slot.content.investedGold = (slot.content.investedGold || 0) + quote.gold;
    return true;
  }

  function removalQuote(state, playerId, lane, slotIndex) {
    const { village, slot } = context(state, playerId, lane, slotIndex);
    if (slot?.content?.category !== "crop") return null;
    return { refund: slot.content.investedGold || 0,
      allowed: Boolean(active(state, village) && state.preparationRemaining > 0) };
  }

  function remove(state, playerId, lane, slotIndex) {
    const quote = removalQuote(state, playerId, lane, slotIndex);
    if (!quote?.allowed) return false;
    const { player, slot } = context(state, playerId, lane, slotIndex);
    player.gold += quote.refund;
    slot.content = null;
    return quote;
  }

  E.Crops = { get, levelOf, yieldOf, isAllowedInBiome, canPlace, hasAvailableSlot, place, upgradeQuote, upgrade, removalQuote, remove };
}());
