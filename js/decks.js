(function () {
  "use strict";
  const E = window.Eredita = window.Eredita || {};
  const cards = E.Cards;
  if (!cards) throw new Error("Eredita.Cards doit être chargé avant decks.js");

  const createState = () => ({
    activeDeck: 0,
    filter: "Toutes",
    search: "",
    popupCardId: null,
    decks: Array.from({ length: cards.rules.deckCount }, () => ({ quantities: {}, mythological: [] }))
  });
  const state = createState();
  let root = null;

  const deckTotal = (targetState = state, index = targetState.activeDeck) =>
    Object.values(targetState.decks[index].quantities).reduce((sum, value) => sum + value, 0);
  const quantity = (id, targetState = state, index = targetState.activeDeck) => targetState.decks[index].quantities[id] || 0;

  function adjustQuantity(targetState, index, cardId, delta) {
    if (!cards.normal.some((item) => item.id === cardId) || !targetState.decks[index]) return false;
    const current = quantity(cardId, targetState, index);
    const next = Math.max(0, Math.min(cards.rules.copiesPerCardMax, current + delta));
    if (next === current || (delta > 0 && deckTotal(targetState, index) >= cards.rules.normalDeckMax)) return false;
    if (next === 0) delete targetState.decks[index].quantities[cardId];
    else targetState.decks[index].quantities[cardId] = next;
    return true;
  }

  function toggleMythological(targetState, index, cardId) {
    const deck = targetState.decks[index];
    if (!deck || !cards.mythological.some((item) => item.id === cardId)) return false;
    const position = deck.mythological.indexOf(cardId);
    if (position >= 0) deck.mythological.splice(position, 1);
    else {
      if (deck.mythological.length >= cards.rules.mythologicalMax) return false;
      deck.mythological.push(cardId);
    }
    return true;
  }

  const categorySlug = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const allCards = [...cards.normal, ...cards.mythological];
  const isMythological = item => item.category === "Mythologique";
  const normalizeSearch = value => categorySlug(value).trim();
  const visual = (item, large = false) => E.CardArt ? E.CardArt.html(item) : item.image
    ? `<img src="${item.image}" alt="" loading="lazy">`
    : `<span class="deck-card-placeholder${large ? " large" : ""}" aria-hidden="true"><i>${item.icon || "✦"}</i><small>${item.name}</small></span>`;

  function quantityControl(item, location = "grid") {
    const count = quantity(item.id);
    const full = deckTotal() >= cards.rules.normalDeckMax;
    return `<div class="deck-quantity" data-quantity-control="${location}" aria-label="Quantité de ${item.name}">
      <button type="button" data-quantity="${item.id}" data-delta="-1" data-focus-key="${location}-${item.id}-minus" ${count === 0 ? "disabled" : ""} aria-label="Retirer ${item.name}">−</button>
      <strong aria-live="polite">×${count}</strong>
      <button type="button" data-quantity="${item.id}" data-delta="1" data-focus-key="${location}-${item.id}-plus" ${count >= cards.rules.copiesPerCardMax || full ? "disabled" : ""} aria-label="Ajouter ${item.name}">+</button>
    </div>`;
  }

  function currentDeckHtml() {
    const selected = cards.normal.filter((item) => quantity(item.id) > 0);
    const myths = state.decks[state.activeDeck].mythological;
    return `<aside class="deck-current" aria-label="Deck actuel">
      <header><div><span>Votre composition</span><h3>Deck ${state.activeDeck + 1}</h3></div><strong class="deck-total" aria-label="${deckTotal()} cartes sur ${cards.rules.normalDeckMax}">${deckTotal()}<small> / ${cards.rules.normalDeckMax}</small></strong></header>
      <div class="deck-capacity" aria-hidden="true"><i style="width:${deckTotal()/cards.rules.normalDeckMax*100}%"></i></div>
      <div class="deck-current-scroll">
        <div class="deck-current-list">${selected.length ? selected.map((item) => `
          <div class="deck-current-entry">
            <button type="button" class="deck-current-row" data-open-card="${item.id}" data-focus-key="deck-open-${item.id}">
              <span class="deck-mini-art" aria-hidden="true">${item.image ? `<img src="${item.image}" alt="" loading="lazy">` : item.icon}</span><span><b>${item.name}</b><small>${item.category}</small></span>
            </button>${quantityControl(item, "deck")}
          </div>`).join("") : `<div class="deck-empty"><span class="deck-empty-mark" aria-hidden="true">✧</span><h4>Votre histoire commence ici</h4><p>Choisissez vos premières cartes<br>dans la collection.</p><button type="button" data-use-starter data-focus-key="starter-empty">Partir d’un deck de départ <span aria-hidden="true">↗</span></button></div>`}</div>
      </div>
        <section class="deck-current-myth" aria-label="Mythologiques du deck">
          <header><h4>Mythologiques</h4><strong>${myths.length} / ${cards.rules.mythologicalMax}</strong></header>
          <p>${cards.rules.futureMythologicalDraw} seront tirées au sort pour la partie.</p>
          <div class="deck-myth-slots">${Array.from({length:cards.rules.mythologicalMax}, (_,index) => {
            const item=cards.get(myths[index]);
            return item ? `<div class="deck-myth-slot filled"><button type="button" data-open-card="${item.id}" data-focus-key="deck-myth-open-${item.id}" aria-label="Voir ${item.name}"><img src="${item.image}" alt="" loading="lazy"><span>${item.name}</span></button><button class="deck-myth-remove" type="button" data-toggle-myth="${item.id}" data-focus-key="deck-myth-remove-${item.id}" aria-label="Retirer ${item.name}">×</button></div>` : `<button class="deck-myth-slot empty" type="button" data-filter="Mythologique" data-focus-key="myth-slot-${index}" aria-label="Choisir une carte mythologique"><span aria-hidden="true">✦</span><small>Choisir</small></button>`;
          }).join("")}</div>
        </section>
      <footer class="deck-current-footer"><span>${cards.rules.copiesPerCardMax} exemplaires maximum par carte</span><span class="deck-session-note">Conservé pour cette session</span></footer>
    </aside>`;
  }

  function collectionHtml() {
    const categories = [...new Set(allCards.map((item) => item.category))];
    const search = normalizeSearch(state.search);
    const filtered = allCards.filter(item => (state.filter === "Toutes" || item.category === state.filter) && (!search || normalizeSearch(`${item.name} ${item.category} ${item.description}`).includes(search)));
    return `<section class="deck-collection" aria-label="Collection de cartes">
      <header class="deck-collection-header"><div><span>Les archives d’Eredità</span><h3>La collection</h3></div><span class="deck-result-count" role="status">${filtered.length} / ${allCards.length} cartes</span></header>
      <div class="deck-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" id="deck-search" data-focus-key="search" aria-label="Rechercher une carte" placeholder="Rechercher une carte, un métier, un effet…" value="${escapeHtml(state.search)}" autocomplete="off"><span aria-hidden="true">${allCards.length} cartes</span></div>
      <nav class="deck-filters" aria-label="Filtres de cartes">${["Toutes", ...categories].map((category) => `<button type="button" data-filter="${category}" data-focus-key="filter-${categorySlug(category)}" aria-pressed="${state.filter === category}" class="${state.filter === category ? "selected" : ""}">${category === "Mythologique" ? '<span aria-hidden="true">✦</span> Mythologie' : category}</button>`).join("")}</nav>
      <div class="deck-collection-scroll"><div class="deck-collection-grid">${filtered.map(collectionCardHtml).join("")}</div>${!filtered.length ? '<div class="deck-no-results"><span aria-hidden="true">⌕</span><h4>Aucune carte trouvée</h4><p>Essayez un autre nom ou une autre catégorie.</p><button type="button" data-reset-search data-focus-key="reset-search">Réinitialiser la recherche</button></div>' : ""}</div>
      <footer class="deck-collection-footer"><span>Cliquez sur une carte pour lire sa fiche.</span><span><i aria-hidden="true"></i> Dans votre deck</span></footer>
    </section>`;
  }

  function collectionCardHtml(item) {
    const myth = isMythological(item);
    const selected = state.decks[state.activeDeck].mythological;
    const included = myth ? selected.includes(item.id) : quantity(item.id)>0;
    const blocked = myth && !included && selected.length >= cards.rules.mythologicalMax;
    return `<article class="${myth ? "deck-myth-card" : "deck-collection-card"} ${item.fullCard ? "full-card" : ""} category-${categorySlug(item.category)} ${included ? "selected" : ""}">
      ${included ? `<span class="deck-included" aria-label="Dans le deck">${myth ? "✓" : `×${quantity(item.id)}`}</span>` : ""}
      <button type="button" class="deck-card-body" data-open-card="${item.id}" data-focus-key="collection-open-${item.id}">${visual(item)}<span class="deck-card-copy"><b>${item.name}</b><small>${item.category}</small></span></button>
      ${myth ? `<button type="button" class="deck-myth-toggle" data-toggle-myth="${item.id}" data-focus-key="collection-myth-${item.id}" aria-pressed="${included}" ${blocked ? "disabled" : ""}>${included ? "✓ Sélectionnée" : "Choisir"}</button>` : quantityControl(item)}
    </article>`;
  }

  function detailsHtml(item) {
    return `${item.stats?.length ? `<section class="deck-modal-section"><h4>Statistiques</h4><dl class="deck-stats">${item.stats.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl></section>` : ""}
      ${item.effect ? `<section class="deck-modal-section"><h4>Effet</h4><p>${item.effect}</p></section>` : ""}
      ${item.conditions?.length ? `<section class="deck-modal-section"><h4>Conditions</h4><ul>${item.conditions.map((condition) => `<li>${condition}</li>`).join("")}</ul></section>` : ""}
      ${item.biome ? `<section class="deck-modal-section biome"><h4>Bonus de biome</h4><p>${item.biome}</p></section>` : ""}
      ${item.notes ? `<section class="deck-modal-section pending"><h4>À définir</h4><p>${item.notes}</p></section>` : ""}`;
  }

  function modalHtml() {
    const item = cards.get(state.popupCardId);
    if (!item) return "";
    const myth = item.category === "Mythologique";
    const selected = state.decks[state.activeDeck].mythological.includes(item.id);
    const blocked = !selected && state.decks[state.activeDeck].mythological.length >= cards.rules.mythologicalMax;
    return `<div class="deck-modal-backdrop" data-close-modal role="presentation">
      <article class="deck-card-modal" role="dialog" aria-modal="true" aria-labelledby="deck-modal-title">
        <button type="button" class="deck-modal-close" data-close-modal data-focus-key="modal-close" aria-label="Fermer">×</button>
        <div class="deck-modal-visual">${visual(item, true)}</div>
        <div class="deck-modal-content"><span class="deck-modal-category">${item.category}${item.rarity ? ` · ${item.rarity}` : ""}</span><h3 id="deck-modal-title">${item.name}</h3><p class="deck-modal-description">${item.description}</p>
          <div class="deck-modal-details">${detailsHtml(item)}</div>
          <div class="deck-modal-actions">${myth
            ? `<div><small>Mythologiques : ${state.decks[state.activeDeck].mythological.length} / ${cards.rules.mythologicalMax}</small><button type="button" class="deck-modal-myth ${selected ? "selected" : ""}" data-toggle-myth="${item.id}" data-focus-key="modal-myth-${item.id}" ${blocked ? "disabled" : ""}>${selected ? "Retirer de la sélection" : "Sélectionner"}</button></div>`
            : `<div><small>Quantité dans le Deck ${state.activeDeck + 1}</small>${quantityControl(item, "modal")}</div>`}</div>
          <div class="deck-narrative-slot" aria-hidden="true"></div>
        </div>
      </article>
    </div>`;
  }

  function render({ resetCollectionScroll = false } = {}) {
    if (!root) return;
    const builderScroll = root.querySelector('.deck-builder')?.scrollTop || 0;
    const collectionScroll = root.querySelector('.deck-collection-scroll')?.scrollTop || 0;
    const currentScroll = root.querySelector('.deck-current-scroll')?.scrollTop || 0;
    const modalScroll = root.querySelector('.deck-modal-content')?.scrollTop || 0;
    const focused = root.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused?.dataset.focusKey;
    const caret = focused?.id === 'deck-search' ? [focused.selectionStart, focused.selectionEnd] : null;
    root.innerHTML = `<div class="deck-builder">
      <header class="deck-builder-top"><div class="deck-tabs" role="group" aria-label="Vos trois decks">${state.decks.map((deck, index) => `<button type="button" aria-pressed="${index === state.activeDeck}" class="${index === state.activeDeck ? "selected" : ""}" data-deck-index="${index}" data-focus-key="deck-${index}"><span class="deck-tab-number">0${index + 1}</span><span>Deck ${index + 1}<small>${deckTotal(state,index)} cartes · ${deck.mythological.length} myth.</small></span></button>`).join("")}</div><div class="deck-library-note"><span aria-hidden="true">✦</span><p>À chaque partie, son héritage.<small>Composez vos stratégies, rassemblez vos légendes.</small></p></div><button type="button" class="deck-starter-button" data-use-starter data-focus-key="starter">Charger le deck de départ <span aria-hidden="true">↗</span></button></header>
      <div class="deck-main-layout">${currentDeckHtml()}${collectionHtml()}</div>
      ${modalHtml()}
    </div>`;
    root.querySelector('.deck-builder').scrollTop = builderScroll;
    root.querySelector('.deck-collection-scroll').scrollTop = resetCollectionScroll ? 0 : collectionScroll;
    root.querySelector('.deck-current-scroll').scrollTop = currentScroll;
    if (root.querySelector('.deck-modal-content')) root.querySelector('.deck-modal-content').scrollTop = modalScroll;
    let nextFocus = focusKey && root.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`);
    if (nextFocus?.disabled) nextFocus = nextFocus.closest('.deck-quantity')?.querySelector('button:not(:disabled)');
    if (!nextFocus && focused?.dataset.quantity) nextFocus = root.querySelector(`.deck-collection [data-open-card="${focused.dataset.quantity}"]`);
    if (state.popupCardId && (!nextFocus || !nextFocus.closest('.deck-card-modal'))) nextFocus = root.querySelector('.deck-modal-close');
    if (nextFocus && !nextFocus.disabled) {
      nextFocus.focus({preventScroll:true});
      if (caret && nextFocus.id === 'deck-search') nextFocus.setSelectionRange(...caret);
    }
  }

  function closeModal() {
    if (!state.popupCardId || !root) return;
    const id = state.popupCardId;
    state.popupCardId = null; render();
    root.querySelector(`[data-open-card="${id}"]`)?.focus({preventScroll:true});
  }

  function handleClick(event) {
    if (event.target.closest("[data-use-starter]") && E.Config?.cardGame) {
      const previous = JSON.stringify(state.decks[state.activeDeck]);
      state.decks[state.activeDeck] = JSON.parse(JSON.stringify(E.Config.cardGame.starterDecks[state.activeDeck]));
      if (previous !== JSON.stringify(state.decks[state.activeDeck])) E.Audio?.playEffect('pageAdd');
      render(); return;
    }
    const quantityButton = event.target.closest("[data-quantity]");
    if (quantityButton) {
      event.stopPropagation();
      const delta = Number(quantityButton.dataset.delta);
      if (adjustQuantity(state, state.activeDeck, quantityButton.dataset.quantity, delta)) { E.Audio?.playEffect(delta > 0 ? 'pageAdd' : 'pageRemove'); render(); }
      return;
    }
    const mythButton = event.target.closest("[data-toggle-myth]");
    if (mythButton) {
      event.stopPropagation();
      const wasSelected = state.decks[state.activeDeck].mythological.includes(mythButton.dataset.toggleMyth);
      if (toggleMythological(state, state.activeDeck, mythButton.dataset.toggleMyth)) { E.Audio?.playEffect(wasSelected ? 'pageRemove' : 'pageAdd'); render(); }
      return;
    }
    const deckButton = event.target.closest("[data-deck-index]");
    if (deckButton) { state.activeDeck = Number(deckButton.dataset.deckIndex); state.filter = "Toutes"; state.search = ""; render({resetCollectionScroll:true}); return; }
    const filterButton = event.target.closest("[data-filter]");
    if (filterButton) { state.filter = filterButton.dataset.filter; if (filterButton.classList.contains('deck-myth-slot')) state.search = ""; render({resetCollectionScroll:true}); return; }
    if (event.target.closest('[data-reset-search]')) { state.filter = "Toutes"; state.search = ""; render({resetCollectionScroll:true}); root.querySelector('#deck-search').focus(); return; }
    const openButton = event.target.closest("[data-open-card]");
    if (openButton) { state.popupCardId = openButton.dataset.openCard; E.Audio?.confirmInterface(); render(); root.querySelector('.deck-modal-close').focus(); return; }
    const close = event.target.closest("[data-close-modal]");
    if (close && (close === event.target || close.classList.contains("deck-modal-close"))) closeModal();
  }

  function handleKeydown(event) {
    if (!state.popupCardId || !root) return;
    if (event.key === "Escape") { event.preventDefault(); closeModal(); }
    if (event.key === "Tab") {
      const buttons = [...root.querySelectorAll('.deck-card-modal button:not(:disabled)')];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }

  function handleInput(event) {
    if (event.target.id !== 'deck-search') return;
    state.search = event.target.value;
    render({resetCollectionScroll:true});
  }

  function mount(container) {
    if (!container) return;
    if (root) { root.removeEventListener("click", handleClick); root.removeEventListener("input", handleInput); }
    root = container;
    root.addEventListener("click", handleClick);
    root.addEventListener("input", handleInput);
    document.addEventListener("keydown", handleKeydown);
    render();
  }

  function unmount() {
    if (root) { root.removeEventListener("click", handleClick); root.removeEventListener("input", handleInput); }
    document.removeEventListener("keydown", handleKeydown);
    state.popupCardId = null;
    root = null;
  }

  const exportDeck = index => JSON.parse(JSON.stringify(state.decks[index] || state.decks[0]));
  E.Decks = { mount, unmount, state, createState, deckTotal, quantity, adjustQuantity, toggleMythological, exportDeck };
})();
