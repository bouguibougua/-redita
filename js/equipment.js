(function () {
  "use strict";

  const E = window.Eredita;
  const fields = { tools: "tool", armors: "armor" };

  function quote(state, playerId, lane, residentId, kind, type) {
    if (!Object.hasOwn(fields, kind) || !Object.hasOwn(E.Config.equipment[kind], type)) return null;
    const player = state.players[playerId];
    const village = player?.villages[lane];
    if (!village) return null;
    const item = E.Config.equipment[kind][type];
    const resident = village.residents.find((candidate) => candidate.id === residentId);
    const level = Math.max(0, ...village.buildings.filter((building) => building.type === "artisanat").map((building) => building.level));
    const equipped = resident?.[fields[kind]] === type;
    let reason = null;
    if (state.phase !== "running") reason = "Partie inactive";
    else if (state.paused) reason = "Partie en pause";
    else if (village.destroyed) reason = "Village détruit";
    else if (level < item.requiredTier) reason = `Artisanat T${item.requiredTier} requis`;
    else if (!resident) reason = "Sélectionnez un habitant du village";
    else if (resident.unitId || ["attaque", "defense"].includes(resident.mission)) reason = "Habitant engagé au combat";
    else if (equipped) reason = "Déjà équipé";
    else if (player.gold < item.gold) reason = "Or insuffisant";
    return { ...item, kind, type, residentId, equipped, allowed: !reason, reason: reason || "Disponible" };
  }

  function buy(state, playerId, lane, residentId, kind, type) {
    const purchase = quote(state, playerId, lane, residentId, kind, type);
    if (!purchase?.allowed) return false;
    const player = state.players[playerId];
    const resident = player.villages[lane].residents.find((candidate) => candidate.id === residentId);
    player.gold -= purchase.gold;
    resident[fields[kind]] = type;
    return purchase;
  }

  function bonuses(resident) {
    const tool = resident && E.Config.equipment.tools[resident.tool];
    const armor = resident && E.Config.equipment.armors[resident.armor];
    return {
      damage: tool?.damage || 0,
      hp: armor?.hp || 0,
      productionSpeed: resident?.tool === "bois" ? tool?.productionBonus || 0 : 0,
      productionYield: resident?.tool !== "bois" ? tool?.productionBonus || 0 : 0
    };
  }

  E.Equipment = { quote, buy, bonuses };
}());
