(function () {
  "use strict";

  const E = window.Eredita;

  function get(type) {
    return E.Config.crops[type] || null;
  }

  function isAllowedInBiome(type, biome) {
    const crop = get(type);
    return Boolean(crop && crop.allowedBiomes.includes(biome));
  }

  function canPlace(state, playerId, lane, slotIndex, type) {
    const player = state.players[playerId];
    const village = player && player.villages[lane];
    const slot = village && village.slots[slotIndex];

    return Boolean(
      state.phase === "running" &&
      !state.paused &&
      village &&
      !village.destroyed &&
      slot &&
      slot.type === "free" &&
      (!slot.content || (slot.content.category === "crop" && slot.content.type !== type)) &&
      isAllowedInBiome(type, village.biome)
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
    state.players[playerId].villages[lane].slots[slotIndex].content = {
      category: "crop",
      type,
      hp: crop.hp,
      maxHp: crop.hp,
      // Le placement direct remplace provisoirement la future carte/méthode.
      source: "prototype-direct"
    };
    return true;
  }

  E.Crops = { get, isAllowedInBiome, canPlace, hasAvailableSlot, place };
}());
