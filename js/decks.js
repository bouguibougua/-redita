(function () {
  "use strict";
  const E = window.Eredita = window.Eredita || {};
  const cards = E.Cards;
  if (!cards) throw new Error("Eredita.Cards doit être chargé avant decks.js");

  const createState = () => ({
    activeDeck: 0,
    filter: "Toutes",
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
  const visual = (item, large = false) => item.image
    ? `<img src="${item.image}" alt="" loading="lazy">`
    : `<span class="deck-card-placeholder${large ? " large" : ""}" aria-hidden="true"><i>${item.icon || "✦"}</i><small>${item.name}</small></span>`;

  function quantityControl(item, location = "grid") {
    const count = quantity(item.id);
    const full = deckTotal() >= cards.rules.normalDeckMax;
    return `<div class="deck-quantity" data-quantity-control="${location}" aria-label="Quantité de ${item.name}">
      <button type="button" data-quantity="${item.id}" data-delta="-1" ${count === 0 ? "disabled" : ""} aria-label="Retirer ${item.name}">−</button>
      <strong aria-live="polite">×${count}</strong>
      <button type="button" data-quantity="${item.id}" data-delta="1" ${count >= cards.rules.copiesPerCardMax || full ? "disabled" : ""} aria-label="Ajouter ${item.name}">+</button>
    </div>`;
  }

  function currentDeckHtml() {
    const selected = cards.normal.filter((item) => quantity(item.id) > 0);
    return `<aside class="deck-current" aria-label="Deck actuel">
      <header><div><span>Composition</span><h3>Deck ${state.activeDeck + 1}</h3></div><strong class="deck-total">${deckTotal()} / ${cards.rules.normalDeckMax}</strong></header>
      <div class="deck-current-list">${selected.length ? selected.map((item) => `
        <button type="button" class="deck-current-row" data-open-card="${item.id}">
          <span class="deck-mini-icon" aria-hidden="true">${item.icon}</span><span><b>${item.name}</b><small>${item.category}</small></span><strong>×${quantity(item.id)}</strong>
        </button>`).join("") : '<p class="deck-empty">Ce deck est vide.<small>Ajoutez des cartes depuis la collection.</small></p>'}</div>
      <p class="deck-limit-help">30 cartes maximum · 4 exemplaires par carte</p>
    </aside>`;
  }

  function collectionHtml() {
    const categories = [...new Set(cards.normal.map((item) => item.category))];
    const filtered = state.filter === "Toutes" ? cards.normal : cards.normal.filter((item) => item.category === state.filter);
    return `<section class="deck-collection" aria-label="Collection de cartes">
      <header class="deck-collection-header"><div><span>Cartes disponibles</span><h3>Collection</h3></div><b>${filtered.length} carte${filtered.length > 1 ? "s" : ""}</b></header>
      <nav class="deck-filters" aria-label="Filtres de cartes">${["Toutes", ...categories].map((category) => `<button type="button" data-filter="${category}" class="${state.filter === category ? "selected" : ""}">${category}</button>`).join("")}</nav>
      <div class="deck-collection-grid">${filtered.map((item) => `<article class="deck-collection-card category-${categorySlug(item.category)}">
        <button type="button" class="deck-card-body" data-open-card="${item.id}">${visual(item)}<span class="deck-card-copy"><b>${item.name}</b><small>${item.category}${item.rarity ? ` · ${item.rarity}` : ""}</small></span></button>
        ${quantityControl(item)}
      </article>`).join("")}</div>
    </section>`;
  }

  function mythologicalHtml() {
    const selected = state.decks[state.activeDeck].mythological;
    return `<section class="deck-mythological" aria-label="Cartes mythologiques">
      <header><div><span>Sélection séparée</span><h3>Mythologiques</h3></div><strong>${selected.length} / ${cards.rules.mythologicalMax}</strong></header>
      <p>Choisissez trois cartes. Plus tard, deux d’entre elles seront tirées au sort pour la partie.</p>
      <div class="deck-myth-grid">${cards.mythological.map((item) => {
        const isSelected = selected.includes(item.id);
        const disabled = !isSelected && selected.length >= cards.rules.mythologicalMax;
        return `<article class="deck-myth-card ${isSelected ? "selected" : ""}">
          <button type="button" class="deck-card-body" data-open-card="${item.id}">${visual(item)}<span class="deck-card-copy"><b>${item.name}</b><small>Mythologique</small></span></button>
          <button type="button" class="deck-myth-toggle" data-toggle-myth="${item.id}" ${disabled ? "disabled" : ""}>${isSelected ? "Sélectionnée" : "Sélectionner"}</button>
        </article>`;
      }).join("")}</div>
    </section>`;
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
        <button type="button" class="deck-modal-close" data-close-modal aria-label="Fermer">×</button>
        <div class="deck-modal-visual">${visual(item, true)}</div>
        <div class="deck-modal-content"><span class="deck-modal-category">${item.category}${item.rarity ? ` · ${item.rarity}` : ""}</span><h3 id="deck-modal-title">${item.name}</h3><p class="deck-modal-description">${item.description}</p>
          <div class="deck-modal-details">${detailsHtml(item)}</div>
          <div class="deck-modal-actions">${myth
            ? `<div><small>Mythologiques : ${state.decks[state.activeDeck].mythological.length} / ${cards.rules.mythologicalMax}</small><button type="button" class="deck-modal-myth ${selected ? "selected" : ""}" data-toggle-myth="${item.id}" ${blocked ? "disabled" : ""}>${selected ? "Retirer de la sélection" : "Sélectionner"}</button></div>`
            : `<div><small>Quantité dans le Deck ${state.activeDeck + 1}</small>${quantityControl(item, "modal")}</div>`}</div>
          <div class="deck-narrative-slot" aria-hidden="true"></div>
        </div>
      </article>
    </div>`;
  }

  function render() {
    if (!root) return;
    root.innerHTML = `<div class="deck-builder">
      <header class="deck-builder-top"><div class="deck-tabs" role="tablist">${state.decks.map((_, index) => `<button type="button" role="tab" aria-selected="${index === state.activeDeck}" class="${index === state.activeDeck ? "selected" : ""}" data-deck-index="${index}">Deck ${index + 1}</button>`).join("")}</div><p>Les changements sont conservés pendant cette session.</p></header>
      <div class="deck-main-layout">${currentDeckHtml()}${collectionHtml()}</div>
      ${mythologicalHtml()}
      ${modalHtml()}
    </div>`;
  }

  function playCardSound() {
    if (typeof Audio !== "function") return;
    try {
      const sound = new Audio("assets/audio/ui/card-open.mp3");
      sound.volume = 0.32;
      const promise = sound.play();
      if (promise?.catch) promise.catch(() => {});
    } catch (_) { /* Le visuel reste fonctionnel sans fichier audio. */ }
  }

  function closeModal() {
    if (!state.popupCardId || !root) return;
    const backdrop = root.querySelector(".deck-modal-backdrop");
    backdrop?.classList.add("closing");
    window.setTimeout(() => { state.popupCardId = null; render(); }, 140);
  }

  function handleClick(event) {
    const quantityButton = event.target.closest("[data-quantity]");
    if (quantityButton) {
      event.stopPropagation();
      if (adjustQuantity(state, state.activeDeck, quantityButton.dataset.quantity, Number(quantityButton.dataset.delta))) render();
      return;
    }
    const mythButton = event.target.closest("[data-toggle-myth]");
    if (mythButton) {
      event.stopPropagation();
      if (toggleMythological(state, state.activeDeck, mythButton.dataset.toggleMyth)) render();
      return;
    }
    const deckButton = event.target.closest("[data-deck-index]");
    if (deckButton) { state.activeDeck = Number(deckButton.dataset.deckIndex); state.filter = "Toutes"; render(); return; }
    const filterButton = event.target.closest("[data-filter]");
    if (filterButton) { state.filter = filterButton.dataset.filter; render(); return; }
    const openButton = event.target.closest("[data-open-card]");
    if (openButton) { state.popupCardId = openButton.dataset.openCard; playCardSound(); render(); return; }
    const close = event.target.closest("[data-close-modal]");
    if (close && (close === event.target || close.classList.contains("deck-modal-close"))) closeModal();
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && state.popupCardId) closeModal();
  }

  function mount(container) {
    if (!container) return;
    if (root) root.removeEventListener("click", handleClick);
    root = container;
    root.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeydown);
    render();
  }

  function unmount() {
    if (root) root.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", handleKeydown);
    state.popupCardId = null;
    root = null;
  }

  E.Decks = { mount, unmount, state, createState, deckTotal, quantity, adjustQuantity, toggleMythological };
})();
