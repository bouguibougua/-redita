(function () {
  'use strict';
  const E = window.Eredita;
  const categoryLabels = { invocation: 'Invocation', enchantement: 'Enchantement', terrain: 'Terrain', vision: 'Vision' };
  function element(tag, className, text) {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function missingArt(viewport, text = 'Illustration manquante') {
    viewport.replaceChildren(element('span', 'mythology-missing', text));
  }
  function activationMessage(reason) {
    return ({ 'selection-unavailable': 'Ce renfort a déjà été utilisé.',
      'selection-not-owned': 'Ce renfort ne vous appartient pas.',
      'match-inactive': 'Reprenez la partie pour utiliser un renfort.',
      'stale-match': 'Cette sélection appartient à une autre partie.',
      'invalid-target': 'Choisissez une région valide.' })[reason] || reason || 'Activation refusée.';
  }
  function createIllustration(id, side = 'left') {
    const illustration = E.Mythology.getIllustration(id, side);
    if (!illustration) throw new TypeError(`Légende inconnue : ${id}`);
    const viewport = element('div', 'mythology-illustration');
    // Le titre, les descriptions et les icônes sont toujours hors de ce sous-arbre.
    viewport.setAttribute('aria-hidden', 'true');
    if (!illustration.image) { missingArt(viewport); return viewport; }
    const asset = illustration.image;
    const crop = asset.crop || { x: 0, y: 0, width: 1, height: 1 };
    viewport.style.aspectRatio = `${asset.width * crop.width} / ${asset.height * crop.height}`;
    viewport.style.setProperty('--mythology-art-ratio', String(asset.width * crop.width / (asset.height * crop.height)));
    const cropped = element('div', `mythology-illustration-crop${illustration.mirrored ? ' is-mirrored' : ''}`);
    const img = document.createElement('img'); img.src = asset.src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.style.width = `${100 / crop.width}%`; img.style.height = `${100 / crop.height}%`;
    img.style.left = `${-100 * crop.x / crop.width}%`; img.style.top = `${-100 * crop.y / crop.height}%`;
    img.addEventListener('error', () => missingArt(viewport, 'Illustration indisponible'), { once: true });
    cropped.append(img); viewport.append(cropped); return viewport;
  }
  function cardGeometry(side) {
    if (!['left', 'right'].includes(side)) throw new TypeError('Orientation attendue : left ou right');
    const inset = E.Config.mythology.crystal.cardOuterInset;
    const left = [[0, 0], [100, 0], [100, 100], [inset, 100]];
    return side === 'left' ? left : left.map(([x, y]) => [100 - x, y]).reverse();
  }
  function categoryIcon(category) {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('mythology-category-icon');
    const paths = {
      vision: 'M2 12 Q12 0 22 12 Q12 24 2 12 M15 12 A3 3 0 1 1 9 12 A3 3 0 1 1 15 12',
      invocation: 'M12 2 L15 9 L22 12 L15 15 L12 22 L9 15 L2 12 L9 9 Z',
      enchantement: 'M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z M12 6 L12 18 M8 10 L16 14 M8 14 L16 10',
      terrain: 'M2 20 L9 5 L13 13 L16 8 L22 20 Z M6 12 L9 14 L12 11'
    };
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', paths[category] || 'M12 4 L20 12 L12 20 L4 12 Z M12 8 L12 13 M12 16 L12 17');
    svg.append(path); return svg;
  }
  function addChoiceBorder(card, side) {
    const points = cardGeometry(side), ns = 'http://www.w3.org/2000/svg';
    card.style.clipPath = `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
    const svg = document.createElementNS(ns, 'svg'); svg.classList.add('mythology-choice-border');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    for (const kind of ['glow', 'edge', 'glint']) {
      const polygon = document.createElementNS(ns, 'polygon'); polygon.classList.add('mythology-choice-' + kind);
      polygon.setAttribute('points', points.map(point => point.join(',')).join(' '));
      polygon.setAttribute('pathLength', '100'); polygon.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(polygon);
    }
    card.append(svg);
  }
  function createCard(id, { side = 'left', variant = 'standard' } = {}) {
    const legend = E.Mythology.get(id), gameplay = E.Mythology.getGameplay(id);
    if (!legend) throw new TypeError(`Légende inconnue : ${id}`);
    const card = element('article', 'mythology-card');
    card.dataset.legendId = legend.id; card.dataset.side = side;
    card.dataset.variant = variant;
    card.style.setProperty('--mythology-primary', legend.visuals.primaryColor);
    card.style.setProperty('--mythology-secondary', legend.visuals.secondaryColor || legend.visuals.primaryColor);
    const heading = element('header', 'mythology-heading');
    const category = element('span', 'mythology-category');
    if (variant === 'choice') category.append(categoryIcon(gameplay.category));
    category.append(document.createTextNode(categoryLabels[gameplay.category] || 'Catégorie à définir'));
    heading.append(element('h3', 'mythology-name', legend.name), category);
    const description = variant === 'choice' ? gameplay.shortDescription || gameplay.description?.split(/(?<=[.!?])\s/)[0] : gameplay.displayDescription || gameplay.description;
    card.append(heading, createIllustration(id, side),
      element('p', 'mythology-power', description || 'Pouvoir non configuré.'));
    if (gameplay.parameters && variant !== 'choice') {
      const labels = {
        durationSeconds: ['Durée', ' s'], burnDurationSeconds: ['Terrain brûlé', ' s'],
        mountainDamage: ['Depuis une Montagne', ' dégâts'], productionMultiplier: ['Rendement', ' ×'],
        resurrectionWindowSeconds: ['Période de résurrection', ' s'],
        plainsResurrectionWindowSeconds: ['Depuis une Plaine', ' s']
      };
      const stats = element('dl', 'mythology-parameters');
      for (const [key, [label, unit]] of Object.entries(labels)) {
        const value = gameplay.parameters[key];
        if (typeof value !== 'number') continue;
        stats.append(element('dt', '', label), element('dd', '', `${value.toLocaleString('fr-FR')}${unit}`));
      }
      if (stats.children.length) card.append(stats);
    }
    const status = legend.implementation.status === 'implemented' ? 'Pouvoir disponible' :
      gameplay.status === 'confirmed' ? 'Pouvoir à implémenter' : 'Pouvoir à définir';
    card.append(element('p', 'mythology-status', status));
    if (variant === 'choice') {
      card.classList.add('mythology-choice'); card.setAttribute('role', 'button');
      card.tabIndex = 0; card.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-label', `${legend.name} · ${categoryLabels[gameplay.category] || 'Catégorie à définir'}`);
      addChoiceBorder(card, side);
    }
    return card;
  }
  function createPair(id, { rightId = id, variant = 'standard' } = {}) {
    const pair = element('section', 'mythology-pair');
    pair.setAttribute('aria-label', `${E.Mythology.get(id)?.name || id} à gauche, ${E.Mythology.get(rightId)?.name || rightId} à droite`);
    pair.append(createCard(id, { side: 'left', variant }), createCard(rightId, { side: 'right', variant }));
    return pair;
  }
  function createCrystalPreview({ leftId = E.Mythology.all[0].id, rightId = E.Mythology.all[1].id, mode = 'preview' } = {}) {
    const root = element('section', 'mythology-crystal-preview');
    root.dataset.mode = mode;
    const heading = element('header', 'mythology-crystal-heading');
    heading.append(element('p', 'mythology-crystal-eyebrow', mode === 'match' ? 'EREDITÀ · RENFORTS MYTHOLOGIQUES' : 'ATELIER VISUEL · EREDITÀ'),
      element('h2', '', 'Cristal des renforts'),
      element('p', '', 'Ouvrez le cristal, puis choisissez votre renfort.'));
    const selectors = element('div', 'mythology-crystal-selectors'), selects = [];
    [leftId, rightId].forEach((id, index) => {
      const label = element('label', '', index ? 'Renfort de droite' : 'Renfort de gauche');
      const select = document.createElement('select'); select.dataset.side = index ? 'right' : 'left';
      E.Mythology.all.forEach(legend => {
        const option = element('option', '', legend.name); option.value = legend.id; select.append(option);
      });
      const legend = E.Mythology.get(id);
      if (!legend) { const option = element('option', '', `Légende inconnue : ${id}`); option.value = id; select.prepend(option); }
      select.value = legend?.id || id; label.append(select); selectors.append(label); selects.push(select);
    });
    const composition = element('div', 'mythology-crystal-composition');
    const choiceTitle = element('h2', 'mythology-choice-title', 'CHOISISSEZ VOTRE RENFORT');
    choiceTitle.hidden = true;
    const stage = element('div', 'mythology-crystal-stage');
    stage.setAttribute('role', 'button'); stage.tabIndex = 0;
    stage.setAttribute('aria-label', 'Ouvrir le cristal des deux renforts');
    stage.append(element('span', 'mythology-crystal-hint', 'Ouvrir le cristal'));
    const results = element('div', 'mythology-crystal-results');
    composition.append(choiceTitle, stage, results);
    const status = element('p', 'mythology-crystal-phase', 'Préparation de l’aperçu…');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const controls = element('div', 'mythology-crystal-controls');
    const replay = element('button', '', 'Rejouer'), pause = element('button', '', 'Pause');
    replay.type = pause.type = 'button'; replay.disabled = pause.disabled = true;
    controls.append(replay, pause);
    const paletteInfo = element('div', 'mythology-crystal-palette');
    const notices = element('p', 'mythology-crystal-notices');
    root.append(heading, composition, status, selectors, controls, paletteInfo, notices);
    if (mode === 'match') { selectors.hidden = controls.hidden = paletteInfo.hidden = true; }
    let lastStatus = '', lastExposed = null, lastRun = 0, selected = null;
    let selectionLocked = false, selectionConfirmed = false, interactionEnabled = true;
    function clearChoice() {
      selected = null; selectionLocked = selectionConfirmed = false; delete root.dataset.selectedSide; delete root.dataset.selectionState;
      results.querySelectorAll('.mythology-choice').forEach(card => {
        card.classList.remove('is-selected'); card.setAttribute('aria-pressed', 'false');
      });
    }
    function renderSelection() {
      const palette = E.Mythology.getCrystalPalette(selects[0].value, selects[1].value);
      results.replaceChildren(); paletteInfo.replaceChildren();
      clearChoice();
      if (palette.left && palette.right) results.append(createPair(palette.left.id, { rightId: palette.right.id, variant: 'choice' }));
      for (const side of ['left', 'right']) {
        const color = palette[side]; if (!color) continue;
        const row = element('p', '');
        row.append(element('strong', '', color.name + ' '));
        for (const field of ['primaryColor', 'secondaryColor']) {
          if (!color[field]) continue;
          const swatch = element('span', 'mythology-crystal-swatch');
          // Valeurs validées par le catalogue : aucune couleur de remplacement.
          if (!palette.issues.some(issue => issue.side === side && issue.field === field)) swatch.style.backgroundColor = color[field];
          swatch.setAttribute('aria-hidden', 'true'); row.append(swatch, document.createTextNode(color[field] + ' '));
        }
        paletteInfo.append(row);
      }
      const messages = palette.issues.map(issue => issue.message);
      for (const side of ['left', 'right']) {
        if (palette[side] && E.Mythology.getIllustration(palette[side].id, side).missing) {
          messages.push(`Illustration manquante pour ${palette[side].name}.`);
        }
      }
      if (palette.provisional) messages.push('Palettes provisoires du catalogue, à valider.');
      if (palette.missingSecondary.length) messages.push('Couleur secondaire non renseignée (facultative) : ' +
        palette.missingSecondary.map(side => palette[side].name).join(', ') + '. Seule la couleur principale est utilisée.');
      notices.textContent = messages.join(' ');
      if (mode === 'match') notices.hidden = palette.issues.length === 0;
      root.dataset.paletteReady = String(palette.ready);
    }
    renderSelection();
    const crystal = E.MythologyCrystal.create({ host: stage, leftId: selects[0].value, rightId: selects[1].value, autoPlay: false, onState(state) {
      if (state.runId !== lastRun) { lastRun = state.runId; clearChoice(); }
      root.style.setProperty('--cards-progress', String(state.cardsProgress));
      root.style.setProperty('--cards-opacity', String(Math.min(1, state.cardsProgress * 5)));
      root.dataset.started = String(state.started);
      root.dataset.paused = String(state.paused);
      choiceTitle.hidden = state.cardsProgress <= 0;
      const exposed = state.cardsProgress >= 1;
      if (exposed !== lastExposed) { results.setAttribute('aria-hidden', String(!exposed)); results.inert = !exposed; lastExposed = exposed; }
      replay.disabled = !state.ready || (state.playing && !state.paused);
      pause.disabled = !state.ready || state.reducedMotion || !state.playing;
      pause.textContent = state.paused ? 'Reprendre' : 'Pause';
      stage.setAttribute('aria-disabled', String(!interactionEnabled || !state.ready || state.started)); stage.tabIndex = interactionEnabled && state.ready && !state.started ? 0 : -1;
      const text = state.error || (!state.palette.ready ? state.palette.issues.map(issue => issue.message).join(' ') :
        selectionLocked && selected ? (selectionConfirmed ? 'Renfort retenu : ' : 'Validation du choix : ') + E.Mythology.get(selected.legendId).name :
        state.phase === 'loading' ? 'Préparation de l’aperçu…' : !state.started ? 'Cliquez sur le cristal pour découvrir les deux renforts' :
        state.paused ? 'Animation en pause' : !state.playing ? 'Les deux renforts sont révélés' :
        state.cardsProgress >= 1 ? 'Choisissez un renfort' : state.seconds < state.cardsAppearAt ? 'Les deux énergies se rassemblent…' : 'Les cartes se déploient…');
      if (text !== lastStatus) { status.textContent = text; lastStatus = text; }
      stage.dataset.phase = state.phase;
    }});
    const activate = () => {
      if (!interactionEnabled || !crystal.activate()) return false;
      root.dispatchEvent(new CustomEvent('eredita:mythology-open', { bubbles: true }));
      return true;
    };
    const activateKey = event => {
      if (event.target === stage && ['Enter', ' '].includes(event.key)) { event.preventDefault(); if (!event.repeat) activate(); }
    };
    stage.addEventListener('click', activate); stage.addEventListener('keydown', activateKey);
    function choose(event) {
      const card = event.target.closest('.mythology-choice');
      if (!interactionEnabled || selectionLocked || !card || !results.contains(card) || crystal.diagnostics.cardsProgress < 1 || !crystal.diagnostics.ready) return;
      if (event.type === 'keydown') { if (!['Enter', ' '].includes(event.key)) return; event.preventDefault(); if (event.repeat) return; }
      if (selected?.side === card.dataset.side) return;
      clearChoice(); card.classList.add('is-selected'); card.setAttribute('aria-pressed', 'true');
      selected = Object.freeze({ legendId: card.dataset.legendId, side: card.dataset.side,
        pair: Object.freeze({ leftId: selects[0].value, rightId: selects[1].value }), runId: crystal.diagnostics.runId, preview: mode !== 'match' });
      root.dataset.selectedSide = selected.side;
      if (mode === 'match') { selectionLocked = true; root.dataset.selectionState = 'sending'; status.textContent = 'Validation du choix…'; }
      // Signal de présentation uniquement : aucun appel au moteur des pouvoirs.
      root.dispatchEvent(new CustomEvent('eredita:mythology-select', { bubbles: true, detail: selected }));
    }
    results.addEventListener('click', choose); results.addEventListener('keydown', choose);
    const resetReveal = () => { clearChoice(); crystal.setSelection(selects[0].value, selects[1].value); };
    const change = () => { renderSelection(); crystal.setSelection(selects[0].value, selects[1].value); };
    selects.forEach(select => select.addEventListener('change', change));
    replay.addEventListener('click', () => crystal.play());
    pause.addEventListener('click', () => crystal.diagnostics.paused ? crystal.resume() : crystal.pause());
    return { element: root, crystal, get selection() { return selected; },
      // La partie réarme la même instance : aucun nouveau renderer à chaque tête FIFO.
      setPair(left, right) {
        const a = E.Mythology.get(left), b = E.Mythology.get(right);
        if (!a || !b) throw new TypeError('Paire mythologique inconnue');
        selects[0].value = a.id; selects[1].value = b.id; change();
      },
      resetReveal,
      setInteractionEnabled(enabled) {
        interactionEnabled = Boolean(enabled); root.inert = !interactionEnabled;
        const ready = interactionEnabled && crystal.diagnostics.ready && !crystal.diagnostics.started;
        stage.setAttribute('aria-disabled', String(!ready)); stage.tabIndex = ready ? 0 : -1;
      },
      resolveSelection(result) {
        if (!result?.accepted) { clearChoice(); status.textContent = 'Choix refusé. Vous pouvez réessayer.'; return; }
        selectionLocked = selectionConfirmed = true; root.dataset.selectionState = 'confirmed';
        if (selected) status.textContent = 'Renfort retenu : ' + E.Mythology.get(selected.legendId).name;
      },
      dispose() {
      crystal.dispose(); selects.forEach(select => select.removeEventListener('change', change));
      stage.removeEventListener('click', activate); stage.removeEventListener('keydown', activateKey);
      results.removeEventListener('click', choose); results.removeEventListener('keydown', choose);
    } };
  }
  function attachIllustrationMotion(viewport, legend, { motion, flash }) {
    const asset = legend.visuals.motion;
    if (!asset) return null;
    const video = element('video', 'mythology-codex-video');
    video.muted = video.defaultMuted = true; video.loop = true; video.playsInline = true;
    video.setAttribute('muted', ''); video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true');
    video.preload = 'none'; video.disablePictureInPicture = true;
    viewport.querySelector('.mythology-illustration-crop').append(video);
    let disposed = false, wanted = false, storyVisible = false, active = false, inView = true, pending = false;
    function reveal() {
      if (disposed || !wanted || !storyVisible || !inView || document.hidden || motion.matches || video.readyState < 2 || video.seeking || video.paused) return;
      if (!active) { flash(); active = true; viewport.classList.add('has-motion'); }
    }
    function start() {
      if (disposed || !wanted || !inView || document.hidden || motion.matches) return;
      // Aucun téléchargement de vidéo avant le clic sur le cristal de cette fiche.
      if (!video.hasAttribute('src')) video.src = asset.src;
      if (pending || !video.paused) { reveal(); return; }
      pending = true;
      video.play().then(() => { pending = false; reveal(); }).catch(() => {
        pending = false;
        // Une lecture refusée ou interrompue laisse l’illustration originale visible.
        if (!disposed && video.paused) { active = false; viewport.classList.remove('has-motion'); }
      });
    }
    function syncVisibility() {
      if (disposed) return;
      if (motion.matches) { active = false; viewport.classList.remove('has-motion'); }
      if (!wanted || !inView || document.hidden || motion.matches) video.pause(); else start();
    }
    function failed() { active = false; viewport.classList.remove('has-motion'); video.pause(); }
    video.addEventListener('playing', reveal); video.addEventListener('loadeddata', reveal); video.addEventListener('seeked', reveal);
    video.addEventListener('error', failed);
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting; syncVisibility();
    }) : null;
    observer?.observe(viewport);
    document.addEventListener('visibilitychange', syncVisibility); motion.addEventListener('change', syncVisibility);
    return {
      prepare(show) {
        wanted = show;
        if (show) { if (video.readyState > 0) video.currentTime = 0; start(); }
        else if (!active) video.pause();
      },
      setStory(show) {
        wanted = storyVisible = show;
        if (show) { start(); reveal(); }
        else { flash(); active = false; viewport.classList.remove('has-motion'); video.pause(); }
      },
      dispose() {
        if (disposed) return;
        disposed = true; wanted = false; video.pause(); observer?.disconnect();
        document.removeEventListener('visibilitychange', syncVisibility); motion.removeEventListener('change', syncVisibility);
        video.removeAttribute('src'); video.load(); video.remove();
      }
    };
  }
  function mountCollection(host) {
    const codex = element('section', 'mythology-codex');
    codex.setAttribute('aria-label', 'Le grimoire des légendes de Corse');
    const intro = element('div', 'mythology-codex-intro');
    intro.append(element('p', '', 'Seize présences. Une île. Des pouvoirs à découvrir.'),
      element('span', 'mythology-codex-seal', 'XVI · LÉGENDES'));
    const feature = element('section', 'mythology-codex-feature');
    feature.setAttribute('aria-label', 'Présentation de la légende');
    const navigation = element('div', 'mythology-codex-navigation');
    const sectionTitle = element('p', 'mythology-codex-label', 'EXPLORER LE GRIMOIRE');
    const filters = element('div', 'mythology-codex-filters');
    filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Filtrer les légendes par catégorie');
    const collection = element('section', 'mythology-collection');
    collection.setAttribute('aria-label', 'Les seize légendes de Corse');
    const entries = new Map();
    const timings = E.Config.mythology.codex;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const crystalButton = element('button', 'mythology-codex-crystal'); crystalButton.type = 'button';
    const stage = element('span', 'mythology-codex-crystal-stage'); stage.setAttribute('aria-hidden', 'true');
    stage.append(element('span', 'mythology-codex-crystal-fallback'));
    const crystalLabel = element('span', 'mythology-codex-crystal-label');
    crystalButton.append(stage, crystalLabel);
    crystalButton.setAttribute('aria-controls', 'mythology-codex-copy');
    const announcement = element('p', 'mythology-codex-announcement'); announcement.setAttribute('aria-live', 'polite');
    let crystal, currentCard, currentCopy, currentArt, headingTemplate, parametersTemplate, illustrationMotion = null, flashLayer;
    let disposed = false, turning = false, view = 'power', transitionId = 0;
    const timers = new Set(), animations = new Set();
    let selectedId = null, filter = 'all';
    function later(callback, delay) {
      const timer = setTimeout(() => { timers.delete(timer); if (!disposed) callback(); }, delay);
      timers.add(timer);
    }
    function animate(node, frames, options) {
      const animation = node.animate?.(frames, options);
      if (!animation) return;
      animations.add(animation);
      animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
      return animation;
    }
    function cancelTransition() {
      transitionId++;
      timers.forEach(clearTimeout); timers.clear();
      animations.forEach(animation => animation.cancel()); animations.clear();
      currentCopy?.getAnimations?.().forEach(animation => animation.cancel());
      turning = false; crystalButton.setAttribute('aria-disabled', 'false');
    }
    function flashIllustration() {
      if (disposed || motion.matches || !flashLayer) return;
      flashLayer.getAnimations?.().forEach(animation => animation.cancel());
      animate(flashLayer, [{ opacity: 0 }, { opacity: timings.flashOpacity, offset: .2 }, { opacity: 0 }],
        { duration: timings.flashDuration, easing: 'ease-out' });
    }
    function createCopy() {
      const legend = E.Mythology.get(selectedId), gameplay = E.Mythology.getGameplay(selectedId);
      const copy = element('div', 'mythology-codex-copy'); copy.id = 'mythology-codex-copy';
      const heading = headingTemplate.cloneNode(true);
      heading.prepend(element('p', 'mythology-codex-mode', view === 'story' ? 'RÉCIT DE CORSE' : 'POUVOIR EN JEU'));
      const description = element('div', 'mythology-power mythology-codex-description' + (view === 'story' ? ' mythology-codex-story' : ''));
      if (view === 'story') {
        description.setAttribute('role', 'region'); description.setAttribute('aria-label', 'Histoire de ' + legend.name); description.tabIndex = 0;
        description.append(element('p', 'mythology-codex-story-title', legend.lore.subtitle));
      }
      for (const paragraph of view === 'story' ? legend.lore.paragraphs : gameplay.menuDescription) description.append(element('p', '', paragraph));
      copy.append(heading, description);
      if (view === 'story') copy.append(element('p', 'mythology-codex-read-hint', 'Faites défiler pour poursuivre le récit ↓'));
      if (view === 'power' && parametersTemplate) copy.append(parametersTemplate.cloneNode(true));
      return copy;
    }
    function updateControl() {
      const name = E.Mythology.get(selectedId).name;
      currentCard.dataset.view = feature.dataset.view = view;
      crystalButton.setAttribute('aria-pressed', String(view === 'story'));
      crystalButton.setAttribute('aria-label', view === 'story' ? 'Revoir le pouvoir de ' + name : 'Lire l’histoire de ' + name);
      crystalLabel.textContent = view === 'story' ? 'SON POUVOIR' : 'SON HISTOIRE';
    }
    function toggleView() {
      if (disposed || turning) return;
      const token = ++transitionId;
      turning = true; crystalButton.setAttribute('aria-disabled', 'true');
      illustrationMotion?.prepare(view === 'power');
      crystal?.play();
      const reduced = motion.matches;
      if (!reduced) animate(currentCopy, [{ opacity: 1 }, { opacity: 0 }], { duration: timings.textDuration, fill: 'forwards' });
      const swap = () => {
        const before = currentArt.getBoundingClientRect();
        view = view === 'power' ? 'story' : 'power'; updateControl();
        currentCopy.getAnimations?.().forEach(animation => animation.cancel());
        const replacement = createCopy(); currentCopy.replaceWith(replacement); currentCopy = replacement;
        if (illustrationMotion) illustrationMotion.setStory(view === 'story'); else flashIllustration();
        const after = currentArt.getBoundingClientRect();
        if (!reduced) {
          const slide = animate(currentArt, [{ transform: `translate(${before.x - after.x}px, ${before.y - after.y}px)` }, { transform: 'none' }],
            { duration: timings.slideDuration, easing: 'cubic-bezier(.22,1,.36,1)' });
          const text = animate(currentCopy, [{ opacity: 0, transform: `translateX(${view === 'story' ? 18 : -18}px)` }, { opacity: 1, transform: 'none' }],
            { duration: timings.slideDuration - timings.textDuration, delay: timings.textDuration, fill: 'backwards', easing: 'ease-out' });
          // Attendre la fin réelle des images animées, même si le navigateur ralentit.
          Promise.all([slide?.finished, text?.finished]).then(finish, () => {});
        }
        announcement.textContent = (view === 'story' ? 'Histoire de ' : 'Pouvoir en jeu de ') + E.Mythology.get(selectedId).name;
      };
      const finish = () => { if (disposed || transitionId !== token) return; turning = false; crystalButton.setAttribute('aria-disabled', 'false'); };
      if (reduced) { swap(); finish(); } else later(swap, timings.swapAt);
    }
    crystalButton.addEventListener('click', toggleView);
    crystalButton.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') crystal?.setHovered(true); });
    crystalButton.addEventListener('pointerleave', () => crystal?.setHovered(crystalButton.matches(':focus-visible')));
    crystalButton.addEventListener('focus', () => crystal?.setHovered(crystalButton.matches(':focus-visible') || crystalButton.matches(':hover')));
    crystalButton.addEventListener('blur', () => crystal?.setHovered(crystalButton.matches(':hover')));
    function select(id, { sound = false } = {}) {
      // Un clic sur la fiche déjà ouverte tourne aussi une page ; montage et filtres restent silencieux.
      if (sound) E.Audio?.playEffect('pageAdd');
      if (id === selectedId) return;
      illustrationMotion?.dispose(); illustrationMotion = null;
      cancelTransition(); view = 'power';
      selectedId = id;
      const legend = E.Mythology.get(id), card = createCard(id);
      currentCard = card;
      card.classList.add('mythology-codex-portrait');
      card.querySelector('.mythology-category').prepend(categoryIcon(legend.gameplay.category));
      card.querySelector('img')?.setAttribute('loading', 'eager');
      const index = element('p', 'mythology-codex-index', 'LÉGENDE ' + String(E.Mythology.all.findIndex(item => item.id === id) + 1).padStart(2, '0') + ' / 16');
      card.querySelector('.mythology-heading').prepend(index);
      headingTemplate = card.querySelector('.mythology-heading'); parametersTemplate = card.querySelector('.mythology-parameters');
      currentArt = card.querySelector('.mythology-illustration'); currentCopy = createCopy();
      flashLayer = element('span', 'mythology-codex-media-flash'); flashLayer.setAttribute('aria-hidden', 'true'); currentArt.append(flashLayer);
      illustrationMotion = attachIllustrationMotion(currentArt, legend, { motion, flash: flashIllustration });
      updateControl(); card.replaceChildren(currentCopy, currentArt, crystalButton);
      feature.style.setProperty('--mythology-primary', legend.visuals.primaryColor);
      feature.replaceChildren(card);
      crystal?.setSelection(id, id); crystal?.setHovered(false);
      for (const [entryId, entry] of entries) entry.setAttribute('aria-pressed', String(entryId === id));
    }
    E.Mythology.all.forEach(legend => {
      const card = createCard(legend.id);
      card.classList.add('mythology-roster-card');
      card.setAttribute('role', 'button'); card.tabIndex = 0;
      card.setAttribute('aria-label', legend.name + ' · ' + categoryLabels[legend.gameplay.category]);
      card.setAttribute('aria-pressed', 'false');
      entries.set(legend.id, card); collection.append(card);
    });
    for (const category of ['all', ...E.Mythology.categories]) {
      const button = element('button', '', category === 'all' ? 'Toutes' : categoryLabels[category]);
      button.type = 'button'; button.dataset.mythologyFilter = category;
      button.setAttribute('aria-pressed', String(category === 'all'));
      if (category !== 'all') button.prepend(categoryIcon(category));
      button.addEventListener('click', () => {
        filter = category;
        for (const [id, card] of entries) card.hidden = filter !== 'all' && E.Mythology.get(id).gameplay.category !== filter;
        filters.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        if (entries.get(selectedId).hidden) select([...entries].find(([, card]) => !card.hidden)[0]);
      });
      filters.append(button);
    }
    collection.addEventListener('click', event => {
      const card = event.target.closest('.mythology-roster-card');
      if (card) {
        select(card.dataset.legendId, { sound: true });
        if (window.matchMedia('(max-width: 700px)').matches) feature.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
    });
    collection.addEventListener('keydown', event => {
      const card = event.target.closest('.mythology-roster-card');
      if (!card) return;
      if (['Enter', ' '].includes(event.key)) { event.preventDefault(); select(card.dataset.legendId, { sound: true }); }
      const visible = [...entries.values()].filter(item => !item.hidden);
      const at = visible.indexOf(card);
      const next = event.key === 'ArrowRight' ? (at + 1) % visible.length : event.key === 'ArrowLeft' ? (at - 1 + visible.length) % visible.length :
        event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : null;
      if (next !== null) { event.preventDefault(); visible[next].focus({ preventScroll: true }); select(visible[next].dataset.legendId, { sound: true }); }
    });
    navigation.append(sectionTitle, filters);
    const footnote = element('p', 'mythology-codex-footnote', 'En partie, le cristal vous propose deux légendes. À vous de choisir celle qui changera le cours du combat.');
    codex.append(intro, feature, navigation, collection, footnote, announcement);
    host.replaceChildren(codex); select(E.Mythology.all[0].id);
    crystal = E.MythologyCrystal.create({ host: stage, leftId: selectedId, rightId: selectedId, autoPlay: false, presentation: 'codex',
      onState: state => {
        stage.dataset.ready = String(state.ready); stage.dataset.phase = state.phase; stage.dataset.run = String(state.runId);
        stage.dataset.color = state.palette.left?.primaryColor || '';
        stage.dataset.magic = String(state.magicVisible); stage.dataset.lightning = String(state.lightningVisible);
      } });
    return { dispose() { if (disposed) return; disposed = true; cancelTransition(); illustrationMotion?.dispose(); crystal.dispose(); codex.remove(); } };
  }
  function createInventory(state, selections, onSelect, selectedOfferId = null) {
    const list = element('div', 'mythology-inventory-list');
    const available = selections.filter(selection => selection.status !== 'activated');
    if (!available.length) {
      const empty = element('div', 'mythology-stock-empty');
      empty.append(categoryIcon('invocation'), element('strong', '', 'Le destin vous attend'),
        element('p', '', 'Les légendes choisies au cristal apparaîtront ici.'));
      list.append(empty);
    }
    for (const selection of available) {
      const legend = E.Mythology.get(selection.legendId);
      const row = element('button', 'mythology-stock-legend'); row.type = 'button';
      row.dataset.offerId = selection.offerId; row.dataset.legendId = legend.id;
      row.style.setProperty('--mythology-primary', legend.visuals.primaryColor);
      const pending = selection.status === 'activation-pending';
      const label = legend.name + ' · ' + (legend.gameplay.displayDescription || legend.gameplay.description);
      row.title = label; row.setAttribute('aria-label', label);
      row.setAttribute('aria-pressed', String(selectedOfferId === selection.offerId));
      row.disabled = state.paused || !['awaiting-activation', 'activation-pending'].includes(selection.status);
      row.classList.toggle('is-pending', pending);
      row.setAttribute('aria-busy', String(pending));
      const frame = element('span', 'mythology-stock-frame');
      frame.append(createIllustration(legend.id, 'left'));
      const category = element('span', 'mythology-stock-category', categoryLabels[legend.gameplay.category]);
      category.prepend(categoryIcon(legend.gameplay.category));
      row.append(frame, element('span', 'mythology-stock-name', legend.name), category);
      if (pending) row.append(element('span', 'mythology-stock-status', 'Validation…'));
      row.addEventListener('click', () => onSelect(selection.offerId));
      list.append(row);
    }
    return list;
  }
  let activePreview = null;
  function openCrystalPreview(options = {}) {
    activePreview?.close();
    const dialog = element('dialog', 'mythology-crystal-dialog');
    dialog.setAttribute('aria-label', 'Aperçu du cristal des renforts');
    const closeButton = element('button', 'mythology-crystal-close', 'Fermer'); closeButton.type = 'button';
    const preview = createCrystalPreview(options);
    dialog.append(closeButton, preview.element); document.body.append(dialog);
    let cleaned = false;
    function close() { if (dialog.open) dialog.close(); cleanup(); }
    function cleanup() {
      if (cleaned) return; cleaned = true;
      preview.dispose(); dialog.remove();
      if (activePreview?.dialog === dialog) { activePreview = null; E.MenuScene?.refreshVisibility(); }
    }
    closeButton.addEventListener('click', close); dialog.addEventListener('close', cleanup, { once: true });
    activePreview = { dialog, element: preview.element, crystal: preview.crystal, get selection() { return preview.selection; }, close };
    dialog.showModal(); E.MenuScene?.setVisible(false); closeButton.focus();
    return activePreview;
  }
  E.MythologyUI = Object.freeze({ createCard, createPair, createIllustration, cardGeometry, createCrystalPreview, openCrystalPreview, mountCollection, createInventory, activationMessage,
    get crystalPreview() { return activePreview; } });
  // Montage uniquement sur demande explicite, sans changer le menu ni les routes de jeu.
  if (typeof document !== 'undefined' && typeof location !== 'undefined') {
    const query = new URLSearchParams(location.search);
    if (query.get('crystal') === 'preview') {
      const open = () => openCrystalPreview({ leftId: query.get('left') || undefined, rightId: query.get('right') || undefined });
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', open, { once: true }); else open();
    }
  }
}());
