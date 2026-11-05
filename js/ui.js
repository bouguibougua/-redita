(function () {
  "use strict";

  const E = window.Eredita;
  const biomeIcons = { montagne: "▲", plaine: "≋", littoral: "≈" };
  const buildingLabels = { bergerie: "Bergerie", artisanat: "Artisanat", boucherie: "Boucherie" };
  const resourceLabels = { ble: "Blé", chataigne: "Châtaigne", raisin: "Raisin", viande: "Viande", poisson: "Poisson", lait: "Lait" };
  const resourceIcons = { ble: "🌾", chataigne: "🌰", raisin: "🍇", viande: "🥩", poisson: "🐟", lait: "🥛" };

  let controller;
  let elements;
  let redirectSignature = null;
  let upgradeResource = "ble";
  let purchaseResource = "ble";
  let currentState = null;
  let selectedSlot = null;
  const viewerId = state => E.Network.mode === "local" ? state.selectedVillage.playerId : E.Network.playerId || "red";
  const vision = (state, village) => E.MythologyEffects?.vision(state, viewerId(state), village) || { fraction: 1, all: true, people: true };

  function init(gameController) {
    controller = gameController;
    elements = {
      setupScreen: document.querySelector("#setup-screen"),
      setupPlayers: document.querySelector("#setup-players"),
      setupHint: document.querySelector("#setup-hint"),
      startButton: document.querySelector("#start-game"),
      gameScreen: document.querySelector("#game-screen"),
      battlefield: document.querySelector("#battlefield"),
      villageSelector: document.querySelector("#village-selector"),
      columns: document.querySelector("#board-columns"),
      units: document.querySelector("#units-layer"),
      mapVillagePopups: document.querySelector("#map-village-popups"),
      inspector: document.querySelector("#village-inspector"),
      residents: document.querySelector("#residents-panel"),
      construction: document.querySelector("#building-market"),
      ownedBuildings: document.querySelector("#owned-buildings"),
      shop: document.querySelector("#village-shop"),
      shopModal: document.querySelector("#shop-modal"),
      shopModalContent: document.querySelector("#shop-modal-content"),
      shopVillageNav: document.querySelector("#shop-village-nav"),
      clock: document.querySelector("#game-clock"),
      phase: document.querySelector("#phase-label"),
      pause: document.querySelector("#pause-game"),
      redirectDialog: document.querySelector("#redirect-dialog"),
      redirectCopy: document.querySelector("#redirect-copy"),
      redirectActions: document.querySelector("#redirect-actions"),
      resultDialog: document.querySelector("#result-dialog"),
      resultTitle: document.querySelector("#result-title"),
      resultCopy: document.querySelector("#result-copy")
    };
    bindEvents();
  }

  function bindEvents() {
    elements.setupPlayers.addEventListener("click", (event) => {
      const biomeButton = event.target.closest("[data-biome-choice]");
      if (biomeButton) controller.toggleBiome(biomeButton.dataset.player, Number(biomeButton.dataset.lane));
      const setupAction = event.target.closest("[data-setup-action]");
      if (setupAction) controller.confirmBiomes(setupAction.dataset.player, setupAction.dataset.setupAction);
    });
    elements.battlefield.addEventListener("click", (event) => {
      const slot = event.target.closest("[data-slot-visual]");
      if (!slot) return;
      const playerId = slot.dataset.player;
      const lane = Number(slot.dataset.lane);
      const index = Number(slot.dataset.slotIndex);
      const village = currentState.players[playerId]?.villages[lane];
      const target = village?.slots[index];
      if (!village || !target || target.content || target.type === "animal") return;
      selectedSlot = selectedSlot?.playerId === playerId && selectedSlot.lane === lane && selectedSlot.index === index
        ? null : { playerId, lane, index };
      renderInspector(currentState);
    });
    elements.startButton.addEventListener("click", () => controller.start());
    document.querySelector("#open-shop-modal").addEventListener("click", () => openShopModal());
    document.querySelector("#close-shop-modal").addEventListener("click", () => { elements.shopModal.hidden = true; });
    elements.shopModal.addEventListener("click", (event) => {
      if (event.target === elements.shopModal) elements.shopModal.hidden = true;
    });
    elements.shopVillageNav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-shop-village]");
      if (!button) return;
      event.preventDefault();
      controller.selectVillage(button.dataset.player, Number(button.dataset.shopVillage));
    });
    elements.pause?.addEventListener("click", () => controller.togglePause());
    document.querySelector("#toggle-board-view")?.addEventListener("click", () => E.Board3D?.toggle());
    elements.villageSelector.addEventListener("click", (event) => {
      const village = event.target.closest("[data-village-select]");
      if (village) controller.selectVillage(village.dataset.player, Number(village.dataset.lane));
    });
    [elements.inspector, elements.residents, elements.shop, elements.construction, elements.ownedBuildings].forEach((panel) => panel.addEventListener("click", (event) => {
      const action = event.target.closest("button");
      if (action && action.disabled) return;
      const sale = event.target.closest("[data-sell]");
      if (sale) controller.sell(sale.dataset.sell);
      const purchase = event.target.closest("[data-buy-resident]");
      if (purchase) controller.buyResident(purchaseResource);
      const profession = event.target.closest("[data-profession]");
      if (profession) controller.setProfession(profession.dataset.residentId, profession.dataset.profession);
      const professionAll = event.target.closest("[data-profession-all]");
      if (professionAll) controller.assignProfessionToAll(professionAll.dataset.professionAll);
      const nextMission = event.target.closest("[data-next-mission]");
      if (nextMission) controller.setNextResidentMission(nextMission.dataset.nextMission);
      const nextProfession = event.target.closest("[data-next-profession]");
      if (nextProfession) controller.setNextResidentProfession(nextProfession.dataset.nextProfession);
      const upgrade = event.target.closest("[data-upgrade]");
      if (upgrade) controller.upgrade(upgrade.dataset.upgrade === "village" ? "village" : Number(upgrade.dataset.upgrade), upgradeResource);
      const building = event.target.closest("[data-build]");
      if (building) controller.build(building.dataset.build);
      const slot = event.target.closest("[data-select-slot]");
      if (slot) {
        const selection = currentState.selectedVillage;
        const index = Number(slot.dataset.selectSlot);
        selectedSlot = selectedSlot?.playerId === selection.playerId && selectedSlot.lane === selection.lane && selectedSlot.index === index
          ? null : { ...selection, index };
        renderInspector(currentState);
      }
      const crop = event.target.closest("[data-place-crop]");
      if (crop) {
        controller.placeCrop(crop.dataset.placeCrop, Number(crop.dataset.slotIndex));
      }
      const livestock = event.target.closest("[data-place-livestock]");
      if (livestock) {
        controller.placeLivestock(livestock.dataset.placeLivestock, Number(livestock.dataset.slotIndex));
      }
      const cropUpgrade = event.target.closest("[data-upgrade-crop]");
      if (cropUpgrade) controller.upgradeCrop(Number(cropUpgrade.dataset.upgradeCrop));
      const removal = event.target.closest("[data-remove-slot]");
      if (removal) controller.removeSlot(Number(removal.dataset.removeSlot));
      const slaughterAll = event.target.closest("[data-slaughter-all]");
      if (slaughterAll) {
        const index = Number(slaughterAll.dataset.slaughterAll);
        const selection = currentState.selectedVillage;
        const content = currentState.players[selection.playerId]?.villages[selection.lane]?.slots[index]?.content;
        if (content?.category === "livestock") controller.slaughter(index, content.count);
      }
      const slaughter = event.target.closest("[data-slaughter]");
      if (slaughter) {
        const quantity = slaughter.closest(".slaughter-card").querySelector("[data-slaughter-quantity]").value;
        controller.slaughter(Number(slaughter.dataset.slaughter), Number(quantity));
      }
      const job = event.target.closest("[data-job-action]");
      if (job) controller.changeJob(job.dataset.job, job.dataset.jobAction);
      const resident = event.target.closest("[data-select-resident]");
      if (resident) controller.selectResident(resident.dataset.selectResident);
      const mission = event.target.closest("[data-resident-mission]");
      if (mission) controller.assignResidentMission(mission.dataset.residentId, mission.dataset.residentMission);
      const assignAll = event.target.closest("[data-assign-all]");
      if (assignAll) controller.assignAllResidents(assignAll.dataset.assignAll);
      const release = event.target.closest("[data-release-resident]");
      if (release) controller.releaseResident(release.dataset.releaseResident);
      const releaseAll = event.target.closest("[data-release-all]");
      if (releaseAll) controller.releaseAllResidents();
      const deploy = event.target.closest("[data-deploy]");
      if (deploy) controller.deploy(deploy.dataset.deploy);
      const shopItem = event.target.closest("[data-buy-shop-item]");
      if (shopItem) controller.buyShopItem(shopItem.dataset.buyShopItem);
      const animal = event.target.closest("[data-buy-animal]");
      if (animal) controller.buyAnimal(animal.dataset.buyAnimal);
      const equipment = event.target.closest("[data-buy-equipment]");
      if (equipment) controller.buyEquipment(equipment.dataset.equipmentKind, equipment.dataset.buyEquipment);
      const specialAnimal = event.target.closest("[data-buy-special-animal]");
      if (specialAnimal) controller.buySpecialAnimal(specialAnimal.dataset.buySpecialAnimal, specialAnimal.dataset.residentId);
      const animalOrder = event.target.closest("[data-order-animal]");
      if (animalOrder) controller.orderAnimal(animalOrder.dataset.animalId, animalOrder.dataset.orderAnimal, animalOrder.dataset.slotIndex === undefined ? undefined : Number(animalOrder.dataset.slotIndex));
      const specialSlaughter = event.target.closest("[data-slaughter-special]");
      if (specialSlaughter) controller.slaughterSpecialAnimal(specialSlaughter.dataset.slaughterSpecial);
    }));
    [elements.residents, elements.construction, elements.ownedBuildings].forEach((target) => target.addEventListener("change", (event) => {
      if (event.target.matches("[data-upgrade-resource]")) {
        upgradeResource = event.target.value;
        elements.gameScreen.querySelectorAll("[data-upgrade-resource]").forEach((select) => { select.value = upgradeResource; });
        const { playerId, lane } = currentState.selectedVillage;
        const player = currentState.players[playerId];
        updateTradeAndUpgrades(currentState, player, player.villages[lane]);
        updateBuildingTable(currentState, player, player.villages[lane]);
      }
      if (event.target.matches("[data-purchase-resource]")) purchaseResource = event.target.value;
    }));
    elements.shop.addEventListener("change", (event) => {
    });
    elements.inspector.addEventListener("input", (event) => {
      if (!event.target.matches("[data-slaughter-quantity]")) return;
      const card = event.target.closest(".slaughter-card");
      const amount = Math.max(1, Math.min(Number(event.target.max), Math.floor(Number(event.target.value) || 1)));
      card.querySelector("[data-slaughter-preview]").textContent = `+${amount * Number(card.dataset.meat)} viande`;
    });
    elements.redirectActions.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-redirect-lane]");
      if (choice) controller.chooseRedirect(choice.dataset.redirectKey, Number(choice.dataset.redirectLane));
    });
    document.querySelector("#restart-game").addEventListener("click", () => controller.restart());
  }

  function render(state) {
    currentState = state;
    const setup = state.phase === "setup";
    if (setup) selectedSlot = null;
    elements.setupScreen.hidden = !setup;
    elements.gameScreen.hidden = setup;
    // La fin de la partie précédente ne doit pas masquer la préparation suivante.
    if (setup) renderResult(state);
    if (setup) renderSetup(state);
    else renderGame(state);
  }

  // Mise à jour légère de la simulation. Les boutons et les régions ne sont
  // pas recréés ici : ils doivent rester dans le DOM pendant un clic complet.
  function renderFrame(state) {
    currentState = state;
    if (state.phase === "setup") return;
    renderStatus(state);
    updateVillageSelector(state);
    updateMapVillagePopups(state);
    renderUnits(state);
    updateBoardState(state);
    updateInspectorState(state);
    updateShopState(state);
    syncShopModal(state);
    renderRedirect(state, false);
    renderResult(state);
  }

  function renderSetup(state) {
    elements.setupPlayers.innerHTML = [state.players.red, state.players.blue].map((player) => {
      const cards = player.villages.map((village) => {
        const selected = player.setupSelection.includes(village.lane);
        return `<button class="biome-choice ${village.biome} ${selected ? "selected" : ""}" type="button"
          data-biome-choice data-player="${player.id}" data-lane="${village.lane}" ${player.setupConfirmed ? "disabled" : ""}
          aria-pressed="${selected}">
          <span class="choice-number">${village.lane + 1}</span>
          <strong>${biomeIcons[village.biome]} ${E.Biomes.labels[village.biome]}</strong>
          <span>${slotDescription(village.biome)}</span>
        </button>`;
      }).join("");

      return `<article class="setup-player ${player.setupConfirmed ? "confirmed" : ""}">
        <div class="setup-player-head">
          <h3>${player.name}</h3>
          <span class="status-pill">${player.setupConfirmed ? `Territoire confirmé` : `${player.setupSelection.length}/${E.Board.getFormat(state).exchanges} biomes`}</span>
        </div>
        <div class="biome-choice-grid">${cards}</div>
        <div class="setup-actions">
          <button class="button ${player.id === "red" ? "button-red" : "button-blue"}" type="button"
            data-setup-action="exchange" data-player="${player.id}" ${player.setupConfirmed || player.setupSelection.length === 0 ? "disabled" : ""}>
            Échanger la sélection
          </button>
          <button class="button" type="button" data-setup-action="keep" data-player="${player.id}" ${player.setupConfirmed ? "disabled" : ""}>Tout conserver</button>
        </div>
      </article>`;
    }).join("");

    const ready = state.players.red.setupConfirmed && state.players.blue.setupConfirmed;
    elements.startButton.disabled = !ready;
    elements.setupHint.textContent = E.Network.mode === "solo"
      ? ready ? "Ton territoire est prêt. L’IA a confirmé le sien." : "Confirme ton territoire pour affronter l’IA."
      : ready ? "Les deux territoires sont prêts." : "Les deux joueurs doivent confirmer leur territoire.";
  }

  function slotDescription(biome) {
    if (biome === "littoral") return "2 emplacements libres";
    if (biome === "montagne") return "2 libres · 2 animaux";
    return "4 emplacements libres";
  }

  function renderGame(state) {
    renderStatus(state);
    renderVillageSelector(state);
    renderBoard(state);
    renderMapVillagePopups(state);
    updateMapVillagePopups(state);
    renderUnits(state);
    renderInspector(state);
    renderShop(state);
    syncShopModal(state);
    updatePanelPermissions(state);
    renderRedirect(state, true);
    renderResult(state);
  }

  function updatePanelPermissions(state) {
    const readonly = !["local", "pending"].includes(E.Network.mode) &&
      state.selectedVillage.playerId !== (E.Network.playerId || "red");
    [elements.inspector, elements.residents, elements.shop, elements.construction, elements.ownedBuildings]
      .forEach(panel => panel.classList.toggle("opponent-readonly", readonly));
  }

  function openShopModal() {
    if (E.Network.mode === "solo" && currentState.selectedVillage.playerId !== "red") {
      controller.selectVillage("red", currentState.selectedVillage.lane);
    }
    elements.shopModal.hidden = false;
    elements.shopModalContent.appendChild(elements.shop);
    syncShopModal(currentState);
  }

  function syncShopModal(state) {
    if (!state || elements.shopModal.hidden) return;
    const playerId = E.Network.mode === "solo" ? "red" : state.selectedVillage.playerId;
    if (elements.shopVillageNav.dataset.player !== playerId || elements.shopVillageNav.childElementCount !== state.players[playerId].villages.length) {
      elements.shopVillageNav.dataset.player = playerId;
      elements.shopVillageNav.innerHTML = state.players[playerId].villages.map((_, lane) => `<button class="button button-quiet" data-player="${playerId}" data-shop-village="${lane}" type="button">Village ${lane + 1}</button>`).join("");
    }
    elements.shopVillageNav.querySelectorAll("[data-shop-village]").forEach((button) => {
      const selected = Number(button.dataset.shopVillage) === state.selectedVillage.lane;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }


  function renderStatus(state) {
    if (state.tutorial?.noTimer) {
      elements.clock.textContent = "∞";
      elements.phase.textContent = "Tutoriel libre";
    } else if (state.preparationRemaining > 0) {
      elements.clock.textContent = formatTime(Math.ceil(state.preparationRemaining));
      elements.phase.textContent = "Préparation";
    } else {
    const overtime = state.elapsed >= E.Config.normalDuration;
    const shownTime = overtime ? state.elapsed - E.Config.normalDuration : E.Config.normalDuration - state.elapsed;
    elements.clock.textContent = `${overtime ? "+" : ""}${formatTime(shownTime)}`;
    elements.phase.textContent = overtime ? "Overtime" : "Temps normal";
    }
    elements.clock.closest(".board-clock")?.setAttribute("aria-label", state.preparationRemaining > 0 ? "Temps de préparation" : "Temps restant");
    const clock = elements.clock.closest('.board-clock');
    if (clock) clock.dataset.paused = String(state.paused);
    if (elements.pause) elements.pause.textContent = state.paused ? "Reprendre" : "Pause";
  }

  function renderVillageSelector(state) {
    elements.villageSelector.innerHTML = (E.Network.mode === "local" ? ["red", "blue"] : [viewerId(state)]).map((playerId) => {
      const player = state.players[playerId];
      const buttons = player.villages.map((village) => {
        const selected = state.selectedVillage.playerId === playerId && state.selectedVillage.lane === village.lane;
        return `<button type="button" class="village-select ${playerId} ${selected ? "selected" : ""} ${village.destroyed ? "destroyed" : ""}" data-village-select data-player="${playerId}" data-lane="${village.lane}" aria-pressed="${selected}"><span>V${village.lane + 1}</span><strong>${biomeIcons[village.biome]} ${E.Biomes.labels[village.biome]}</strong><small data-village-select-hp>${Math.ceil(village.hp)}/${village.maxHp} PV · T${village.level}</small></button>`;
      }).join("");
      return `<div class="village-select-group ${playerId}"><span class="village-select-label">${playerId === "red" ? "Rouge" : "Bleu"}</span>${buttons}</div>`;
    }).join("");
  }

  function updateVillageSelector(state) {
    Object.values(state.players).forEach((player) => player.villages.forEach((village) => {
      const button = elements.villageSelector.querySelector(`[data-village-select][data-player="${player.id}"][data-lane="${village.lane}"]`);
      if (!button) return;
      const selected = state.selectedVillage.playerId === player.id && state.selectedVillage.lane === village.lane;
      button.classList.toggle("selected", selected);
      button.classList.toggle("destroyed", village.destroyed);
      button.setAttribute("aria-pressed", String(selected));
      const hp = button.querySelector("[data-village-select-hp]");
      if (hp) hp.textContent = `${Math.ceil(village.hp)}/${village.maxHp} PV · T${village.level}`;
    }));
  }

  const campIds = ['red', 'blue'];
  const campName = id => id === 'red' ? 'Rouge' : 'Bleu';
  const statsKnown = (state, playerId) => E.MythologyEffects.canSeeStats(state, viewerId(state), playerId);
  const hudSignature = state => JSON.stringify([viewerId(state), ...campIds.map(id => [state.players[id].villages.length, statsKnown(state,id)])]);
  function equipmentPips(kind, type) {
    const tier = E.Config.equipment[kind][type]?.requiredTier || 0;
    const path = kind === 'tools'
      ? '<path d="m4 20 3-3m-2-3 5 5m-3-5L17 4l3-1-1 3L9 16M3 21l2-2"/>'
      : '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/>';
    return `<span class="hud-pips" data-tier="${tier}" aria-label="${kind === 'tools' ? 'Outils' : 'Armures'} : palier ${tier} sur 3">${[1,2,3].map(n => `<svg viewBox="0 0 24 24" aria-hidden="true" class="hud-pip ${n <= tier ? 'is-lit' : ''}">${path}</svg>`).join('')}</span>`;
  }
  function renderMapVillagePopups(state) {
    elements.mapVillagePopups.dataset.viewer = viewerId(state);
    elements.mapVillagePopups.dataset.signature = hudSignature(state);
    elements.mapVillagePopups.style.setProperty('--camp-card-count', state.players.red.villages.length + 1);
    elements.mapVillagePopups.innerHTML = campIds.map(playerId => {
      const player = state.players[playerId], known = statsKnown(state,playerId);
      const global = `<article class="map-camp-summary ${playerId}" data-map-camp="${playerId}" aria-label="Statistiques globales du camp ${campName(playerId)}">
        <header><strong>${campName(playerId)} · Global</strong><span>${playerId === viewerId(state) ? 'Vous' : 'Adversaire'}</span></header>
        <div class="hud-global-row hud-global-values"><span>Or <b data-camp-gold></b></span><span>PV <b data-camp-hp></b></span></div>
        <div class="hud-global-row hud-equipment" data-camp-equipment aria-label="Paliers d’équipement par village"></div>
        <div class="hud-global-row hud-legend-row"><span class="hud-legend-count"><b data-camp-legends>0</b> <span data-camp-legend-label>légendes</span></span><div class="hud-crystals" data-camp-crystals aria-label="Cristaux des légendes en réserve"></div></div>
      </article>`;
      const villages = player.villages.map(village => `<article class="map-village-popup ${playerId} lane-${village.lane}" data-map-village data-player="${playerId}" data-lane="${village.lane}" data-stats-visible="${known}" aria-label="${campName(playerId)} Village ${village.lane + 1}">
        <header><strong>${campName(playerId)} V${village.lane + 1}</strong><span data-map-intelligence>${biomeIcons[village.biome]}</span></header>
        <div class="map-village-stats"><span title="Points de vie">PV <b data-map-hp></b></span><span title="Population">Pop. <b data-map-population>${known ? `${village.population}/${village.populationMax}` : '?'}</b></span><span title="Habitants disponibles">Dispo. <b data-map-available>${known ? E.Economy.getAvailableResidents(state,playerId,village.lane) : '?'}</b></span></div>
        <dl>${E.Config.resources.map(resource => `<div title="${resourceLabels[resource]}"><dt>${resourceIcons[resource]}</dt><dd data-map-resource="${resource}">${known ? formatNumber(village.resources[resource]) : '?'}</dd></div>`).join('')}</dl>
      </article>`).join('');
      return global + villages;
    }).join('');
    const cardCount = state.players.red.villages.length + 1;
    [...elements.mapVillagePopups.children].forEach((card,index) => {
      card.style.setProperty('--hud-column', index < cardCount ? index + 1 : index + 2);
      card.style.setProperty('--hud-side', index < cardCount ? 1 : 3);
      card.style.setProperty('--hud-row', index % cardCount + 1);
    });
    updateMapVillagePopups(state);
  }

  function updateMapVillagePopups(state) {
    if (elements.mapVillagePopups.dataset.signature !== hudSignature(state)) return renderMapVillagePopups(state);
    for (const playerId of campIds) {
      const player = state.players[playerId], known = statsKnown(state,playerId);
      const summary = elements.mapVillagePopups.querySelector(`[data-map-camp="${playerId}"]`);
      summary.querySelector('[data-camp-gold]').textContent = formatNumber(player.gold);
      summary.querySelector('[data-camp-hp]').textContent = `${Math.ceil(player.villages.reduce((n,v) => n+v.hp,0))}/${player.villages.reduce((n,v) => n+v.maxHp,0)}`;
      const equipment = summary.querySelector('[data-camp-equipment]');
      const equipmentKey = JSON.stringify(player.villages.map(v => v.equipment));
      if (equipment.dataset.signature !== equipmentKey) {
        equipment.dataset.signature = equipmentKey;
        equipment.innerHTML = player.villages.map(v => `<span class="hud-village-equipment" data-equipment-lane="${v.lane}"><small>V${v.lane+1}</small>${equipmentPips('tools',v.equipment?.tool)}${equipmentPips('armors',v.equipment?.armor)}</span>`).join('');
      }
      const stock = E.MythologySession?.getPublicSummary(state,playerId) || {count:0,colors:[]};
      summary.querySelector('[data-camp-legends]').textContent = stock.count;
      summary.querySelector('[data-camp-legend-label]').textContent = stock.count === 1 ? 'légende' : 'légendes';
      const crystals = summary.querySelector('[data-camp-crystals]'), colorsKey = JSON.stringify(stock.colors);
      if (crystals.dataset.signature !== colorsKey) {
        crystals.dataset.signature = colorsKey;
        crystals.innerHTML = stock.colors.map(color => `<svg viewBox="0 0 20 28" class="hud-crystal" style="--gem-color:${color}" role="img" aria-label="Cristal coloré"><path d="m10 1 8 8v10l-8 8-8-8V9Z"/><path d="M10 1v26M2 9h16M2 19h16M10 1 6 9v10l4 8m0-26 4 8v10l-4 8"/></svg>`).join('');
      }
      for (const village of player.villages) {
        const popup = elements.mapVillagePopups.querySelector(`[data-map-village][data-player="${playerId}"][data-lane="${village.lane}"]`);
        const selected = state.selectedVillage.playerId === playerId && state.selectedVillage.lane === village.lane;
        popup.classList.toggle('selected',selected);
        popup.classList.toggle('under-attack',village.damageSmoke > 0);
        popup.classList.toggle('destroyed',village.destroyed);
        popup.classList.toggle('is-concealed',!known);
        popup.setAttribute('aria-current',String(selected));
        popup.querySelector('[data-map-hp]').textContent = `${Math.ceil(village.hp)}/${village.maxHp}`;
        popup.querySelector('[data-map-population]').textContent = known ? `${village.population}/${village.populationMax}` : '?';
        popup.querySelector('[data-map-available]').textContent = known ? E.Economy.getAvailableResidents(state,playerId,village.lane) : '?';
        const intelligence = popup.querySelector('[data-map-intelligence]');
        intelligence.textContent = `${biomeIcons[village.biome]} ${known ? `T${village.level}` : '🔒'}`;
        intelligence.title = known ? `Village T${village.level} · ${village.buildings.map(b => `${buildingLabels[b.type]} T${b.level}`).join(' · ') || 'Aucun bâtiment'}` : 'Population et ressources masquées · Œil de Sainte-Lucie requis';
        E.Config.resources.forEach(resource => {
          popup.querySelector(`[data-map-resource="${resource}"]`).textContent = known ? formatNumber(village.resources[resource]) : '?';
        });
      }
    }
  }

  function renderBoard(state) {
    elements.columns.dataset.signature = terrainSignature(state);
    elements.columns.style.setProperty("--region-count", state.players.red.villages.length);
    elements.columns.innerHTML = state.players.red.villages.map((_, lane) => {
      const redVillage = state.players.red.villages[lane];
      const blueVillage = state.players.blue.villages[lane];
      return `<article class="lane" data-mythology-lane="${lane}">
        <span class="lane-label">${lane + 1}</span>
        ${villageButton(redVillage, state.selectedVillage)}
        ${regionMarkup(state, redVillage, "red")}
        <div class="frontier"></div>
        ${regionMarkup(state, blueVillage, "blue")}
        ${villageButton(blueVillage, state.selectedVillage)}
      </article>`;
    }).join("");
  }

  function villageButton(village, selection) {
    const ratio = Math.max(0, village.hp / village.maxHp) * 100;
    const selected = selection.playerId === village.ownerId && selection.lane === village.lane;
    return `<div class="village-token ${village.ownerId} ${selected ? "selected" : ""} ${village.destroyed ? "destroyed" : ""}"
      data-village-visual data-player="${village.ownerId}" data-lane="${village.lane}" aria-hidden="true">
      <span class="village-meta"><strong>Village T${village.level}</strong><span data-village-hp>${Math.ceil(village.hp)}/${village.maxHp}</span></span>
      <span class="hp-track"><i style="width:${ratio}%"></i></span>
    </div>`;
  }

  function regionMarkup(state, village, playerId) {
    const overlays = village.terrain?.river ? '<div class="mythology-terrain-overlays"><span class="mythology-terrain-river" title="Rivière"></span></div>' : "";
    const slots = village.slots.map((slot, index) => {
      const crop = slot.content && slot.content.category === "crop" ? E.Crops.get(slot.content.type) : null;
      const herd = slot.content && slot.content.category === "livestock" ? E.Livestock.get(slot.content.type) : null;
      let title = slot.type === "animal" ? "Réservé aux animaux" : "Emplacement libre";
      let content = `<span class="slot-number">${index + 1}</span>`;
      let contentClass = "";
      if (crop) {
        title = `${crop.label} · Niveau ${E.Crops.levelOf(slot.content)} · ${Math.ceil(slot.content.hp)}/${slot.content.maxHp} PV`;
        content = `<span class="content-icon">${crop.icon}</span><span class="content-name">${crop.shortLabel} · N${E.Crops.levelOf(slot.content)}</span><span class="content-detail"><b data-crop-yield>${E.Economy.cropYield(village, slot.content.type)}</b> / retour · <span data-crop-hp>${Math.ceil(slot.content.hp)}</span> PV</span>`;
        contentClass = `occupied crop crop-${slot.content.type}`;
        const variant = E.CropModels?.variantFor(slot.content.type, slot.content);
        if (variant) contentClass += ` crop-size-${variant.id}`;
      } else if (herd) {
        title = `${herd.label} · ${slot.content.count} animaux · ${Math.ceil(slot.content.hp)} PV`;
        content = `<span class="content-icon">${herd.icon}</span><span class="content-name">${herd.shortLabel}</span><span class="content-detail"><b data-herd-count>${slot.content.count}</b> animaux · <span data-herd-hp>${Math.ceil(slot.content.hp)}</span> PV</span>`;
        contentClass = `occupied livestock livestock-${slot.content.type}`;
        const variant = E.LivestockModels?.variantFor(slot.content.type, slot.content.count);
        if (variant) contentClass += ` herd-size-${variant.id}`;
      }
      return `<div class="slot ${slot.type} ${contentClass}" data-slot-visual data-player="${playerId}" data-lane="${village.lane}" data-slot-index="${index}" title="${title}">${content}</div>`;
    }).join("");
    const terrainBuildings = [
      `<span class="terrain-building terrain-campfire tier-${village.level}" data-terrain-building="campfire" data-building-tier="${village.level}" title="Feu de camp T${village.level}"></span>`,
      `<span class="terrain-building terrain-village tier-${village.level}" data-terrain-building="village" data-building-tier="${village.level}" title="Village T${village.level}"></span>`,
      ...village.buildings.map((building, index) => `<span class="terrain-building terrain-${building.type} tier-${building.level}" data-terrain-building="${building.type}" data-building-tier="${building.level}" data-building-index="${index}" title="${buildingLabels[building.type]} T${building.level}"></span>`)
    ].join("");
    const maritime = E.Transport.maritimeState(village);
    const boatIcons = (type) => Array.from({ length: maritime[type] }, (_, index) => `<span class="terrain-vessel vessel-${type}" title="${E.Config.maritime.shop[type].label} ${index + 1}">${E.Config.maritime.shop[type].icon}</span>`).join("");
    const maritimeLayer = village.biome === "littoral" ? `<div class="maritime-layer" aria-label="Flotte du littoral">
      <span class="fleet-group fleet-voilier" data-terrain-fleet="voilier">${boatIcons("voilier")}<b>${maritime.voilier}/2</b></span>
      <span class="fleet-group fleet-filet" data-terrain-fleet="filet"><span class="terrain-net">🕸</span><b>${maritime.filet}</b></span>
      <span class="fleet-group fleet-barque" data-terrain-fleet="barque">${boatIcons("barque")}<b>${maritime.barque}/4</b></span>
    </div>` : "";
    return `<div class="region ${village.biome} ${playerId} ${village.burnUntil > state.elapsed ? "mythology-burned" : ""} ${village.curseUntil > state.elapsed ? "mythology-cursed" : ""}" data-mythology-region data-player="${playerId}" data-lane="${village.lane}">
      <div class="region-name"><span>${E.Biomes.labels[village.biome]}</span><span data-region-population>${village.population}/${village.populationMax} hab.</span></div>
      <div class="terrain-ramparts tier-${village.level} ${village.destroyed ? 'destroyed' : ''}" data-terrain-ramparts title="Remparts · ${Math.ceil(village.hp)} PV"></div>
      <div class="terrain-building-layer ${village.destroyed ? "destroyed" : ""} ${village.damageSmoke > 0 ? "under-attack" : ""}" aria-label="Village et bâtiments visibles sur le terrain">${terrainBuildings}</div>
      ${maritimeLayer}
      ${overlays}
      <div class="slot-grid">${slots}</div>
    </div>`;
  }

  function renderUnits(state) {
    const regionCount = state.players.red.villages.length;
    const combatUnits = state.units.filter(unit => !E.MythologyEffects || E.MythologyEffects.unitVisible(state, viewerId(state), unit)).map((unit) => {
      const stats = E.Config.units[unit.role];
      const left = ((unit.lanePosition + 0.5) / regionCount) * 100;
      const top = Math.max(1.2, Math.min(98.8, unit.position));
      const vessel = unit.waterTransport ? `<span class="unit-vessel" title="Transporté par ${E.Config.maritime.shop[unit.waterTransport].label.toLowerCase()}">${E.Config.maritime.shop[unit.waterTransport].icon}</span>` : "";
      const selected = unit.residentId === state.selectedResidentId && unit.ownerId === state.selectedVillage.playerId && unit.originLane === state.selectedVillage.lane;
      const label = E.Mythology?.get(unit.mythologyLegendId)?.name || stats.label;
      return `<div class="unit ${unit.ownerId} role-${unit.role} ${selected ? "selected-resident" : ""} ${unit.waitingForRedirect ? "waiting" : ""} ${unit.waterTransport ? `on-water transport-${unit.waterTransport}` : ""}" data-unit-id="${unit.id}" style="left:${left}%;top:${top}%" title="${label} · ${Math.ceil(unit.hp)} PV${unit.returningToVillage ? " · Retour au village" : ""}${unit.waterTransport ? ` · ${E.Config.maritime.shop[unit.waterTransport].label}` : ""}">
        ${unit.animalType ? animalAppearance(unit.animalType, "unit-body") : residentAppearance(unit, "unit-body")}
        ${unit.returningToVillage ? '<span class="unit-recall-indicator" aria-hidden="true">↩</span>' : ''}
        ${vessel}
        <span class="hp-track"><i style="width:${Math.max(0, unit.hp / unit.maxHp) * 100}%"></i></span>
      </div>`;
    }).join("");
    const workers = Object.values(state.players).flatMap((player) => player.villages.flatMap((village) =>
      village.residents
        .filter((resident) => (E.MythologyEffects ? E.MythologyEffects.residentVisible(state, viewerId(state), village, resident) : vision(state, village).people)
          && ["agriculture", "elevage", "chasse"].includes(resident.mission) && resident.workPosition !== null)
        .map((resident) => {
          const laneOffset = resident.mission === "chasse" ? 0.5 + (resident.workLaneOffset || 0) : resident.mission === "elevage" ? 0.62 : 0.45;
          const left = ((village.lane + laneOffset) / regionCount) * 100;
          const top = Math.max(1.2, Math.min(98.8, resident.workPosition));
          const carrying = resident.carrying ? " carrying" : "";
          const selected = resident.id === state.selectedResidentId && player.id === state.selectedVillage.playerId && village.lane === state.selectedVillage.lane;
          return `<div class="unit worker ${player.id}${carrying} ${selected ? "selected-resident" : ""}" data-worker-mission="${resident.mission}" style="left:${left}%;top:${top}%" title="${resident.name} · ${farmerPhaseLabel(resident)}${resident.carrying ? ` · ${formatNumber(resident.carrying.amount)} ${resourceLabels[resident.carrying.resource]}` : ""}">
            ${residentAppearance(resident, "unit-body")}
          </div>`;
        })
    )).join("");
    const locals = Object.values(state.players).flatMap((player) => player.villages.flatMap((village) =>
      village.destroyed || !vision(state, village).people && !vision(state, village).offensive ? [] : (() => {
        const visible = village.residents.filter((resident) => !resident.unitId && !["attaque", "defense"].includes(resident.mission)
          && !(["agriculture", "elevage", "chasse"].includes(resident.mission) && resident.workPosition !== null));
        let fisherIndex = 0, idleIndex = 0;
        const idleCount = visible.filter(r => r.mission !== "peche").length;
        return visible.filter(resident => !E.MythologyEffects || E.MythologyEffects.residentVisible(state, viewerId(state), village, resident)).map((resident, index) => {
          const fishing = resident.mission === "peche";
          const narrow = window.innerWidth < 720;
          const fisherColumns = narrow ? 4 : 7;
          const fishingSlot = fishing ? fisherIndex++ : 0;
          const angle = 2 * Math.PI * (fishing ? 0 : idleIndex++) / Math.max(1, idleCount);
          const left = fishing
            ? ((village.lane + (fishingSlot % fisherColumns + 0.5) / fisherColumns) / regionCount) * 100
            : ((village.lane + .5 + Math.cos(angle) * .31) / regionCount) * 100;
          const distance = fishing ? 23 + Math.floor(fishingSlot / fisherColumns) * (narrow ? 1.9 : 3) : 12 + Math.sin(angle) * 3.4;
          const top = player.id === "red" ? distance : 100 - distance;
          const selected = resident.id === state.selectedResidentId && player.id === state.selectedVillage.playerId && village.lane === state.selectedVillage.lane;
          return `<div class="local-person ${player.id} ${fishing ? "fishing" : ""} ${selected ? "selected-resident" : ""}" data-local-resident="${resident.id}" style="left:${left}%;top:${top}%" title="${resident.name} · ${E.Config.professions[resident.profession || "habitant"].label}">${residentAppearance(resident, "unit-body")}</div>`;
        });
      })()
    )).join("");
    const localAnimals = Object.values(state.players).flatMap((player) => player.villages.flatMap((village) =>
      village.destroyed || !vision(state, village).all ? [] : (village.animals || []).filter((animal) => !animal.unitId).map((animal, index) => {
        const left = ((village.lane + 0.22 + (index % 4) * 0.17) / regionCount) * 100;
        const distance = 18 + Math.floor(index / 4) * 2;
        return `<div class="local-person ${player.id}" data-local-animal="${animal.id}" style="left:${left}%;top:${player.id === "red" ? distance : 100 - distance}%" title="${E.Config.specialAnimals[animal.type].label}">${animalAppearance(animal.type, "unit-body")}</div>`;
      })
    )).join("");
    elements.units.innerHTML = combatUnits + workers + locals + localAnimals;
  }

  function terrainSignature(state) {
    return Object.values(state.players).flatMap((player) => player.villages.map((village) => `${village.id}:${village.destroyed}:${village.level}:${E.MythologyEffects?.terrainVisualKey(village) || ""}:${village.burnUntil > state.elapsed}:${village.curseUntil > state.elapsed}:${vision(state, village).fraction}:${village.buildings.map((building) => `${building.type}:${building.level}`).join(",")}:${village.slots.map((slot) => slot.content ? `${slot.content.category}:${slot.content.type}:${slot.content.level || 1}:${slot.content.hp > 0}:${slot.content.category === 'livestock' ? E.LivestockModels?.variantFor(slot.content.type, slot.content.count)?.id || '' : ''}` : "-").join(",")}`)).join("|");
  }

  function livestockPreview(type) {
    const variant = E.LivestockModels?.variantFor(type, E.Config.startingLivestockCount);
    return variant ? `<span class="herd-preview-${type} herd-size-${variant.id}" aria-hidden="true"></span>` : E.Livestock.get(type).icon;
  }

  function cropPreview(type) {
    if (type === 'ble') return '<span class="crop-preview-ble" aria-hidden="true"></span>';
    const variant = E.CropModels?.variantFor(type);
    if (variant) return `<span class="crop-preview-${type} crop-size-${variant.id}" title="${variant.label}" aria-hidden="true"></span>`;
    return E.Crops.get(type).icon;
  }

  function animalAppearance(type, className) {
    return `<span class="${className} animal-appearance animal-${type}" data-visual-animal="${type}" aria-hidden="true">${E.Config.specialAnimals[type].icon}</span>`;
  }

  function residentAppearance(resident, className) {
    const profession = E.Config.professions[resident.profession] ? resident.profession : "habitant";
    const tool = E.Config.equipment.tools[resident.tool] ? resident.tool : "";
    const armor = E.Config.equipment.armors[resident.armor] ? resident.armor : "";
    return `<span class="${className} profession-${profession}" data-visual-profession="${profession}" data-visual-tool="${tool}" data-visual-armor="${armor}" data-visual-donkey="${Boolean(resident.donkey)}" aria-hidden="true">${armor ? `<i class="gear-armor armor-${armor}"></i>` : ""}${tool ? `<i class="gear-tool tool-${tool}"></i>` : ""}${resident.donkey ? '<i class="donkey-badge">🫏</i>' : ""}</span>`;
  }

  function equipmentLabel(resident) {
    return [E.Config.equipment.tools[resident.tool]?.label, E.Config.equipment.armors[resident.armor]?.label, resident.donkey ? "Âne compagnon" : null].filter(Boolean).join(" · ") || "Sans outil ni armure";
  }

  function removalButton(state, player, village, slot, index) {
    if (state.phase !== "running" || !(state.preparationRemaining > 0)) return "";
    const crop = slot.content?.category === "crop";
    const quote = (crop ? E.Crops : E.Livestock).removalQuote(state, player.id, village.lane, index);
    if (!quote) return "";
    return `<button type="button" class="remove-slot-button" data-remove-slot="${index}" ${quote.allowed ? "" : "disabled"}>${crop ? "Vendre le terrain" : "Retirer l’élevage"}<small>${crop ? `+${quote.refund} or` : "Gratuit · sans viande"}</small></button>`;
  }

  function renderSlotPicker(state, player, village) {
    const activeIndex = selectedSlot?.playerId === player.id && selectedSlot.lane === village.lane
      ? selectedSlot.index : null;
    const preparing = state.preparationRemaining > 0;
    const buttons = Array.from({ length: 4 }, (_, index) => {
      const slot = village.slots[index];
      const content = slot?.content;
      const definition = content && (E.Config.crops[content.type] || E.Config.livestock[content.type]);
      const status = !slot ? "Indisponible" : content?.category === "livestock"
        ? `${definition.icon} ×${content.count}` : content?.category === "crop"
          ? `N${E.Crops.levelOf(content)} · ${definition.shortLabel}` : slot.type === "animal" ? "Élevage libre" : "Libre";
      return `<button type="button" class="placement-slot ${activeIndex === index ? "selected" : ""}" data-select-slot="${index}" aria-expanded="${activeIndex === index}" aria-controls="slot-options" ${!slot ? "disabled" : ""}><strong>Slot ${index + 1}</strong><small>${status}</small></button>`;
    }).join("");
    const slot = activeIndex === null ? null : village.slots[activeIndex];
    const cropOptions = slot?.type === "free" ? Object.entries(E.Config.crops)
      .filter(([type]) => E.Crops.isAllowedInBiome(type, village.biome) && type !== slot.content?.type)
      .map(([type, crop]) => `<button type="button" class="placement-option" data-place-crop="${type}" data-slot-index="${activeIndex}" ${!E.Crops.canPlace(state, player.id, village.lane, activeIndex, type) ? "disabled" : ""}>${cropPreview(type)}<span>${crop.shortLabel}<small>Niveau 1 · ${E.Config.cropLevels[1].gold} or</small></span></button>`) : [];
    let choices = "";
    if (slot?.content?.category === "crop") {
      const content = slot.content, definition = E.Crops.get(content.type);
      const quote = E.Crops.upgradeQuote(state, player.id, village.lane, activeIndex);
      const next = E.Config.cropLevels[quote.nextLevel];
      choices = `<div class="enclosure-control slot-management ${preparing ? "is-preparing" : ""}"><strong>${definition.label} · Niveau ${E.Crops.levelOf(content)}</strong><small>${Math.ceil(content.hp)} PV · Rendement ×${E.Crops.yieldOf(content)}</small><div class="slot-actions">${removalButton(state, player, village, slot, activeIndex)}<button type="button" class="crop-upgrade-button" data-upgrade-crop="${activeIndex}" ${quote.allowed ? "" : "disabled"} title="${quote.reason || "Améliorer le rendement"}">${next ? `Améliorer → N${quote.nextLevel}<small>${quote.gold} or · Rendement ×${quote.yield}</small>` : "Niveau 3 · Maximum"}</button></div></div>`;
      if (cropOptions.length) choices += `<details class="crop-replant"><summary>Changer de culture · ${E.Config.cropLevels[1].gold} or</summary><p class="section-help">La nouvelle culture repart au niveau 1. Ce remplacement ne rembourse pas l’ancienne culture.</p><div class="placement-options">${cropOptions.join("")}</div></details>`;
    } else if (slot?.content?.category === "livestock") {
      const animal = E.Livestock.get(slot.content.type);
      const locked = state.phase !== "running" || state.paused || village.destroyed;
      choices = `<div class="enclosure-control slaughter-card slot-management ${preparing ? "is-preparing" : ""}" data-meat="${animal.meatAtDeath}"><strong>${animal.icon} ${animal.shortLabel} · ${slot.content.count}</strong><small class="harassment-warning" data-herd-harassment="${activeIndex}"></small><div class="slot-actions">${removalButton(state, player, village, slot, activeIndex)}<div class="slaughter-controls"><label><span>À abattre</span><input type="number" min="1" max="${slot.content.count}" value="1" data-slaughter-quantity></label><button type="button" class="slaughter-button" data-slaughter="${activeIndex}" ${locked ? "disabled" : ""}>Abattre <span data-slaughter-preview>+${animal.meatAtDeath} viande</span></button><button type="button" class="slaughter-button" data-slaughter-all="${activeIndex}" ${locked ? "disabled" : ""}>Tout abattre<small>+${slot.content.count * animal.meatAtDeath} viande</small></button></div></div></div>`;
    } else if (slot) {
      const livestock = Object.entries(E.Config.livestock)
        .map(([type, animal]) => `<button type="button" class="placement-option" data-place-livestock="${type}" data-slot-index="${activeIndex}" ${!E.Livestock.canPlace(state, player.id, village.lane, activeIndex, type) ? "disabled" : ""}>${livestockPreview(type)} ${animal.shortLabel}</button>`);
      choices = `<div class="placement-options">${[...cropOptions, ...livestock].join("")}</div>`;
    }
    return `<section class="inspector-section slot-section" aria-label="Emplacements du village"><div class="placement-slots">${buttons}</div><div id="slot-options" class="slot-options" ${!slot ? "hidden" : ""}>${slot ? `<strong>Slot ${activeIndex + 1} · ${E.Biomes.labels[village.biome]}</strong>${choices}` : ""}</div></section>`;
  }

  function renderInspector(state) {
    const selection = state.selectedVillage;
    const player = state.players[selection.playerId];
    const village = player && player.villages[selection.lane];
    const sameVillage = elements.residents.dataset.selectionKey === `${selection.playerId}-${selection.lane}`;
    const residentScroll = sameVillage ? elements.residents.querySelector("[data-resident-list]")?.scrollTop || 0 : 0;
    const panelScrolls = new Map(sameVillage ? Array.from(elements.residents.querySelectorAll("[data-scroll-key]"), panel => [panel.dataset.scrollKey, panel.scrollTop]) : []);
    const inspectorScroll = sameVillage ? elements.inspector.scrollTop : 0;
    elements.residents.dataset.selectionKey = `${selection.playerId}-${selection.lane}`;
    elements.residents.className = `panel-card residents-panel ${selection.playerId} lane-${selection.lane}`;
    updatePanelPermissions(state);
    elements.residents.hidden = false;
    elements.construction.hidden = false;
    elements.ownedBuildings.hidden = false;
    if (!village) {
      elements.inspector.innerHTML = `<p class="empty-copy">Sélectionnez un village.</p>`;
      elements.residents.innerHTML = "";
      elements.construction.hidden = elements.ownedBuildings.hidden = true;
      return;
    }
    elements.inspector.dataset.herdSignature = `${herdSignature(village)}:${state.preparationRemaining > 0}`;
    const availableResidents = E.Economy.getAvailableResidents(state, player.id, village.lane);
    const slots = renderSlotPicker(state, player, village);
    const selectedResident = village.residents.find((resident) => resident.id === state.selectedResidentId) || village.residents[0] || null;
    const residentSignature = residentsSignature(village);
    const residentCards = village.residents.map((resident) => {
      const selected = selectedResident && selectedResident.id === resident.id;
      return `<button class="resident-card ${selected ? "selected" : ""}" type="button"
        data-select-resident="${resident.id}" data-resident-state="${resident.mission}" aria-pressed="${selected}" title="${resident.name} · ${equipmentLabel(resident)}">
        ${residentAppearance(resident, "resident-avatar")}
        <span><strong>${resident.name}</strong><small>${E.Config.professions[resident.profession || "habitant"].label}</small><small>${residentTaskLabel(resident)}${E.Economy.isBoosted(resident, resident.pendingMission || resident.mission) ? " · ★ Boost" : ""}</small><small>${equipmentLabel(resident)}</small></span>
      </button>`;
    }).join("");
    const missionButtons = selectedResident ? residentMissionButtons(state, player, village, selectedResident) : "";
    const professionButtons = selectedResident ? Object.entries(E.Config.professions).map(([key, definition]) => {
      const active = (selectedResident.profession || "habitant") === key;
      const allowed = E.Economy.canSetProfession(state, player.id, village.lane, selectedResident.id, key);
      const canAssignAll = village.residents.some((resident) => {
        const currentProfession = resident.profession || "habitant";
        const engagedInCombat = resident.unitId || ["attaque", "defense"].includes(resident.mission);
        if (engagedInCombat || currentProfession === key) return false;
        if (key !== "habitant" && currentProfession !== "habitant") return false;
        return E.Economy.canSetProfession(state, player.id, village.lane, resident.id, key);
      });
      const next = (village.nextResidentProfession || "habitant") === key;
      const canSetNext = state.phase === "running" && !state.paused && !village.destroyed;
      const requirement = definition.requires && !E.Buildings.has(village, definition.requires) ? `${buildingLabels[definition.requires]} requis` : definition.description;
      return `<div class="profession-command"><button type="button" class="profession-button ${active ? "selected" : ""}" data-profession="${key}" data-resident-id="${selectedResident.id}" aria-pressed="${active}" ${!allowed ? "disabled" : ""}>${definition.icon} ${definition.label}${active ? " · Équipé" : ""}<small>${requirement}</small></button><div class="command-actions"><button type="button" class="profession-all-button ${key === "habitant" ? "remove-all-button" : ""}" data-profession-all="${key}" title="${key === "habitant" ? "Retirer les métiers à tous" : "Attribuer ce métier à tous les habitants sans métier"}" aria-label="${key === "habitant" ? "Retirer les métiers à tous" : "Attribuer ce métier à tous les habitants sans métier"}" ${!canAssignAll ? "disabled" : ""}>${key === "habitant" ? "Retirer tous" : "Tous"}</button><button type="button" class="next-resident-button ${next ? "active" : ""}" data-next-profession="${key}" aria-pressed="${next}" ${!canSetNext ? "disabled" : ""} title="Attribuer aux prochains habitants" aria-label="Attribuer aux prochains habitants">Prochains</button></div></div>`;
    }).join("") : '<p class="section-help">Aucun habitant sélectionné.</p>';


    elements.inspector.innerHTML = slots;

    elements.residents.innerHTML = `<div class="residents-content management-columns">
      <aside class="character-panel panel-card" aria-label="Habitants et tâches">
        <header class="management-context"><button type="button" class="layout-reset" data-layout-reset title="Réinitialiser la disposition" aria-label="Réinitialiser la disposition des panneaux">↺</button><strong>Village ${village.lane + 1} · ${player.id === "red" ? "Rouge" : "Bleu"}</strong><span><b data-residents-available>${availableResidents}</b> disponibles · ${selectedResident ? selectedResident.name : "Aucun habitant"}</span></header>
        <section class="management-column management-people"><h3>1 · Habitants</h3>
          <div class="resident-list dashboard-scroll" data-scroll-key="people" data-resident-list data-signature="${residentSignature}">${residentCards || '<p class="empty-residents">Aucun habitant vivant.</p>'}</div>
        </section>
        <section class="management-column management-tasks"><h3>2 · Tâches</h3>
          <p class="selected-resident">${selectedResident ? `${selectedResident.name} · ${residentTaskLabel(selectedResident)}` : "Aucun habitant"}</p>
          <div class="mission-grid dashboard-scroll" data-scroll-key="tasks">${missionButtons}</div>
        </section>
      </aside>
      <section class="management-column management-professions panel-card"><h3>3 · Métiers <small>${selectedResident ? selectedResident.name : ""}</small></h3><div class="profession-list dashboard-scroll" data-scroll-key="professions">${professionButtons}</div></section>
      <section class="management-column management-village panel-card"><h3>4 · Village</h3>
        <div class="village-overview dashboard-scroll" data-scroll-key="village">
          <div class="resident-purchase"><strong>Nouvel habitant</strong><small>50 or + 50 ressources</small><label>Ressource<select data-purchase-resource>${E.Config.resources.map((key) => `<option value="${key}" ${key === purchaseResource ? "selected" : ""}>${resourceLabels[key]}</option>`).join("")}</select></label><button type="button" class="button buy-resident-button" data-buy-resident>Acheter un habitant</button></div>
          <div class="management-card building-card building-village"><img class="campfire-management-image" src="assets/generated/feu_camp_t1.png" alt="" width="80" height="80"><strong>Feu de camp T${village.level}</strong><small>${village.populationMax} habitants maximum</small><small>Améliore le village et ses remparts</small><small>Riposte : ${E.Config.combat.villageRetaliationDamagePerSecond} dégâts/s</small>${upgradeButton(state, player, village, "village")}</div>
        </div>
      </section>
    </div>`;
    renderBuildingTable(state, player, village);
    elements.residents.querySelector("[data-resident-list]").scrollTop = residentScroll;
    elements.residents.querySelectorAll("[data-scroll-key]").forEach(panel => { panel.scrollTop = panelScrolls.get(panel.dataset.scrollKey) || 0; });
    elements.inspector.scrollTop = inspectorScroll;
    updateTradeAndUpgrades(state, player, village);
  }

  const buildingPercent = value => `${Math.round(value * 100)} %`;
  function buildingEffects(type, level) {
    const cfg = E.Config.building, bonus = cfg.artisanatBonus;
    const effects = [`+${cfg[`T${level}`].hp} PV au village`];
    if (type === 'bergerie') effects.push(`Production +${buildingPercent(cfg.bergerieBonusByLevel[level])}`);
    if (type === 'artisanat') effects.push(`Humains : +${bonus.hp} PV, +${bonus.damage} dégâts`);
    effects.push(`Ventes +${buildingPercent(level * E.Config.saleBonusPerLevel)}`);
    return effects;
  }
  function buildingDetails(type) {
    const cfg = E.Config.building, resourceNames = E.Config.saleBuildingResources[type].map(key => resourceLabels[key]);
    const production = type === 'bergerie' ? `<p>Accélère la récolte et la reproduction, et augmente le lait : ${[1,2,3].map(level => `T${level} +${buildingPercent(cfg.bergerieBonusByLevel[level])}`).join(' · ')}.</p>` :
      type === 'artisanat' ? `<p>+${cfg.artisanatBonus.hp} PV et +${cfg.artisanatBonus.damage} dégâts aux humains alliés de la colonne, à tous les niveaux.</p>` : '';
    const shop = E.Config.villageShops[type];
    return `${production}<p>Revente de ${resourceNames.join(', ')} : +${buildingPercent(E.Config.saleBonusPerLevel)} par niveau. Le meilleur bonus s’applique par ressource.</p><ol class="building-unlocks">${[1,2,3].map(level => `<li><b>T${level}</b> ${shop.tiers[level].map(item => { const active = item.animalType || item.equipmentKind || item.specialAnimal || item.purchaseType; const biome = item.purchaseType && E.Config.maritime.shop[item.purchaseType]?.biome; return item.label + (!active ? ' (à venir)' : biome ? ` (${E.Biomes.labels[biome]})` : ''); }).join(', ')}</li>`).join('')}</ol>`;
  }
  function buildingTableSignature(player, village) {
    return JSON.stringify([player.id,village.lane,village.destroyed,village.buildings.map(b => [b.type,b.level,b.hpBonus])]);
  }
  function renderBuildingTable(state, player, village) {
    const cfg = E.Config.building, selection = `${player.id}-${village.lane}`;
    const scrollTop = elements.ownedBuildings.dataset.selectionKey === selection ? elements.ownedBuildings.scrollTop : 0;
    const open = elements.ownedBuildings.dataset.selectionKey === selection ? new Set([...elements.ownedBuildings.querySelectorAll('[data-building-details][open]')].map(d => d.dataset.buildingDetails)) : new Set();
    elements.ownedBuildings.dataset.selectionKey = selection;
    elements.ownedBuildings.dataset.signature = buildingTableSignature(player,village);
    const builtCount = cfg.types.filter(type => E.Buildings.has(village,type)).length;
    const canUpgrade = village.buildings.some(b => b.level < 3);
    elements.construction.innerHTML = `<div class="building-panel-heading"><h3>Bâtiments <span>${builtCount}/${cfg.types.length}</span></h3><small>Un de chaque par village</small></div>${canUpgrade ? `<label class="building-resource-picker">Améliorer avec<select data-upgrade-resource aria-label="Ressource des améliorations de bâtiments">${E.Config.resources.map(key => `<option value="${key}" ${key === upgradeResource ? 'selected' : ''}>${resourceLabels[key]} (${formatNumber(village.resources[key])})</option>`).join('')}</select></label>` : ''}`;
    const rows = cfg.types.map(type => {
      const index = village.buildings.findIndex(b => b.type === type), building = village.buildings[index];
      const level = building?.level || 1, definition = cfg.descriptions[type];
      const professions = Object.values(E.Config.professions).filter(p => p.requires === type).map(p => p.label).join(' · ');
      const action = building ? upgradeButton(state,player,village,index,false) : `<button class="building-buy-button" type="button" data-build="${type}" aria-label="Construire ${definition.label} pour ${cfg.T1.gold} or"><span>Construire</span><strong>${cfg.T1.gold} or</strong></button>`;
      return `<tr class="building-table-row building-${type} ${building ? 'is-built' : 'is-unbuilt'}" data-building-row="${type}" data-building-level="${building?.level || 0}"><th scope="row"><div class="building-row-title"><span class="building-thumbnail building-${type} ${level === 1 ? 'model-preview' : ''}" aria-hidden="true"></span><span><strong>${definition.label}</strong><small>${definition.purpose}</small></span><span class="building-tier ${building ? 'is-owned' : ''}">${building ? `T${level}` : 'T1'}</span></div><p class="building-professions">Métiers : ${professions}</p><ul class="building-bonuses">${buildingEffects(type,level).map(effect => `<li>${effect}</li>`).join('')}</ul><details data-building-details="${type}" ${open.has(type) ? 'open' : ''}><summary>Effets et déblocages</summary>${buildingDetails(type)}</details></th><td class="building-action-cell"><span class="building-step">${building ? level === 3 ? 'Construit' : `Vers T${level+1}` : 'À construire'}</span>${action}<small class="building-action-hint" data-building-hint></small></td></tr>`;
    }).join('');
    elements.ownedBuildings.innerHTML = `<table class="building-table"><caption class="visually-hidden">Bâtiments du village ${village.lane+1} : effets, bonus et coûts</caption><colgroup><col class="building-info-column"><col class="building-cost-column"></colgroup><thead><tr><th scope="col">Bâtiment et bonus</th><th scope="col">Coût / Action</th></tr></thead><tbody>${rows}</tbody></table><p class="building-payment-note">Or partagé · ressources de ce village.</p>`;
    elements.ownedBuildings.scrollTop = scrollTop;
    updateBuildingTable(state,player,village);
  }
  function updateBuildingTable(state, player, village) {
    if (elements.ownedBuildings.dataset.signature !== buildingTableSignature(player,village)) return renderBuildingTable(state,player,village);
    elements.construction.querySelectorAll('[data-upgrade-resource] option').forEach(option => {
      option.textContent = `${resourceLabels[option.value]} (${formatNumber(village.resources[option.value])})`;
    });
    elements.ownedBuildings.querySelectorAll('[data-building-row]').forEach(row => {
      const type = row.dataset.buildingRow, index = village.buildings.findIndex(b => b.type === type), building = village.buildings[index];
      const button = row.querySelector('[data-build]'), hint = row.querySelector('[data-building-hint]');
      const quote = building ? E.Buildings.upgradeQuote(state,player.id,village.lane,index,upgradeResource) : E.Buildings.buildQuote(state,player.id,village.lane,type);
      if (button) { button.disabled = !quote?.allowed; button.title = quote?.reason || `Construire ${E.Config.building.descriptions[type].label}`; }
      if (!quote) hint.textContent = '';
      else if (quote.allowed) hint.textContent = building ? `+${E.Config.building[`T${quote.level}`].hp-building.hpBonus} PV au village` : '';
      else hint.textContent = quote.reason || (state.paused ? 'Partie en pause' : village.destroyed ? 'Village détruit' : player.gold < quote.gold ? 'Or insuffisant' : `${resourceLabels[quote.resourceType] || 'Ressource'} insuffisant(e)`);
    });
  }

  function upgradeButton(state, player, village, index, withResource = true) {
    const quote = E.Buildings.upgradeQuote(state, player.id, village.lane, index, upgradeResource);
    if (!quote) return '<small>Niveau maximum · T3</small>';
    const resourceChoice = index === "village" || !withResource ? "" : `<select class="building-upgrade-resource" data-upgrade-resource aria-label="Ressource utilisée pour améliorer ce bâtiment">${E.Config.resources.map((key) => `<option value="${key}" ${key === upgradeResource ? "selected" : ""}>${resourceLabels[key]}</option>`).join("")}</select>`;
    return `${resourceChoice}<button type="button" class="upgrade-button" data-upgrade="${index}" ${quote.allowed ? "" : "disabled"}>${index === 'village' ? 'Améliorer le feu' : 'Améliorer'} → T${quote.level}<small data-upgrade-cost></small></button>`;
  }

  function updateTradeAndUpgrades(state, player, village) {
    const locked = state.phase !== "running" || state.paused || village.destroyed;
    elements.inspector.querySelectorAll("[data-sell]").forEach((button) => {
      const quote = E.Economy.saleQuote(village, button.dataset.sell);
      button.disabled = locked || !quote || quote.amount <= 0;
      const preview = elements.inspector.querySelector(`[data-sale-preview="${button.dataset.sell}"]`);
      preview.textContent = quote.amount > 0 ? `${formatNumber(quote.amount)} → ${quote.gold.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} or` : "Stock vide";
    });
    elements.gameScreen.querySelectorAll("[data-upgrade]").forEach((button) => {
      const index = button.dataset.upgrade === "village" ? "village" : Number(button.dataset.upgrade);
      const quote = E.Buildings.upgradeQuote(state, player.id, village.lane, index, upgradeResource);
      button.disabled = !quote?.allowed;
      if (quote) button.querySelector("[data-upgrade-cost]").textContent = `${quote.gold} or${quote.resourceAmount ? ` + ${quote.resourceAmount} ${resourceLabels[quote.resourceType]}` : ""}`;
    });
    const buyResident = elements.residents.querySelector("[data-buy-resident]");
    if (buyResident) buyResident.disabled = !E.Economy.canBuyResident(state, player.id, village.lane, purchaseResource);
  }

  function updateBoardState(state) {
    if (elements.columns.dataset.signature !== terrainSignature(state)) renderBoard(state);
    Object.values(state.players).forEach((player) => {
      player.villages.forEach((village) => {
        const button = elements.columns.querySelector(`[data-village-visual][data-player="${player.id}"][data-lane="${village.lane}"]`);
        if (button) {
          button.classList.toggle("destroyed", village.destroyed);
          button.classList.toggle("under-attack", village.damageSmoke > 0);
          const hpText = button.querySelector("[data-village-hp]");
          const hpBar = button.querySelector(".hp-track i");
          if (hpText) hpText.textContent = `${Math.ceil(village.hp)}/${village.maxHp}`;
          if (hpBar) hpBar.style.width = `${Math.max(0, village.hp / village.maxHp) * 100}%`;
        }

        const laneElement = button && button.closest(".lane");
        const structureLayer = laneElement && laneElement.querySelector(`.region.${player.id} .terrain-building-layer`);
        if (structureLayer) structureLayer.classList.toggle("under-attack", village.damageSmoke > 0);
        const population = laneElement && laneElement.querySelector(`.region.${player.id} [data-region-population]`);
        if (population) population.textContent = `${village.population}/${village.populationMax} hab.`;
        village.slots.forEach((slot, index) => {
          if (slot.content?.category === "crop") {
            const visual = elements.columns.querySelector(`[data-slot-visual][data-player="${player.id}"][data-lane="${village.lane}"][data-slot-index="${index}"]`);
            const yieldLabel = visual?.querySelector("[data-crop-yield]");
            if (yieldLabel) yieldLabel.textContent = E.Economy.cropYield(village, slot.content.type);
            const hp = visual?.querySelector("[data-crop-hp]");
            if (hp) hp.textContent = Math.ceil(slot.content.hp);
            if (visual) visual.title = `${E.Crops.get(slot.content.type).label} · Niveau ${E.Crops.levelOf(slot.content)} · ${Math.ceil(slot.content.hp)}/${slot.content.maxHp} PV`;
            return;
          }
          if (!slot.content || slot.content.category !== "livestock") return;
          const slotButton = elements.columns.querySelector(`[data-slot-visual][data-player="${player.id}"][data-lane="${village.lane}"][data-slot-index="${index}"]`);
          if (!slotButton) return;
          const count = slotButton.querySelector("[data-herd-count]");
          const hp = slotButton.querySelector("[data-herd-hp]");
          if (count) count.textContent = slot.content.count;
          if (hp) hp.textContent = Math.ceil(slot.content.hp);
          slotButton.title = `${E.Livestock.get(slot.content.type).label} · ${slot.content.count} animaux · ${Math.ceil(slot.content.hp)} PV`;
        });
      });
    });
  }

  function updateInspectorState(state) {
    const selection = state.selectedVillage;
    const player = state.players[selection.playerId];
    const village = player && player.villages[selection.lane];
    if (!village) return;
    if (elements.inspector.dataset.herdSignature !== `${herdSignature(village)}:${state.preparationRemaining > 0}`) {
      renderInspector(state);
      return;
    }

    setText("[data-inspector-title]", village.destroyed ? "Village détruit" : E.Biomes.labels[village.biome]);
    setText("[data-inspector-hp]", `${Math.ceil(village.hp)} / ${village.maxHp}`);
    setText("[data-inspector-population]", `${village.population} / ${village.populationMax}`);
    setText("[data-inspector-available]", E.Economy.getAvailableResidents(state, player.id, village.lane));
    setText("[data-inspector-gold]", formatNumber(player.gold));
    setText("[data-inspector-birth]", nextPopulationText(state, player, village));
    E.Config.resources.forEach((resource) => {
      const target = elements.inspector.querySelector(`[data-resource="${resource}"]`);
      if (target) target.textContent = formatNumber(village.resources[resource]);
    });

    const available = elements.residents.querySelector("[data-residents-available]");
    if (available) available.textContent = E.Economy.getAvailableResidents(state, player.id, village.lane);
    const residentList = elements.residents.querySelector("[data-resident-list]");
    if (residentList && residentList.dataset.signature !== residentsSignature(village)) {
      renderInspector(state);
      return;
    }
    updateBuildingTable(state, player, village);
    updateTradeAndUpgrades(state, player, village);
    elements.inspector.querySelectorAll("[data-place-crop]").forEach((button) => {
      button.disabled = !E.Crops.canPlace(state, player.id, village.lane, Number(button.dataset.slotIndex), button.dataset.placeCrop);
    });
    elements.inspector.querySelectorAll("[data-place-livestock]").forEach((button) => {
      button.disabled = !E.Livestock.canPlace(state, player.id, village.lane, Number(button.dataset.slotIndex), button.dataset.placeLivestock);
    });
    elements.inspector.querySelectorAll("[data-upgrade-crop]").forEach(button => {
      button.disabled = !E.Crops.upgradeQuote(state, player.id, village.lane, Number(button.dataset.upgradeCrop))?.allowed;
    });
    elements.inspector.querySelectorAll("[data-remove-slot]").forEach(button => {
      const index = Number(button.dataset.removeSlot), slot = village.slots[index];
      button.disabled = !(slot?.content?.category === "crop" ? E.Crops : E.Livestock).removalQuote(state, player.id, village.lane, index)?.allowed;
    });
    elements.inspector.querySelectorAll("[data-slaughter], [data-slaughter-all]").forEach(button => {
      button.disabled = state.phase !== "running" || state.paused || village.destroyed;
    });
    elements.inspector.querySelectorAll("[data-herd-harassment]").forEach((label) => {
      const effect = E.Animals.harassment(state, village, Number(label.dataset.herdHarassment));
      label.textContent = effect.stacks ? `🐕 ${effect.stacks} chien(s) · reproduction −${Math.round(effect.penalty * 100)} %` : "";
    });
  }

  function residentMissionButtons(state, player, village, resident) {
    const activeMission = resident.pendingMission || resident.mission;
    const tutorialDefenseOrder = E.Network.mode === "tutorial" && E.Tutorial?.stage === "defend";
    const locked = state.phase !== "running" || (state.paused && !tutorialDefenseOrder) || village.destroyed;
    const hasAvailableResidents = E.Economy.getAvailableResidents(state, player.id, village.lane) > 0;
    const canSetNext = !locked;
    const nextButton = (mission) => `<button class="next-resident-button ${(village.nextResidentMission || "disponible") === mission ? "active" : ""}" type="button" data-next-mission="${mission}" aria-pressed="${(village.nextResidentMission || "disponible") === mission}" ${!canSetNext ? "disabled" : ""} title="Attribuer aux prochains habitants" aria-label="Attribuer aux prochains habitants">Prochains</button>`;
    const economicButtons = Object.entries(E.Config.jobs).map(([job, definition]) => {
      const allowed = E.Economy.canAssignResidentMission(state, player.id, village.lane, resident.id, job);
      const canAssignAll = hasAvailableResidents && E.Economy.canAssignJob(state, player.id, village.lane, job);
      const boosted = E.Economy.isBoosted(resident, job);
      const assigned = activeMission === job;
      return `<div class="mission-command"><button class="mission-button ${boosted ? "boosted" : ""} ${assigned ? "assigned" : ""}" type="button" aria-pressed="${assigned}" data-resident-mission="${job}" data-resident-id="${resident.id}" ${!allowed ? "disabled" : ""}>
        ${definition.icon} ${definition.label}${boosted ? " ★" : ""}${assigned ? " ✓" : ""}<small>${jobRequirementText(village, job)}${boosted ? " · Bonus métier" : " · Sans bonus métier"}</small>
      </button><div class="command-actions"><button class="assign-all-button" type="button" data-assign-all="${job}" ${!canAssignAll ? "disabled" : ""} title="Attribuer à tous les habitants disponibles" aria-label="Attribuer à tous les habitants disponibles">Tous</button>${nextButton(job)}</div></div>`;
    }).join("");
    const canAttack = !locked && (tutorialDefenseOrder || E.Economy.canAssignResidentMission(state, player.id, village.lane, resident.id, "attaque"));
    const canDefend = !locked && (tutorialDefenseOrder || E.Economy.canAssignResidentMission(state, player.id, village.lane, resident.id, "defense"));
    const canAssignAllCombat = hasAvailableResidents && !locked;
    const releaseAllowed = !locked && E.Economy.canAssignResidentMission(state, player.id, village.lane, resident.id, "disponible");
    const canReleaseAll = !locked && village.residents.some((item) => Object.hasOwn(E.Config.jobs, item.mission));
    return `<div class="mission-command"><button class="mission-button mission-release" type="button" data-release-resident="${resident.id}" ${!releaseAllowed ? "disabled" : ""}>↩ Rendre disponible<small>Rappelle au village, conserve le métier</small></button><div class="command-actions"><button class="assign-all-button remove-all-button" type="button" data-release-all ${!canReleaseAll ? "disabled" : ""} title="Retirer les tâches à tous" aria-label="Retirer les tâches à tous">Retirer tous</button>${nextButton("disponible")}</div></div>
      ${economicButtons}
      <div class="mission-command"><button class="mission-button mission-attack ${E.Economy.isBoosted(resident, "attaque") ? "boosted" : ""} ${activeMission === "attaque" ? "assigned" : ""}" type="button" aria-pressed="${activeMission === "attaque"}" data-resident-mission="attaque" data-resident-id="${resident.id}" ${!canAttack ? "disabled" : ""}>⚔ Attaquer${activeMission === "attaque" ? " ✓" : ""}<small>${E.Economy.isBoosted(resident, "attaque") ? "★ Bonus métier" : "Combat de base"} · Village : −5 PV/s</small></button><div class="command-actions"><button class="assign-all-button" type="button" data-assign-all="attaque" ${!canAssignAllCombat ? "disabled" : ""} title="Attribuer à tous les habitants disponibles" aria-label="Attribuer à tous les habitants disponibles">Tous</button>${nextButton("attaque")}</div></div>
      <div class="mission-command"><button class="mission-button mission-defense ${E.Economy.isBoosted(resident, "defense") ? "boosted" : ""} ${activeMission === "defense" ? "assigned" : ""}" type="button" aria-pressed="${activeMission === "defense"}" data-resident-mission="defense" data-resident-id="${resident.id}" ${!canDefend ? "disabled" : ""}>🛡 Défendre${activeMission === "defense" ? " ✓" : ""}<small>${E.Economy.isBoosted(resident, "defense") ? "★ Bonus métier" : "Combat de base"}</small></button><div class="command-actions"><button class="assign-all-button" type="button" data-assign-all="defense" ${!canAssignAllCombat ? "disabled" : ""} title="Attribuer à tous les habitants disponibles" aria-label="Attribuer à tous les habitants disponibles">Tous</button>${nextButton("defense")}</div></div>
      `;
  }

  function renderShop(state) {
    const selection = state.selectedVillage;
    const player = state.players[selection.playerId];
    const village = player?.villages[selection.lane];
    const sameVillage = elements.shop.dataset.selectionKey === `${selection.playerId}-${selection.lane}`;
    const openStores = new Map([...elements.shop.querySelectorAll("[data-shop-store]")].map((store) => [store.dataset.shopStore, { open: store.open, level: Number(store.dataset.level) }]));
    elements.shop.dataset.selectionKey = `${selection.playerId}-${selection.lane}`;
    if (!village) {
      elements.shop.innerHTML = '<p class="empty-copy">Sélectionnez un village.</p>';
      return;
    }
    const resident = shopResident(state, village);
    elements.shop.dataset.signature = shopSignature(state, village);
    const sales = `<section class="shop-sales" aria-label="Vendre les ressources du village"><header><h3>Vendre les ressources</h3><span>Or global <b data-shop-gold>${formatNumber(player.gold)}</b></span></header><p>Stocks du village ${village.lane + 1} · jusqu’à ${E.Config.saleBatchSize} unités par vente.</p><div class="shop-sale-list">${E.Config.resources.map((resource) => `<div class="shop-sale" data-shop-sale="${resource}"><div><strong>${resourceIcons[resource]} ${resourceLabels[resource]}</strong><small>Stock : <b data-shop-stock="${resource}">${formatNumber(village.resources[resource])}</b></small></div><span data-shop-sale-preview="${resource}"></span><button class="sell-button" type="button" data-sell="${resource}">Vendre</button></div>`).join("")}</div></section>`;
    const stores = Object.entries(E.Config.villageShops).map(([buildingType, store]) => {
      const buildingLevel = E.Transport.buildingLevel(village, buildingType);
      const tiers = Object.entries(store.tiers).map(([tier, items]) => {
        const unlocked = buildingLevel >= Number(tier);
        const itemCards = items.map((item) => {
          if (item.specialAnimal) {
            const quote = E.Animals.purchaseQuote(state, player.id, village.lane, item.specialAnimal, resident?.id);
            const effect = item.specialAnimal === "ane" ? `Pour ${resident?.name || "l’habitant sélectionné"} · +20 % déplacement, +10 % travail` : item.specialAnimal === "chien" ? "40 PV · combat, garde et perturbation des élevages" : "80 PV · 8 dégâts/s · priorité aux champs · nage à mi-vitesse";
            return `<article class="shop-item ${item.specialAnimal === "ane" && resident?.donkey ? "equipped" : ""}" data-shop-catalog-item><span class="shop-item-icon">${item.icon}</span><div><strong>${item.label}</strong><small>${effect}</small></div><button type="button" data-buy-special-animal="${item.specialAnimal}" data-resident-id="${resident?.id || ""}" ${!quote.allowed ? "disabled" : ""}>${item.specialAnimal === "ane" && resident?.donkey ? "Associé" : "Acheter"}<small>${quote.gold} or</small></button><p data-shop-reason>${quote.reason}</p></article>`;
          }
          if (item.animalType) {
            const quote = E.Livestock.purchaseQuote(state, player.id, village.lane, item.animalType);
            return `<article class="shop-item" data-shop-catalog-item><span class="shop-item-icon">${item.icon}</span><div><strong>${item.label}</strong><small>1 animal · enclos compatible au hasard</small><small data-animal-count>${animalShopCount(village, item.animalType)}</small></div><button type="button" data-buy-animal="${item.animalType}" ${!quote.allowed ? "disabled" : ""}>Acheter<small>${quote.gold} or</small></button><p data-shop-reason>${quote.reason}</p></article>`;
          }
          if (item.equipmentKind) {
            const quote = E.Equipment.quote(state, player.id, village.lane, item.equipmentKind, item.equipmentType);
            return `<article class="shop-item ${quote.equipped ? "equipped" : ""}" data-shop-catalog-item><span class="shop-item-icon">${item.icon}</span><div><strong>${item.label}</strong><small>${equipmentEffect(item.equipmentKind, item.equipmentType)}</small></div><button type="button" data-buy-equipment="${item.equipmentType}" data-equipment-kind="${item.equipmentKind}" data-equipment-scope="village" ${!quote.allowed ? "disabled" : ""}>${quote.equipped ? "Équipé" : "Équiper le village"}<small>${quote.gold} or</small></button><p data-shop-reason>${quote.reason}</p></article>`;
          }
          if (item.purchaseType) {
            const quote = E.Transport.shopQuote(state, player.id, village.lane, item.purchaseType);
            const allowed = unlocked && quote.allowed;
            const reason = unlocked ? quote.reason : `${buildingLabels[buildingType]} T${tier} requis`;
            return `<article class="shop-item shop-${item.purchaseType} ${unlocked ? "unlocked" : "locked"}" data-shop-catalog-item><span class="shop-item-icon">${item.icon}</span><div><strong>${item.label}</strong><small>${shopItemEffect(item.purchaseType, quote)}</small><small data-shop-count="${item.purchaseType}">${shopItemAmount(item.purchaseType, quote)}</small></div><button type="button" data-buy-shop-item="${item.purchaseType}" data-shop-building="${buildingType}" data-shop-tier="${tier}" ${!allowed ? "disabled" : ""}>Acheter<small>${quote.gold} or</small></button><p data-shop-reason>${reason}</p></article>`;
          }
          const status = !unlocked ? `${buildingLabels[buildingType]} T${tier} requis` : item.managedBy ? `Disponible dans « ${item.managedBy} »` : "Débloqué · mécanique à venir";
          return `<article class="shop-item catalog-only ${unlocked ? "unlocked" : "locked"}" data-shop-catalog-item><span class="shop-item-icon">${item.icon}</span><div><strong>${item.label}</strong><small>${status}</small></div><button type="button" disabled>${item.managedBy && unlocked ? item.managedBy : "À venir"}</button></article>`;
        }).join("");
        return `<section class="shop-tier ${unlocked ? "unlocked" : "locked"}" data-shop-tier="${tier}"><h4>Tier ${tier} ${unlocked ? "· débloqué" : "· verrouillé"}</h4>${itemCards}</section>`;
      }).join("");
      return `<section class="shop-store ${buildingLevel ? "unlocked" : "locked"}" data-shop-store="${buildingType}" data-level="${buildingLevel}"><header><span>${store.icon} ${store.label}</span><b>${buildingLevel ? `T${buildingLevel}` : "Bâtiment requis"}</b></header>${tiers}${buildingType === "bergerie" ? renderAnimalRoster(state, player, village) : ""}</section>`;
    }).join("");
    elements.shop.innerHTML = `<div class="shop-columns"><div class="shop-sales-column">${sales}</div>${stores}</div>`;
    updateShopSales(state, player, village);
  }

  function updateShopSales(state, player, village) {
    const locked = state.phase !== "running" || state.paused || village.destroyed;
    const gold = elements.shop.querySelector("[data-shop-gold]");
    if (gold) gold.textContent = formatNumber(player.gold);
    elements.shop.querySelectorAll("[data-shop-sale]").forEach((row) => {
      const resource = row.dataset.shopSale;
      const quote = E.Economy.saleQuote(village, resource);
      row.querySelector("[data-shop-stock]").textContent = formatNumber(village.resources[resource]);
      row.querySelector("[data-shop-sale-preview]").textContent = quote?.amount > 0
        ? `${formatNumber(quote.amount)} → ${formatNumber(quote.gold)} or` : "Stock vide";
      row.querySelector("[data-sell]").disabled = locked || !quote || quote.amount <= 0;
    });
  }

  function shopResident(state, village) {
    return village.residents.find((resident) => resident.id === state.selectedResidentId) || village.residents[0] || null;
  }

  function renderAnimalRoster(state, player, village) {
    const animals = village.animals || [];
    const donkeyCount = village.residents.filter((resident) => resident.donkey).length;
    const counts = ["chien", "sanglier"].map((type) => `${E.Config.specialAnimals[type].icon} ${animals.filter((animal) => animal.type === type).length}`).join(" · ");
    const cards = animals.map((animal) => {
      const definition = E.Config.specialAnimals[animal.type];
      const command = (mission, label, slotIndex) => {
        const quote = E.Animals.orderQuote(state, player.id, village.lane, animal.id, mission, slotIndex);
        return `<button type="button" data-order-animal="${mission}" data-animal-id="${animal.id}" ${slotIndex === undefined ? "" : `data-slot-index="${slotIndex}"`} ${!quote.allowed ? "disabled" : ""} title="${quote.reason}">${label}</button>`;
      };
      const guards = animal.type === "chien" ? village.slots.map((slot, index) => slot.content?.category === "livestock" ? command("garde", `Garder enclos ${index + 1}`, index) : "").join("") : "";
      const status = { disponible: "Au village", attaque: "En attaque", defense: "Garde la frontière", garde: "Garde un enclos", perturber: "Perturbe les élevages ennemis" }[animal.mission] || animal.mission;
      return `<article class="companion-card" data-companion-card="${animal.id}"><header>${animalAppearance(animal.type, "resident-avatar")}<div><strong>${definition.label} ${String(animal.id).split("-").at(-1)}</strong><small>${status} · <b data-companion-hp="${animal.id}">${definition.hp}</b> PV</small></div></header><div class="companion-orders">${command("attaque", "Attaquer")}${animal.type === "chien" ? command("defense", "Frontière") + command("perturber", "Perturber") + guards : `<button type="button" class="slaughter-button" data-slaughter-special="${animal.id}" ${animal.unitId || state.paused || state.phase !== "running" || village.destroyed ? "disabled" : ""}>Abattre · +${definition.meatAtDeath} viande</button>`}</div></article>`;
    }).join("");
    return `<section class="companion-roster"><h4>Compagnons du village</h4><p class="section-help">${counts} · 🫏 ${donkeyCount} associé(s)</p>${cards || '<p class="section-help">Achetez un chien ou un sanglier pour lui donner une mission ici.</p>'}<p class="section-help">Les compagnons ne consomment ni population ni emplacement d’élevage. Un âne accompagne son habitant et meurt avec lui. Un animal engagé ne peut pas être abattu.</p></section>`;
  }

  function updateAnimalOrders(state, player, village) {
    elements.shop.querySelectorAll("[data-order-animal]").forEach((button) => {
      const slotIndex = button.dataset.slotIndex === undefined ? undefined : Number(button.dataset.slotIndex);
      const quote = E.Animals.orderQuote(state, player.id, village.lane, button.dataset.animalId, button.dataset.orderAnimal, slotIndex);
      button.disabled = !quote.allowed;
      button.title = quote.reason;
    });
    elements.shop.querySelectorAll("[data-companion-hp]").forEach((label) => {
      const animal = (village.animals || []).find((entry) => entry.id === label.dataset.companionHp);
      const unit = animal && state.units.find((entry) => entry.id === animal.unitId);
      if (animal) label.textContent = Math.ceil(unit ? unit.hp : E.Config.specialAnimals[animal.type].hp);
    });
    elements.shop.querySelectorAll("[data-slaughter-special]").forEach((button) => {
      const animal = (village.animals || []).find((entry) => entry.id === button.dataset.slaughterSpecial);
      button.disabled = !animal || Boolean(animal.unitId) || state.paused || state.phase !== "running" || village.destroyed;
    });
  }

  function shopSignature(state, village) {
    const resident = shopResident(state, village);
    return `${village.equipment?.tool}:${village.equipment?.armor}:${village.residents.length}:${village.destroyed}:${village.buildings.map((building) => `${building.type}:${building.level}`).join(",")}:${resident?.id}:${resident?.profession}:${resident?.tool}:${resident?.armor}:${resident?.donkey}:${herdSignature(village)}:${(village.animals || []).map((animal) => `${animal.id}:${animal.mission}:${animal.unitId}`).join(",")}`;
  }

  function animalShopCount(village, type) {
    const count = village.slots.reduce((total, slot) => total + (slot.content?.category === "livestock" && slot.content.type === type ? slot.content.count : 0), 0);
    return `${count} dans ce village`;
  }

  function equipmentEffect(kind, type) {
    const definition = E.Config.equipment[kind][type];
    if (kind === "armors") return `+${definition.hp} PV`;
    return `+${definition.damage} dégâts · +${definition.productionBonus * 100} % ${type === "bois" ? "vitesse de production" : "production"}`;
  }

  function shopItemAmount(type, quote) {
    return type === "filet" ? `${quote.count} installé${quote.count > 1 ? "s" : ""}` : `${quote.count}/${quote.max} · ${quote.capacity} places chacun`;
  }


  function shopItemEffect(type, quote) {
    if (type === "filet") return `+${quote.fishAmount} poisson toutes les ${quote.interval} s par filet`;
    return type === "barque" ? "Réserve du village · embarquement automatique" : "Transport maritime lourd · côté gauche";
  }

  function updateShopState(state) {
    const selection = state.selectedVillage;
    const player = state.players[selection.playerId];
    const village = player?.villages[selection.lane];
    if (!village) return;
    if (elements.shop.dataset.selectionKey !== `${selection.playerId}-${selection.lane}` || elements.shop.dataset.signature !== shopSignature(state, village)) {
      renderShop(state);
      return;
    }
    updateShopSales(state, player, village);
    elements.shop.querySelectorAll("[data-buy-shop-item]").forEach((button) => {
      const type = button.dataset.buyShopItem;
      const quote = E.Transport.shopQuote(state, player.id, village.lane, type);
      const unlocked = E.Transport.buildingLevel(village, button.dataset.shopBuilding) >= Number(button.dataset.shopTier);
      const card = button.closest("[data-shop-catalog-item]");
      const reason = card.querySelector("[data-shop-reason]");
      button.disabled = !unlocked || !quote.allowed;
      if (reason) reason.textContent = unlocked ? quote.reason : `${buildingLabels[button.dataset.shopBuilding]} T${button.dataset.shopTier} requis`;
      const count = card.querySelector(`[data-shop-count="${type}"]`);
      if (count) count.textContent = shopItemAmount(type, quote);
    });
    elements.shop.querySelectorAll("[data-buy-animal]").forEach((button) => {
      const quote = E.Livestock.purchaseQuote(state, player.id, village.lane, button.dataset.buyAnimal);
      const card = button.closest("[data-shop-catalog-item]");
      button.disabled = !quote.allowed;
      card.querySelector("[data-shop-reason]").textContent = quote.reason;
      card.querySelector("[data-animal-count]").textContent = animalShopCount(village, button.dataset.buyAnimal);
    });
    elements.shop.querySelectorAll("[data-buy-equipment]").forEach((button) => {
      const quote = E.Equipment.quote(state, player.id, village.lane, button.dataset.equipmentKind, button.dataset.buyEquipment);
      button.disabled = !quote.allowed;
      button.closest("[data-shop-catalog-item]").querySelector("[data-shop-reason]").textContent = quote.reason;
    });
    elements.shop.querySelectorAll("[data-buy-special-animal]").forEach((button) => {
      const quote = E.Animals.purchaseQuote(state, player.id, village.lane, button.dataset.buySpecialAnimal, button.dataset.residentId);
      button.disabled = !quote.allowed;
      button.closest("[data-shop-catalog-item]").querySelector("[data-shop-reason]").textContent = quote.reason;
    });
    updateAnimalOrders(state, player, village);
  }

  function residentTaskLabel(resident) {
    return resident.pendingMission ? `Retour → ${residentMissionLabel(resident.pendingMission)}` : residentMissionLabel(resident.mission);
  }

  function residentMissionLabel(mission) {
    if (mission === "disponible") return "Disponible au village";
    if (mission === "attaque") return "En attaque";
    if (mission === "defense") return "En défense";
    const job = E.Config.jobs[mission];
    return job ? job.label : mission;
  }

  function residentsSignature(village) {
    return village.residents.map((resident) => `${resident.id}:${resident.profession}:${resident.mission}:${resident.pendingMission || ""}:${resident.unitId || 0}:${resident.tool || ""}:${resident.armor || ""}:${resident.donkey || false}`).join("|");
  }

  function herdSignature(village) {
    return village.slots.map((slot) => slot.content ? `${slot.content.category}:${slot.content.type}:${slot.content.count || 0}:${slot.content.level || 1}:${slot.content.investedGold || 0}` : "-").join("|");
  }

  function farmerPhaseLabel(resident) {
    if (resident.mission === "chasse") return "chasse dans la région";
    if (resident.workPhase === "toField") return resident.mission === "elevage" ? "se rend à l’élevage" : "se rend au champ";
    if (resident.workPhase === "harvesting") return resident.mission === "elevage" ? "trait les animaux" : "récolte";
    if (resident.workPhase === "toVillage") return "rapporte sa récolte";
    if (resident.workPhase === "villageStop") return "dépose et fait une pause au village";
    return resident.mission === "elevage" ? "surveille le troupeau, attend des animaux laitiers" : "attend une culture";
  }

  function setText(selector, value) {
    const target = elements.inspector.querySelector(selector);
    if (target && target.textContent !== String(value)) target.textContent = value;
  }

  function jobRequirementText(village, job) {
    const definition = E.Config.jobs[job];
    if (job === "agriculture" && !village.slots.some((slot) => slot.content && slot.content.category === "crop")) return "Culture requise";
    if (job === "elevage" && !village.slots.some((slot) => slot.content && slot.content.category === "livestock")) return "Élevage requis";
    if (job === "peche" && village.biome !== "littoral") return "Littoral ou rivière requis";
    return definition.label;
  }

  function nextPopulationText(state, player, village) {
    if (village.destroyed) return "—";
    if (village.population >= village.populationMax) return "Maximum";
    const living = player.villages.filter((item) => !item.destroyed).length;
    const interval = E.Config.population.generationByLivingVillages[living];
    return `${Math.ceil(interval - village.populationTimer)} s`;
  }

  function renderRedirect(state, force) {
    const request = state.pendingRedirects[0];
    const signature = request ? `${request.key}:${request.candidates.join(",")}` : "none";
    if (!force && signature === redirectSignature) return;
    redirectSignature = signature;
    elements.redirectDialog.hidden = !request || state.phase === "ended";
    if (!request) return;
    const player = state.players[request.playerId];
    elements.redirectCopy.textContent = `${player.name} : le village opposé à la ligne ${request.fromLane + 1} est détruit. Quelle route les troupes doivent-elles emprunter ?`;
    elements.redirectActions.innerHTML = request.candidates.map((lane) => `<button class="button ${request.playerId === "red" ? "button-red" : "button-blue"}" type="button" data-redirect-key="${request.key}" data-redirect-lane="${lane}">Vers la ligne ${lane + 1}</button>`).join("");
  }

  function renderResult(state) {
    elements.resultDialog.hidden = state.phase !== "ended";
    if (state.phase !== "ended") return;
    if (state.result === "draw") {
      elements.resultTitle.textContent = "Égalité";
      elements.resultCopy.textContent = "Les deux derniers villages sont tombés simultanément.";
    } else {
      const winner = state.players[state.result];
      elements.resultTitle.textContent = `${winner.name} l’emporte`;
      elements.resultCopy.textContent = "Les quatre villages adverses ont été détruits.";
    }
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function formatNumber(value) {
    return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  }

  E.UI = { init, render, renderFrame };
}());
