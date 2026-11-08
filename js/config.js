(function () {
  "use strict";

  window.Eredita = window.Eredita || {};

  // Toutes les valeurs marquées TEMP_BALANCE_VALUE sont indispensables à ce
  // prototype, mais ne constituent pas une règle validée du Game Design.
  window.Eredita.Config = {
    normalDuration: 750,
    defaultFormat: "simplified",
    formats: {
      simplified: { label: "2 camps", regions: 2, exchanges: 1 },
      classic: { label: "4 camps", regions: 4, exchanges: 2 }
    },
    // TEMP_BALANCE_VALUE — dimensions visuelles du plateau, sans effet sur les distances logiques.
    board: { laneSpacing: 3, simplifiedWidthScale: 1.15, baseMargin: 1.3, rimMargin: 1.65 },
    // Présentation 3D uniquement : aucune incidence sur les règles ou les déplacements.
    terrainModels: {
      plaine: { src: "assets/models/plaine.glb?v=1" },
      montagne: { src: "assets/models/montagne.glb?v=1" },
      littoral_rouge: { src: "assets/models/littoral_rouge.glb?v=1" },
      littoral_bleu: { src: "assets/models/littoral_bleu.glb?v=1" }
    },
    // Chantier Tripo commun aux bâtiments absents ; pictogrammes ajoutés en relief.
    constructionSiteModel: { src: "assets/models/chantier-construction.glb?v=1-286e17f2fedb", emblemPosition: [0,.31,-.08], emblemScale: .8 },
    // Présentation du village : ni PV supplémentaires ni collision avec les remparts.
    villageModels: {
      artisanat_t3: { src: "assets/models/artisanat_t3.glb?v=1-6db2efa35ccb" },
      bergerie_t3: { src: "assets/models/bergerie_t3.glb?v=1-b8d909322158" },
      boucherie_t3: { src: "assets/models/boucherie_t3.glb?v=1-e6f0fb979284" },
      feu_camp_t3: { src: "assets/models/feu_camp_t3.glb?v=1-7614ce301e52" },
      hotel_t3: { src: "assets/models/hotel_t3.glb?v=1-82fc4080ecfc" },
      artisanat_t2: { src: "assets/models/artisanat_t2.glb?v=1-cb1bbaa448ab" },
      bergerie_t2: { src: "assets/models/bergerie_t2.glb?v=1-7d4534501c59" },
      feu_camp_t2: { src: "assets/models/feu_camp_t2.glb?v=1-ae5418cd279f" },
      hotel_t2: { src: "assets/models/hotel_t2.glb?v=1-2f3391f28b5f" },
      boucherie_t2: { src: "assets/models/boucherie_t2.glb?v=2-3675e2faceaa" },
      bergerie_t1: { src: "assets/models/bergerie_t1.glb?v=1-1b420c32cac7" },
      artisanat_t1: { src: "assets/models/artisanat_t1.glb?v=1-f82735ce16bc" },
      boucherie_t1: { src: "assets/models/boucherie_t1.glb?v=1-cfc8c9551320" },
      hotel_t1: { src: "assets/models/hotel_t1.glb?v=1-6fc24a07302f" },
      feu_camp_t1: { src: "assets/models/feu_camp_t1.glb?v=1-2e9c70d59637" },
      remparts_t1: { src: "assets/models/remparts_t1.glb?v=1-05c0a93e02a3" },
      remparts_t2: { src: "assets/models/remparts_t2.glb?v=1-8699ad569edd" },
      remparts_t3: { src: "assets/models/remparts_t3.glb?v=1-dd5f62518a89" }
    },
    // TEMP_BALANCE_VALUE — implantation purement visuelle, dans le village d’origine.
    villagePresentation: {
      regionCenter: 2.55, front: -0.70, back: -2.34, elevation: 0.13,
      buildingScale: 0.62, hotelScale: 0.70, fireScale: 0.54,
      buildings: { bergerie: [-1.02, -1.98], village: [-0.34, -1.98],
        artisanat: [0.34, -1.98], boucherie: [1.02, -1.98] },
      fire: [0, -1.19], idleRadiusX: 1.10, idleRadiusZ: 0.35,
      idleScale: 0.58, crowdedIdleScale: 0.47, crowdedThreshold: 20,
      wallHalfWidth: 1.38, rampartModelDepth: 2.02, combatTransition: 30,
      slotsTwo: [[-0.55, 0.10], [0.55, 0.10]],
      slotsFour: [[-0.60, 0.30], [0.60, 0.30], [-0.60, 1.42], [0.60, 1.42]]
    },
    // TEMP_BALANCE_VALUE — hauteur visuelle sur le marqueur du slot ; aucune règle de récolte.
    cropModels: {
      ble: {
        elevation: 0.13,
        variants: [
          { id: "petit", label: "Champ de blé · Niveau 1", level: 1, src: "assets/models/ble_petit.glb?v=1" },
          { id: "moyen", label: "Champ de blé · Niveau 2", level: 2, src: "assets/models/ble_moyen.glb?v=1" },
          { id: "grand", label: "Champ de blé · Niveau 3", level: 3, src: "assets/models/ble_grand.glb?v=1" }
        ]
      },
      chataignier: {
        elevation: 0.13,
        // Le modèle représente le niveau de la culture dans ce slot.
        variants: [
          { id: "petit", label: "Châtaigneraie · Niveau 1", level: 1, src: "assets/models/chataignier_petit.glb?v=1" },
          { id: "moyen", label: "Châtaigneraie · Niveau 2", level: 2, src: "assets/models/chataignier_moyen.glb?v=1" },
          { id: "grand", label: "Châtaigneraie · Niveau 3", level: 3, src: "assets/models/chataignier_grand.glb?v=1" }
        ]
      },
      vignoble: {
        elevation: 0.13,
        variants: [
          { id: "petit", label: "Vignoble · Niveau 1", level: 1, src: "assets/models/vignoble_petit.glb?v=1" },
          { id: "moyen", label: "Vignoble · Niveau 2", level: 2, src: "assets/models/vignoble_moyen.glb?v=1" },
          { id: "grand", label: "Vignoble · Niveau 3", level: 3, src: "assets/models/vignoble_grand.glb?v=1" }
        ]
      }
    },
    // TEMP_BALANCE_VALUE — présentation de l'enclos uniquement, sans effet sur l'élevage.
    livestockModels: {
      chevre: {
        elevation: 0.13, maxVisualAnimals: 6,
        variants: [
          { id: "petit", minAnimals: 1, src: "assets/models/elevage_chevre_petit.glb?v=1",
            positions: [[-.085, .035, .15], [.085, -.035, 3.0]] },
          { id: "moyen", minAnimals: 3, src: "assets/models/elevage_chevre_moyen.glb?v=1",
            positions: [[-.12, .12, .15], [.12, .12, 2.9], [0, -.01, -.1], [-.13, -.04, .4], [.13, -.04, 2.7]] },
          { id: "grand", minAnimals: 6, src: "assets/models/elevage_chevre_grand.glb?v=1",
            positions: [[-.14, .13, .1], [0, .14, 2.9], [.14, .13, 3.2], [-.14, -.005, .15], [0, -.01, 2.8], [.14, -.005, 3.1]] }
        ]
      },
      cochon: {
        elevation: 0.13, maxVisualAnimals: 6,
        variants: [
          { id: "petit", minAnimals: 1, src: "assets/models/elevage_cochon_petit.glb?v=1",
            positions: [[-.085, .035, .15], [.085, -.035, 3.0]] },
          { id: "moyen", minAnimals: 3, src: "assets/models/elevage_cochon_moyen.glb?v=1",
            positions: [[-.12, .12, .15], [.12, .12, 2.9], [0, -.01, -.1], [-.13, -.04, .4], [.13, -.04, 2.7]] },
          { id: "grand", minAnimals: 6, src: "assets/models/elevage_cochon_grand.glb?v=1",
            positions: [[-.14, .13, .1], [0, .14, 2.9], [.14, .13, 3.2], [-.14, -.005, .15], [0, -.01, 2.8], [.14, -.005, 3.1]] }
        ]
      },
      vache: {
        elevation: 0.13, maxVisualAnimals: 6,
        variants: [
          { id: "petit", minAnimals: 1, src: "assets/models/elevage_vache_petit.glb?v=1",
            positions: [[-.09, 0, 1.57], [.09, 0, -1.57]] },
          { id: "moyen", minAnimals: 3, src: "assets/models/elevage_vache_moyen.glb?v=1",
            positions: [[-.145, .12, 1.57], [.145, .12, 1.57], [0, -.10, -1.57], [-.145, -.10, -1.57], [.145, -.10, -1.57]] },
          { id: "grand", minAnimals: 6, src: "assets/models/elevage_vache_grand.glb?v=1",
            positions: [[-.145, .12, 1.57], [0, .12, 1.57], [.145, .12, 1.57], [-.145, -.10, -1.57], [0, -.10, -1.57], [.145, -.10, -1.57]] }
        ]
      }
    },
    preparation: {
      duration: 60,
      // TEMP_BALANCE_VALUE — production pendant la préparation non encore validée.
      productionDuringPreparation: false
    },
    bulkTaskInterval: 0.5,
    network: { connectionTimeoutMs: 8000 },
    reinforcements: {
      intervalSeconds: 120,
      // Toutes les propositions s’accumulent et sont consommées dans leur ordre d’arrivée.
      pendingPolicy: 'fifo',
      development: { includeUnconfigured: false, logs: true }
    },
    reinforcementPowers: {
      stregaDuration: 120, stregaMultiplier: .5,
      streguDuration: 120, streguMultiplier: 2,
      fataFishingSpeed: 1.25,
      orcuHp: 200, orcuDamage: 30,
      maguStatMultiplier: 2, maguScale: 1.5, maguResidentsPerVillage: 1,
      vampireHp: 40, vampireDamage: 11,
      lupuHp: 60, lupuDamage: 20,
      biancaDuration: 60, resurrectionWindow: 60,
      animaHp: 1, animaDps: 1,
      lacramantiHpPerDeath: 2, lacramantiDamagePerDeath: 1,
      fullettuCount: 5, fullettuHp: 20, fullettuDamage: 0,
      // TEMP_BALANCE_VALUE — vitesses qualitatives et cadence de vol non chiffrées
      // par le concepteur ; seuls ces réglages sont provisoires.
      orcuSpeed: .7, vampireSpeed: 8, fullettuSpeed: 12,
      fullettuGatherInterval: 3, fullettuGatherAmount: 1,
      // Le terrain brûlé conserve la durée écrite existante (GDD §69).
      burnDuration: 120,
      // TEMP_BALANCE_VALUE — emplacement d’une invocation dans une région choisie.
      regionSpawnByOwner: { red: 20, blue: 80 }
    },
    // TEMP_BALANCE_VALUE — volumes et limite des effets sonores d’interface.
    audio: {
      musicVolume: 0.38, effectVolume: 0.5, maxEffectVoices: 4,
      effects: {
        pageAdd: "assets/audio/interface/page-turn.wav",
        pageRemove: "assets/audio/interface/page-turn-reverse.wav",
        sword: "assets/audio/interface/sword.wav",
        swordReverse: "assets/audio/interface/sword-reverse.wav"
      }
    },
    // TEMP_BALANCE_VALUE — révélation du logo du menu, sans effet sur la simulation.
    intro: {
      duration: 1.5, revealAt: 0, holdAt: 1.5,
      logoLoadTimeoutMs: 4000, maxPixelRatio: 1.5, maxCanvasEdge: 1920,
      desktopFps: 60, mobileFps: 30, mobileBreakpoint: 600,
      revealColor: '#edbf65'
    },
    // TEMP_BALANCE_VALUE — présentation du menu uniquement, sans effet sur le jeu.
    menu: {
      panorama: "assets/menu-360.png", logo: "assets/eredita-logo.png",
      explorationPanorama: "assets/panorama-360.png",
      desktopFov: 76, sphereRadius: 40, maxPixelRatio: 1.5,
      desktopFps: 30, animationSeconds: 6, particleCount: 55,
      gifFps: 12, gifWidth: 960, gifHeight: 480,
      mouseSensitivity: 0.003, maxPitch: Math.PI * 0.44,
      flagAmplitude: 0.0035, mistOpacity: 0.055, fireStrength: 0.13, fireCenter: [0.934, 0.447],
      vrPanelDistance: 2.4, vrPanelWidth: 1.7, vrRowHeight: 0.18, vrFontSize: 48,
      vrPageSize: 6, vrRefreshMs: 150, vrInputCooldownMs: 180, vrFramebufferScale: 0.85
    },
    xr: {
      // TEMP_BALANCE_VALUE — réglages de présentation/confort, sans effet sur les règles.
      environment: {
        enabledDuringMatch: true, panorama: "assets/panorama-360.png",
        groundTexture: "assets/vr-stone-floor.png",
        sphereRadius: 24, floorRadius: 3, floorEdgeStart: 0.4, fallbackEyeHeight: 1.65,
        fadeSeconds: 1.1, floorTileMeters: 2.4, sphereSegments: 48,
        groundColor: "#463522", groutColor: "#241d14", stoneColor: "#6f5740",
        altar: { enabled: true, widthMargin: 0.14, depthMargin: 0.14, minHeight: 0.18,
          stoneColor: "#a49179", sideColor: "#736451", bronzeColor: "#b5965c",
          previewWidth: 0.95, previewDepth: 0.72, previewHeight: 0.72, previewDistance: 1.85 }
      },
      initialWidth: 0.8, minWidth: 0.45, maxWidth: 1.4,
      boardWidth: 13.65, boardBottom: -0.56,
      minDistance: 0.4, maxDistance: 2.5, rayLength: 4,
      manualBelowEyes: 0.55,
      minBelowEyes: 0.15, maxBelowEyes: 1.5, heightStep: 0.05,
      surfaceNormalMin: 0.92, hitTestTimeoutMs: 8000,
      moveSpeed: 0.3, turnSpeed: 0.8, moveStep: 0.05,
      turnStep: Math.PI / 12, scaleStep: 1.1, stickDeadzone: 0.18,
      minGripSeparation: 0.12, previewOpacity: 0.3,
      panelWidth: 0.64, panelHeight: 0.56, panelDistance: 1.1,
      panelSideOffset: 0.52, panelBelowEyes: 0.1,
      panelUpdateMs: 250, desktopUpdateMs: 150,
      feedbackMs: 450,
      // TEMP_BALANCE_VALUE — disposition et cadence de l'interface dans le casque.
      dashboardDistance: 1.55, dashboardBoardOffset: 0.45, dashboardMoveThreshold: 0.55,
      dashboardTurnThreshold: 0.65, dashboardSmoothness: 3,
      dashboardRefreshMs: 200, dashboardRowHeight: 0.061,
      dashboardFontSize: 40, dashboardTitleSize: 48,
      dashboardStickThreshold: 0.65, dashboardStickRepeatMs: 260,
      dashboardRowsPerPage: 6, residentPageSize: 4,
      // TEMP_BALANCE_VALUE — fenêtres indépendantes, distances en mètres.
      windowMinDistance: 0.7, windowMaxDistance: 2.4,
      windowMaxYaw: Math.PI / 2.8, windowMinY: -1.9, windowMaxY: 0.65,
      dashboardPitch: 0, scorePitch: 0,
      windowSmoothing: 18, windowDepthSpeed: 0.45,
      windowScaleSpeed: 0.35, windowMinScale: 0.85, windowMaxScale: 1.4,
      windowMoveStep: 0.08, windowScaleStep: 1.08,
      windowSelectGuardMs: 300, windowRecoveryHoldMs: 1200,
      interfaceSoundHz: 660, interfaceSoundDuration: 0.055, interfaceSoundGain: 0.035,
      cameraNear: 0.02, cameraFar: 30
    },
    biomes: ["montagne", "plaine", "littoral"],
    village: {
      T1: { hp: 200, populationMax: 15 },
      T2: { hp: 400, populationMax: 25 },
      T3: { hp: 600, populationMax: 35 }
    },
    building: {
      slots: 3,
      maxPerType: 1,
      bergerieBonusByLevel: { 1: 0.1, 2: 0.2, 3: 0.3 },
      descriptions: {
        bergerie: { label: "Bergerie", icon: "🐑", purpose: "Récoltes et élevage", production: "Récolte, lait et reproduction" },
        artisanat: { label: "Artisanat", icon: "⚒", purpose: "Chasse et équipement" },
        boucherie: { label: "Boucherie", icon: "🔪", purpose: "Pêche et transport" }
      },
      artisanatBonus: { hp: 5, damage: 2 },
      types: ["bergerie", "artisanat", "boucherie"],
      T1: { hp: 75, gold: 200 },
      T2: { hp: 150, gold: 200, resourceAmount: 100, resourceType: null },
      T3: { hp: 225, gold: 300, resourceAmount: 150, resourceType: null }
    },
    villageShops: {
      bergerie: {
        label: "Échoppe de la Bergerie",
        icon: "🐑",
        tiers: {
          1: [
            { label: "Chèvre", icon: "🐐", animalType: "chevre" },
            { label: "Cochon", icon: "🐖", animalType: "cochon" },
            { label: "Vache", icon: "🐄", animalType: "vache" }
          ],
          2: [{ label: "Âne", icon: "🫏", specialAnimal: "ane" }],
          3: [{ label: "Chien", icon: "🐕", specialAnimal: "chien" }, { label: "Sanglier", icon: "🐗", specialAnimal: "sanglier" }]
        }
      },
      artisanat: {
        label: "Échoppe de l’Artisanat",
        icon: "⚒",
        tiers: {
          1: [{ label: "Outil en bois", icon: "🪵", equipmentKind: "tools", equipmentType: "bois" }, { label: "Armure de cuir", icon: "🦺", equipmentKind: "armors", equipmentType: "cuir" }],
          2: [{ label: "Outil en bronze", icon: "🟤", equipmentKind: "tools", equipmentType: "bronze" }, { label: "Cotte de mailles", icon: "🛡", equipmentKind: "armors", equipmentType: "maille" }],
          3: [{ label: "Outil en fer", icon: "⚙", equipmentKind: "tools", equipmentType: "fer" }, { label: "Armure de fer", icon: "🛡", equipmentKind: "armors", equipmentType: "fer" }]
        }
      },
      boucherie: {
        label: "Échoppe de la Boucherie",
        icon: "🔪",
        tiers: {
          1: [{ label: "Filet de pêche", icon: "🕸", purchaseType: "filet" }, { label: "Barque", icon: "🛶", purchaseType: "barque" }],
          2: [{ label: "Piège de chasse", icon: "🪤" }],
          3: [{ label: "Voilier", icon: "⛵", purchaseType: "voilier" }, { label: "Piège défensif", icon: "🛡" }]
        }
      }
    },
    specialAnimals: {
      // TEMP_BALANCE_VALUE — prix, vitesses terrestres des animaux et cadence du chien.
      // Les PV, dégâts, bonus, cumul maximal, tiers et nage sont fixés par le GDD.
      ane: { label: "Âne", icon: "🫏", gold: 150, requiredTier: 2, movementBonus: 0.2, workBonus: 0.1 },
      chien: { label: "Chien", icon: "🐕", gold: 120, requiredTier: 3, hp: 40, damage: 7, speed: 5, attackInterval: 1, harassmentPenalty: 0.05, goatPenalty: 0.07, maxStacks: 4 },
      sanglier: { label: "Sanglier", icon: "🐗", gold: 180, requiredTier: 3, hp: 80, damage: 8, speed: 5, waterSpeedMultiplier: 0.5, meatAtDeath: 8 }
    },
    equipment: {
      // Prix validés par village ; les achats équipent les habitants actuels et futurs, hors légendes.
      tools: {
        bois: { label: "Outil en bois", gold: 150, requiredTier: 1, damage: 5, productionBonus: 0.2 },
        bronze: { label: "Outil en bronze", gold: 250, requiredTier: 2, damage: 10, productionBonus: 0.3 },
        fer: { label: "Outil en fer", gold: 400, requiredTier: 3, damage: 20, productionBonus: 0.5 }
      },
      // Tiers d’Artisanat existants ; un outil et une armure par habitant.
      armors: {
        cuir: { label: "Armure de cuir", gold: 150, requiredTier: 1, hp: 15 },
        maille: { label: "Cotte de mailles", gold: 250, requiredTier: 2, hp: 35 },
        fer: { label: "Armure de fer", gold: 400, requiredTier: 3, hp: 50 }
      }
    },
    resources: ["ble", "chataigne", "raisin", "viande", "poisson", "lait"],
    // TEMP_BALANCE_VALUE — coût du village et ressource au choix pour les bâtiments.
    villageUpgradeGold: { 2: 300, 3: 450 },
    buildingUpgradeResourceChoice: true,
    saleBatchSize: 10,
    // TEMP_BALANCE_VALUE — seul le meilleur bonus de revente applicable est retenu.
    saleBonusPerLevel: 0.05,
    saleBuildingResources: { bergerie: ["ble", "lait"], artisanat: ["ble", "chataigne", "raisin", "viande", "poisson", "lait"], boucherie: ["viande", "poisson"] },
    combatProfessions: ["guerrier", "ravageur", "chasseur"],
    professions: {
      habitant: { label: "Sans métier", icon: "👤", missions: [], description: "Toutes les tâches, sans bonus" },
      agriculteur: { label: "Agriculteur", icon: "🌾", missions: ["agriculture"], speedBonus: 0.2, workBonus: 0.2, biome: "plaine", biomeBonus: 0.3, description: "+20 % récolte (+30 % en Plaine), +20 % vitesse" },
      berger: { label: "Berger", icon: "🐑", requires: "bergerie", missions: ["elevage"], speedBonus: 0.3, workBonus: 0.2, biome: "montagne", biomeBonus: 0.3, description: "+20 % lait / reproduction (+30 % en Montagne), +30 % vitesse" },
      pecheur: { label: "Pêcheur", icon: "🎣", requires: "boucherie", missions: ["peche"], workBonus: 0.2, biome: "littoral", biomeBonus: 0.3, description: "+20 % poisson (+30 % sur le Littoral)" },
      guerrier: { label: "Guerrier", icon: "⚔", missions: ["attaque", "defense"], description: "+20 PV, +5 dégâts, +10 % vitesse" },
      ravageur: { label: "Ravageur", icon: "🪓", missions: ["attaque"], description: "+10 PV, +2 dégâts, +35 % vitesse ; +5 contre village" },
      chasseur: { label: "Chasseur", icon: "🏹", requires: "artisanat", missions: ["chasse", "attaque", "defense"], speedBonus: 0.5, description: "5 viandes par chasse au lieu de 3, +50 % vitesse ; arc : portée 15" }
    },
    resourceSaleValues: {
      ble: 1,
      chataigne: 1.5,
      raisin: 1.5,
      viande: 2,
      poisson: 2,
      lait: 1
    },
    crops: {
      chataignier: {
        label: "Châtaignier",
        shortLabel: "Châtaigne",
        icon: "🌳",
        hp: 200,
        allowedBiomes: ["montagne", "plaine"],
        productionInterval: null
      },
      ble: {
        label: "Champ de blé",
        shortLabel: "Blé",
        icon: "🌾",
        hp: 200,
        allowedBiomes: ["plaine", "littoral"],
        productionInterval: null
      },
      vignoble: {
        label: "Vignoble",
        shortLabel: "Vigne",
        icon: "🍇",
        hp: 200,
        allowedBiomes: ["montagne", "littoral"],
        productionInterval: null
      }
    },
    cropLevels: {
      1: { gold: 75, yield: 1 },
      2: { gold: 150, yield: 2 },
      3: { gold: 300, yield: 3 }
    },
    livestock: {
      chevre: {
        label: "Élevage de chèvres",
        shortLabel: "Chèvres",
        icon: "🐐",
        // TEMP_BALANCE_VALUE — prix d'achat provisoire, un animal par achat.
        purchaseGold: 50, requiredTier: 1, purchaseCount: 1,
        reproductionInterval: 70,
        milkInterval: 30,
        meatAtDeath: 4,
        hpPerAnimal: 25,
        preferredBiome: "montagne"
      },
      cochon: {
        label: "Élevage de cochons",
        shortLabel: "Cochons",
        icon: "🐖",
        // TEMP_BALANCE_VALUE — prix d'achat provisoire, un animal par achat.
        purchaseGold: 65, requiredTier: 1, purchaseCount: 1,
        reproductionInterval: 60,
        milkInterval: null,
        meatAtDeath: 8,
        hpPerAnimal: 20,
        preferredBiome: "plaine"
      },
      vache: {
        label: "Élevage de vaches",
        shortLabel: "Vaches",
        icon: "🐄",
        // TEMP_BALANCE_VALUE — prix d'achat provisoire, un animal par achat.
        purchaseGold: 90, requiredTier: 1, purchaseCount: 1,
        reproductionInterval: 120,
        milkInterval: 30,
        meatAtDeath: 8,
        hpPerAnimal: 30,
        preferredBiome: "littoral"
      }
    },
    jobs: {
      agriculture: { label: "Agriculture", role: "Agriculteur", profession: "agriculteur", icon: "🌾" },
      elevage: { label: "Élevage", role: "Berger", profession: "berger", icon: "🐑", requires: "bergerie" },
      peche: { label: "Pêche", role: "Pêcheur", profession: "pecheur", icon: "🎣", requires: "boucherie" },
      chasse: { label: "Chasse", role: "Chasseur", profession: "chasseur", icon: "🏹", requires: "artisanat" }
    },
    // TEMP_BALANCE_VALUE — coût et quantité initiale des élevages sont TBD.
    livestockPlacementCost: 0,
    startingLivestockCount: 1,
    temporaryProduction: {
      // TEMP_BALANCE_VALUE — rythmes/quantités non validés dans le GDD.
      agricultureHarvestDuration: 7,
      agricultureVillageStopDuration: 2,
      agricultureAmountPerTrip: 1,
      agricultureFieldPositionByOwner: { red: 23, blue: 77 },
      fishingInterval: 30,
      fishAmountPerWorker: 1,
      milkAmountPerAnimal: 1,
      huntingInterval: 30,
      huntingBaseAmount: 3,
      huntingSpecialistAmount: 5,
      // TEMP_BALANCE_VALUE — limites visuelles du déplacement libre dans la région.
      huntingAreaByOwner: { red: { min: 8, max: 43 }, blue: { min: 57, max: 92 } },
      huntingLaneOffset: 0.32,
      huntingLateralSpeed: 0.22
    },
    population: {
      generationByLivingVillages: { 4: 45, 3: 35, 2: 25, 1: 15 }
    },
    movement: {
      columnLength: 100,
      inhabitantSpeed: 5,
      hunterSpeed: 7.5
    },
    maritime: {
      // TEMP_BALANCE_VALUE — les limites et capacités viennent du GDD, mais
      // les prix et les vitesses des bateaux ne sont pas encore définis.
      waterRanges: { red: { min: 38, max: 50 }, blue: { min: 50, max: 62 } },
      shop: {
        barque: { label: "Barque", icon: "🛶", gold: 100, max: 4, capacity: 2, unlock: "boucherie-t1" },
        voilier: { label: "Voilier", icon: "⛵", gold: 350, max: 2, capacity: 15, biome: "littoral", unlock: "boucherie-t3" },
        filet: { label: "Filet de pêche", icon: "🕸", gold: 75, max: null, fishAmount: 1, interval: 30, biome: "littoral", unlock: "boucherie-t1" }
      }
    },
    units: {
      habitant: { label: "Habitant", shortLabel: "H", hp: 50, damage: 5, speed: 5 },
      guerrier: { label: "Guerrier", shortLabel: "G", hp: 70, damage: 10, speed: 5.5 },
      // TEMP_BALANCE_VALUE — spécialisation du Ravageur contre les villages/bâtiments.
      ravageur: { label: "Ravageur", shortLabel: "R", hp: 60, damage: 7, speed: 6.75, villageDamageBonus: 5 },
      // TEMP_BALANCE_VALUE — vitesse terrestre 5 ; PV/dégâts fixés par le GDD.
      chien: { label: "Chien", shortLabel: "🐕", hp: 40, damage: 7, speed: 5 },
      sanglier: { label: "Sanglier", shortLabel: "🐗", hp: 80, damage: 8, speed: 5 }
    },
    // Règle demandée : chaque joueur commence avec 5 000 or.
    startingGold: 5000,
    // TEMP_BALANCE_VALUE — la population initiale n'est pas encore définie.
    startingPopulation: 5,
    // TEMP_BALANCE_VALUE — achat immédiat d'un habitant dans le village sélectionné.
    residentPurchase: { gold: 50, resourceAmount: 50 },
    combat: {
      villageRetaliationDamagePerSecond: 5,
      // TEMP_BALANCE_VALUE — portée, détection et vitesse d'attaque sont TBD.
      attackRange: 3,
      // Règle validée : le métier Chasseur tire à 15 unités, troupes comprises.
      professionAttackRanges: { chasseur: 15 },
      detectionRange: 4.5,
      attackInterval: 1,
      // TEMP_BALANCE_VALUE — position logique de garde dans chaque territoire.
      defensePositionByOwner: { red: 25, blue: 75 },
      // TEMP_BALANCE_VALUE — position de la rive, cohérente avec les pêcheurs visibles.
      fishingPositionByOwner: { red: 23, blue: 77 },
      // TEMP_BALANCE_VALUE — vitesse du trajet latéral entre deux régions.
      redirectSpeed: 0.35
    },
    overtime: {
      start: 750,
      // TEMP_BALANCE_VALUE — pourcentage et intervalle d'Overtime sont TBD.
      damagePercent: 0.02,
      interval: 5
    },
    simulation: { maxDelta: 0.1 },
    // TEMP_BALANCE_VALUE — comportement provisoire de l'adversaire solo.
    ai: {
      // TEMP_BALANCE_VALUE — priorité des cartes et achats de transport de l'IA.
      decisionInterval: 3,
      attackInterval: 9,
      reserveResidents: 2,
      maxAttackersPerLane: 2,
      maxDefendersPerLane: 2,
      threatDistance: 25,
      cropPriority: ["ble", "chataignier", "vignoble"]
    },
    // TEMP_BALANCE_VALUE — échelle et transitions visuelles du modèle animé.
    // Les dégâts, la portée et la cadence restent ceux du moteur de combat.
    transportModels: {
      // Dimensions purement visuelles ; capacité, prix et vitesse restent dans maritime.
      barque: { src: "assets/models/barque.glb?v=1-e1ff6a2744b3", scale: 1 }
    },
    characterHud: {
      ally: '#42d8f0', enemy: '#f06470', ringSize: .54,
      healthWidth: .61, healthHeight: .19, healthGap: .11,
      tiers: {0:'#626a76',1:'#a56b3f',2:'#c1c7cf',3:'#efd071'}
    },
    characterModels: {
      // TEMP_BALANCE_VALUE — échelle visuelle du GLB fourni pour les sans métier.
      villager: { src: "assets/models/habitant.glb?v=1-151656a63b68", scale: 0.31 },
      // Échelle et transitions visuelles ; production et cadence économique inchangées.
      // Berger fourni : mouvements visuels, sans modification des bonus du métier.
      shepherd: {
        src: "assets/models/berger.glb?v=1-08a9ed56ddf0", scale: 0.31,
        crossFade: 0.18, maxFrameDelta: 0.05, attackDuration: 0.65,
        clips: { idle: "Repos", walk: "Marche", harvest: "Traite", attack: "Frappe", death: "Mort" }
      },
      farmer: {
        src: "assets/models/agriculteur.glb?v=1-f802929f0a88", scale: 0.31,
        crossFade: 0.18, maxFrameDelta: 0.05, attackDuration: 0.6,
        clips: { idle: "Repos", walk: "Marche", harvest: "Recolte", attack: "Frappe", death: "Mort" }
      },
      // Animations et projectile purement visuels ; portée de combat définie dans combat.
      hunter: {
        src: "assets/models/chasseur.glb?v=1-5f0f9b2b4914", scale: 0.31,
        crossFade: 0.12, maxFrameDelta: 0.05, attackDuration: 0.8, arrowFlightDuration: 0.22,
        clips: { idle: "Repos", walk: "Marche", attack: "Tir", death: "Mort" }
      },
      // Échelle et animations visuelles du ravageur et de la hache fournis.
      ravager: {
        src: "assets/models/ravageur.glb?v=1-52982620a075", scale: 0.31,
        attackDuration: 0.8, crossFade: 0.12, maxFrameDelta: 0.05,
        clips: { idle: "Repos", walk: "Marche", attacks: ["Coup_Hache"], death: "Mort" }
      },
      warrior: {
        src: "assets/models/guerrier.glb?v=final-cd44bcb24b67", scale: 0.31,
        attackDuration: 0.72, crossFade: 0.08, maxFrameDelta: 0.05,
        movementEpsilon: 0.0001,
        clips: { idle: "Repos", walk: "Marche", attacks: ["Coup_Droit", "Revers"], death: "Mort" }
      },
      // TEMP_BALANCE_VALUE — échelle et rythme d'animation purement visuels.
      orcu: {
        src: "assets/models/orcu.glb?v=1-9b79e8bc4d1e", scale: 0.31,
        attackDuration: 0.9, walkTimeScale: 0.35, crossFade: 0.08,
        maxFrameDelta: 0.05, movementEpsilon: 0.0001,
        clips: { idle: "Repos", walk: "Marche", attacks: ["Frappe_Droite", "Frappe_Gauche"], death: "Mort" }
      },
      // TEMP_BALANCE_VALUE — échelle et transitions visuelles ; cadence du vol inchangée.
      fullettu: {
        src: "assets/models/fullettu.glb?v=1-edbe8329a6c5", scale: 0.31,
        crossFade: 0.08, maxFrameDelta: 0.05,
        clips: { idle: "Repos", walk: "Bonds", harvest: "Recolte", death: "Mort" }
      },
      // TEMP_BALANCE_VALUE — rythme visuel des griffes ; dégâts et cadence du combat inchangés.
      lupu: {
        src: "assets/models/lupu_mannaru.glb?v=1-f708c7a3a231", scale: 0.31,
        attackDuration: 0.9, walkTimeScale: 1, crossFade: 0.08,
        maxFrameDelta: 0.05,
        clips: { idle: "Repos", walk: "Quatre_Pattes", attacks: ["Griffes_Croisees"], death: "Mort" }
      },
      // TEMP_BALANCE_VALUE — rendu de la forme vampire ; statistiques dans reinforcementPowers.
      surpatore: {
        src: "assets/models/surpatore_vampire.glb?v=2-5ffb7ed01318", scale: 0.31,
        attackDuration: 0.9, walkTimeScale: 1, crossFade: 0.08,
        maxFrameDelta: 0.05, movementEpsilon: 0.0001,
        clips: { idle: "Repos", walk: "Marche", attacks: ["Griffe"], death: "Mort" }
      }
    },
    visualEffects: {
      structureSmokeDuration: 2.4,
      // TEMP_BALANCE_VALUE — durées et amplitudes purement visuelles des unités 3D.
      unitAttackDuration: 0.3,
      unitAttackTilt: 0.3,
      unitHitFlashDuration: 0.38,
      unitDeathDuration: 1.8,
      unitDeathRedMix: 0.7,
      unitDeathFallAngle: 1.48,
      unitDeathSmokeDuration: 0.9,
      unitDeathSmokePuffs: 6
    }
  };
}());
