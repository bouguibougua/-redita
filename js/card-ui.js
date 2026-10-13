(function () {
  "use strict";
  const E = window.Eredita;
  let root, controller, selectedId = null, chosenTarget = null, ownerId = null, lastSignature = null, currentState;
  const slug = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

  function targetLabel(state, playerId, target) {
    const village = state.players[playerId].villages[target.lane];
    let label = `Village ${target.lane + 1} · ${E.Biomes.labels[village.biome]}`;
    if (target.slotIndex !== undefined) label += ` · Slot ${target.slotIndex + 1}`;
    if (target.residentId) label += ` · ${village.residents.find(person => person.id === target.residentId)?.name || "Habitant"}`;
    if (target.resource) label += ` · payer en ${target.resource}`;
    if (target.residentIds) label += ` · embarquer ${target.residentIds.length} habitant(s)`;
    if (target.targetLane !== undefined) label += ` → région adverse ${target.targetLane + 1}`;
    return label;
  }

  function init(gameController) {
    controller = gameController;
    root = document.querySelector("#card-hand");
    if (!root) return;
    root.addEventListener("click", event => {
      const card = event.target.closest("[data-hand-card]");
      if (card) { selectedId = selectedId === card.dataset.handCard ? null : card.dataset.handCard; chosenTarget = null; render(currentState); }
      if (event.target.closest("[data-cancel-card]")) { selectedId = null; chosenTarget = null; render(currentState); }
      if (event.target.closest("[data-confirm-card]") && selectedId && chosenTarget) {
        if (!E.CardGame.quote(currentState, ownerId, selectedId, chosenTarget).allowed) return render(currentState);
        controller.selectVillage(ownerId, chosenTarget.lane);
        const result = controller.playCard(selectedId, chosenTarget);
        if (result || E.Network.mode === "guest") { selectedId = null; chosenTarget = null; }
        render(currentState);
      }
    });
    root.addEventListener("change", event => {
      if (!event.target.matches("[data-card-target]")) return;
      const held = E.CardGame.find(currentState, ownerId, selectedId);
      chosenTarget = held ? E.CardEffects.targets(currentState, ownerId, held.cardId)[Number(event.target.value)] : null;
      render(currentState);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && selectedId) { selectedId = null; chosenTarget = null; render(currentState); }
    });
  }

  function cardHtml(state, held, myth = false) {
    const card = E.Cards.get(held.cardId);
    const locked = myth && state.elapsed < held.unlockAt;
    const gold = E.CardEffects.cost(card.id);
    return `<button type="button" class="play-card ${card.fullCard ? "full-card" : ""} category-${slug(card.category)} ${selectedId === held.id ? "selected" : ""} ${locked ? "locked" : ""} ${held.used ? "used" : ""}" data-hand-card="${held.id}" aria-pressed="${selectedId === held.id}" aria-label="${card.name}${locked ? `, disponible à ${clock(held.unlockAt)}` : ""}" ${held.used ? "disabled" : ""}>
      <span class="card-category">${card.category}</span><span class="card-art">${E.CardArt ? E.CardArt.html(card) : `<img src="${card.image}" alt="" loading="lazy">`}</span>
      <span class="card-title">${card.name}</span><span class="card-price">${held.used ? "Jouée" : locked ? `À ${clock(held.unlockAt)}` : gold ? `${gold} or` : "Sans coût en or"}</span>
    </button>`;
  }

  function render(state) {
    currentState = state;
    if (!root || !state) return;
    const playerId = E.Network.mode === "local" ? state.selectedVillage.playerId : E.Network.playerId || "red";
    const player = state.players[playerId];
    root.hidden = !state.cardGameStarted || !player?.cards;
    if (root.hidden) { lastSignature = null; selectedId = null; chosenTarget = null; return; }
    if (ownerId !== playerId) { selectedId = null; chosenTarget = null; ownerId = playerId; }
    const cards = player.cards;
    const held = E.CardGame.find(state, playerId, selectedId);
    if (!held) { selectedId = null; chosenTarget = null; }
    const card = held && E.Cards.get(held.cardId);
    const targets = held ? E.CardEffects.targets(state, playerId, held.cardId) : [];
    const quotes = targets.map(target => E.CardGame.quote(state, playerId, selectedId, target));
    if (held && (!chosenTarget || !targets.some(target => JSON.stringify(target) === JSON.stringify(chosenTarget)))) {
      const preferred = targets.findIndex((target, i) => quotes[i].allowed && target.lane === state.selectedVillage.lane);
      chosenTarget = targets[preferred >= 0 ? preferred : Math.max(0, quotes.findIndex(quote => quote.allowed))] || null;
    }
    const q = held && chosenTarget ? E.CardGame.quote(state, playerId, selectedId, chosenTarget) : null;
    const signature = JSON.stringify([playerId, cards.hand, cards.mythological.map(item => [item.id, item.used, state.elapsed >= item.unlockAt]), cards.drawPile.length,
      selectedId, chosenTarget, quotes.map(quote => [quote.allowed, quote.reason]), targets.map(target => targetLabel(state, playerId, target)), q?.allowed, q?.reason, state.phase, state.paused]);
    if (signature !== lastSignature) {
      lastSignature = signature;
      const targetControls = card ? `<div class="card-play-panel"><div class="card-description"><strong>${card.icon} ${card.name}</strong><p>${card.effect || card.description}</p>${card.conditions?.length ? `<small>${card.conditions.join(" · ")}</small>` : ""}</div><div class="card-target-controls"><label>Choisir une cible<select data-card-target>${targets.map((target, i) => `<option value="${i}" ${JSON.stringify(chosenTarget) === JSON.stringify(target) ? "selected" : ""}>${targetLabel(state, playerId, target)}${quotes[i].allowed ? "" : ` · ${quotes[i].reason}`}</option>`).join("")}</select></label><span class="card-quote ${q?.allowed ? "available" : ""}" role="status">${q?.allowed ? `${q.gold} or${q.resourceAmount ? ` + ${q.resourceAmount} ${q.resource}` : ""}` : q?.reason || "Aucune cible compatible"}</span><div><button type="button" class="button button-primary" data-confirm-card ${!q?.allowed ? "disabled" : ""}>Jouer la carte</button><button type="button" class="button button-quiet" data-cancel-card>Annuler</button></div></div></div>` : '<p class="card-hand-help">Choisissez une carte, sa cible, puis confirmez. Les métiers et équipements ciblent un habitant ; les cultures et animaux ciblent un slot.</p>';
      root.className = `card-hand ${playerId}`;
      root.innerHTML = `<header class="card-hand-header"><div><span class="card-eyebrow">Votre deck en action</span><h2>La main de ${playerId === "red" ? "Rouge" : "Bleu"}</h2></div><div class="card-hand-counters"><b>${cards.hand.length}/${E.Config.cardGame.handMax} cartes</b><span>${cards.drawPile.length} dans le deck</span><span data-next-card></span></div></header>
        <div class="card-hand-scroll">${cards.hand.map(item => cardHtml(state, item)).join("") || '<p class="card-empty-hand">Votre main est vide. La prochaine pioche apparaîtra ici.</p>'}</div>${targetControls}
        <div class="card-myth-row"><div><strong>Mythologiques</strong><small>Deux cartes tirées parmi votre sélection · utilisables une fois</small></div><div class="card-myth-list">${cards.mythological.map(item => cardHtml(state, item, true)).join("")}</div></div>`;
    }
    const timer = root.querySelector("[data-next-card]");
    const nextDraw = !cards.drawPile.length ? "Deck épuisé" : state.preparationRemaining > 0 ? "Pioche après la préparation" :
      !E.Config.cardGame.drawDuringOvertime && state.elapsed >= E.Config.overtime.start ? "Pioche terminée" :
        cards.hand.length >= E.Config.cardGame.handMax && cards.drawTimer >= E.Config.cardGame.drawInterval ? "Pioche en attente · main pleine" :
          `Prochaine carte : ${Math.ceil(E.Config.cardGame.drawInterval - cards.drawTimer)} s`;
    if (timer && timer.textContent !== nextDraw) timer.textContent = nextDraw;
    document.querySelectorAll("[data-select-slot]").forEach(button => {
      const selected = state.selectedVillage;
      const allowed = Boolean(card && targets.some((target, i) => quotes[i].allowed && playerId === selected.playerId && target.lane === selected.lane && target.slotIndex === Number(button.dataset.selectSlot)));
      button.classList.toggle("card-target-allowed", allowed);
    });
  }

  E.CardUI = { init, render, targetLabel };
}());
