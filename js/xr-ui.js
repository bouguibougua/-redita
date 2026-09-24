(function () {
  "use strict";
  const E = window.Eredita;
  const labels = { ble: "Blé", chataigne: "Châtaigne", raisin: "Raisin", viande: "Viande", poisson: "Poisson", lait: "Lait" };
  const button = (label, action, enabled = true) => [label, action, enabled];
  const row = (...items) => items;
  const command = (method, ...args) => ({ type: "command", method, args });
  const open = (name, data) => ({ type: "open", name, data });

  function create(dashboard, status) {
    let modal = null;
    let page = 0;
    let residentPage = 0;
    let visible = true;
    let muted = E.Audio?.muted || false;
    let quality = "normal";
    let nav = [];
    let focused = 0;
    const owner = () => E.GameView.getPlayerId();
    const state = () => E.GameView.getState();
    const selection = () => state().selectedVillage;
    const village = () => state().players[selection().playerId]?.villages[selection().lane];
    const controllable = () => E.GameView.canControl(selection().playerId) && state().phase === "running" && !state().paused && !village()?.destroyed;
    const selectedResident = () => village()?.residents.find((r) => r.id === state().selectedResidentId) || village()?.residents[0];
    function setModal(name, data) { modal = name ? { name, data } : null; page = 0; focused = 0; }
    function paginate(items, size = E.Config.xr.dashboardRowsPerPage) {
      const pages = Math.max(1, Math.ceil(items.length / size)); page = Math.max(0, Math.min(page, pages - 1));
      return { items: items.slice(page * size, (page + 1) * size), pages };
    }
    function modalContent() {
      const s = state(), v = village(), p = s.players[selection().playerId], own = controllable();
      if (!modal) return null;
      const name = modal.name, data = modal.data;
      let title = "", lines = [], entries = [];
      if (name === "mode") {
        title = "Choisir une partie";
        lines = ["Entraînement contre l’IA ou partie locale.", "Pour un salon en ligne, utilisez le menu de Quest Browser."];
        entries = [button("Entraînement", { type: "mode", mode: "solo" }), button("Local à deux", { type: "mode", mode: "local" })];
      } else if (name === "settings") {
        title = "Réglages"; lines = ["Gâchette ou A : activer · B : retour", "Le plateau reste stable pendant la partie."];
        entries = [button(muted ? "Réactiver le son" : "Couper le son", { type: "audio" }),
          button(`Graphismes : ${quality}`, { type: "quality" }),
          button(s.paused ? "Reprendre" : "Pause", command("togglePause"), s.phase === "running" && E.Network.mode !== "guest"),
          button("Déplacer le plateau", { type: "manipulate", mode: "move" }, E.Network.mode !== "guest"),
          button("Pivoter le plateau", { type: "manipulate", mode: "rotate" }, E.Network.mode !== "guest"),
          button("Changer la taille", { type: "manipulate", mode: "size" }, E.Network.mode !== "guest"),
          button(E.Network.mode === "guest" ? "Replacer localement" : "Recentrer", { type: "recenter" }),
          button("Quitter la réalité mixte", { type: "exit" }),
          button("Retour au salon", open("leave"))];
      } else if (name === "leave") {
        title = "Quitter la partie ?"; lines = ["Votre session de jeu prendra fin."];
        entries = [button("Confirmer", { type: "leave" }), button("Annuler", { type: "back" })];
      } else if (name === "missions" || name === "next-mission") {
        title = name === "missions" ? `Mission · ${selectedResident()?.name || "habitant"}` : "Mission du prochain habitant";
        const id = selectedResident()?.id;
        entries = [...Object.entries(E.Config.jobs).map(([key, def]) => button(def.label, command(name === "missions" ? "assignResidentMission" : "setNextResidentMission", ...(name === "missions" ? [id, key] : [key])), own && (name !== "missions" || Boolean(id)))),
          ...["attaque", "defense"].map((mission) => button(mission === "attaque" ? "Attaquer" : "Défendre", command(name === "missions" ? "assignResidentMission" : "setNextResidentMission", ...(name === "missions" ? [id, mission] : [mission])), own && (name !== "missions" || Boolean(id)))),
          button(name === "missions" ? "Rendre disponible" : "Disponible", command(name === "missions" ? "releaseResident" : "setNextResidentMission", ...(name === "missions" ? [id] : ["disponible"])), own && (name !== "missions" || Boolean(id)))];
      } else if (["professions", "all-professions", "next-profession"].includes(name)) {
        title = name === "professions" ? `Métier · ${selectedResident()?.name || "habitant"}` : name === "all-professions" ? "Métier pour tous" : "Métier du prochain";
        const id = selectedResident()?.id;
        entries = Object.entries(E.Config.professions).map(([key, def]) => button(def.label,
          command(name === "professions" ? "setProfession" : name === "all-professions" ? "assignProfessionToAll" : "setNextResidentProfession", ...(name === "professions" ? [id, key] : [key])), own && (!def.requires || E.Buildings.has(v, def.requires))));
      } else if (name === "all-missions") {
        title = "Mission pour tous les disponibles";
        entries = [...Object.entries(E.Config.jobs).map(([key, def]) => button(def.label, command("assignAllResidents", key), own)),
          button("Attaquer", command("assignAllResidents", "attaque"), own), button("Défendre", command("assignAllResidents", "defense"), own),
          button("Libérer les travailleurs", command("releaseAllResidents"), own)];
      } else if (name === "build") {
        title = "Construire"; lines = [`Or : ${Math.floor(p.gold)} · places ${v.buildings.length}/${E.Config.building.slots}`];
        entries = E.Config.building.types.map((type) => button(type, command("build", type), own && p.gold >= E.Config.building.T1.gold && v.buildings.length < E.Config.building.slots));
      } else if (name === "upgrade-list") {
        title = "Améliorer un bâtiment";
        entries = v.buildings.map((building, index) => button(`${building.type} T${building.level}`, open("upgrade", index), building.level < 3));
      } else if (name === "upgrade") {
        title = `Améliorer ${data === "village" ? "le village" : v.buildings[data]?.type || "bâtiment"}`;
        const resources = data === "village" ? ["ble"] : E.Config.resources;
        entries = resources.map((resource) => { const q = E.Buildings.upgradeQuote(s, p.id, v.lane, data, resource); return button(`${labels[resource]} · ${q?.gold || "—"} or${q?.resourceAmount ? ` +${q.resourceAmount}` : ""}`, command("upgrade", data, resource), own && Boolean(q?.allowed)); });
      } else if (name === "shop") {
        title = "Échoppes et ventes";
        lines = [`Or : ${Math.floor(p.gold)}`];
        entries = [button("Vendre ressources", open("sell")), button("Acheter un habitant", open("buy-resident")),
          ...Object.entries(E.Config.villageShops).map(([key, shop]) => button(shop.label, open("store", key), E.Transport.buildingLevel(v, key) > 0)),
          button("Compagnons", open("animals"))];
      } else if (name === "sell" || name === "buy-resident") {
        title = name === "sell" ? "Vendre les stocks" : "Acheter un habitant";
        if (name === "buy-resident") lines = [`Coût : ${E.Config.residentPurchase.gold} or + ${E.Config.residentPurchase.resourceAmount} ressources`];
        entries = E.Config.resources.map((resource) => button(`${labels[resource]} · ${Math.floor(v.resources[resource])}`, command(name === "sell" ? "sell" : "buyResident", resource), own && (name === "sell" ? E.Economy.saleQuote(v, resource).amount > 0 : E.Economy.canBuyResident(s, p.id, v.lane, resource))));
      } else if (name === "store") {
        title = E.Config.villageShops[data].label;
        const level = E.Transport.buildingLevel(v, data);
        entries = Object.entries(E.Config.villageShops[data].tiers).flatMap(([tier, items]) => items.map((item) => {
          const resident = selectedResident();
          if (item.animalType) return button(item.label, command("buyAnimal", item.animalType), own && E.Livestock.purchaseQuote(s, p.id, v.lane, item.animalType).allowed);
          if (item.purchaseType) return button(item.label, command("buyShopItem", item.purchaseType), own && level >= Number(tier) && E.Transport.shopQuote(s, p.id, v.lane, item.purchaseType).allowed);
          if (item.equipmentKind) return button(item.label, command("buyEquipment", resident?.id, item.equipmentKind, item.equipmentType), own && E.Equipment.quote(s, p.id, v.lane, resident?.id, item.equipmentKind, item.equipmentType).allowed);
          if (item.specialAnimal) return button(item.label, command("buySpecialAnimal", item.specialAnimal, resident?.id), own && E.Animals.purchaseQuote(s, p.id, v.lane, item.specialAnimal, resident?.id).allowed);
          return button(`${item.label} · à venir`, null, false);
        }));
      } else if (name === "animals") {
        title = "Compagnons";
        entries = (v.animals || []).flatMap((animal) => [button(`${E.Config.specialAnimals[animal.type].label} · attaquer`, command("orderAnimal", animal.id, "attaque"), own && E.Animals.orderQuote(s, p.id, v.lane, animal.id, "attaque").allowed),
          ...(animal.type === "chien" ? [button("Défendre", command("orderAnimal", animal.id, "defense"), own && E.Animals.orderQuote(s, p.id, v.lane, animal.id, "defense").allowed), button("Perturber", command("orderAnimal", animal.id, "perturber"), own && E.Animals.orderQuote(s, p.id, v.lane, animal.id, "perturber").allowed),
            ...v.slots.map((slot, index) => button(`Garder enclos ${index + 1}`, command("orderAnimal", animal.id, "garde", index), own && slot.content?.category === "livestock" && E.Animals.orderQuote(s, p.id, v.lane, animal.id, "garde", index).allowed))] : [button("Abattre", command("slaughterSpecialAnimal", animal.id), own && !animal.unitId)])]);
      } else if (name === "slots") {
        title = "Cultures et élevages";
        entries = v.slots.flatMap((slot, index) => [button(`Emplacement ${index + 1} · ${slot.content?.type || "vide"}`, open("slot", index))]);
      } else if (name === "slot") {
        title = `Emplacement ${data + 1}`;
        entries = [...Object.entries(E.Config.crops).map(([key, crop]) => button(crop.label, command("placeCrop", key, data), own && E.Crops.canPlace(s, p.id, v.lane, data, key))),
          ...Object.entries(E.Config.livestock).map(([key, animal]) => button(animal.label, command("placeLivestock", key, data), own && E.Livestock.canPlace(s, p.id, v.lane, data, key)))];
        if (v.slots[data]?.content?.category === "livestock") entries.push(button("Abattre 1", command("slaughter", data, 1), own));
      } else if (name === "setup") {
        title = "Préparer la partie";
        const id = E.Network.mode === "local" ? (data || "red") : owner();
        const player = s.players[id];
        lines = [`${player.name} · ${player.setupConfirmed ? "confirmé" : "à confirmer"}`, `Biomes cochés : ${player.setupSelection.length}/2`];
        entries = [0, 1, 2].map((index) => button(`Deck ${index + 1}${player.selectedDeck === index ? " ✓" : ""}`, command("selectDeck", id, index), !player.setupConfirmed));
        entries.push(
          ...player.villages.map((item, index) => button(`Village ${index + 1} · ${E.Biomes.labels[item.biome]} ${player.setupSelection.includes(index) ? "✓" : ""}`, command("toggleBiome", id, index), !player.setupConfirmed)),
          button("Conserver", command("confirmBiomes", id, "keep"), !player.setupConfirmed), button("Échanger", command("confirmBiomes", id, "exchange"), !player.setupConfirmed && player.setupSelection.length > 0));
        if (E.Network.mode === "local") entries.push(button(id === "red" ? "Préparer Bleu" : "Préparer Rouge", open("setup", id === "red" ? "blue" : "red")));
        entries.push(button("Commencer", command("start"), s.players.red.setupConfirmed && s.players.blue.setupConfirmed && E.Network.mode !== "guest"));
        entries.push(button("Réglages", open("settings")));
      } else if (name === "redirect") {
        title = "Choisir une route";
        const request = s.pendingRedirects.find((item) => item.key === data);
        entries = (request?.candidates || []).map((lane) => button(`Ligne ${lane + 1}`, command("chooseRedirect", data, lane)));
      } else if (name === "result") {
        title = "Partie terminée"; lines = [s.result === "draw" ? "Égalité" : s.result === "red" ? "Victoire de Rouge" : s.result === "blue" ? "Victoire de Bleu" : "Résultat affiché sur le plateau"];
        entries = [button("Retour au salon", open("leave"))];
      } else if (name === "village-info") {
        title = `${p.name} · Village ${v.lane + 1}`;
        lines = [`${E.Biomes.labels[v.biome]} · T${v.level} · ${Math.ceil(v.hp)}/${v.maxHp} PV`, `${v.population}/${v.populationMax} habitants`, ...E.Config.resources.map((key) => `${labels[key]} : ${Math.floor(v.resources[key])}`), ...v.buildings.map((building) => `${building.type} T${building.level}`)];
        entries = [button("Gérer ce village", { type: "back" })];
      } else if (name === "cards") {
        title = "Cartes";
        lines = ["Les cartes actives ne sont pas encore", "implémentées dans le jeu classique.", "Aucune carte ne peut être jouée ici."];
      }
      const paged = paginate(entries);
      const rows = paged.items.map((entry) => row(entry));
      if (paged.pages > 1) rows.push(row(button("◀ Préc.", { type: "page", delta: -1 }, page > 0), button(`${page + 1}/${paged.pages}`, null, false), button("Suiv. ▶", { type: "page", delta: 1 }, page + 1 < paged.pages)));
      rows.push(row(button("Retour · B", { type: "back" })));
      return { title, lines, rows };
    }
    function render() {
      const s = state(), sel = selection(), v = village(), p = s.players[sel.playerId], own = controllable();
      for (const id of ["red", "blue"]) {
        const player = s.players[id];
        dashboard.paint(`${id}Gold`, `${id === "red" ? "VILLAGES ROUGES" : "VILLAGES BLEUS"} · ${Math.floor(player.gold)} or`, [], []);
        player.villages.forEach((item, lane) => dashboard.paint(`${id}${lane}`,
          `${id === "red" ? "ROUGE" : "BLEU"} V${lane + 1}`,
          [`PV ${Math.ceil(item.hp)}/${item.maxHp}`, `Pop. ${item.population}/${item.populationMax}`,
            `Dispo. ${item.residents.filter((resident) => resident.mission === "disponible" && !resident.unitId).length}`,
            `🌾${Math.floor(item.resources.ble)} 🌰${Math.floor(item.resources.chataigne)} 🍇${Math.floor(item.resources.raisin)}`,
            `🍖${Math.floor(item.resources.viande)} 🐟${Math.floor(item.resources.poisson)} 🥛${Math.floor(item.resources.lait)}`], [], true,
          { action: { type: "select-village", playerId: id, lane }, selected: sel.playerId === id && sel.lane === lane }));
      }
      const remaining = Math.max(0, E.Config.normalDuration - s.elapsed);
      dashboard.paint("clock", s.phase === "setup" ? "PRÉPARATION" : `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, "0")}`, [s.paused ? "PAUSE" : s.phase === "ended" ? "TERMINÉ" : "FRONTIÈRE"], []);
      dashboard.paint("gear", "⚙", [], [], true, { action: open("settings") });
      const managerVisible = visible && s.phase === "running";
      const available = v ? E.Economy.getAvailableResidents(s, p.id, v.lane) : 0;
      dashboard.paint("jobs", `Métiers à attribuer · ${available} libres`, [], [
        ...Object.entries(E.Config.jobs).map(([key, def]) => row(button(`${def.label} · +1`, command("changeJob", key, "add"), own && E.Economy.canAssignJob(s, p.id, v.lane, key)))),
        row(button("Métier individuel", open("professions"), own), button("Métier à tous", open("all-professions"), own))
      ], managerVisible);
      dashboard.paint("info", `⌂ ${p.name} · Village ${sel.lane + 1}`, v ? [
        `${E.Biomes.labels[v.biome]} · T${v.level} · ${Math.ceil(v.hp)}/${v.maxHp} PV`,
        `${v.population}/${v.populationMax} habitants · ${available} libres`,
        ...E.Config.resources.map((key) => `${labels[key]} : ${Math.floor(v.resources[key])}`)
      ] : [], [row(button("Échoppes", open("shop"), own), button("Parcelles", open("slots"), own))], managerVisible);
      dashboard.paint("tasks", "Tâches du village", [], [
        row(button("Libérer cet habitant", command("releaseResident", selectedResident()?.id), own && Boolean(selectedResident()))),
        row(button("Mission individuelle", open("missions"), own)),
        row(button("Attribuer à tous", open("all-missions"), own)),
        row(button("Pour les prochains", open("next-mission"), own))
      ], managerVisible);
      const buildingRows = [row(button(`Village T${v?.level || 1} · améliorer`, open("upgrade", "village"), own && v?.level < 3))];
      E.Config.building.types.forEach((type) => {
        const index = v?.buildings.findIndex((item) => item.type === type) ?? -1;
        const built = index >= 0 ? v.buildings[index] : null;
        buildingRows.push(row(button(built ? `${type} T${built.level} · améliorer` : `${type} · construire ${E.Config.building.T1.gold} or`,
          built ? open("upgrade", index) : command("build", type),
          own && (built ? built.level < 3 : p.gold >= E.Config.building.T1.gold && v.buildings.length < E.Config.building.slots))));
      });
      dashboard.paint("buildings", "Bâtiments du village", [], buildingRows, managerVisible);
      const residents = v?.residents || [];
      residentPage = Math.min(residentPage, Math.max(0, Math.ceil(residents.length / E.Config.xr.residentPageSize) - 1));
      const currentResidents = residents.slice(residentPage * E.Config.xr.residentPageSize, (residentPage + 1) * E.Config.xr.residentPageSize);
      dashboard.paint("residents", `Habitants disponibles (${available})`, [], [
        currentResidents.map((resident) => button(`${resident.id === s.selectedResidentId ? "▶ " : ""}${resident.name}`, { type: "select-resident", residentId: resident.id })),
        row(button("◀", { type: "resident-page", delta: -1 }, residentPage > 0), button(`Page ${residentPage + 1}/${Math.max(1, Math.ceil(residents.length / E.Config.xr.residentPageSize))}`, null, false), button("▶", { type: "resident-page", delta: 1 }, (residentPage + 1) * E.Config.xr.residentPageSize < residents.length))
      ].filter((entry) => entry.length), managerVisible);
      if (s.phase === "setup" && !modal) setModal(E.Network.mode === "pending" ? "mode" : "setup", E.Network.mode === "local" ? "red" : owner());
      if (s.phase === "running" && modal?.name === "setup") setModal(null);
      if (s.phase === "ended" && modal?.name !== "result" && modal?.name !== "leave") setModal("result");
      const redirect = s.pendingRedirects.find((item) => E.Network.mode === "local" || item.playerId === owner());
      if (redirect && !["redirect", "leave"].includes(modal?.name)) setModal("redirect", redirect.key);
      if (!redirect && modal?.name === "redirect") setModal(null);
      const content = modalContent();
      dashboard.paint("modal", content?.title || "", content?.lines || [], content?.rows || [], Boolean(content));
      dashboard.syncTargets();
      nav = dashboard.targets.filter((target) => (!modal || target.parent?.position.z > 0.05) && target.userData.xrTarget?.kind === "dashboard-button" && target.userData.xrTarget.enabled);
      focused = Math.min(focused, Math.max(0, nav.length - 1));
    }
    function execute(action) {
      if (!action) return false;
      const s = state();
      if (action.type === "open") { setModal(action.name, action.data); return true; }
      if (action.type === "mode") { if (!E.Network.startMode(action.mode)) return false; setModal("setup", "red"); return true; }
      if (action.type === "back") { setModal(s.phase === "setup" ? (E.Network.mode === "pending" ? "mode" : "setup") : null); return true; }
      if (action.type === "page") { page += action.delta; return true; }
      if (action.type === "resident-page") { residentPage = Math.max(0, residentPage + action.delta); return true; }
      if (action.type === "cycle-village") {
        const sel = selection(); const lane = sel.playerId === action.playerId ? (sel.lane + 1) % 4 : 0;
        E.GameView.selectVillage(action.playerId, lane); return true;
      }
      if (action.type === "select-village") { E.GameView.selectVillage(action.playerId, action.lane); return true; }
      if (action.type === "select-resident") { E.GameView.command("selectResident", action.residentId); return true; }
      if (action.type === "audio") { muted = !muted; E.Audio?.setMuted(muted); return true; }
      if (action.type === "quality") {
        quality = quality === "normal" ? "léger" : "normal";
        const xr = E.Board3D?.getXRContext()?.renderer?.xr;
        if (typeof xr?.setFoveation === "function") xr.setFoveation(quality === "léger" ? 1 : 0);
        return true;
      }
      if (action.type === "command") {
        const ok = E.GameView.command(action.method, ...action.args);
        if (ok) { if (action.method === "confirmBiomes" || action.method === "start") { if (state().phase === "running") setModal(null); } else if (s.phase === "running") setModal(null); }
        return ok;
      }
      if (action.type === "manipulate" || action.type === "recenter" || action.type === "leave" || action.type === "exit") return action;
      return false;
    }
    function activate(target) { if (!target?.enabled) return false; const result = execute(target.action); render(); return result; }
    function stick(hand, direction) {
      if (hand === "right" && !modal) {
        const residents = village()?.residents || []; if (!residents.length) return;
        const index = residents.findIndex((r) => r.id === state().selectedResidentId);
        const next = residents[(index + direction + residents.length) % residents.length];
        E.GameView.command("selectResident", next.id);
        residentPage = Math.floor(residents.indexOf(next) / E.Config.xr.residentPageSize);
      } else if (hand === "left" && nav.length) focused = (focused + direction + nav.length) % nav.length;
      render();
    }
    return { render, activate, stick, execute, close() { setModal(null); render(); },
      info() { setModal(modal?.name === "village-info" ? null : "village-info"); render(); },
      toggle() { visible = !visible; render(); }, cards() { setModal(modal?.name === "cards" ? null : "cards"); render(); },
      get modal() { return modal; }, get visible() { return visible; },
      get focusedTarget() { return nav[focused]; },
      get quality() { return quality; },
      selectResident(id) { E.GameView.command("selectResident", id); render(); }
    };
  }
  E.XRUI = { create };
}());
