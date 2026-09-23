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
      const deckButton = event.target.closest("[data-setup-deck]");
      if (deckButton) controller.selectDeck(deckButton.dataset.player, Number(deckButton.dataset.setupDeck));
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
    elements.pause.addEventListener("click", () => controller.togglePause());
    document.querySelector("#toggle-board-view").addEventListener("click", () => E.Board3D?.toggle());
    elements.villageSelector.addEventListener("click", (event) => {
      const village = event.target.closest("[data-village-select]");
      if (village) controller.selectVillage(village.dataset.player, Number(village.dataset.lane));
    });
    [elements.inspector, elements.residents, elements.shop].forEach((panel) => panel.addEventListener("click", (event) => {
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
        selectedSlot = null;
        controller.placeCrop(crop.dataset.placeCrop, Number(crop.dataset.slotIndex));
      }
      const livestock = event.target.closest("[data-place-livestock]");
      if (livestock) {
        selectedSlot = null;
        controller.placeLivestock(livestock.dataset.placeLivestock, Number(livestock.dataset.slotIndex));
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
      if (equipment) controller.buyEquipment(equipment.dataset.residentId, equipment.dataset.equipmentKind, equipment.dataset.buyEquipment);
      const specialAnimal = event.target.closest("[data-buy-special-animal]");
      if (specialAnimal) controller.buySpecialAnimal(specialAnimal.dataset.buySpecialAnimal, specialAnimal.dataset.residentId);
      const animalOrder = event.target.closest("[data-order-animal]");
      if (animalOrder) controller.orderAnimal(animalOrder.dataset.animalId, animalOrder.dataset.orderAnimal, animalOrder.dataset.slotIndex === undefined ? undefined : Number(animalOrder.dataset.slotIndex));
      const specialSlaughter = event.target.closest("[data-slaughter-special]");
      if (specialSlaughter) controller.slaughterSpecialAnimal(specialSlaughter.dataset.slaughterSpecial);
    }));
    elements.residents.addEventListener("change", (event) => {
      if (event.target.matches("[data-upgrade-resource]")) upgradeResource = event.target.value;
      if (event.target.matches("[data-purchase-resource]")) purchaseResource = event.target.value;
    });
    elements.shop.addEventListener("change", (event) => {
      if (event.target.matches("[data-shop-resident]")) controller.selectResident(event.target.value);
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
          <span class="status-pill">${player.setupConfirmed ? `Deck ${player.selectedDeck + 1} · confirmé` : `Deck ${player.selectedDeck + 1} · ${player.setupSelection.length}/2 biomes`}</span>
        </div>
        <section class="setup-decks" aria-label="Choix du deck de ${player.name}">
          <h4>Deck pour cette partie</h4>
          <div>${[0, 1, 2].map((deckIndex) => `<button type="button" class="setup-deck-choice ${player.selectedDeck === deckIndex ? "selected" : ""}" data-setup-deck="${deckIndex}" data-player="${player.id}" aria-pressed="${player.selectedDeck === deckIndex}" ${player.setupConfirmed || (E.Network.mode === "tutorial" && (player.id !== "red" || deckIndex !== 1)) ? "disabled" : ""}>${E.Network.mode === "tutorial" ? E.Tutorial.deckLabels[deckIndex] : `Deck ${deckIndex + 1}`}<small>${player.selectedDeck === deckIndex ? "Sélectionné ✓" : "Choisir"}</small></button>`).join("")}</div>
        </section>
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
    renderUnits(state);
    renderInspector(state);
    renderShop(state);
    syncShopModal(state);
    const readonly = E.Network.mode === "solo" && state.selectedVillage.playerId === "blue";
    [elements.inspector, elements.residents, elements.shop].forEach((panel) => panel.classList.toggle("opponent-readonly", readonly));
    renderRedirect(state, true);
    renderResult(state);
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
    if (elements.shopVillageNav.dataset.player !== playerId) {
      elements.shopVillageNav.dataset.player = playerId;
      elements.shopVillageNav.innerHTML = [0, 1, 2, 3].map((lane) => `<button class="button button-quiet" data-player="${playerId}" data-shop-village="${lane}" type="button">Village ${lane + 1}</button>`).join("");
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
    } else {
    const overtime = state.elapsed >= E.Config.normalDuration;
    const shownTime = overtime ? state.elapsed - E.Config.normalDuration : E.Config.normalDuration - state.elapsed;
    elements.clock.textContent = `${overtime ? "+" : ""}${formatTime(shownTime)}`;
    elements.phase.textContent = overtime ? "Overtime" : "Temps normal";
    }
    elements.pause.textContent = state.paused ? "Reprendre" : "Pause";
  }

  function renderVillageSelector(state) {
    elements.villageSelector.innerHTML = ["red", "blue"].map((playerId) => {
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

  function renderMapVillagePopups(state) {
    elements.mapVillagePopups.innerHTML = ["red", "blue"].flatMap((playerId) => {
      const player = state.players[playerId];
      return player.villages.map((village) => {
        const selected = state.selectedVillage.playerId === playerId && state.selectedVillage.lane === village.lane;
        const available = E.Economy.getAvailableResidents(state, playerId, village.lane);
        const resources = E.Config.resources.map((resource) => `<div title="${resourceLabels[resource]}"><dt>${resourceIcons[resource]}</dt><dd data-map-resource="${resource}">${formatNumber(village.resources[resource])}</dd></div>`).join("");
        return `<article class="map-village-popup ${playerId} lane-${village.lane} ${selected ? "selected" : ""} ${village.damageSmoke > 0 ? "under-attack" : ""} ${village.destroyed ? "destroyed" : ""}" data-map-village data-player="${playerId}" data-lane="${village.lane}" aria-current="${selected}">
          <header><strong>${playerId === "red" ? "Rouge" : "Bleu"} V${village.lane + 1}</strong><span>${biomeIcons[village.biome]}</span></header>
          <div class="map-village-stats"><span title="Points de vie">PV <b data-map-hp>${Math.ceil(village.hp)}/${village.maxHp}</b></span><span title="Population">Pop. <b data-map-population>${village.population}/${village.populationMax}</b></span><span title="Habitants disponibles">Dispo. <b data-map-available>${available}</b></span></div>
          <dl>${resources}</dl>
        </article>`;
      });
    }).join("");
  }

  function updateMapVillagePopups(state) {
    Object.values(state.players).forEach((player) => player.villages.forEach((village) => {
      const popup = elements.mapVillagePopups.querySelector(`[data-map-village][data-player="${player.id}"][data-lane="${village.lane}"]`);
      if (!popup) {
        renderMapVillagePopups(state);
        return;
      }
      const selected = state.selectedVillage.playerId === player.id && state.selectedVillage.lane === village.lane;
      popup.classList.toggle("selected", selected);
      popup.classList.toggle("under-attack", village.damageSmoke > 0);
      popup.classList.toggle("destroyed", village.destroyed);
      popup.setAttribute("aria-current", String(selected));
      const hp = popup.querySelector("[data-map-hp]");
      const population = popup.querySelector("[data-map-population]");
      const available = popup.querySelector("[data-map-available]");
      if (hp) hp.textContent = `${Math.ceil(village.hp)}/${village.maxHp}`;
      if (population) population.textContent = `${village.population}/${village.populationMax}`;
      if (available) available.textContent = E.Economy.getAvailableResidents(state, player.id, village.lane);
      E.Config.resources.forEach((resource) => {
        const value = popup.querySelector(`[data-map-resource="${resource}"]`);
        if (value) value.textContent = formatNumber(village.resources[resource]);
      });
    }));
  }

  function renderBoard(state) {
    elements.columns.dataset.signature = terrainSignature(state);
    elements.columns.innerHTML = [0, 1, 2, 3].map((lane) => {
      const redVillage = state.players.red.villages[lane];
      const blueVillage = state.players.blue.villages[lane];
      return `<article class="lane">
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
    const slots = village.slots.map((slot, index) => {
      const crop = slot.content && slot.content.category === "crop" ? E.Crops.get(slot.content.type) : null;
      const herd = slot.content && slot.content.category === "livestock" ? E.Livestock.get(slot.content.type) : null;
      let title = slot.type === "animal" ? "Réservé aux animaux" : "Emplacement libre";
      let content = `<span class="slot-number">${index + 1}</span>`;
      let contentClass = "";
      if (crop) {
        title = `${crop.label} · ${Math.ceil(slot.content.hp)}/${slot.content.maxHp} PV`;
        content = `<span class="content-icon">${crop.icon}</span><span class="content-name">${crop.shortLabel}</span><span class="content-detail"><b data-crop-yield>${E.Economy.cropCount(village, slot.content.type)}</b> / retour · <span data-crop-hp>${Math.ceil(slot.content.hp)}</span> PV</span>`;
        contentClass = `occupied crop crop-${slot.content.type}`;
      } else if (herd) {
        title = `${herd.label} · ${slot.content.count} animaux · ${Math.ceil(slot.content.hp)} PV`;
        content = `<span class="content-icon">${herd.icon}</span><span class="content-name">${herd.shortLabel}</span><span class="content-detail"><b data-herd-count>${slot.content.count}</b> animaux · <span data-herd-hp>${Math.ceil(slot.content.hp)}</span> PV</span>`;
        contentClass = `occupied livestock livestock-${slot.content.type}`;
      }
      return `<div class="slot ${slot.type} ${contentClass}" data-slot-visual data-player="${playerId}" data-lane="${village.lane}" data-slot-index="${index}" title="${title}">${content}</div>`;
    }).join("");
    const terrainBuildings = [
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
    return `<div class="region ${village.biome} ${playerId}">
      <div class="region-name"><span>${E.Biomes.labels[village.biome]}</span><span data-region-population>${village.population}/${village.populationMax} hab.</span></div>
      <div class="terrain-building-layer ${village.destroyed ? "destroyed" : ""} ${village.damageSmoke > 0 ? "under-attack" : ""}" aria-label="Village et bâtiments visibles sur le terrain">${terrainBuildings}</div>
      ${maritimeLayer}
      <div class="slot-grid">${slots}</div>
    </div>`;
  }

  function renderUnits(state) {
    const combatUnits = state.units.map((unit) => {
      const stats = E.Config.units[unit.role];
      const left = ((unit.lanePosition + 0.5) / 4) * 100;
      const top = Math.max(1.2, Math.min(98.8, unit.position));
      const vessel = unit.waterTransport ? `<span class="unit-vessel" title="Transporté par ${E.Config.maritime.shop[unit.waterTransport].label.toLowerCase()}">${E.Config.maritime.shop[unit.waterTransport].icon}</span>` : "";
      const selected = unit.residentId === state.selectedResidentId && unit.ownerId === state.selectedVillage.playerId && unit.originLane === state.selectedVillage.lane;
      return `<div class="unit ${unit.ownerId} role-${unit.role} ${selected ? "selected-resident" : ""} ${unit.waitingForRedirect ? "waiting" : ""} ${unit.waterTransport ? `on-water transport-${unit.waterTransport}` : ""}" style="left:${left}%;top:${top}%" title="${stats.label} · ${Math.ceil(unit.hp)} PV${unit.waterTransport ? ` · ${E.Config.maritime.shop[unit.waterTransport].label}` : ""}">
        ${unit.animalType ? animalAppearance(unit.animalType, "unit-body") : residentAppearance(unit, "unit-body")}
        ${vessel}
        <span class="hp-track"><i style="width:${Math.max(0, unit.hp / unit.maxHp) * 100}%"></i></span>
      </div>`;
    }).join("");
    const workers = Object.values(state.players).flatMap((player) => player.villages.flatMap((village) =>
      village.residents
        .filter((resident) => ["agriculture", "elevage", "chasse"].includes(resident.mission) && resident.workPosition !== null)
        .map((resident) => {
          const laneOffset = resident.mission === "chasse" ? 0.5 + (resident.workLaneOffset || 0) : resident.mission === "elevage" ? 0.62 : 0.45;
          const left = ((village.lane + laneOffset) / 4) * 100;
          const top = Math.max(1.2, Math.min(98.8, resident.workPosition));
          const carrying = resident.carrying ? " carrying" : "";
          const selected = resident.id === state.selectedResidentId && player.id === state.selectedVillage.playerId && village.lane === state.selectedVillage.lane;
          return `<div class="unit worker ${player.id}${carrying} ${selected ? "selected-resident" : ""}" data-worker-mission="${resident.mission}" style="left:${left}%;top:${top}%" title="${resident.name} · ${farmerPhaseLabel(resident)}${resident.carrying ? ` · ${formatNumber(resident.carrying.amount)} ${resourceLabels[resident.carrying.resource]}` : ""}">
            ${residentAppearance(resident, "unit-body")}
          </div>`;
        })
    )).join("");
    const locals = Object.values(state.players).flatMap((player) => player.villages.flatMap((village) =>
      village.destroyed ? [] : (() => {
        const visible = village.residents.filter((resident) => !resident.unitId && !["attaque", "defense"].includes(resident.mission)
          && !(["agriculture", "elevage", "chasse"].includes(resident.mission) && resident.workPosition !== null));
        let fisherIndex = 0;
        return visible.map((resident, index) => {
          const fishing = resident.mission === "peche";
          const narrow = window.innerWidth < 720;
          const fisherColumns = narrow ? 4 : 7;
          const fishingSlot = fishing ? fisherIndex++ : 0;
          const left = fishing
            ? ((village.lane + (fishingSlot % fisherColumns + 0.5) / fisherColumns) / 4) * 100
            : ((village.lane + 0.2 + (index % 4) * 0.18) / 4) * 100;
          const distance = fishing ? 23 + Math.floor(fishingSlot / fisherColumns) * (narrow ? 1.9 : 3) : 8 + Math.floor(index / 4) * 2;
          const top = player.id === "red" ? distance : 100 - distance;
          const selected = resident.id === state.selectedResidentId && player.id === state.selectedVillage.playerId && village.lane === state.selectedVillage.lane;
          return `<div class="local-person ${player.id} ${fishing ? "fishing" : ""} ${selected ? "selected-resident" : ""}" data-local-resident="${resident.id}" style="left:${left}%;top:${top}%" title="${resident.name} · ${E.Config.professions[resident.profession || "habitant"].label}">${residentAppearance(resident, "unit-body")}</div>`;
        });
      })()
    )).join("");
    const localAnimals = Object.values(state.players).flatMap((player) => player.villages.flatMap((village) =>
      village.destroyed ? [] : (village.animals || []).filter((animal) => !animal.unitId).map((animal, index) => {
        const left = ((village.lane + 0.22 + (index % 4) * 0.17) / 4) * 100;
        const distance = 18 + Math.floor(index / 4) * 2;
        return `<div class="local-person ${player.id}" data-local-animal="${animal.id}" style="left:${left}%;top:${player.id === "red" ? distance : 100 - distance}%" title="${E.Config.specialAnimals[animal.type].label}">${animalAppearance(animal.type, "unit-body")}</div>`;
      })
    )).join("");
    elements.units.innerHTML = combatUnits + workers + locals + localAnimals;
  }

  function terrainSignature(state) {
    return Object.values(state.players).flatMap((player) => player.villages.map((village) => `${village.id}:${village.destroyed}:${village.level}:${village.buildings.map((building) => `${building.type}:${building.level}`).join(",")}:${village.slots.map((slot) => slot.content ? `${slot.content.category}:${slot.content.type}` : "-").join(",")}`)).join("|");
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

  function renderSlotPicker(state, player, village) {
    const activeIndex = selectedSlot?.playerId === player.id && selectedSlot.lane === village.lane
      ? selectedSlot.index : null;
    const buttons = Array.from({ length: 4 }, (_, index) => {
      const slot = village.slots[index];
      const content = slot?.content;
      const definition = content && (E.Config.crops[content.type] || E.Config.livestock[content.type]);
      const status = !slot ? "Indisponible" : content?.category === "livestock"
        ? `${definition.icon} ×${content.count}` : definition?.shortLabel || (slot.type === "animal" ? "Élevage libre" : "Libre");
      return `<button type="button" class="placement-slot ${activeIndex === index ? "selected" : ""}" data-select-slot="${index}" aria-expanded="${activeIndex === index}" aria-controls="slot-options" ${!slot ? "disabled" : ""}><strong>Slot ${index + 1}</strong><small>${status}</small></button>`;
    }).join("");
    const slot = activeIndex === null ? null : village.slots[activeIndex];
    let choices = "";
    if (slot?.content?.category === "livestock") {
      const animal = E.Livestock.get(slot.content.type);
      choices = `<div class="enclosure-control slaughter-card" data-meat="${animal.meatAtDeath}"><strong>${animal.icon} ${animal.shortLabel} · ${slot.content.count}</strong><small class="harassment-warning" data-herd-harassment="${activeIndex}"></small><label><span>À abattre</span><input type="number" min="1" max="${slot.content.count}" value="1" data-slaughter-quantity></label><button type="button" class="slaughter-button" data-slaughter="${activeIndex}" ${state.phase !== "running" || state.paused || village.destroyed ? "disabled" : ""}>Abattre <span data-slaughter-preview>+${animal.meatAtDeath} viande</span></button></div>`;
    } else if (slot) {
      const crops = slot.type === "free" ? Object.entries(E.Config.crops)
        .filter(([type]) => E.Crops.isAllowedInBiome(type, village.biome))
        .map(([type, crop]) => `<button type="button" class="placement-option" data-place-crop="${type}" data-slot-index="${activeIndex}" ${!E.Crops.canPlace(state, player.id, village.lane, activeIndex, type) ? "disabled" : ""}>${crop.icon} ${crop.shortLabel}</button>`) : [];
      const livestock = !slot.content ? Object.entries(E.Config.livestock)
        .map(([type, animal]) => `<button type="button" class="placement-option" data-place-livestock="${type}" data-slot-index="${activeIndex}" ${!E.Livestock.canPlace(state, player.id, village.lane, activeIndex, type) ? "disabled" : ""}>${animal.icon} ${animal.shortLabel}</button>`) : [];
      choices = `<div class="placement-options">${[...crops, ...livestock].join("")}</div>`;
    }
    return `<section class="inspector-section slot-section" aria-label="Emplacements du village"><div class="placement-slots">${buttons}</div><div id="slot-options" class="slot-options" ${!slot ? "hidden" : ""}>${slot ? `<strong>Slot ${activeIndex + 1} · ${E.Biomes.labels[village.biome]}</strong>${choices}` : ""}</div></section>`;
  }

  function renderInspector(state) {
    const selection = state.selectedVillage;
    const player = state.players[selection.playerId];
    const village = player && player.villages[selection.lane];
    const sameVillage = elements.residents.dataset.selectionKey === `${selection.playerId}-${selection.lane}`;
    const previousDetails = elements.residents.querySelector("details");
    const expanded = !sameVillage || !previousDetails || previousDetails.open;
    const residentScroll = sameVillage ? elements.residents.querySelector("[data-resident-list]")?.scrollTop || 0 : 0;
    const managementScroll = sameVillage ? elements.residents.querySelector(".residents-content")?.scrollTop || 0 : 0;
    const inspectorScroll = sameVillage ? elements.inspector.scrollTop : 0;
    elements.residents.dataset.selectionKey = `${selection.playerId}-${selection.lane}`;
    elements.residents.className = `panel-card residents-panel ${selection.playerId} lane-${selection.lane}`;
    elements.residents.hidden = false;
    if (!village) {
      elements.inspector.innerHTML = `<p class="empty-copy">Sélectionnez un village.</p>`;
      elements.residents.innerHTML = "";
      return;
    }
    elements.inspector.dataset.herdSignature = herdSignature(village);
    const resources = E.Config.resources.map((key) => `<div class="resource-row"><dt>${resourceLabels[key]}</dt><dd data-resource="${key}">${formatNumber(village.resources[key])}</dd></div>`).join("");
    const noSlot = village.buildings.length >= E.Config.building.slots;
    const cannotBuy = player.gold < E.Config.building.T1.gold || noSlot || village.destroyed || state.phase !== "running" || state.paused;
    const availableResidents = E.Economy.getAvailableResidents(state, player.id, village.lane);
    const slots = renderSlotPicker(state, player, village);
    const selectedResident = village.residents.find((resident) => resident.id === state.selectedResidentId) || village.residents[0] || null;
    const residentSignature = residentsSignature(village);
    const residentCards = village.residents.map((resident) => {
      const selected = selectedResident && selectedResident.id === resident.id;
      return `<button class="resident-card ${selected ? "selected" : ""}" type="button"
        data-select-resident="${resident.id}" data-resident-state="${resident.mission}" aria-pressed="${selected}">
        ${residentAppearance(resident, "resident-avatar")}
        <span><strong>${resident.name}</strong><small>${E.Config.professions[resident.profession || "habitant"].label}</small><small>${residentMissionLabel(resident.mission)}${E.Economy.isBoosted(resident, resident.mission) ? " · ★ Boost" : ""}</small><small>${equipmentLabel(resident)}</small></span>
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
      return `<div class="profession-command"><button type="button" class="profession-button ${active ? "selected" : ""}" data-profession="${key}" data-resident-id="${selectedResident.id}" aria-pressed="${active}" ${!allowed ? "disabled" : ""}>${definition.icon} ${definition.label}${active ? " · Équipé" : ""}<small>${requirement}</small></button><div class="command-actions"><button type="button" class="profession-all-button ${key === "habitant" ? "remove-all-button" : ""}" data-profession-all="${key}" ${!canAssignAll ? "disabled" : ""}>${key === "habitant" ? "Retirer les métiers à tous" : "Attribuer à tous"}</button><button type="button" class="next-resident-button ${next ? "active" : ""}" data-next-profession="${key}" aria-pressed="${next}" ${!canSetNext ? "disabled" : ""}>Attribuer aux prochain</button></div></div>`;
    }).join("") : '<p class="section-help">Aucun habitant sélectionné.</p>';
    const buildings = village.buildings.map((building, index) => `<div class="management-card building-card building-${building.type}"><strong>${buildingLabels[building.type]} T${building.level}</strong><small>+${building.hpBonus} PV</small>${upgradeButton(state, player, village, index)}</div>`).join("");

    elements.inspector.innerHTML = `
    ${!(E.Network.mode === "solo" && player.id === "blue") ? `<section class="inspector-section">
      <h3>Banque locale</h3>
      <p class="section-help">Ressources disponibles dans ce village.</p>
      <dl class="resource-list">${resources}</dl>
    </section>` : ""}
    ${slots}`;

    elements.residents.innerHTML = `<details ${expanded ? "open" : ""}>
      <summary><strong>Gestion · Village ${village.lane + 1} · ${player.id === "red" ? "Rouge" : "Bleu"}</strong><span><b data-residents-available>${availableResidents}</b> disponibles · ${selectedResident ? selectedResident.name : "Aucun habitant"} sélectionné · cliquer pour replier</span></summary>
      <div class="residents-content management-columns">
      <section class="management-column"><h3>1 · Habitants</h3>
      <p class="section-help">Population de ce village ; les habitants en mission restent identifiés.</p>
      <div class="resident-list" data-resident-list data-signature="${residentSignature}">${residentCards || '<p class="empty-residents">Aucun habitant vivant.</p>'}</div>
      </section>
      <section class="management-column"><h3>2 · Tâches</h3>
        <p class="section-help">Bleu ★ : bonus du métier. Jaune ✓ : tâche active ou métier équipé. Libère une tâche avant d’en changer.</p>
        <p class="selected-resident">${selectedResident ? `${selectedResident.name} · ${residentMissionLabel(selectedResident.mission)}` : "Aucun habitant"}</p>
        <div class="mission-grid">${missionButtons}</div>
      </section>
      <section class="management-column"><h3>3 · Métiers</h3><p class="section-help">« Attribuer à tous » ne concerne que les habitants sans métier. Le retrait groupé ignore les attaquants et défenseurs engagés.</p><div class="profession-list">${professionButtons}</div></section>
      <section class="management-column management-village"><h3>4 · Village</h3>
        <div class="village-overview">
          <div class="resident-purchase"><strong>Nouvel habitant</strong><small>50 or + 50 ressources au choix</small><label>Ressource<select data-purchase-resource>${E.Config.resources.map((key) => `<option value="${key}" ${key === purchaseResource ? "selected" : ""}>${resourceLabels[key]}</option>`).join("")}</select></label><button type="button" class="button buy-resident-button" data-buy-resident>Acheter un habitant</button></div>
          <div class="management-card building-card building-village"><strong>Village T${village.level}</strong><small>${village.populationMax} habitants maximum</small><small>Riposte : ${E.Config.combat.villageRetaliationDamagePerSecond} dégâts/s par assaillant</small>${upgradeButton(state, player, village, "village")}</div>
        </div>
        <label class="upgrade-resource">Ressource pour améliorer<select data-upgrade-resource>${E.Config.resources.map((key) => `<option value="${key}" ${key === upgradeResource ? "selected" : ""}>${resourceLabels[key]}</option>`).join("")}</select></label>
        <div class="built-buildings">${buildings}</div>
        <p class="section-help">${village.buildings.length}/${E.Config.building.slots} bâtiments</p>
        <div class="construction-list">${E.Config.building.types.map((type) => `<button class="button" type="button" data-build="${type}" ${cannotBuy ? "disabled" : ""}>+ ${buildingLabels[type]}<small>${E.Config.building.T1.gold} or · +75 PV</small></button>`).join("")}</div>
      </section>
      </div>
    </details>`;
    elements.residents.querySelector("[data-resident-list]").scrollTop = residentScroll;
    elements.residents.querySelector(".residents-content").scrollTop = managementScroll;
    elements.inspector.scrollTop = inspectorScroll;
    updateTradeAndUpgrades(state, player, village);
  }

  function upgradeButton(state, player, village, index) {
    const quote = E.Buildings.upgradeQuote(state, player.id, village.lane, index, upgradeResource);
    if (!quote) return '<small>Niveau maximum · T3</small>';
    return `<button type="button" class="upgrade-button" data-upgrade="${index}" ${quote.allowed ? "" : "disabled"}>Améliorer → T${quote.level}<small data-upgrade-cost></small></button>`;
  }

  function updateTradeAndUpgrades(state, player, village) {
    const locked = state.phase !== "running" || state.paused || village.destroyed;
    elements.inspector.querySelectorAll("[data-sell]").forEach((button) => {
      const quote = E.Economy.saleQuote(village, button.dataset.sell);
      button.disabled = locked || !quote || quote.amount <= 0;
      const preview = elements.inspector.querySelector(`[data-sale-preview="${button.dataset.sell}"]`);
      preview.textContent = quote.amount > 0 ? `${formatNumber(quote.amount)} → ${quote.gold.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} or` : "Stock vide";
    });
    elements.residents.querySelectorAll("[data-upgrade]").forEach((button) => {
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
            if (yieldLabel) yieldLabel.textContent = E.Economy.cropCount(village, slot.content.type);
            const hp = visual?.querySelector("[data-crop-hp]");
            if (hp) hp.textContent = Math.ceil(slot.content.hp);
            if (visual) visual.title = `${E.Crops.get(slot.content.type).label} · ${Math.ceil(slot.content.hp)}/${slot.content.maxHp} PV`;
            return;
          }
          if (!slot.content || slot.content.category !== "livestock") return;
          const slotButton = elements.columns.querySelector(`[data-slot-visual][data-player="${player.id}"][data-lane="${village.lane}"][data-slot-index="${index}"]`);
          if (!slotButton) return;
          const count = slotButton.querySelector("[data-herd-count]");
          const hp = slotButton.querySelector("[data-herd-hp]");
          if (count) count.textContent = slot.content.count;
          if (hp) hp.textContent = Math.ceil(slot.content.hp);
        });
      });
    });
  }

  function updateInspectorState(state) {
    const selection = state.selectedVillage;
    const player = state.players[selection.playerId];
    const village = player && player.villages[selection.lane];
    if (!village) return;
    if (elements.inspector.dataset.herdSignature !== herdSignature(village)) {
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

    const noBuildingSlot = village.buildings.length >= E.Config.building.slots;
    const cannotBuild = player.gold < E.Config.building.T1.gold || noBuildingSlot || village.destroyed || state.phase !== "running" || state.paused;
    const available = elements.residents.querySelector("[data-residents-available]");
    if (available) available.textContent = E.Economy.getAvailableResidents(state, player.id, village.lane);
    const residentList = elements.residents.querySelector("[data-resident-list]");
    if (residentList && residentList.dataset.signature !== residentsSignature(village)) {
      renderInspector(state);
      return;
    }
    elements.residents.querySelectorAll("[data-build]").forEach((button) => { button.disabled = cannotBuild; });
    updateTradeAndUpgrades(state, player, village);
    elements.inspector.querySelectorAll("[data-place-crop]").forEach((button) => {
      button.disabled = !E.Crops.canPlace(state, player.id, village.lane, Number(button.dataset.slotIndex), button.dataset.placeCrop);
    });
    elements.inspector.querySelectorAll("[data-place-livestock]").forEach((button) => {
      button.disabled = !E.Livestock.canPlace(state, player.id, village.lane, Number(button.dataset.slotIndex), button.dataset.placeLivestock);
    });
    elements.inspector.querySelectorAll("[data-herd-harassment]").forEach((label) => {
      const effect = E.Animals.harassment(state, village, Number(label.dataset.herdHarassment));
      label.textContent = effect.stacks ? `🐕 ${effect.stacks} chien(s) · reproduction −${Math.round(effect.penalty * 100)} %` : "";
    });
  }

  function residentMissionButtons(state, player, village, resident) {
    const available = resident.mission === "disponible" && !resident.unitId;
    const tutorialDefenseOrder = E.Network.mode === "tutorial" && E.Tutorial?.stage === "defend";
    const locked = state.phase !== "running" || (state.paused && !tutorialDefenseOrder) || village.destroyed;
    const hasAvailableResidents = E.Economy.getAvailableResidents(state, player.id, village.lane) > 0;
    const canSetNext = !locked;
    const nextButton = (mission) => `<button class="next-resident-button ${(village.nextResidentMission || "disponible") === mission ? "active" : ""}" type="button" data-next-mission="${mission}" aria-pressed="${(village.nextResidentMission || "disponible") === mission}" ${!canSetNext ? "disabled" : ""}>Attribuer aux prochain</button>`;
    const economicButtons = Object.entries(E.Config.jobs).map(([job, definition]) => {
      const allowed = available && E.Economy.canAssignResidentJob(state, player.id, village.lane, resident.id, job);
      const canAssignAll = hasAvailableResidents && E.Economy.canAssignJob(state, player.id, village.lane, job);
      const boosted = E.Economy.isBoosted(resident, job);
      const assigned = resident.mission === job;
      return `<div class="mission-command"><button class="mission-button ${boosted ? "boosted" : ""} ${assigned ? "assigned" : ""}" type="button" aria-pressed="${assigned}" data-resident-mission="${job}" data-resident-id="${resident.id}" ${!allowed ? "disabled" : ""}>
        ${definition.icon} ${definition.label}${boosted ? " ★" : ""}${assigned ? " ✓" : ""}<small>${jobRequirementText(village, job)}${boosted ? " · Bonus métier" : " · Sans bonus métier"}</small>
      </button><div class="command-actions"><button class="assign-all-button" type="button" data-assign-all="${job}" ${!canAssignAll ? "disabled" : ""}>Attribuer à tous</button>${nextButton(job)}</div></div>`;
    }).join("");
    const canFight = available && !locked;
    const canAssignAllCombat = hasAvailableResidents && !locked;
    const releaseAllowed = Object.hasOwn(E.Config.jobs, resident.mission) && !locked;
    const canReleaseAll = !locked && village.residents.some((item) => Object.hasOwn(E.Config.jobs, item.mission));
    return `<div class="mission-command"><button class="mission-button mission-release" type="button" data-release-resident="${resident.id}" ${!releaseAllowed ? "disabled" : ""}>↩ Rendre disponible<small>Arrête la tâche, conserve le métier</small></button><div class="command-actions"><button class="assign-all-button remove-all-button" type="button" data-release-all ${!canReleaseAll ? "disabled" : ""}>Retirer les tâches à tous</button>${nextButton("disponible")}</div></div>
      ${economicButtons}
      <div class="mission-command"><button class="mission-button mission-attack ${E.Economy.isBoosted(resident, "attaque") ? "boosted" : ""} ${resident.mission === "attaque" ? "assigned" : ""}" type="button" aria-pressed="${resident.mission === "attaque"}" data-resident-mission="attaque" data-resident-id="${resident.id}" ${!canFight ? "disabled" : ""}>⚔ Attaquer${resident.mission === "attaque" ? " ✓" : ""}<small>${E.Economy.isBoosted(resident, "attaque") ? "★ Bonus métier" : "Combat de base"} · Village : −5 PV/s</small></button><div class="command-actions"><button class="assign-all-button" type="button" data-assign-all="attaque" ${!canAssignAllCombat ? "disabled" : ""}>Attribuer à tous</button>${nextButton("attaque")}</div></div>
      <div class="mission-command"><button class="mission-button mission-defense ${E.Economy.isBoosted(resident, "defense") ? "boosted" : ""} ${resident.mission === "defense" ? "assigned" : ""}" type="button" aria-pressed="${resident.mission === "defense"}" data-resident-mission="defense" data-resident-id="${resident.id}" ${!canFight ? "disabled" : ""}>🛡 Défendre${resident.mission === "defense" ? " ✓" : ""}<small>${E.Economy.isBoosted(resident, "defense") ? "★ Bonus métier" : "Combat de base"}</small></button><div class="command-actions"><button class="assign-all-button" type="button" data-assign-all="defense" ${!canAssignAllCombat ? "disabled" : ""}>Attribuer à tous</button>${nextButton("defense")}</div></div>
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
    const fleet = E.Transport.maritimeState(village);
    const resident = shopResident(state, village);
    elements.shop.dataset.signature = shopSignature(state, village);
    const sales = `<section class="shop-sales" aria-label="Vendre les ressources du village"><header><h3>Vendre les ressources</h3><span>Or global <b data-shop-gold>${formatNumber(player.gold)}</b></span></header><p>Stocks du village ${village.lane + 1} · jusqu’à ${E.Config.saleBatchSize} unités par vente.</p><div class="shop-sale-list">${E.Config.resources.map((resource) => `<div class="shop-sale" data-shop-sale="${resource}"><div><strong>${resourceIcons[resource]} ${resourceLabels[resource]}</strong><small>Stock : <b data-shop-stock="${resource}">${formatNumber(village.resources[resource])}</b></small></div><span data-shop-sale-preview="${resource}"></span><button class="sell-button" type="button" data-sell="${resource}">Vendre</button></div>`).join("")}</div></section>`;
    const artisanatLevel = E.Transport.buildingLevel(village, "artisanat");
    const equipmentPreview = resident ? `<label class="shop-resident-picker">Habitant à équiper<select data-shop-resident>${village.residents.map((item) => `<option value="${item.id}" ${item.id === resident.id ? "selected" : ""}>${item.name} · ${E.Config.professions[item.profession || "habitant"].label}</option>`).join("")}</select></label><div class="equipment-preview">${residentAppearance(resident, "resident-avatar")}<div><strong>Équiper ${resident.name}</strong><small>${E.Config.professions[resident.profession || "habitant"].label}</small><small>${equipmentLabel(resident)}</small></div></div><p class="section-help">L’achat équipe immédiatement cet habitant. Un outil et une armure maximum ; remplacement sans remboursement.</p>` : '<p class="section-help">Aucun habitant à équiper.</p>';
    const equipmentTarget = `<section class="shop-equipment-target" aria-label="Habitant à équiper"><header><span>⚒ Échoppe de l’Artisanat</span><b>${artisanatLevel ? `T${artisanatLevel}` : "Bâtiment requis"}</b></header>${equipmentPreview}</section>`;
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
            const quote = E.Equipment.quote(state, player.id, village.lane, resident?.id, item.equipmentKind, item.equipmentType);
            return `<article class="shop-item ${quote.equipped ? "equipped" : ""}" data-shop-catalog-item><span class="shop-item-icon">${item.icon}</span><div><strong>${item.label}</strong><small>${equipmentEffect(item.equipmentKind, item.equipmentType)}</small></div><button type="button" data-buy-equipment="${item.equipmentType}" data-equipment-kind="${item.equipmentKind}" data-resident-id="${resident?.id || ""}" ${!quote.allowed ? "disabled" : ""}>${quote.equipped ? "Équipé" : "Équiper"}<small>${quote.gold} or</small></button><p data-shop-reason>${quote.reason}</p></article>`;
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
    elements.shop.innerHTML = `<div class="shop-columns"><div class="shop-sales-column">${sales}${equipmentTarget}</div>${stores}</div>`;
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
    return `${village.destroyed}:${village.buildings.map((building) => `${building.type}:${building.level}`).join(",")}:${resident?.id}:${resident?.profession}:${resident?.tool}:${resident?.armor}:${resident?.donkey}:${herdSignature(village)}:${(village.animals || []).map((animal) => `${animal.id}:${animal.mission}:${animal.unitId}`).join(",")}`;
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
    return type === "barque" ? "Transport maritime léger · côté droit" : "Transport maritime lourd · côté gauche";
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
    const capacity = elements.shop.querySelector("[data-shop-capacity]");
    if (capacity) capacity.textContent = `${E.Transport.fleetCapacity(village)} places`;
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
      const quote = E.Equipment.quote(state, player.id, village.lane, button.dataset.residentId, button.dataset.equipmentKind, button.dataset.buyEquipment);
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

  function residentMissionLabel(mission) {
    if (mission === "disponible") return "Disponible au village";
    if (mission === "attaque") return "En attaque";
    if (mission === "defense") return "En défense";
    const job = E.Config.jobs[mission];
    return job ? job.label : mission;
  }

  function residentIcon(mission) {
    if (mission === "disponible") return "👤";
    if (mission === "attaque") return "⚔";
    if (mission === "defense") return "🛡";
    return E.Config.jobs[mission] ? E.Config.jobs[mission].icon : "👤";
  }

  function residentsSignature(village) {
    return village.residents.map((resident) => `${resident.id}:${resident.profession}:${resident.mission}:${resident.unitId || 0}:${resident.tool || ""}:${resident.armor || ""}:${resident.donkey || false}`).join("|");
  }

  function herdSignature(village) {
    return village.slots.map((slot) => slot.content ? `${slot.content.category}:${slot.content.type}:${slot.content.count || 0}` : "-").join("|");
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
    if (target) target.textContent = value;
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
