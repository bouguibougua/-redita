(function () {
  "use strict";

  window.Eredita = window.Eredita || {};

  // Toutes les valeurs marquées TEMP_BALANCE_VALUE sont indispensables à ce
  // prototype, mais ne constituent pas une règle validée du Game Design.
  window.Eredita.Config = {
    normalDuration: 750,
    bulkTaskInterval: 0.5,
    network: { connectionTimeoutMs: 8000 },
    biomes: ["montagne", "plaine", "littoral"],
    village: {
      T1: { hp: 200, populationMax: 15 },
      T2: { hp: 400, populationMax: 25 },
      T3: { hp: 600, populationMax: 35 }
    },
    building: {
      slots: 3,
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
          1: [{ label: "Barque", icon: "🛶", purchaseType: "barque" }, { label: "Outil en bois", icon: "🪵", equipmentKind: "tools", equipmentType: "bois" }, { label: "Armure de cuir", icon: "🦺", equipmentKind: "armors", equipmentType: "cuir" }],
          2: [{ label: "Outil en bronze", icon: "🟤", equipmentKind: "tools", equipmentType: "bronze" }, { label: "Cotte de mailles", icon: "🛡", equipmentKind: "armors", equipmentType: "maille" }, { label: "Piège", icon: "🪤" }],
          3: [{ label: "Piège défensif", icon: "🛡" }, { label: "Outil en fer", icon: "⚙", equipmentKind: "tools", equipmentType: "fer" }, { label: "Armure de fer", icon: "🛡", equipmentKind: "armors", equipmentType: "fer" }]
        }
      },
      boucherie: {
        label: "Échoppe de la Boucherie",
        icon: "🔪",
        tiers: {
          1: [{ label: "Filet de pêche", icon: "🕸", purchaseType: "filet" }, { label: "Barque", icon: "🛶", purchaseType: "barque" }],
          2: [{ label: "Piège de chasse", icon: "🪤" }],
          3: [{ label: "Voilier", icon: "⛵", purchaseType: "voilier" }]
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
      // TEMP_BALANCE_VALUE — prix provisoires ; bonus des outils fixés par le GDD.
      tools: {
        bois: { label: "Outil en bois", gold: 75, requiredTier: 1, damage: 5, productionBonus: 0.2 },
        bronze: { label: "Outil en bronze", gold: 150, requiredTier: 2, damage: 10, productionBonus: 0.3 },
        fer: { label: "Outil en fer", gold: 250, requiredTier: 3, damage: 20, productionBonus: 0.5 }
      },
      // TEMP_BALANCE_VALUE — prix et rattachement des armures à l'Artisanat T1/T2/T3.
      armors: {
        cuir: { label: "Armure de cuir", gold: 75, requiredTier: 1, hp: 15 },
        maille: { label: "Cotte de mailles", gold: 150, requiredTier: 2, hp: 35 },
        fer: { label: "Armure de fer", gold: 250, requiredTier: 3, hp: 50 }
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
    professions: {
      habitant: { label: "Sans métier", icon: "👤", missions: [], description: "Toutes les tâches, sans bonus" },
      agriculteur: { label: "Agriculteur", icon: "🌾", requires: "bergerie", missions: ["agriculture"], speedBonus: 0.2, workBonus: 0.2, biome: "plaine", biomeBonus: 0.3, description: "+20 % récolte (+30 % en Plaine), +20 % vitesse" },
      berger: { label: "Berger", icon: "🐑", requires: "bergerie", missions: ["elevage"], speedBonus: 0.3, workBonus: 0.2, biome: "montagne", biomeBonus: 0.3, description: "+20 % lait / reproduction (+30 % en Montagne), +30 % vitesse" },
      pecheur: { label: "Pêcheur", icon: "🎣", requires: "artisanat", missions: ["peche"], workBonus: 0.2, biome: "littoral", biomeBonus: 0.3, description: "+20 % poisson (+30 % sur le Littoral)" },
      guerrier: { label: "Guerrier", icon: "⚔", requires: "artisanat", missions: ["attaque", "defense"], description: "+20 PV, +5 dégâts, +10 % vitesse" },
      ravageur: { label: "Ravageur", icon: "🪓", requires: "boucherie", missions: ["attaque"], description: "+10 PV, +2 dégâts, +35 % vitesse ; +5 contre village" },
      chasseur: { label: "Chasseur", icon: "🏹", requires: "boucherie", missions: ["chasse"], speedBonus: 0.5, description: "5 viandes par chasse au lieu de 3, +50 % vitesse" }
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
    // TEMP_BALANCE_VALUE — le moyen et le coût de placement sont encore TBD.
    // Le prototype autorise donc un placement direct sans dépense.
    cropPlacementCost: 0,
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
      agriculture: { label: "Agriculture", role: "Agriculteur", icon: "🌾", requires: "bergerie" },
      elevage: { label: "Élevage", role: "Berger", icon: "🐑", requires: "bergerie" },
      peche: { label: "Pêche", role: "Pêcheur", icon: "🎣", requires: "artisanat" },
      chasse: { label: "Chasse", role: "Chasseur", icon: "🏹", requires: "boucherie" }
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
        barque: { label: "Barque", icon: "🛶", gold: 100, max: 4, capacity: 2, unlock: "artisanat-ou-boucherie-t1" },
        voilier: { label: "Voilier", icon: "⛵", gold: 350, max: 2, capacity: 15, unlock: "boucherie-t3" },
        filet: { label: "Filet de pêche", icon: "🕸", gold: 75, max: null, fishAmount: 1, interval: 30, unlock: "boucherie-t1" }
      }
    },
    units: {
      habitant: { label: "Habitant", shortLabel: "H", hp: 50, damage: 5, speed: 5 },
      guerrier: { label: "Guerrier", shortLabel: "G", hp: 70, damage: 10, speed: 5.5, requires: "artisanat" },
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
      detectionRange: 4.5,
      attackInterval: 1,
      // TEMP_BALANCE_VALUE — position logique de garde dans chaque territoire.
      defensePositionByOwner: { red: 25, blue: 75 },
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
      decisionInterval: 3,
      attackInterval: 9,
      reserveResidents: 2,
      maxAttackersPerLane: 2,
      maxDefendersPerLane: 2,
      threatDistance: 25,
      cropPriority: ["ble", "chataignier", "vignoble"]
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
