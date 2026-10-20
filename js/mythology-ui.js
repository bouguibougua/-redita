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
    const cropped = element('div', `mythology-illustration-crop${illustration.mirrored ? ' is-mirrored' : ''}`);
    const img = document.createElement('img'); img.src = asset.src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.style.width = `${100 / crop.width}%`; img.style.height = `${100 / crop.height}%`;
    img.style.left = `${-100 * crop.x / crop.width}%`; img.style.top = `${-100 * crop.y / crop.height}%`;
    img.addEventListener('error', () => missingArt(viewport, 'Illustration indisponible'), { once: true });
    cropped.append(img); viewport.append(cropped); return viewport;
  }
  function createCard(id, { side = 'left' } = {}) {
    const legend = E.Mythology.get(id), gameplay = E.Mythology.getGameplay(id);
    if (!legend) throw new TypeError(`Légende inconnue : ${id}`);
    const card = element('article', 'mythology-card');
    card.dataset.legendId = legend.id; card.dataset.side = side;
    card.style.setProperty('--mythology-primary', legend.visuals.primaryColor);
    card.style.setProperty('--mythology-secondary', legend.visuals.secondaryColor || legend.visuals.primaryColor);
    const heading = element('header', 'mythology-heading');
    heading.append(element('h3', 'mythology-name', legend.name),
      element('span', 'mythology-category', categoryLabels[gameplay.category] || 'Catégorie à définir'));
    card.append(heading, createIllustration(id, side),
      element('p', 'mythology-power', gameplay.description || 'Pouvoir non configuré.'));
    if (gameplay.parameters) {
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
    const status = legend.implementation.status === 'existing' ? 'Pouvoir existant' :
      gameplay.status === 'confirmed' ? 'Pouvoir à implémenter' : 'Pouvoir à définir';
    card.append(element('p', 'mythology-status', status));
    return card;
  }
  function createPair(id, { rightId = id } = {}) {
    const pair = element('section', 'mythology-pair');
    pair.setAttribute('aria-label', `${E.Mythology.get(id)?.name || id} à gauche, ${E.Mythology.get(rightId)?.name || rightId} à droite`);
    pair.append(createCard(id, { side: 'left' }), createCard(rightId, { side: 'right' }));
    return pair;
  }
  function createCrystalPreview({ leftId = E.Mythology.all[0].id, rightId = E.Mythology.all[1].id } = {}) {
    const root = element('section', 'mythology-crystal-preview');
    const heading = element('header', 'mythology-crystal-heading');
    heading.append(element('p', 'mythology-crystal-eyebrow', 'ATELIER VISUEL · EREDITÀ'),
      element('h2', '', 'Cristal des renforts'),
      element('p', '', 'Deux légendes, une rencontre. Aperçu sans activation des pouvoirs.'));
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
    const stage = element('div', 'mythology-crystal-stage');
    stage.setAttribute('role', 'img'); stage.setAttribute('aria-label', 'Cristal facetté aux couleurs des deux renforts');
    const results = element('div', 'mythology-crystal-results');
    composition.append(stage, results);
    const status = element('p', 'mythology-crystal-phase', 'Préparation de l’aperçu…');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const controls = element('div', 'mythology-crystal-controls');
    const replay = element('button', '', 'Rejouer'), pause = element('button', '', 'Pause');
    replay.type = pause.type = 'button'; replay.disabled = pause.disabled = true;
    controls.append(replay, pause);
    const paletteInfo = element('div', 'mythology-crystal-palette');
    const notices = element('p', 'mythology-crystal-notices');
    root.append(heading, selectors, composition, status, controls, paletteInfo, notices);
    let lastStatus = '', lastExposed = null;
    function renderSelection() {
      const palette = E.Mythology.getCrystalPalette(selects[0].value, selects[1].value);
      results.replaceChildren(); paletteInfo.replaceChildren();
      if (palette.left && palette.right) results.append(createPair(palette.left.id, { rightId: palette.right.id }));
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
      if (palette.provisional) messages.push('Palettes provisoires du catalogue, à valider.');
      if (palette.missingSecondary.length) messages.push('Couleur secondaire non renseignée (facultative) : ' +
        palette.missingSecondary.map(side => palette[side].name).join(', ') + '. Seule la couleur principale est utilisée.');
      notices.textContent = messages.join(' ');
      root.dataset.paletteReady = String(palette.ready);
    }
    renderSelection();
    const crystal = E.MythologyCrystal.create({ host: stage, leftId: selects[0].value, rightId: selects[1].value, onState(state) {
      root.style.setProperty('--crystal-reveal', String(state.reveal));
      const exposed = state.reveal >= .99;
      if (exposed !== lastExposed) { results.setAttribute('aria-hidden', String(!exposed)); results.inert = !exposed; lastExposed = exposed; }
      replay.disabled = !state.ready;
      pause.disabled = !state.ready || state.reducedMotion || !state.playing;
      pause.textContent = state.paused ? 'Reprendre' : 'Pause';
      const text = state.error || (!state.palette.ready ? state.palette.issues.map(issue => issue.message).join(' ') :
        state.phase === 'loading' ? 'Préparation de l’aperçu…' : state.reducedMotion ? 'Aperçu fixe · mouvement réduit activé' :
        state.paused ? 'Animation en pause' : !state.playing ? 'Les deux renforts sont révélés' :
        state.phase === 'charging' ? 'Les deux énergies se rassemblent…' : state.phase === 'opening' ? 'Le cristal s’ouvre…' : 'Les légendes se révèlent…');
      if (text !== lastStatus) { status.textContent = text; lastStatus = text; }
      stage.dataset.phase = state.phase;
    }});
    const change = () => { renderSelection(); crystal.setSelection(selects[0].value, selects[1].value); };
    selects.forEach(select => select.addEventListener('change', change));
    replay.addEventListener('click', () => crystal.play());
    pause.addEventListener('click', () => crystal.diagnostics.paused ? crystal.resume() : crystal.pause());
    return { element: root, crystal, dispose() { crystal.dispose(); selects.forEach(select => select.removeEventListener('change', change)); } };
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
    activePreview = { dialog, crystal: preview.crystal, close };
    dialog.showModal(); E.MenuScene?.setVisible(false); closeButton.focus();
    return activePreview;
  }
  E.MythologyUI = Object.freeze({ createCard, createPair, createIllustration, createCrystalPreview, openCrystalPreview,
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
