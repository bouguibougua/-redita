(function () {
  'use strict';
  const E = window.Eredita;
  const categories = ['invocation', 'enchantement', 'terrain', 'vision'];
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  const configRef = path => ({ configRef: path });
  // Sources existantes : cartes complètes. Ce cadrage exclut titre, texte et icône.
  // Les variantes inversées restent null tant qu’aucun fichier réel n’est fourni.
  function cardArt(cardId, width, height) {
    return { src: E.Cards.get(cardId).image, kind: 'full-card', width, height,
      crop: { x: 0.06, y: 0.13, width: 0.88, height: 0.46 } };
  }
  function entry(id, name, { aliases = [], normal = null, reversed = null, primary = '#b5965c', secondary = null,
    category = null, description = null, parameters = null, sections = [],
    powerStatus = 'unconfigured', implemented = false, effectKey = null } = {}) {
    return {
      id, name, aliases,
      visuals: { normal, reversed, primaryColor: primary, secondaryColor: secondary,
        paletteStatus: 'provisional' },
      gameplay: { status: powerStatus, category,
        categoryStatus: category ? 'classified' : 'unconfigured',
        description, parameters, source: sections.length ? { document: 'GAME_DESIGN.md', sections } : null },
      implementation: { status: implemented ? 'existing' : 'not-implemented',
        effectKey, cardId: implemented ? id : null }
    };
  }

  const entries = [
    entry('u-mazzeru', 'U Mazzeru', {
      normal: cardArt('u-mazzeru', 176, 241), primary: '#789cc1', secondary: '#d4c19b',
      category: 'vision', powerStatus: 'confirmed', implemented: true, effectKey: 'reveal-people', sections: [66],
      description: 'Révèle temporairement le nombre et les rôles des habitants dans toutes les colonnes adverses.',
      parameters: { durationSeconds: configRef('cardGame.effectDuration'), target: 'all-enemy-columns',
        reveals: ['resident-count', 'resident-roles'] }
    }),
    entry('a-stregha', 'A Stregha', {
      normal: cardArt('a-stregha', 178, 241), primary: '#9aaf73', secondary: '#b5965c',
      category: 'enchantement', powerStatus: 'confirmed', implemented: true, effectKey: 'curse-production', sections: [67],
      description: 'Maudit une région adverse et divise sa production et son rendement par deux.',
      parameters: { durationSeconds: configRef('cardGame.effectDuration'), productionMultiplier: 0.5,
        target: 'one-enemy-region' }
    }),
    entry('u-stregu', 'U Stregu'),
    entry('a-fata', 'A Fata'),
    entry('anima-in-pena', 'Anima in Pena'),
    entry('l-orcu', "L'Orcu"),
    entry('u-magu', 'U Magu'),
    entry('u-surpatore', 'U Surpatore'),
    entry('u-lupu-mannaru', 'U Lupu Mannaru'),
    // Identifiant conservé pour les decks et commandes actuels ; nouveau nom demandé.
    entry('u-diavulu', 'U Diavule', {
      aliases: ['u-diavule', 'U Diavulu'],
      normal: cardArt('u-diavulu', 172, 241), primary: '#df6537', secondary: '#dbaf5c',
      category: 'terrain', powerStatus: 'confirmed', implemented: true, effectKey: 'burn-column', sections: [68, 69, 70, 71],
      description: 'Détruit les habitants, cultures et élevages des deux territoires d’une colonne, puis brûle les terrains. Depuis une Montagne, inflige aussi des dégâts au village et aux bâtiments adverses. Le village de départ doit être vivant.',
      parameters: { burnDurationSeconds: configRef('cardGame.effectDuration'),
        mountainDamage: configRef('cardGame.diavuluMountainDamage'),
        target: 'both-regions-of-column', requiresLivingSourceVillage: true,
        forbidsPlacementWhileBurned: true, destroys: ['residents', 'crops', 'livestock'] }
    }),
    entry('a-stregha-bianca', 'A Stregha Bianca'),
    entry('squadra-arozza', "A Squadra d'Arozza", {
      aliases: ['a-squadra-d-arozza'],
      normal: cardArt('squadra-arozza', 195, 241), primary: '#8ba2bd', secondary: '#d1ab6b',
      category: 'invocation', powerStatus: 'confirmed', implemented: true, effectKey: 'resurrect-residents', sections: [72],
      description: 'Ressuscite les habitants alliés morts récemment. Depuis une Plaine, la période est étendue. Si le village d’origine est détruit, le retour se fait dans le village allié vivant le plus proche, en respectant la capacité de population et la file d’attente existante.',
      parameters: { resurrectionWindowSeconds: configRef('cardGame.resurrectionWindow'),
        plainsResurrectionWindowSeconds: configRef('cardGame.plainsResurrectionWindow'),
        target: 'allied-casualties', destroyedOrigin: 'nearest-living-allied-village',
        unavailableDestination: 'existing-resurrection-queue', respectsPopulationCap: true,
        preserves: ['profession', 'tool', 'armor'], restoresDonkey: false,
        // TEMP_BALANCE_VALUE — politique déjà utilisée, documentée en section 72.
        tieBreak: { value: 'lowest-lane-index', status: 'existing-temporary-rule' } }
    }),
    entry('a-mumma', 'A Mumma'),
    entry('i-lacrimenti', 'I Lacrimenti'),
    entry('u-fullettu', 'U Fullettu'),
    entry('oeil-sainte-lucie', 'Ochju di Santa Lucia', {
      aliases: ['ochju-di-santa-lucia', 'Œil de Sainte-Lucie'],
      normal: cardArt('oeil-sainte-lucie', 179, 241), primary: '#59aebc', secondary: '#d7bb82',
      category: 'vision', powerStatus: 'confirmed', implemented: true, effectKey: 'reveal-coasts', sections: [73],
      description: 'Révèle entièrement les biomes Littoraux adverses jusqu’à la fin de la partie. Utilisable uniquement depuis un Littoral.',
      parameters: { until: 'match-end', sourceBiome: 'littoral', target: 'all-enemy-coastal-regions' }
    })
  ];
  E.Config.mythology = freeze({ schemaVersion: 1, categories, entries,
    // TEMP_BALANCE_VALUE — animation d’aperçu uniquement, sans activation des pouvoirs.
    crystal: { duration: 4.4, splitAt: 1.4, splitDuration: 1.2, revealAt: 2.5, revealDuration: 1.1,
      maxPixelRatio: 1.5, desktopFps: 60, mobileFps: 30, mobileBreakpoint: 600, particleCount: 48 }
  });

  function normalize(value) {
    return String(value).trim().toLowerCase().replace(/œ/g, 'oe').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  const byId = new Map();
  for (const legend of entries) for (const key of [legend.id, legend.name, ...legend.aliases]) {
    const normalized = normalize(key);
    if (byId.has(normalized) && byId.get(normalized) !== legend) throw new Error(`Alias mythologique ambigu : ${key}`);
    byId.set(normalized, legend);
  }
  function get(id) { return typeof id === 'string' ? byId.get(normalize(id)) || null : null; }
  function resolve(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Object.hasOwn(value, 'configRef')) {
      let result = E.Config;
      for (const key of value.configRef.split('.')) {
        if (!result || !Object.hasOwn(result, key)) return null;
        result = result[key];
      }
      return result === undefined ? null : resolve(result);
    }
    return Array.isArray(value) ? value.map(resolve) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item)]));
  }
  function getGameplay(id) {
    const legend = get(id);
    return legend ? freeze({ ...legend.gameplay, parameters: resolve(legend.gameplay.parameters) }) : null;
  }
  function resolveIllustration(visuals, side = 'left') {
    if (!['left', 'right'].includes(side)) throw new TypeError('Orientation attendue : left ou right');
    const { normal, reversed } = visuals;
    const image = side === 'right' && reversed ? reversed : normal;
    return Object.freeze({ image, mirrored: Boolean(side === 'right' && !reversed && normal),
      missing: !image, side, source: image ? side === 'right' && reversed ? 'reversed' : 'normal' : null });
  }
  function getIllustration(id, side = 'left') {
    const legend = get(id);
    return legend ? resolveIllustration(legend.visuals, side) : null;
  }
  function report() {
    return freeze({ total: entries.length,
      missingNormal: entries.filter(item => !item.visuals.normal).map(item => item.id),
      missingReversed: entries.filter(item => !item.visuals.reversed).map(item => item.id),
      cssMirrorFallback: entries.filter(item => item.visuals.normal && !item.visuals.reversed).map(item => item.id),
      unconfiguredPowers: entries.filter(item => item.gameplay.status === 'unconfigured').map(item => item.id) });
  }
  function resolveCrystalPalette(left, right) {
    const issues = [], missingSecondary = [];
    const sides = [left, right].map((legend, index) => {
      const side = index ? 'right' : 'left';
      if (!legend) {
        issues.push({ side, field: 'legend', reason: 'missing', message: `Renfort de ${index ? 'droite' : 'gauche'} introuvable.` });
        return null;
      }
      const colors = {};
      for (const field of ['primaryColor', 'secondaryColor']) {
        const value = legend.visuals?.[field];
        const absent = value === null || value === undefined || value === '';
        colors[field] = absent ? null : value;
        if (absent && field === 'secondaryColor') { missingSecondary.push(side); continue; }
        if (absent || typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
          issues.push({ side, legendId: legend.id, field, reason: absent ? 'missing' : 'invalid',
            message: `Couleur ${field === 'primaryColor' ? 'principale' : 'secondaire'} ${absent ? 'absente' : 'invalide'} pour ${legend.name}.` });
        }
      }
      return { id: legend.id, name: legend.name, ...colors, paletteStatus: legend.visuals?.paletteStatus || 'unconfirmed' };
    });
    return freeze({ left: sides[0], right: sides[1], ready: issues.length === 0, issues, missingSecondary,
      provisional: sides.some(side => side && side.paletteStatus !== 'confirmed') });
  }
  function getCrystalPalette(leftId, rightId) { return resolveCrystalPalette(get(leftId), get(rightId)); }
  E.Mythology = Object.freeze({ all: entries, categories, get, getGameplay, getIllustration, resolveIllustration,
    getCrystalPalette, resolveCrystalPalette, report });
}());
