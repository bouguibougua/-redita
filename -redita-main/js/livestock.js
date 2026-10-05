(function () {
  "use strict";

  const E = window.Eredita;

  function get(type) {
    return Object.hasOwn(E.Config.livestock, type) ? E.Config.livestock[type] : null;
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
      get(type) &&
      slot &&
      (slot.type === "free" || slot.type === "animal") &&
      !slot.content
    );
  }

  function hasAvailableSlot(state, playerId, lane, type) {
    const player = state.players[playerId];
    const village = player && player.villages[lane];
    if (!village || !get(type)) return false;
    return village.slots.some((slot, index) => canPlace(state, playerId, lane, index, type));
  }

  function place(state, playerId, lane, slotIndex, type) {
    if (!canPlace(state, playerId, lane, slotIndex, type)) return false;
    const animal = get(type);
    const count = E.Config.startingLivestockCount;
    state.players[playerId].villages[lane].slots[slotIndex].content = {
      category: "livestock",
      type,
      count,
      hp: count * animal.hpPerAnimal,
      maxHp: count * animal.hpPerAnimal,
      reproductionProgress: 0,
      source: "prototype-direct"
    };
    return true;
  }

  function purchaseQuote(state, playerId, lane, type) {
    const player = state.players[playerId];
    const village = player?.villages[lane];
    const animal = get(type);
    if (!village || !animal) return null;
    const gold = animal.purchaseGold;
    const quantity = animal.purchaseCount;
    const requiredTier = animal.requiredTier;
    if (!Number.isFinite(gold) || gold < 0 || !Number.isInteger(quantity) || quantity < 1 ||
      !Number.isInteger(requiredTier) || requiredTier < 1) return null;

    const existing = [];
    const empty = [];
    village.slots.forEach((slot, index) => {
      if (slot.type !== "free" && slot.type !== "animal") return;
      if (!slot.content) empty.push(index);
      else if (slot.content.category === "livestock" && slot.content.type === type &&
        slot.content.count > 0 && slot.content.hp > 0) existing.push(index);
    });
    // Le devis ne tire pas de destination : seul l'achat autoritaire consomme l'aléatoire.
    const slotIndices = existing.length ? existing : empty;
    const buildingLevel = Math.max(0, ...village.buildings
      .filter((building) => building.type === "bergerie")
      .map((building) => building.level));
    let reason = null;
    if (state.phase !== "running") reason = "Partie inactive";
    else if (state.paused) reason = "Partie en pause";
    else if (village.destroyed) reason = "Village détruit";
    else if (buildingLevel < requiredTier) reason = `Bergerie T${requiredTier} requise`;
    else if (!slotIndices.length) reason = "Aucun enclos compatible disponible";
    else if (player.gold < gold) reason = "Or insuffisant";
    return { type, label: animal.shortLabel, icon: animal.icon, gold, quantity, requiredTier,
      slotIndices, newEnclosure: !existing.length, allowed: !reason, reason: reason || "Disponible" };
  }

  function buy(state, playerId, lane, type) {
    const quote = purchaseQuote(state, playerId, lane, type);
    if (!quote?.allowed) return false;
    const player = state.players[playerId];
    const village = player.villages[lane];
    const slotIndex = quote.slotIndices[Math.floor(Math.random() * quote.slotIndices.length)];
    const slot = village.slots[slotIndex];
    const addedHp = quote.quantity * get(type).hpPerAnimal;
    if (slot.content) {
      slot.content.count += quote.quantity;
      slot.content.maxHp += addedHp;
      slot.content.hp += addedHp;
    } else {
      slot.content = { category: "livestock", type, count: quote.quantity,
        hp: addedHp, maxHp: addedHp, reproductionProgress: 0, source: "shop" };
    }
    player.gold -= quote.gold;
    return { ...quote, slotIndex };
  }

  function refreshHp(content) {
    const animal = get(content.type);
    if (!animal) return;
    content.maxHp = content.count * animal.hpPerAnimal;
    content.hp = content.maxHp;
  }

  function slaughter(state, playerId, lane, slotIndex, amount) {
    const village = state.players[playerId]?.villages[lane];
    const slot = village?.slots[slotIndex];
    const content = slot?.content;
    const quantity = Math.floor(Number(amount));
    const animal = content?.category === "livestock" ? get(content.type) : null;
    if (state.phase !== "running" || state.paused || !village || village.destroyed || !animal ||
      !Number.isFinite(quantity) || quantity < 1 || quantity > content.count) return false;
    const meat = quantity * animal.meatAtDeath;
    const type = content.type;
    content.count -= quantity;
    village.resources.viande += meat;
    if (content.count <= 0) slot.content = null;
    else {
      content.maxHp = content.count * animal.hpPerAnimal;
      content.hp = Math.min(content.hp, content.maxHp);
    }
    return { quantity, meat, type };
  }

  E.Livestock = { get, canPlace, hasAvailableSlot, place, purchaseQuote, buy, refreshHp, slaughter };
}());
