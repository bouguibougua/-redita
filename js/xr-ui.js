(function () {
  "use strict";
  const E = window.Eredita;
  const labels = { ble: "Blé", chataigne: "Châtaigne", raisin: "Raisin", viande: "Viande", poisson: "Poisson", lait: "Lait" };
  const buildingLabels = { village: "Village principal", bergerie: "Bergerie", artisanat: "Artisanat", boucherie: "Boucherie" };
  const missionLabels = { agriculture: "Agriculture", elevage: "Élevage", peche: "Pêche", chasse: "Chasse", attaque: "Attaquer", defense: "Défendre", disponible: "Disponible" };
  const missionIcons = { agriculture: "🌾", elevage: "🐑", peche: "🎣", chasse: "🏹", attaque: "⚔", defense: "🛡", disponible: "👤" };
  const portraitIndices = { habitant: 0, agriculteur: 1, berger: 2, pecheur: 3, guerrier: 4, chasseur: 5, ravageur: 6 };
  const panelLabels = { jobs: "Métiers", info: "Informations", tasks: "Tâches", buildings: "Bâtiments", residents: "Habitants" };
  const textSizes = { normal: "Normal", large: "Grand", xlarge: "Très grand" };
  const button = (label, action, enabled = true, meta = {}) => [label, action, Boolean(enabled), meta];
  const row = (...items) => items;
  const command = (method, ...args) => ({ type: "command", method, args });
  const open = (name, data) => ({ type: "open", name, data });

  function create(dashboard, status) {
    let modal = null;
    let residentPage = 0;
    let visible = true;
    let muted = E.Audio?.muted || false;
    let quality = "normal";
    let nav = [];
    let focused = 0;
    let hasFocus = false;
    let selectedVillageKey = "";
    const owner = () => E.GameView.getPlayerId();
    const state = () => E.GameView.getState();
    const selection = () => state().selectedVillage;
    const village = () => state().players[selection().playerId]?.villages[selection().lane];
    const controllable = () => E.GameView.canControl(selection().playerId) && state().phase === "running" && !state().paused && !village()?.destroyed;
    const selectedResident = () => village()?.residents.find((r) => r.id === state().selectedResidentId) || village()?.residents[0];
    function feedback(message, kind = "info") {
      status?.(message);
      dashboard.setFeedback?.(message, kind);
    }
    function lockedReason() {
      if (!E.GameView.canControl(selection().playerId)) return "Ce village appartient à l’adversaire.";
      if (state().phase !== "running") return "La partie n’est pas en cours.";
      if (state().paused) return "Reprenez la partie pour agir.";
      if (village()?.destroyed) return "Ce village est détruit.";
      return "";
    }
    function professionReason(key, scope = "single", resident = selectedResident()) {
      const locked = lockedReason(); if (locked) return locked;
      const v = village(), def = E.Config.professions[key];
      if (!def) return "Métier inconnu.";
      // Les préférences futures sont mémorisables avant de construire leur bâtiment.
      if (scope === "next") return "";
      if (def.requires && !E.Buildings.has(v, def.requires)) return `${buildingLabels[def.requires]} requise.`;
      if (scope === "all") {
        return v.residents.some((item) => !item.unitId && !["attaque", "defense"].includes(item.mission) &&
          (item.profession || "habitant") !== key && (key === "habitant" || (item.profession || "habitant") === "habitant") &&
          E.Economy.canSetProfession(state(), selection().playerId, v.lane, item.id, key)) ? "" : "Aucun habitant éligible ; les métiers existants sont conservés.";
      }
      if (!resident) return "Sélectionnez un habitant.";
      if (resident.unitId) return "Impossible de changer un métier pendant le combat.";
      return E.Economy.canSetProfession(state(), selection().playerId, v.lane, resident.id, key) ? "" : "Métier indisponible pour cet habitant.";
    }
    function missionReason(key, scope = "single", resident = selectedResident()) {
      const locked = lockedReason(); if (locked) return locked;
      const v = village(), s = state(), id = selection().playerId;
      if (scope === "next") return "";
      if (key === "disponible") {
        if (scope === "all") return v.residents.some((item) => E.Config.jobs[item.mission]) ? "" : "Aucun travailleur à libérer.";
        if (!resident) return "Sélectionnez un habitant.";
        return E.Config.jobs[resident.mission] ? "" : resident.unitId ? "Un habitant au combat ne peut pas être rappelé." : "Cet habitant est déjà disponible.";
      }
      if (scope === "single") {
        if (!resident) return "Sélectionnez un habitant.";
        if (resident.unitId) return "Cet habitant est engagé au combat.";
        if (resident.mission !== "disponible") return "Libérez d’abord sa tâche actuelle.";
      }
      if (E.Config.jobs[key]) {
        if (!E.Economy.jobRequirementMet(v, key)) return key === "agriculture" ? "Placez d’abord une culture dans ce village." : key === "elevage" ? "Placez d’abord un élevage dans ce village." : "La pêche nécessite un Littoral.";
        const allowed = scope === "all" ? E.Economy.canAssignJob(s, id, v.lane, key) : E.Economy.canAssignResidentJob(s, id, v.lane, resident.id, key);
        if (!allowed) return "Aucun habitant disponible pour cette tâche.";
      } else if (!["attaque", "defense"].includes(key)) return "Tâche inconnue.";
      else if (scope === "all" && E.Economy.getAvailableResidents(s, id, v.lane) < 1) return "Aucun habitant disponible.";
      return "";
    }
    function professionButton(key, scope = "single") {
      const def = E.Config.professions[key], resident = selectedResident(), v = village();
      const reason = professionReason(key, scope);
      const selected = scope === "next" ? (v.nextResidentProfession || "habitant") === key : scope === "single" && (resident?.profession || "habitant") === key;
      const action = scope === "single" ? command("setProfession", resident?.id, key) : command(scope === "all" ? "assignProfessionToAll" : "setNextResidentProfession", key);
      return button(def.label, action, !reason, { icon: def.icon, selected, reason,
        detail: reason || (selected ? "Équipé" : scope === "next" ? "Choisir pour les prochains" : "Attribuer · Disponible") });
    }
    function missionButton(key, scope = "single") {
      const resident = selectedResident(), reason = missionReason(key, scope);
      const selected = scope === "next" ? (village().nextResidentMission || "disponible") === key : scope === "single" && resident?.mission === key;
      let action;
      if (scope === "next") action = command("setNextResidentMission", key);
      else if (scope === "all") action = key === "disponible" ? command("releaseAllResidents") : command("assignAllResidents", key);
      else action = key === "disponible" ? command("releaseResident", resident?.id) : command("assignResidentMission", resident?.id, key);
      return button(key === "disponible" && scope !== "next" ? "Libérer la tâche" : missionLabels[key], action, !reason,
        { icon: missionIcons[key], selected, reason, detail: reason || (selected ? "Tâche active" : E.Economy.isBoosted(resident, key) ? "Attribuer · Bonus métier" : "Attribuer") });
    }
    function buildReason(type) {
      return lockedReason() || (!E.Config.building.types.includes(type) ? "Bâtiment inconnu." :
        village().buildings.length >= E.Config.building.slots ? "Tous les emplacements de bâtiments sont occupés." :
          state().players[selection().playerId].gold < E.Config.building.T1.gold ? `Il faut ${E.Config.building.T1.gold} or global.` : "");
    }
    function upgradeInfo(index, resource) {
      const s = state(), v = village(), p = s.players[selection().playerId];
      const resources = index === "village" ? [E.Config.resources[0]] : resource ? [resource] : E.Config.resources;
      const quotes = resources.map((key) => E.Buildings.upgradeQuote(s, p.id, v.lane, index, key)).filter(Boolean);
      const quote = quotes.find((item) => item.allowed) || quotes[0];
      let reason = lockedReason();
      if (!reason && !quote) reason = "Niveau maximum atteint.";
      if (!reason && p.gold < quote.gold) reason = `Il faut ${quote.gold} or global.`;
      if (!reason && !quotes.some((item) => item.allowed)) reason = `Il faut ${quote.resourceAmount} ${resource ? labels[quote.resourceType || resource] : "unités d’une même ressource locale"}.`;
      const cost = quote ? `${quote.gold} or${quote.resourceAmount ? ` + ${quote.resourceAmount} ${resource ? labels[quote.resourceType || resource] : "ressources"}` : ""}` : "T3 · maximum";
      return { quote, reason, cost };
    }
    function setModal(name, data) { modal = name ? { name, data } : null; focused = 0; hasFocus = false; }
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
        title = "Paramètres"; lines = ["Gâchette : choisir · A : informations · B : retour", "Préhension sur une poignée : déplacer la fenêtre"];
        entries = [button(muted ? "Réactiver le son" : "Couper le son", { type: "audio" }),
          button(`Graphismes : ${quality}`, { type: "quality" }),
          button(`Texte : ${textSizes[dashboard.textSize || "normal"]}`, open("text-size")),
          button("Recentrer les fenêtres", { type: "panels-recenter" }),
          button("Réinitialiser les fenêtres", { type: "panels-reset" }),
          button("Ajuster une fenêtre", open("panel-layout")),
          button(s.paused ? "Reprendre" : "Pause", command("togglePause"), s.phase === "running" && E.Network.mode !== "guest", { reason: E.Network.mode === "guest" ? "Seul l’hôte peut mettre la partie en pause." : "La partie n’est pas en cours." }),
          button("Déplacer le plateau", { type: "manipulate", mode: "move" }, E.Network.mode !== "guest", { reason: "La manipulation du plateau est réservée à l’hôte." }),
          button("Pivoter le plateau", { type: "manipulate", mode: "rotate" }, E.Network.mode !== "guest", { reason: "La manipulation du plateau est réservée à l’hôte." }),
          button("Taille du plateau", { type: "manipulate", mode: "size" }, E.Network.mode !== "guest", { reason: "La taille du plateau est contrôlée par l’hôte." }),
          button(E.Network.mode === "guest" ? "Replacer mon plateau" : "Recentrer le plateau", { type: "recenter" }),
          button("Quitter la réalité mixte", { type: "exit" }),
          button("Retour au salon", open("leave"))];
      } else if (name === "text-size") {
        title = "Taille des textes";
        lines = ["Les fenêtres adaptent leur contenu et leur pagination."];
        entries = Object.entries(textSizes).map(([size, label]) => button(label, { type: "text-size", size }, true, { selected: (dashboard.textSize || "normal") === size }));
      } else if (name === "panel-layout") {
        title = "Ajuster les fenêtres";
        lines = ["Alternative à la préhension des poignées."];
        entries = Object.entries(panelLabels).map(([id, label]) => button(label, open("panel-adjust", id)));
      } else if (name === "panel-adjust") {
        title = `Fenêtre · ${panelLabels[data]}`;
        entries = [["Rapprocher", "near"], ["Éloigner", "far"], ["Orienter vers moi", "face"], ["À gauche", "left"], ["À droite", "right"], ["Monter", "up"], ["Descendre", "down"], ["Agrandir", "grow"], ["Réduire", "shrink"]]
          .map(([label, operation]) => button(label, { type: "panel-adjust", panelId: data, operation }));
      } else if (name === "leave") {
        title = "Quitter la partie ?"; lines = ["Votre session de jeu prendra fin."];
        entries = [button("Confirmer", { type: "leave" }), button("Annuler", { type: "back" })];
      } else if (name === "missions" || name === "next-mission") {
        title = name === "missions" ? `Mission · ${selectedResident()?.name || "habitant"}` : "Mission du prochain habitant";
        const scope = name === "missions" ? "single" : "next";
        if (scope === "next") lines = ["Choix appliqué à chaque arrivée, si ses conditions sont réunies."];
        entries = Object.keys(missionLabels).map((key) => missionButton(key, scope));
      } else if (["professions", "all-professions", "next-profession"].includes(name)) {
        title = name === "professions" ? `Métier · ${selectedResident()?.name || "habitant"}` : name === "all-professions" ? "Métier pour tous" : "Métier du prochain";
        const scope = name === "professions" ? "single" : name === "all-professions" ? "all" : "next";
        if (scope === "next") lines = ["Choix appliqué à chaque arrivée, si son bâtiment est construit."];
        if (scope === "all") lines = ["Les métiers existants sont conservés.", "Sans métier retire les spécialités hors combat."];
        entries = Object.keys(E.Config.professions).map((key) => professionButton(key, scope));
      } else if (name === "all-missions") {
        title = "Mission pour tous les disponibles";
        lines = ["Attribution progressive aux habitants sans tâche."];
        entries = Object.keys(missionLabels).map((key) => missionButton(key, "all"));
      } else if (name === "build") {
        title = "Construire"; lines = [`Or : ${Math.floor(p.gold)} · places ${v.buildings.length}/${E.Config.building.slots}`];
        entries = E.Config.building.types.map((type) => button(buildingLabels[type], command("build", type), !buildReason(type), { icon: E.Config.villageShops[type].icon, detail: `Construire · ${E.Config.building.T1.gold} or`, reason: buildReason(type) }));
      } else if (name === "upgrade-list") {
        title = "Améliorer un bâtiment";
        entries = v.buildings.map((building, index) => { const q = upgradeInfo(index); return button(`${buildingLabels[building.type]} T${building.level}`, open("upgrade", index), !q.reason, { detail: q.cost, reason: q.reason }); });
      } else if (name === "upgrade") {
        title = `Améliorer ${data === "village" ? "le village" : v.buildings[data]?.type || "bâtiment"}`;
        const resources = data === "village" ? ["ble"] : E.Config.resources;
        entries = resources.map((resource) => { const q = upgradeInfo(data, resource); return button(data === "village" ? "Améliorer le village" : `Payer en ${labels[resource]}`, command("upgrade", data, resource), !q.reason, { detail: q.cost, reason: q.reason }); });
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
      // La pagination appartient au composant spatial : une seule navigation,
      // calculée avec les dimensions des textes et des cibles, pour tous les menus.
      const rows = entries.map((entry) => row(entry));
      rows.push(row(button("Retour · B", { type: "back" })));
      return { title, lines, rows };
    }
    function render() {
      const s = state(), sel = selection(), v = village(), p = s.players[sel.playerId], own = controllable();
      const key = `${sel.playerId}:${sel.lane}`;
      if (selectedVillageKey !== key) { selectedVillageKey = key; residentPage = 0; }
      for (const id of ["red", "blue"]) {
        const player = s.players[id];
        dashboard.paint(`${id}Gold`, `${id === "red" ? "ROUGE" : "BLEU"} · OR GLOBAL`, [String(Math.floor(player.gold))], []);
        player.villages.forEach((item, lane) => dashboard.paint(`${id}${lane}`,
          `${id === "red" ? "ROUGE" : "BLEU"} V${lane + 1}`,
          [`${E.Biomes.labels[item.biome]} · T${item.level}`, `PV ${Math.ceil(item.hp)}/${item.maxHp}`,
            `${item.population}/${item.populationMax} hab. · ${E.Economy.getAvailableResidents(s, id, lane)} libres`], [], true,
          { action: { type: "select-village", playerId: id, lane }, selected: sel.playerId === id && sel.lane === lane }));
      }
      const remaining = Math.max(0, E.Config.normalDuration - s.elapsed);
      const overtime = s.elapsed >= E.Config.normalDuration;
      dashboard.paint("clock", s.phase === "setup" ? "PRÉPARATION" : `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, "0")}`, [s.paused ? "PAUSE" : s.phase === "ended" ? "TERMINÉ" : overtime ? "OVERTIME" : "TEMPS RESTANT"], []);
      dashboard.paint("gear", "⚙", [], [], true, { action: open("settings") });
      const managerVisible = visible && s.phase === "running";
      const available = v ? E.Economy.getAvailableResidents(s, p.id, v.lane) : 0;
      const resident = selectedResident();
      dashboard.paint("jobs", "Métiers à attribuer", [resident?.name || "Aucun habitant"], [
        ...Object.keys(E.Config.professions).map((key) => row(professionButton(key))),
        row(button("À tous", open("all-professions"), own, { reason: lockedReason() }), button("Aux prochains", open("next-profession"), own, { reason: lockedReason() }))
      ], managerVisible);
      dashboard.paint("info", `${p.name} · Village ${sel.lane + 1}`, v ? [
        `${E.Biomes.labels[v.biome]} · Niveau ${v.level}`,
        { label: "Points de vie", value: `${Math.ceil(v.hp)} / ${v.maxHp}`, kind: "stat" },
        { label: "Habitants", value: `${v.population} / ${v.populationMax}`, kind: "stat" },
        { label: "Disponibles", value: String(available), kind: "stat" },
        { label: "Banque locale", kind: "section" },
        ...E.Config.resources.map((key) => ({ label: labels[key], value: String(Math.floor(v.resources[key])), kind: "stat" }))
      ] : [], [row(button("Échoppes", open("shop"), true), button("Parcelles", open("slots"), true))], managerVisible);
      dashboard.paint("tasks", "Tâches du village", [resident?.name || "Aucun habitant"], [
        ...Object.keys(missionLabels).map((key) => row(missionButton(key))),
        row(button("À tous", open("all-missions"), own, { reason: lockedReason() }), button("Aux prochains", open("next-mission"), own, { reason: lockedReason() }))
      ], managerVisible);
      const villageQuote = upgradeInfo("village");
      const buildingRows = [row(button(`Village principal · T${v?.level || 1}`, open("upgrade", "village"), !villageQuote.reason,
        { icon: "⌂", detail: `Améliorer · ${villageQuote.cost}`, reason: villageQuote.reason }))];
      E.Config.building.types.forEach((type) => {
        const builtItems = v.buildings.map((item, index) => ({ ...item, index })).filter((item) => item.type === type);
        if (!builtItems.length) {
          const reason = buildReason(type);
          buildingRows.push(row(button(buildingLabels[type], command("build", type), !reason,
            { icon: E.Config.villageShops[type].icon, detail: `Construire · ${E.Config.building.T1.gold} or`, reason })));
        } else builtItems.forEach((built) => {
          const q = upgradeInfo(built.index);
          buildingRows.push(row(button(`${buildingLabels[type]} · T${built.level}`, open("upgrade", built.index), !q.reason,
            { icon: E.Config.villageShops[type].icon, detail: `Améliorer · ${q.cost}`, reason: q.reason })));
        });
      });
      const buildingCards = buildingRows.flat(), buildingGrid = [];
      for (let i = 0; i < buildingCards.length; i += 2) buildingGrid.push(buildingCards.slice(i, i + 2));
      buildingGrid.push(row(button("Toutes les constructions", open("build"))));
      dashboard.paint("buildings", "Bâtiments du village", [`${Math.floor(p.gold)} or global · ${v.buildings.length}/${E.Config.building.slots} places`], buildingGrid, managerVisible);
      const residents = v?.residents || [];
      residentPage = Math.min(residentPage, Math.max(0, Math.ceil(residents.length / E.Config.xr.residentPageSize) - 1));
      const currentResidents = residents.slice(residentPage * E.Config.xr.residentPageSize, (residentPage + 1) * E.Config.xr.residentPageSize);
      dashboard.paint("residents", `Habitants · ${available} disponibles / ${residents.length}`, residents.length ? [] : ["Ce village ne possède plus d’habitants."], [
        currentResidents.map((item) => button(item.name, { type: "select-resident", residentId: item.id }, true, {
          selected: item.id === resident?.id,
          portrait: { src: "assets/generated/characters-atlas.png", columns: 4, rows: 2, index: portraitIndices[item.profession || "habitant"] ?? 0 },
          profession: E.Config.professions[item.profession || "habitant"]?.label || "Sans métier",
          status: item.unitId ? item.mission === "defense" ? "En défense" : "Au combat" : missionLabels[item.mission] || item.mission,
          detail: `#${String(item.id).split("-").at(-1)}`
        })),
        row(button("◀ Précédents", { type: "resident-page", delta: -1 }, residentPage > 0, { reason: "Première page d’habitants." }), button(`Page ${residentPage + 1}/${Math.max(1, Math.ceil(residents.length / E.Config.xr.residentPageSize))}`, null, false), button("Suivants ▶", { type: "resident-page", delta: 1 }, (residentPage + 1) * E.Config.xr.residentPageSize < residents.length, { reason: "Dernière page d’habitants." }))
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
      nav = dashboard.targets.filter((target) => (!modal || target.userData.xrTarget?.panelId === "modal") && target.userData.xrTarget?.kind === "dashboard-button" && target.userData.xrTarget.action);
      focused = Math.min(focused, Math.max(0, nav.length - 1));
    }
    function execute(action) {
      if (!action) return false;
      const s = state();
      if (action.type === "open") { setModal(action.name, action.data); return true; }
      if (action.type === "mode") { if (!E.Network.startMode(action.mode)) return false; setModal("setup", "red"); return true; }
      if (action.type === "back") { setModal(s.phase === "setup" ? (E.Network.mode === "pending" ? "mode" : "setup") : null); return true; }
      if (action.type === "page") return dashboard.navigate("modal", action.delta);
      if (action.type === "panel-page") return dashboard.navigate(action.panelId, action.delta);
      if (action.type === "text-size") { dashboard.setTextSize(action.size); feedback(`Taille des textes : ${textSizes[action.size]}.`); return true; }
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
      if (["manipulate", "recenter", "leave", "exit", "panels-reset", "panels-recenter", "panel-adjust"].includes(action.type)) return action;
      return false;
    }
    function activate(target) {
      if (!target?.action) return false;
      // Revalidation depuis la simulation actuelle, avant toute dépense/affectation.
      render();
      const fresh = dashboard.targets.find((item) => item.userData.xrTarget?.panelId === target.panelId && JSON.stringify(item.userData.xrTarget?.action) === JSON.stringify(target.action))?.userData.xrTarget;
      const current = fresh || { enabled: false, reason: "L’action a changé. Choisissez-la à nouveau." };
      if (!current.enabled) { feedback(current.reason || "Cette action n’est pas disponible. Vérifiez ses conditions et vos ressources.", "error"); return false; }
      const result = execute(current.action);
      if (!result) feedback("Action refusée : vérifiez la sélection et les ressources disponibles.", "error");
      else if (current.action.type === "command") feedback(E.Network.mode === "guest" ? "Commande envoyée à l’hôte ; en attente de synchronisation." : `${current.label || "Action"} · commande transmise.`, "success");
      render(); return result;
    }
    function stick(hand, direction, panelId) {
      if (hand === "right" && !modal && (!panelId || panelId === "residents")) {
        const residents = village()?.residents || []; if (!residents.length) return;
        const index = residents.findIndex((r) => r.id === state().selectedResidentId);
        const next = residents[(index + direction + residents.length) % residents.length];
        E.GameView.command("selectResident", next.id);
        residentPage = Math.floor(residents.indexOf(next) / E.Config.xr.residentPageSize);
      } else if (panelId && dashboard.navigate(panelId, direction)) {
        hasFocus = false;
      } else if (nav.length) { focused = (focused + direction + nav.length) % nav.length; hasFocus = true; }
      render();
    }
    return { render, activate, stick, execute, close() { setModal(null); render(); },
      info() { setModal(modal?.name === "village-info" ? null : "village-info"); render(); },
      toggle() { visible = !visible; render(); }, cards() { setModal(modal?.name === "cards" ? null : "cards"); render(); },
      get modal() { return modal; }, get visible() { return visible; },
      get focusedTarget() { return hasFocus ? nav[focused] : null; },
      get quality() { return quality; },
      selectResident(id) { E.GameView.command("selectResident", id); render(); }
    };
  }
  E.XRUI = { create };
}());
