(function () {
  'use strict';
  const E = window.Eredita;
  let localAuthority = null, privateView = null, stateRef = null;
  let widget = null, component = null, closeButton = null, caption = null, counter = null, offerId = null, ownerId = null;
  let resolved = false, pausedByMatch = false, submitted = false, lastCaption = '';
  let inventory = null, inventoryContent = null, activationNotice = null, stockHelp = null, stockCount = null, inventorySignature = '';
  let activeTargetId = null, targetInFlight = null, hoveredRegion = null, targetGuide = null, targetMessage = '';
  const announcedSelections = new Set();
  const online = () => ['host', 'guest'].includes(E.Network.mode);
  function disposeWidget() {
    const clock = document.querySelector('.board-clock');
    if (clock && widget?.contains(clock)) document.querySelector('#battlefield').prepend(clock);
    document.querySelector('#game-screen').classList.remove('has-mythology-hud');
    component?.dispose(); widget?.remove(); targetGuide?.remove();
    if (inventory) { inventory.replaceChildren(); inventory.hidden = true; }
    widget = component = closeButton = caption = counter = null; offerId = ownerId = null;
    resolved = pausedByMatch = submitted = false; lastCaption = '';
    inventory = inventoryContent = activationNotice = stockHelp = stockCount = targetGuide = null; inventorySignature = '';
    activeTargetId = targetInFlight = hoveredRegion = null;
    targetMessage = '';
    updateTargetHints();
  }
  function reset() {
    disposeWidget(); localAuthority = null; privateView = null; stateRef = null; announcedSelections.clear();
  }
  function start(state) {
    state.reinforcementEpoch = E.MythologyMatch.newEpoch();
    if (!online()) { localAuthority = E.MythologyMatch.createAuthority(); localAuthority.sync(state); }
    render(state);
  }
  function update(state) { if (['solo', 'local'].includes(E.Network.mode)) localAuthority?.sync(state); }
  function player(state) { return E.Network.mode === 'local' ? state.selectedVillage.playerId : E.Network.playerId || 'red'; }
  function view(state) {
    const id = player(state);
    return online() ? privateView && privateView.epoch === state.reinforcementEpoch && privateView.playerId === id ? privateView : null : localAuthority?.view(id) || null;
  }
  // Le stock LÉGENDES dérive des confirmations privées, sans deuxième
  // inventaire. Toujours l’image normale, même après un choix à droite.
  function getObtainedLegends() {
    return Object.freeze((stateRef ? view(stateRef)?.selections || [] : []).map((selection, order) => Object.freeze({
      ...selection, order, name: E.Mythology.get(selection.legendId)?.name || selection.legendId,
      illustration: E.Mythology.getIllustration(selection.legendId, 'left')
    })));
  }
  function announceSelections(current) {
    if (!current) return;
    getObtainedLegends().forEach(selection => {
      const key = `${current.epoch}:${current.playerId}:${selection.offerId}`;
      if (announcedSelections.has(key)) return;
      announcedSelections.add(key);
      widget.dispatchEvent(new CustomEvent('eredita:mythology-collected', { bubbles: true,
        detail: Object.freeze({ epoch: current.epoch, playerId: current.playerId, ...selection }) }));
    });
  }
  function select(state, detail) {
    const current = view(state), pending = current?.pending;
    if (submitted) return;
    if (state.phase !== 'running' || state.paused || !pending || pending.id !== offerId || !pending.legendIds.includes(detail.legendId)) {
      component?.resolveSelection({ accepted: false }); return;
    }
    submitted = true;
    if (online()) {
      if (!E.Network.selectReinforcement(current.epoch, pending.id, detail.legendId)) {
        submitted = false; component?.resolveSelection({ accepted: false });
      }
      return;
    }
    const result = localAuthority.select(player(state), { epoch: current.epoch, offerId: pending.id, legendId: detail.legendId });
    component?.resolveSelection(result); submitted = resolved = result.accepted;
    render(state);
  }
  function receive(packet) {
    if (!packet?.view || packet.view.playerId !== E.Network.playerId) return;
    if (privateView?.epoch === packet.view.epoch && packet.view.revision < privateView.revision) return;
    privateView = packet.view;
    if (packet.activation && !packet.accepted) { targetInFlight = null; targetMessage = E.MythologyUI.activationMessage(packet.reason); }
    if (packet.activation && activationNotice) activationNotice.textContent = packet.accepted ? 'Demande prise en compte.' : E.MythologyUI.activationMessage(packet.reason);
    if (packet.view.selections.some(selection => selection.offerId === offerId)) {
      component?.resolveSelection({ accepted: true }); submitted = resolved = true;
    } else if (packet.offerId === offerId && packet.accepted !== undefined) {
      component?.resolveSelection(packet); submitted = resolved = packet.accepted;
    }
    if (E.GameView?.getState) render(E.GameView.getState());
  }
  function closeOffer() {
    if (!widget || submitted) return;
    widget.classList.remove('is-open'); component.resetReveal(); pausedByMatch = false;
    component.element.querySelector('.mythology-crystal-stage').focus({ preventScroll: true });
  }
  function activate(ownedOfferId, target = {}) {
    const current = stateRef && view(stateRef);
    if (!current || stateRef.phase !== 'running' || stateRef.paused) return false;
    if (online()) return E.Network.activateReinforcement(current.epoch, ownedOfferId, target);
    const request = localAuthority.requestActivation(current.playerId, { epoch: current.epoch, offerId: ownedOfferId, target });
    if (!request.accepted) { activationNotice.textContent = E.MythologyUI.activationMessage(request.reason); return false; }
    const result = E.MythologyEffects.activate(stateRef, request.execution);
    localAuthority.finishActivation(request.execution.activationId, result.accepted, result.reason);
    activationNotice.textContent = result.accepted ? 'Renfort utilisé.' : E.MythologyUI.activationMessage(result.reason);
    render(stateRef); E.UI.render(stateRef);
    return result.accepted;
  }
  function getTargeting() {
    if (!activeTargetId || stateRef?.phase !== 'running') return null;
    const current = stateRef && view(stateRef);
    const selection = current?.selections.find(item => item.offerId === activeTargetId);
    if (!selection || selection.status === 'activated' || selection.developmentOnly) return null;
    const legend = E.Mythology.get(selection.legendId);
    return { offerId: selection.offerId, legendId: legend.id, playerId: current.playerId,
      mode: legend.gameplay.targetMode, targets: E.MythologyEffects.targets(stateRef, current.playerId, legend.id),
      hover: hoveredRegion, pending: Boolean(targetInFlight || selection.status === 'activation-pending') };
  }
  function regionTarget(targeting, playerId, lane) {
    if (targeting.mode === 'none') return {};
    return targeting.mode === 'column' ? { lane } : { playerId, lane };
  }
  function canTargetRegion(playerId, lane) {
    const targeting = getTargeting();
    if (!targeting || stateRef.paused || !stateRef.players[playerId]?.villages[lane]) return false;
    const target = regionTarget(targeting, playerId, lane);
    return targeting.targets.some(candidate => Object.keys(candidate).length === Object.keys(target).length &&
      Object.entries(candidate).every(([key, value]) => target[key] === value));
  }
  function instruction(mode) {
    return mode === 'column' ? 'Cliquez sur une colonne du terrain.' : mode === 'allied-region' ? 'Cliquez sur une région alliée.' :
      mode === 'enemy-region' ? 'Cliquez sur une région ennemie.' : mode === 'none' ? 'Cliquez sur le terrain pour activer le pouvoir.' : 'Cliquez sur la région à cibler.';
  }
  function updateTargetHints() {
    const targeting = getTargeting(), enabled = Boolean(targeting && !stateRef.paused && !targeting.pending);
    document.querySelector('#battlefield')?.classList.toggle('mythology-is-targeting', enabled);
    document.querySelectorAll('[data-mythology-region]').forEach(region => {
      const valid = enabled && canTargetRegion(region.dataset.player, Number(region.dataset.lane));
      region.classList.toggle('mythology-target-eligible', valid);
      if (enabled) {
        if (region.getAttribute('tabindex') !== '0') region.setAttribute('tabindex', '0');
        if (region.getAttribute('role') !== 'button') region.setAttribute('role', 'button');
        const label = `${region.dataset.player === 'red' ? 'Rouge' : 'Bleu'} · région ${Number(region.dataset.lane) + 1}${valid ? ' · cible possible' : ' · cible incompatible'}`;
        if (region.getAttribute('aria-label') !== label) region.setAttribute('aria-label', label);
      } else { region.removeAttribute('tabindex'); region.removeAttribute('role'); region.removeAttribute('aria-label'); }
    });
    if (targetGuide) {
      targetGuide.hidden = !targeting;
      if (targeting) {
        const text = `${E.Mythology.get(targeting.legendId).name} · ${stateRef.paused ? 'Partie en pause.' : targeting.pending ? 'Validation en cours…' : targetMessage || instruction(targeting.mode)}`;
        const copy = targetGuide.querySelector('span'); if (copy.textContent !== text) copy.textContent = text;
      }
    }
  }
  function cancelTargeting() {
    activeTargetId = targetInFlight = hoveredRegion = null; inventorySignature = ''; targetMessage = '';
    if (stateRef) render(stateRef);
  }
  function arm(ownedOfferId) {
    const current = stateRef && view(stateRef);
    const selection = current?.selections.find(item => item.offerId === ownedOfferId);
    if (!selection || stateRef.phase !== 'running' || stateRef.paused || selection.developmentOnly || selection.status === 'activated') return false;
    if (selection.status === 'activation-pending') return activate(selection.offerId, selection.execution.target);
    if (targetInFlight) return false;
    if (activeTargetId === ownedOfferId) { cancelTargeting(); return true; }
    activeTargetId = ownedOfferId; hoveredRegion = null; targetMessage = '';
    activationNotice.textContent = '';
    render(stateRef);
    if (window.matchMedia('(max-width: 900px)').matches) document.querySelector('#battlefield').scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  }
  function targetRegion(playerId, lane) {
    const targeting = getTargeting();
    if (!targeting) return false;
    if (targeting.pending) return true;
    targetMessage = '';
    if (!canTargetRegion(playerId, lane)) {
      targetMessage = stateRef.paused ? 'Reprenez la partie pour utiliser ce renfort.' : 'Cette région ne convient pas à ce pouvoir.';
      activationNotice.textContent = targetMessage;
      return true;
    }
    const target = regionTarget(targeting, playerId, lane);
    const check = E.MythologyEffects.quote(stateRef, targeting.playerId, targeting.legendId, target);
    if (!check.allowed) { activationNotice.textContent = targetMessage = check.reason; return true; }
    targetInFlight = targeting.offerId;
    const accepted = activate(targeting.offerId, target);
    if (!accepted) { targetInFlight = null; if (online()) activationNotice.textContent = targetMessage = 'Connexion indisponible. Réessayez.'; }
    render(stateRef); return true;
  }
  function hoverRegion(playerId, lane) {
    hoveredRegion = playerId ? { playerId, lane } : null;
  }
  function makeWidget(state, current) {
    disposeWidget();
    const pending = current?.pending;
    offerId = pending?.id || null; ownerId = current?.playerId || player(state);
    widget = document.createElement('aside'); widget.className = 'mythology-match-widget';
    widget.setAttribute('aria-label', 'Renfort mythologique'); widget.dataset.owner = ownerId;
    component = E.MythologyUI.createCrystalPreview({ leftId: pending?.legendIds[0], rightId: pending?.legendIds[1], mode: 'match' });
    const stage = component.element.querySelector('.mythology-crystal-stage');
    counter = document.createElement('span'); counter.className = 'mythology-match-count'; counter.setAttribute('aria-hidden', 'true');
    const ns = 'http://www.w3.org/2000/svg', sparks = document.createElementNS(ns, 'svg');
    sparks.setAttribute('viewBox', '0 0 90 80'); sparks.setAttribute('aria-hidden', 'true'); sparks.classList.add('mythology-match-sparks');
    for (const d of ['M22 23 16 31 23 36 16 46', 'M68 23 74 31 67 36 74 46']) {
      const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); sparks.append(path);
    }
    stage.append(sparks, counter);
    caption = document.createElement('p'); caption.className = 'mythology-match-caption'; caption.setAttribute('role', 'status');
    closeButton = document.createElement('button'); closeButton.type = 'button'; closeButton.className = 'mythology-match-close';
    closeButton.textContent = 'Fermer'; closeButton.setAttribute('aria-label', 'Fermer les cartes sans choisir');
    closeButton.addEventListener('click', closeOffer);
    // L’ouverture suit uniquement une activation réussie de l’instance existante.
    component.element.addEventListener('eredita:mythology-open', () => { cancelTargeting(); widget.classList.add('is-open'); });
    component.element.addEventListener('eredita:mythology-select', event => select(stateRef, event.detail));
    // Aucun geste sur les cartes ne se propage aux commandes du plateau.
    for (const type of ['pointerdown', 'pointerup', 'click', 'dblclick', 'wheel']) widget.addEventListener(type, event => event.stopPropagation());
    widget.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape' && widget.classList.contains('is-open')) { event.preventDefault(); closeOffer(); }
    });
    inventory = document.querySelector('#mythology-stock'); inventory.hidden = false;
    const inventoryHeader = document.createElement('header'); inventoryHeader.className = 'mythology-stock-header';
    const inventoryEyebrow = document.createElement('p'); inventoryEyebrow.className = 'mythology-stock-eyebrow'; inventoryEyebrow.textContent = 'LES RENFORTS DU CRISTAL';
    const inventoryHeading = document.createElement('h2'); inventoryHeading.textContent = 'Vos légendes';
    stockCount = document.createElement('span'); stockCount.className = 'mythology-stock-count'; inventoryHeading.append(stockCount);
    inventoryHeader.append(inventoryEyebrow, inventoryHeading);
    stockHelp = document.createElement('p'); stockHelp.className = 'mythology-stock-help';
    inventoryContent = document.createElement('div');
    activationNotice = document.createElement('p'); activationNotice.className = 'mythology-activation-notice'; activationNotice.setAttribute('role', 'status');
    inventory.replaceChildren(inventoryHeader, stockHelp, inventoryContent, activationNotice);
    targetGuide = document.createElement('div'); targetGuide.className = 'mythology-target-guide'; targetGuide.hidden = true;
    const guideCopy = document.createElement('span'); guideCopy.setAttribute('role', 'status');
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Annuler';
    cancel.addEventListener('click', cancelTargeting); targetGuide.append(guideCopy, cancel);
    targetGuide.addEventListener('click', event => event.stopPropagation());
    document.querySelector('#battlefield').append(targetGuide);
    widget.append(component.element, closeButton, caption);
    const clock = document.querySelector('.board-clock');
    if (clock) widget.append(clock);
    document.querySelector('#game-screen').classList.add('has-mythology-hud');
    document.querySelector('#game-screen').append(widget);
  }
  function render(state) {
    stateRef = state;
    update(state); // Même horloge de partie ; aucun minuteur de proposition supplémentaire.
    if (!['solo', 'local', 'host', 'guest'].includes(E.Network.mode) || state.phase !== 'running') { disposeWidget(); return; }
    const current = view(state);
    if (!widget || ownerId !== player(state)) makeWidget(state, current);
    const active = current?.selections.find(item => item.offerId === activeTargetId);
    if (!active || active.status === 'activated') activeTargetId = targetInFlight = hoveredRegion = null;
    const nextId = current?.pending?.id || null;
    if (nextId !== offerId) {
      // Une confirmation referme même la DERNIÈRE paire. La tête suivante reste
      // fermée et réutilise le renderer ; seul un nouveau clic pourra la révéler.
      widget.classList.remove('is-open');
      offerId = nextId; submitted = false; resolved = !nextId && Boolean(current?.selections.length); pausedByMatch = false;
      if (current?.pending) component.setPair(...current.pending.legendIds); else component.resetReveal();
    }
    const available = Boolean(nextId);
    const count = current?.pendingCount || 0;
    if (counter.textContent !== String(count)) { counter.textContent = String(count); counter.hidden = count === 0; }
    const stage = component.element.querySelector('.mythology-crystal-stage');
    const label = count ? `Ouvrir le cristal · ${count} proposition${count > 1 ? 's' : ''} en attente` : 'Cristal inactif';
    if (stage.getAttribute('aria-label') !== label) stage.setAttribute('aria-label', label);
    widget.classList.toggle('is-available', available); widget.dataset.resolved = String(resolved);
    component.setInteractionEnabled(available && !state.paused);
    closeButton.disabled = submitted;
    if (state.paused && component.crystal.diagnostics.playing && !component.crystal.diagnostics.paused) {
      pausedByMatch = component.crystal.pause();
    } else if (!state.paused && pausedByMatch) { pausedByMatch = false; component.crystal.resume(); }
    const remaining = Math.max(0, Math.ceil((current?.nextAt || 0) - state.elapsed));
    const text = available ? count > 1 ? `${count} propositions en attente` : 'Renfort disponible' :
      current ? `Cristal inactif · prochain renfort dans ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : 'Cristal inactif';
    if (text !== lastCaption) { caption.textContent = text; lastCaption = text; }
    announceSelections(current);
    const stock = current?.selections || [];
    const countAvailable = stock.filter(item => ['awaiting-activation', 'activation-pending'].includes(item.status)).length;
    if (stockCount.textContent !== String(countAvailable)) stockCount.textContent = String(countAvailable);
    const description = activeTargetId ? E.Mythology.get(active.legendId).gameplay.displayDescription || E.Mythology.get(active.legendId).gameplay.description : 'Choisissez une légende, puis cliquez sur le terrain.';
    if (stockHelp.textContent !== description) stockHelp.textContent = description;
    const signature = JSON.stringify([ownerId, state.paused, stock, activeTargetId]);
    if (signature !== inventorySignature) {
      inventorySignature = signature;
      inventoryContent.replaceChildren(E.MythologyUI.createInventory(state, stock, arm, activeTargetId));
    }
    updateTargetHints();
  }
  const battlefield = document.querySelector('#battlefield');
  battlefield.addEventListener('click', event => {
    if (!getTargeting() || event.target.closest('#battlefield-3d, .mythology-target-guide, .view-controls, button, a')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const region = event.target.closest('[data-mythology-region], [data-village-visual], [data-map-village]');
    const lane = event.target.closest('[data-mythology-lane]');
    targetRegion(region?.dataset.player || player(stateRef), Number(region?.dataset.lane ?? lane?.dataset.mythologyLane ?? stateRef.selectedVillage.lane));
  }, true);
  battlefield.addEventListener('keydown', event => {
    const region = event.target.closest('[data-mythology-region]');
    if (getTargeting() && region && ['Enter', ' '].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) targetRegion(region.dataset.player, Number(region.dataset.lane));
    }
  }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && getTargeting()) { event.preventDefault(); cancelTargeting(); } });
  battlefield.addEventListener('contextmenu', event => { if (getTargeting()) { event.preventDefault(); cancelTargeting(); } });
  E.MythologySession = { start, update, render, receive, reset, getObtainedLegends, activate, arm, cancelTargeting, getTargeting, canTargetRegion, targetRegion, hoverRegion,
    get diagnostics() { return { privateView: stateRef ? view(stateRef) : null, offerId, ownerId, submitted, resolved,
      targeting: getTargeting(), crystal: component?.crystal.diagnostics || null }; } };
}());
