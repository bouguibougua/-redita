(function () {
  "use strict";
  const E = window.Eredita;
  const labels = { ble: "Blé", chataigne: "Châtaigne", raisin: "Raisin", viande: "Viande", poisson: "Poisson", lait: "Lait" };
  const buildingLabels = { village: "Village principal", bergerie: "Bergerie", artisanat: "Artisanat", boucherie: "Boucherie" };
  const missionLabels = { agriculture: "Agriculture", elevage: "Élevage", peche: "Pêche", chasse: "Chasse", attaque: "Attaquer", defense: "Défendre", disponible: "Disponible" };
  const missionIcons = { agriculture: "🌾", elevage: "🐑", peche: "🎣", chasse: "🏹", attaque: "⚔", defense: "🛡", disponible: "👤" };
  const portraitIndices = { habitant: 0, agriculteur: 1, berger: 2, pecheur: 3, guerrier: 4, chasseur: 5, ravageur: 6 };
  const panelLabels = { modal: "Menu et paramètres", residents: "Habitants", tasks: "Tâches", jobs: "Bâtiments", buildings: "Gestion du village",
    ...Object.fromEntries(["red", "blue"].flatMap((team) => [0, 1, 2, 3].map((lane) => [`${team}${lane}`, `${team === "red" ? "Rouge" : "Bleu"} · Village ${lane + 1}`]))),
    redGold: "Or Rouge", blueGold: "Or Bleu", clock: "Chronomètre" };
  const textSizes = { normal: "Normal", large: "Grand", xlarge: "Très grand" };
  const button = (label, action, enabled = true, meta = {}) => [label, action, Boolean(enabled), meta];
  const row = (...items) => items;
  const command = (method, ...args) => ({ type: "command", method, args });
  const open = (name, data) => ({ type: "open", name, data });

  function fleetSummary(state, village) {
    const fleet = E.Transport.fleetStatus(state, village);
    return `Barques : ${fleet.barque}/${E.Config.maritime.shop.barque.max} · places libres ${fleet.available}/${fleet.capacity}`;
  }

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
    let wasPreparing = false;
    let format = E.Network.format || E.Config.defaultFormat;
    const owner = () => E.GameView.getPlayerId();
    const state = () => E.GameView.getState();
    const setupPlayer = () => E.Network.mode === "local" ? ["red", "blue"].find((id) => !state().players[id].setupConfirmed) || "red" : owner();
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
    function missionReason(key, scope = "single", resident = selectedResident()) {
      const locked = lockedReason(); if (locked) return locked;
      const v = village(), s = state(), id = selection().playerId;
      if (scope === "next") return "";
      if (scope === "single") {
        if (!resident) return "Sélectionnez un habitant.";
        if (E.Config.jobs[key] && !E.Economy.jobRequirementMet(v,key)) return E.Economy.jobRequirementReason(v,key);
        return E.Economy.canAssignResidentMission(s,id,v.lane,resident.id,key) ? "" : "Cette tâche est déjà choisie ou indisponible.";
      }
      if (key === "disponible") return v.residents.some(item => E.Config.jobs[item.mission]) ? "" : "Aucun travailleur à libérer.";
      if (E.Config.jobs[key]) {
        if (!E.Economy.jobRequirementMet(v, key)) return E.Economy.jobRequirementReason(v,key);
        const allowed = scope === "all" ? E.Economy.canAssignJob(s, id, v.lane, key) : E.Economy.canAssignResidentJob(s, id, v.lane, resident.id, key);
        if (!allowed) return "Aucun habitant disponible pour cette tâche.";
      } else if (!["attaque", "defense"].includes(key)) return "Tâche inconnue.";
      else if (scope === "all" && E.Economy.getAvailableResidents(s, id, v.lane) < 1) return "Aucun habitant disponible.";
      return "";
    }
    function missionButton(key, scope = "single") {
      const resident = selectedResident(), reason = missionReason(key, scope);
      const selected = scope === "next" ? (village().nextResidentMission || "disponible") === key : scope === "single" && (resident?.pendingMission || resident?.mission) === key;
      const choice = ['attaque','defense'].includes(key) ? E.Economy.combatProfession(resident) : undefined;
      const profession = E.Economy.professionForMission(resident,key,choice);
      let action;
      if (scope === "next") action = command("setNextResidentMission", key, choice);
      else if (scope === "all") action = key === "disponible" ? command("releaseAllResidents") : command("assignAllResidents", key, choice);
      else action = key === "disponible" ? command("releaseResident", resident?.id) : command("assignResidentMission", resident?.id, key, choice);
      return button(key === "disponible" && scope !== "next" ? "Libérer la tâche" : `${missionLabels[key]}${key !== 'disponible' ? ' · ★ '+E.Config.professions[profession].label : ''}`, action, !reason,
        { icon: missionIcons[key], selected, reason, detail: resident?.pendingMission && selected ? "Retour au village, puis nouvelle tâche" : reason || (selected ? "Tâche active" : E.Economy.isBoosted(resident, key) ? "Attribuer · Bonus métier" : "Attribuer") });
    }
    function buildReason(type) {
      const q = E.Buildings.buildQuote(state(),selection().playerId,village().lane,type);
      return lockedReason() || (q?.reason === 'Or insuffisant' ? `Il faut ${q.gold} or global.` : q?.reason) || (!q ? "Bâtiment inconnu." : "");
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
    function setModal(name, data) {
      if (name && (name !== modal?.name || data !== modal?.data)) dashboard.presentModal?.();
      modal = name ? { name, data } : null; focused = 0; hasFocus = false;
    }
    function modalContent() {
      const s = state(), v = village(), p = s.players[selection().playerId], own = controllable();
      if (!modal) return null;
      const name = modal.name, data = modal.data;
      let title = "", lines = [], entries = [], explicitRows = null;
      if (name === "mode") {
        title = "Choisir une partie";
        lines = ["EREDITÀ · Choisissez votre aventure"];
        return { title, lines, rows: [
          Object.entries(E.Config.formats).map(([id, value]) => button(value.label, { type: "format", format: id }, true, { centered: true, selected: format === id })),
          row(button("Entraînement", { type: "mode", mode: "solo" }, true, { centered: true, large: true, primary: true, detail: "Jouer contre l’IA" })),
          row(button("Local à deux", { type: "mode", mode: "local" }, true, { centered: true, large: true, detail: "Deux joueurs sur le même plateau" }))
        ], options: { variant: "mode", footer: [button("Quitter le mode VR", { type: "exit" }, true, { centered: true }), button("Paramètres", open("settings"), true, { centered: true })] } };
      } else if (name === "settings") {
        title = "Paramètres";
        lines = ["Gâchettes ou A : choisir · B : retour", "Préhension : déplacer · joystick ↔ pendant la saisie : taille"];
        const host = E.Network.mode !== "guest";
        const scale = dashboard.windowScale || 1;
        return { title, lines, rows: [
          row(button("Agrandir les fenêtres", { type: "panels-scale", direction: "grow" }, scale < E.Config.xr.windowMaxScale, { centered: true, reason: "Taille maximale atteinte." }),
            button("Réduire les fenêtres", { type: "panels-scale", direction: "shrink" }, scale > E.Config.xr.windowMinScale, { centered: true, reason: "Taille minimale atteinte." })),
          row(button(E.Network.mode === "guest" ? "Replacer mon plateau" : "Replacer le plateau", { type: "recenter" }, true, { centered: true, primary: true })),
          row(button("Ajuster une fenêtre", open("panel-layout")), button(`Texte : ${textSizes[dashboard.textSize || "normal"]}`, open("text-size"))),
          row(button("Recentrer les fenêtres", { type: "panels-recenter" }), button("Réinitialiser les fenêtres", { type: "panels-reset" })),
          row(button("Déplacer le plateau", { type: "manipulate", mode: "move" }, host, { reason: "La manipulation du plateau est réservée à l’hôte." }),
            button("Pivoter le plateau", { type: "manipulate", mode: "rotate" }, host, { reason: "La manipulation du plateau est réservée à l’hôte." }),
            button("Taille du plateau", { type: "manipulate", mode: "size" }, host, { reason: "La taille du plateau est contrôlée par l’hôte." })),
          row(button(s.paused ? "Reprendre" : "Pause", command("togglePause"), s.phase === "running" && host, { reason: host ? "La partie n’est pas en cours." : "Seul l’hôte peut mettre la partie en pause." }),
            button(muted ? "Réactiver le son" : "Couper le son", { type: "audio" }), button(`Graphismes : ${quality}`, { type: "quality" })),
          row(button(E.XR?.environmentEnabled === false ? "Afficher le décor corse" : "Voir ma pièce", { type: "environment-toggle" }, true, { centered: true })),
          row(button("Retour au salon", open("leave")))
        ], options: { variant: "settings", footer: [button("Retour", { type: "back" }, true, { centered: true }), button("Quitter le mode VR", { type: "exit" }, true, { centered: true })] } };
      } else if (name === "text-size") {
        title = "Taille des textes";
        lines = ["Les fenêtres adaptent leur contenu et leur pagination."];
        entries = Object.entries(textSizes).map(([size, label]) => button(label, { type: "text-size", size }, true, { selected: (dashboard.textSize || "normal") === size }));
      } else if (name === "panel-layout") {
        title = "Ajuster les fenêtres";
        lines = ["Alternative à la préhension des poignées."];
        entries = Object.entries(panelLabels).filter(([id]) => !/^(red|blue)\d$/.test(id) || state().players[id.replace(/\d$/, "")].villages[Number(id.at(-1))]).map(([id, label]) => button(label, open("panel-adjust", id)));
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
      } else if (name === 'combat-profession') {
        title = 'Métier de combat';
        entries = E.Config.combatProfessions.map(key=>button(E.Config.professions[key].label,
          command('setCombatProfession',selectedResident()?.id,key),own && !selectedResident()?.isLegend,
          {selected:E.Economy.combatProfession(selectedResident())===key,detail:key==='chasseur'?'Arc : portée 15':E.Config.professions[key].description}));
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
        entries = resources.map((resource) => { const q = upgradeInfo(data, resource); return button(data === "village" ? "Améliorer le feu de camp" : `Payer en ${labels[resource]}`, command("upgrade", data, resource), !q.reason, { detail: q.cost, reason: q.reason }); });
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
        lines = [];
        const level = E.Transport.buildingLevel(v, data);
        entries = Object.entries(E.Config.villageShops[data].tiers).flatMap(([tier, items]) => items.map((item) => {
          const resident = selectedResident();
          if (item.animalType) return button(item.label, command("buyAnimal", item.animalType), own && E.Livestock.purchaseQuote(s, p.id, v.lane, item.animalType).allowed);
          if (item.purchaseType) return button(item.label, command("buyShopItem", item.purchaseType), own && level >= Number(tier) && E.Transport.shopQuote(s, p.id, v.lane, item.purchaseType).allowed);
          if (item.equipmentKind) {
            const q = E.Equipment.quote(s, p.id, v.lane, item.equipmentKind, item.equipmentType);
            return button(item.label, command("buyEquipment", item.equipmentKind, item.equipmentType), own && q.allowed,
              {detail: `${q.gold} or · village entier, actuels et futurs · hors légendes`, reason: q.reason});
          }
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
        const slot = v.slots[data], content = slot?.content, preparing = s.preparationRemaining > 0;
        if (content?.category === "crop") {
          const quote = E.Crops.upgradeQuote(s, p.id, v.lane, data), removal = E.Crops.removalQuote(s, p.id, v.lane, data);
          lines = [`${E.Crops.get(content.type).label} · N${E.Crops.levelOf(content)} · Rendement ×${E.Crops.yieldOf(content)}`, `Or : ${Math.floor(p.gold)}`];
          const actions = [];
          if (preparing) actions.push(button("Vendre le terrain", command("removeSlot", data), own && removal.allowed, { detail: `+${removal.refund} or` }));
          actions.push(button(E.Config.cropLevels[quote.nextLevel] ? `Améliorer → N${quote.nextLevel}` : "Niveau maximum", command("upgradeCrop", data), own && quote.allowed, { detail: `${quote.gold} or`, reason: quote.reason }));
          explicitRows = [row(...actions)];
          Object.entries(E.Config.crops).filter(([key]) => key !== content.type && E.Crops.isAllowedInBiome(key, v.biome)).forEach(([key, crop]) => {
            explicitRows.push(row(button(`Replanter ${crop.shortLabel}`, command("placeCrop", key, data), own && E.Crops.canPlace(s, p.id, v.lane, data, key), { detail: `${E.Config.cropLevels[1].gold} or · niveau 1 · sans remboursement` })));
          });
        } else if (content?.category === "livestock") {
          lines = [`${E.Livestock.get(content.type).shortLabel} · ${content.count} animaux`];
          const actions = [], active = own && s.phase === "running" && !s.paused && !v.destroyed;
          if (preparing) actions.push(button("Retirer l’élevage", command("removeSlot", data), own && E.Livestock.removalQuote(s, p.id, v.lane, data).allowed, { detail: "Gratuit · sans viande" }));
          actions.push(button("Abattre 1", command("slaughter", data, 1), active));
          actions.push(button("Tout abattre", command("slaughter", data, content.count), active));
          explicitRows = [row(...actions)];
        } else if (slot) {
          entries = [...Object.entries(E.Config.crops).filter(([key]) => slot.type === "free" && E.Crops.isAllowedInBiome(key, v.biome)).map(([key, crop]) => button(crop.label, command("placeCrop", key, data), own && E.Crops.canPlace(s, p.id, v.lane, data, key), { detail: `${E.Config.cropLevels[1].gold} or · niveau 1` })),
            ...Object.entries(E.Config.livestock).map(([key, animal]) => button(animal.label, command("placeLivestock", key, data), own && E.Livestock.canPlace(s, p.id, v.lane, data, key)))];
        }
      } else if (name === "setup") {
        title = "Préparer la partie";
        const id = E.Network.mode === "local" ? (data || setupPlayer()) : owner(), player = s.players[id];
        const otherId = id === "red" ? "blue" : "red";
        lines = [`${player.name} · ${player.setupSelection.length}/${E.Board.getFormat(s).exchanges} biomes`,
          player.setupConfirmed ? "Territoire confirmé · prêt à jouer" : "Choisissez les biomes à échanger."];
        const biomes = player.villages.map((item, lane) => button(`${{ littoral: "≈", plaine: "≋", montagne: "▲" }[item.biome]} ${E.Biomes.labels[item.biome]}`, command("toggleBiome", id, lane),
          !player.setupConfirmed && (player.setupSelection.includes(lane) || E.Board.getFormat(s).exchanges === 1 || player.setupSelection.length < E.Board.getFormat(s).exchanges), {
            centered: true, biome: item.biome, lane, selected: player.setupSelection.includes(lane),
            reason: player.setupConfirmed ? "Le territoire est déjà confirmé." : `${E.Board.getFormat(s).exchanges} biome(s) maximum.`,
            detail: item.biome === "littoral" ? "2 emplacements libres" : item.biome === "montagne" ? "2 libres · 2 animaux" : "4 emplacements libres"
          }));
        const nextPlayer = E.Network.mode === "local" && !s.players[otherId].setupConfirmed;
        const launchLabel = nextPlayer ? `Préparer ${otherId === "red" ? "Rouge" : "Bleu"} →` : E.Network.mode === "guest" ? "Confirmer · prêt" : "Lancer la partie";
        return { title, lines, rows: [biomes.slice(0, 2), ...(biomes.length > 2 ? [biomes.slice(2)] : []),
          row(button(player.setupConfirmed ? "Tirage confirmé ✓" : "Échanger la sélection", command("confirmBiomes", id, "exchange"),
            !player.setupConfirmed && player.setupSelection.length > 0, { centered: true, reason: `Sélectionnez jusqu’à ${E.Board.getFormat(s).exchanges} biome(s) à échanger.` }), button("Réglages", open("settings"), true, { centered: true }))],
          options: { variant: "setup", footer: [
            button("Retour", { type: "setup-back" }, true, { centered: true }),
            button(launchLabel, { type: "setup-launch", playerId: id }, !(E.Network.mode === "guest" && player.setupConfirmed),
              { centered: true, primary: true, detail: player.setupConfirmed ? "Territoire prêt" : player.setupSelection.length ? "Échanger puis continuer" : "Conserver ce tirage", reason: "En attente de l’hôte." })
          ] } };
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

      }
      // La pagination appartient au composant spatial : une seule navigation,
      // calculée avec les dimensions des textes et des cibles, pour tous les menus.
      const rows = explicitRows || entries.map((entry) => row(entry));
      rows.push(row(button("Retour", { type: "back" })));
      return { title, lines, rows };
    }
    function render() {
      const s = state(), sel = selection(), v = village(), p = s.players[sel.playerId], own = controllable();
      const inGame = s.phase !== "setup" && E.Network.mode !== "pending";
      const key = `${sel.playerId}:${sel.lane}`;
      if (selectedVillageKey !== key) { selectedVillageKey = key; residentPage = 0; }
      for (const id of ["red", "blue"]) {
        for (let lane = s.players[id].villages.length; lane < E.Config.formats.classic.regions; lane++) dashboard.paint(`${id}${lane}`, "", [], [], false);
        const player = s.players[id];
        const showPlayer = inGame && id === (E.Network.mode === "local" ? sel.playerId : owner());
        dashboard.paint(`${id}Gold`, `${id === "red" ? "ROUGE" : "BLEU"} · OR GLOBAL`, [String(Math.floor(player.gold))], [], showPlayer);
        player.villages.forEach((item, lane) => dashboard.paint(`${id}${lane}`,
          `${id === "red" ? "ROUGE" : "BLEU"} V${lane + 1}`,
          [`${E.Biomes.labels[item.biome]} · T${item.level}`, `PV ${Math.ceil(item.hp)}/${item.maxHp}`,
            `${item.population}/${item.populationMax} hab. · ${E.Economy.getAvailableResidents(s, id, lane)} libres`], [], showPlayer,
          { action: { type: "select-village", playerId: id, lane }, selected: sel.playerId === id && sel.lane === lane }));
      }
      const preparing = s.preparationRemaining > 0;
      if (preparing && !wasPreparing) feedback("Préparation : une minute pour attribuer vos tâches et organiser vos villages.");
      if (!preparing && wasPreparing && s.phase === "running") feedback("La préparation est terminée. Le combat commence !");
      wasPreparing = preparing;
      const remaining = preparing ? Math.ceil(s.preparationRemaining) : Math.max(0, E.Config.normalDuration - s.elapsed);
      const overtime = s.elapsed >= E.Config.normalDuration;
      dashboard.paint("clock", s.phase === "setup" ? "PRÉPARATION" : `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, "0")}`, [s.paused ? "PAUSE" : s.phase === "ended" ? "TERMINÉ" : preparing ? "PRÉPARATION" : overtime ? "OVERTIME" : "TEMPS RESTANT"], [], inGame);
      dashboard.paint("gear", "⚙", [], [], inGame, { action: open("settings") });
      const managerVisible = visible && s.phase === "running";
      const available = v ? E.Economy.getAvailableResidents(s, p.id, v.lane) : 0;
      const resident = selectedResident();
      const pairs = (items) => { const rows = []; for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2)); return rows; };
      dashboard.paint("tasks", "Tâches à assigner", [resident?.name || "Aucun habitant"], [
        row(button(`Combat · ${E.Config.professions[E.Economy.combatProfession(resident)].label}`,open('combat-profession'),own && !resident?.isLegend)),
        ...pairs(Object.keys(missionLabels).map((key) => missionButton(key))),
        row(button("À tous", open("all-missions"), own, { reason: lockedReason() }), button("Aux prochains", open("next-mission"), own, { reason: lockedReason() }))
      ], managerVisible);
      const villageQuote = upgradeInfo("village");
      const buildingRows = [row(button(`Feu de camp · T${v?.level || 1}`, open("upgrade", "village"), !villageQuote.reason,
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
      const tradeRows = buildingRows.slice(1).flat();
      dashboard.paint('jobs','Bâtiments',[],pairs(tradeRows),managerVisible);
      const buildingCards = buildingRows.slice(0,1).flat(), buildingGrid = [];
      for (let i = 0; i < buildingCards.length; i += 2) buildingGrid.push(buildingCards.slice(i, i + 2));
      buildingGrid.push(row(button("Construire", open("build")), button("Parcelles", open("slots"))));
      buildingGrid.push(row(button("Boutique · Y", open("shop")), button("Vendre", open("sell"))));
      const stockLines = [];
      for (let i = 0; i < E.Config.resources.length; i += 2) stockLines.push(E.Config.resources.slice(i, i + 2).map((key) => `${labels[key]} : ${Math.floor(v.resources[key])}`).join(" · "));
      dashboard.paint("buildings", `Gestion · Village ${sel.lane + 1}`, [
        `${E.Biomes.labels[v.biome]} · T${v.level} · ${Math.ceil(v.hp)}/${v.maxHp} PV · ${Math.floor(p.gold)} or`, fleetSummary(s, v), ...stockLines
      ], buildingGrid, managerVisible);
      const residents = v?.residents || [];
      residentPage = Math.min(residentPage, Math.max(0, Math.ceil(residents.length / E.Config.xr.residentPageSize) - 1));
      const currentResidents = residents.slice(residentPage * E.Config.xr.residentPageSize, (residentPage + 1) * E.Config.xr.residentPageSize);
      dashboard.paint("residents", `Habitants · ${available} disponibles / ${residents.length}`, residents.length ? [] : ["Ce village ne possède plus d’habitants."], [
        ...pairs(currentResidents.map((item) => button(item.name, { type: "select-resident", residentId: item.id }, true, {
          selected: item.id === resident?.id,
          portrait: { src: "assets/generated/characters-atlas.webp", columns: 4, rows: 2, index: portraitIndices[item.profession || "habitant"] ?? 0 },
          profession: E.Config.professions[item.profession || "habitant"]?.label || "Sans métier",
          status: item.pendingMission ? `Retour → ${missionLabels[item.pendingMission]}` : item.unitId ? item.mission === "defense" ? "En défense" : "Au combat" : missionLabels[item.mission] || item.mission,
          detail: `#${String(item.id).split("-").at(-1)}`
        }))),
        row(button("◀ Précédents", { type: "resident-page", delta: -1 }, residentPage > 0, { reason: "Première page d’habitants." }), button(`Page ${residentPage + 1}/${Math.max(1, Math.ceil(residents.length / E.Config.xr.residentPageSize))}`, null, false), button("Suivants ▶", { type: "resident-page", delta: 1 }, (residentPage + 1) * E.Config.xr.residentPageSize < residents.length, { reason: "Dernière page d’habitants." }))
      ].filter((entry) => entry.length), managerVisible);
      if (s.phase === "setup" && !modal) setModal(E.Network.mode === "pending" ? "mode" : "setup", setupPlayer());
      if (s.phase === "running" && modal?.name === "setup") setModal(null);
      if (s.phase === "ended" && modal?.name !== "result" && modal?.name !== "leave") setModal("result");
      const redirect = s.pendingRedirects.find((item) => E.Network.mode === "local" || item.playerId === owner());
      if (redirect && !["redirect", "leave"].includes(modal?.name)) setModal("redirect", redirect.key);
      if (!redirect && modal?.name === "redirect") setModal(null);
      const content = modalContent();
      dashboard.paint("modal", content?.title || "", content?.lines || [], content?.rows || [], Boolean(content), content?.options || {});
      dashboard.syncTargets();
      nav = dashboard.targets.filter((target) => (!modal || target.userData.xrTarget?.panelId === "modal") && target.userData.xrTarget?.kind === "dashboard-button" && target.userData.xrTarget.action);
      focused = Math.min(focused, Math.max(0, nav.length - 1));
    }
    function execute(action) {
      if (!action) return false;
      const s = state();
      if (action.type === "open") { setModal(action.name, action.data); return true; }
      if (action.type === "format") { format = action.format; E.Network.selectFormat?.(format); return true; }
      if (action.type === "mode") { if (!E.Network.startMode(action.mode, format)) return false; setModal("setup", "red"); return true; }
      if (action.type === "back") { setModal(s.phase === "setup" ? (E.Network.mode === "pending" ? "mode" : "setup") : null); return true; }
      if (action.type === "setup-back") {
        if (["solo", "local"].includes(E.Network.mode)) { E.GameView.returnToLobby(); setModal("mode"); }
        else return { type: "exit" };
        return true;
      }
      if (action.type === "setup-launch") {
        if (s.phase !== "setup" || !E.GameView.canControl(action.playerId)) return false;
        const player = s.players[action.playerId];
        if (!player.setupConfirmed && !E.GameView.command("confirmBiomes", player.id, player.setupSelection.length ? "exchange" : "keep")) return false;
        if (E.Network.mode === "guest") return true;
        const other = player.id === "red" ? "blue" : "red";
        if (!state().players[other].setupConfirmed) {
          if (E.Network.mode === "local") { setModal("setup", other); return true; }
          feedback("En attente de la préparation de l’autre joueur."); return true;
        }
        if (!state().players[player.id].setupConfirmed) return false;
        return E.GameView.command("start");
      }
      if (action.type === "page") return dashboard.navigate("modal", action.delta);
      if (action.type === "panel-page") return dashboard.navigate(action.panelId, action.delta);
      if (action.type === "text-size") { dashboard.setTextSize(action.size); feedback(`Taille des textes : ${textSizes[action.size]}.`); return true; }
      if (action.type === "resident-page") { residentPage = Math.max(0, residentPage + action.delta); return true; }
      if (action.type === "cycle-village") {
        const sel = selection(); const lane = sel.playerId === action.playerId ? (sel.lane + 1) % state().players[action.playerId].villages.length : 0;
        E.GameView.selectVillage(action.playerId, lane); return true;
      }
      if (action.type === "select-village") { return selectVillage(action.playerId, action.lane); }
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
        if (ok) { if (action.method === "confirmBiomes" || action.method === "start") { if (state().phase === "running") setModal(null); } else if (s.phase === "running" && !["shop", "sell", "buy-resident", "store", "animals", "slot"].includes(modal?.name)) setModal(null); }
        return ok;
      }
      if (["manipulate", "recenter", "leave", "exit", "panels-reset", "panels-recenter", "panels-scale", "panel-adjust", "environment-toggle"].includes(action.type)) return action;
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
    function selectVillage(playerId, lane) {
      if (!E.GameView.selectVillage(playerId, lane)) return false;
      visible = true; residentPage = 0; hasFocus = false; return true;
    }
    function stick(hand, direction, panelId, axis = hand === "left" ? "vertical" : "horizontal") {
      const shopping = ["shop", "sell", "buy-resident", "store", "animals"].includes(modal?.name);
      if (state().phase === "running" && (!modal || shopping)) {
        if (hand === "left" && axis === "vertical") {
          const residents = village()?.residents || []; if (!residents.length) return false;
          const index = residents.findIndex((r) => r.id === selectedResident()?.id);
          const next = residents[(index + direction + residents.length) % residents.length];
          E.GameView.command("selectResident", next.id);
          residentPage = Math.floor(residents.indexOf(next) / E.Config.xr.residentPageSize);
        } else if (hand === "right" && axis === "horizontal") {
          const sel = selection(), count = state().players[sel.playerId].villages.length;
          selectVillage(sel.playerId, (sel.lane + direction + count) % count);
        } else return false;
        hasFocus = false;
      } else if (panelId && dashboard.navigate(panelId, direction)) {
        hasFocus = false;
      } else if (nav.length) { focused = (focused + direction + nav.length) % nav.length; hasFocus = true; }
      render(); return true;
    }
    return { render, activate, stick, execute, close() { setModal(null); render(); },
      info() { setModal(modal?.name === "village-info" ? null : "village-info"); render(); },
      toggle() { visible = !visible; render(); },
      shop() { if (state().phase !== "running") return; setModal(["shop", "sell", "buy-resident", "store", "animals"].includes(modal?.name) ? null : "shop"); render(); },
      selectVillage(playerId, lane) { const ok = selectVillage(playerId, lane); render(); return ok; },
      get modal() { return modal; }, get visible() { return visible; },
      get focusedTarget() { return hasFocus ? nav[focused] : null; },
      get quality() { return quality; },
      selectResident(id) { E.GameView.command("selectResident", id); render(); }
    };
  }
  E.XRUI = { create };
}());
