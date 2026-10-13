(function () {
  "use strict";
  const E = window.Eredita;
  const config = () => E.Config.cardGame;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function validateDeck(deck) {
    if (!deck || !deck.quantities || typeof deck.quantities !== "object" || Array.isArray(deck.quantities) || !Array.isArray(deck.mythological)) return false;
    let count = 0;
    for (const [id, quantity] of Object.entries(deck.quantities)) {
      if (!E.Cards.normal.some(card => card.id === id) || !Number.isInteger(quantity) || quantity < 1 || quantity > E.Cards.rules.copiesPerCardMax) return false;
      count += quantity;
    }
    return count <= E.Cards.rules.normalDeckMax && deck.mythological.length <= E.Cards.rules.mythologicalMax &&
      new Set(deck.mythological).size === deck.mythological.length && deck.mythological.every(id => E.Cards.mythological.some(card => card.id === id));
  }

  function matchDeck(index, custom) {
    const fallback = config().starterDecks[index] || config().starterDecks[0];
    if (!validateDeck(custom) || !Object.keys(custom.quantities).length) return clone(fallback);
    const deck = clone(custom);
    // Une sélection incomplète conserve les choix du joueur et complète les cases libres.
    for (const id of fallback.mythological) if (deck.mythological.length < E.Cards.rules.mythologicalMax && !deck.mythological.includes(id)) deck.mythological.push(id);
    return deck;
  }

  function shuffle(values, random = Math.random) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function instance(state, cardId) {
    state.nextCardInstanceId = (state.nextCardInstanceId || 0) + 1;
    return { id: `carte-${state.nextCardInstanceId}`, cardId };
  }

  function start(state, random = Math.random) {
    if (state.cardGameStarted) return false;
    state.cardGameStarted = true;
    state.casualties ||= [];
    state.pendingResurrections ||= [];
    for (const player of Object.values(state.players)) {
      const deck = matchDeck(player.selectedDeck, player.matchDeck);
      player.matchDeck = deck;
      const pile = shuffle(Object.entries(deck.quantities).flatMap(([id, count]) => Array(count).fill(id)), random);
      player.cards = { hand: [], drawPile: pile, discard: [], drawTimer: 0,
        mythological: shuffle(deck.mythological, random).slice(0, E.Cards.rules.futureMythologicalDraw).map((cardId, i) => ({ ...instance(state, cardId), unlockAt: config().mythologicalUnlocks[i], used: false })) };
      while (player.cards.hand.length < config().startingHand && pile.length) player.cards.hand.push(instance(state, pile.shift()));
    }
    return true;
  }

  function draw(state, player) {
    const cards = player.cards;
    if (!cards || !cards.drawPile.length || cards.hand.length >= config().handMax) return false;
    cards.hand.push(instance(state, cards.drawPile.shift()));
    return true;
  }

  function update(state, delta) {
    if (!state.cardGameStarted || state.phase !== "running" || state.paused || state.preparationRemaining > 0 || !Number.isFinite(delta) || delta <= 0) return;
    for (const player of Object.values(state.players)) {
      const cards = player.cards;
      if (!cards || (!config().drawDuringOvertime && state.elapsed >= E.Config.overtime.start)) continue;
      // À main pleine le temps s'arrête à une seule pioche en attente, sans perdre de carte.
      cards.drawTimer += delta;
      while (cards.drawTimer >= config().drawInterval && draw(state, player)) cards.drawTimer -= config().drawInterval;
      cards.drawTimer = Math.min(config().drawInterval, cards.drawTimer);
    }
  }

  function find(state, playerId, instanceId) {
    const cards = state.players[playerId]?.cards;
    if (!cards) return null;
    return cards.hand.find(card => card.id === instanceId) || cards.mythological.find(card => card.id === instanceId && !card.used) || null;
  }

  function quote(state, playerId, instanceId, target = {}) {
    if (!target || typeof target !== "object" || Array.isArray(target)) return { allowed: false, reason: "Cible invalide", gold: 0 };
    const held = find(state, playerId, instanceId);
    const card = held && E.Cards.get(held.cardId);
    let reason = !held ? "Cette carte n’est pas dans votre main" : !card ? "Carte inconnue" :
      state.phase !== "running" ? "Partie inactive" : state.paused ? "Partie en pause" :
        held.unlockAt !== undefined && state.elapsed < held.unlockAt ? `Disponible à ${Math.floor(held.unlockAt / 60)} minutes` : null;
    const effect = card && !reason ? E.CardEffects.quote(state, playerId, card.id, target) : null;
    if (!reason && !effect?.allowed) reason = effect?.reason || "Cible incompatible";
    return { card, held, target, gold: effect?.gold || 0, resource: effect?.resource, resourceAmount: effect?.resourceAmount || 0, allowed: !reason, reason: reason || "Disponible" };
  }

  function play(state, playerId, instanceId, target = {}) {
    const q = quote(state, playerId, instanceId, target);
    if (!q.allowed) return false;
    if (!E.CardEffects.apply(state, playerId, q.card.id, target)) return false;
    const cards = state.players[playerId].cards;
    if (q.held.unlockAt !== undefined) q.held.used = true;
    else {
      cards.hand = cards.hand.filter(card => card.id !== instanceId);
      cards.discard.push(q.held.cardId);
    }
    state.logs.unshift(`${state.players[playerId].name} joue ${q.card.name} au village ${target.lane + 1}.`);
    // Une carte en attente peut être piochée aussitôt qu'une place se libère.
    if ((config().drawDuringOvertime || state.elapsed < E.Config.overtime.start) && cards.drawTimer >= config().drawInterval && draw(state, state.players[playerId])) cards.drawTimer = 0;
    return q;
  }

  function targets(state, playerId, instanceId) {
    const held = find(state, playerId, instanceId);
    return held ? E.CardEffects.targets(state, playerId, held.cardId).filter(target => quote(state, playerId, instanceId, target).allowed) : [];
  }

  E.CardGame = { validateDeck, matchDeck, start, update, find, quote, play, targets, shuffle };
}());
