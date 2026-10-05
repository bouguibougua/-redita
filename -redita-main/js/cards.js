(function () {
  "use strict";
  const E = window.Eredita = window.Eredita || {};

  const card = (id, name, category, icon, description, details = {}) => ({
    id, name, category, icon, description, image: null, ...details
  });

  const normal = [
    card("habitant", "Habitant", "Action", "♟", "Un habitant polyvalent qui peut travailler, récolter, recevoir une tâche et combattre.", { stats: [["PV", "50"], ["Dégâts", "5"], ["Vitesse", "5 unités/s"]] }),
    card("agriculteur", "Agriculteur", "Action", "🌾", "Spécialise un habitant dans l’agriculture.", { stats: [["PV", "+20"], ["Dégâts", "+1/s"], ["Vitesse", "+20 %"], ["Récolte", "+20 %"]], conditions: ["Nécessite une Bergerie."], biome: "Plaine : bonus de récolte porté à +30 %." }),
    card("berger", "Berger", "Action", "🐑", "Spécialise un habitant dans l’élevage.", { stats: [["PV", "+10"], ["Dégâts", "+2/s"], ["Vitesse", "+30 %"], ["Élevage", "+20 %"]], conditions: ["Nécessite une Bergerie."], biome: "Montagne : reproduction et production portées à +30 %." }),
    card("pecheur", "Pêcheur", "Action", "🎣", "Spécialise un habitant dans la pêche.", { stats: [["PV", "+15"], ["Dégâts", "+3/s"], ["Vitesse", "+10 %"], ["Pêche", "+20 %"]], conditions: ["Nécessite un Artisanat."], biome: "Littoral : rendement de pêche porté à +30 %." }),
    card("guerrier", "Guerrier", "Action", "⚔", "Combattant capable d’attaquer ou de tenir une position défensive.", { stats: [["PV", "+20"], ["Dégâts", "+5/s"], ["Vitesse", "+10 %"]], conditions: ["Nécessite un Artisanat."] }),
    card("ravageur", "Ravageur", "Action", "🔥", "Combattant rapide destiné à attaquer l’économie adverse.", { stats: [["PV", "+10"], ["Dégâts", "+2"], ["Vitesse", "+35 %"], ["Cible spécialisée", "+5 dégâts"]], conditions: ["Nécessite une Boucherie."], notes: "Le ciblage définitif entre élevages et bâtiments reste à confirmer." }),
    card("chasseur", "Chasseur", "Action", "🏹", "Spécialiste mobile de la chasse et de la production de viande.", { stats: [["PV", "5"], ["Dégâts", "2"], ["Vitesse", "7,5 unités/s"], ["Viande", "4 à 6"]], conditions: ["Nécessite une Boucherie."], notes: "La fréquence définitive de production reste à définir." }),
    card("ane", "Âne", "Action", "🫏", "Compagnon associé à un habitant, qu’il aide dans ses déplacements et son travail.", { stats: [["Vitesse", "+20 %"], ["Travail", "+10 %"]], conditions: ["Un seul âne par habitant.", "L’âne meurt avec l’habitant associé."] }),
    card("chevre", "Chèvre", "Action", "🐐", "Animal laitier qui se reproduit et peut être abattu.", { stats: [["PV du troupeau", "+25 par chèvre"], ["Reproduction", "70 s"], ["Viande", "4"]], biome: "Montagne : reproduction 5 % plus rapide." }),
    card("cochon", "Cochon", "Action", "🐖", "Animal d’élevage destiné à la production de viande.", { stats: [["PV du troupeau", "+20 par cochon"], ["Reproduction", "60 s"], ["Viande", "8"]], biome: "Plaine : reproduction 5 % plus rapide." }),
    card("vache", "Vache", "Action", "🐄", "Animal laitier qui se reproduit et peut être abattu.", { stats: [["PV du troupeau", "+30 par vache"], ["Reproduction", "120 s"], ["Viande", "8"]], biome: "Littoral : reproduction 5 % plus rapide.", notes: "La condition de réduction du temps de reproduction reste à clarifier." }),
    card("sanglier", "Sanglier", "Action", "🐗", "Unité autonome qui donne la priorité aux cultures ennemies et peut traverser la mer.", { stats: [["PV", "80"], ["Dégâts", "8/s"], ["Viande", "8"]], conditions: ["Débloqué par la Bergerie T3."], biome: "Dans l’eau : vitesse divisée par deux." }),
    card("chien", "Chien", "Action", "🐕", "Compagnon capable d’attaquer, défendre, garder un enclos ou perturber un élevage.", { stats: [["PV", "40"], ["Dégâts", "7"], ["Perturbation", "−5 % reproduction"]], conditions: ["Débloqué par la Bergerie T3.", "Quatre chiens maximum sont comptés par élevage."], biome: "Contre les chèvres : perturbation portée à −7 %." }),

    card("bergerie", "Bergerie", "Antique", "⌂", "Bâtiment consacré aux métiers agricoles et au développement du bétail.", { stats: [["PV", "75 / 150 / 225"], ["Production", "+10 / 20 / 30 %"]], effect: "Débloque progressivement animaux et compagnons." }),
    card("artisanat", "Artisanat", "Antique", "⚒", "Bâtiment qui débloque les embarcations, équipements et pièges.", { stats: [["PV", "75 / 150 / 225"]], effect: "+2 dégâts et +5 PV par personne présente dans la colonne.", notes: "Le cumul exact de cet effet reste à confirmer." }),
    card("boucherie", "Boucherie", "Antique", "🔪", "Bâtiment qui débloque filets, embarcations et pièges de chasse.", { stats: [["PV", "75 / 150 / 225"]], effect: "Améliore la revente de viande et de poisson selon son niveau." }),
    card("chataignier", "Châtaignier", "Antique", "🌳", "Culture de châtaignes destinée à la Montagne ou à la Plaine.", { stats: [["PV", "200"]], conditions: ["Montagne ou Plaine."], biome: "Montagne : +20 % production.", notes: "Le rythme de production reste à définir." }),
    card("champ-ble", "Champ de blé", "Antique", "🌾", "Culture de blé destinée à la Plaine ou au Littoral.", { stats: [["PV", "200"]], conditions: ["Plaine ou Littoral."], biome: "Un bonus de Plaine de valeur +20 est prévu ; sa signification reste à confirmer." }),
    card("vignoble", "Vignoble", "Antique", "🍇", "Culture de raisin destinée à la Montagne ou au Littoral.", { stats: [["PV", "200"]], conditions: ["Montagne ou Littoral."], biome: "Un bonus de Littoral de valeur +20 est prévu ; sa signification reste à préciser." }),
    card("riviere", "Rivière", "Antique", "≋", "Élément de terrain qui ouvre notamment des possibilités de pêche.", { conditions: ["Montagne ou Plaine."] }),
    card("moulin", "Moulin", "Antique", "⚙", "Construction qui améliore la production agricole.", { stats: [["PV", "250"], ["Production agricole", "+30 %"]], conditions: ["Nécessite une Rivière."] }),
    card("barque", "Barque", "Antique", "⛵", "Petite embarcation servant à traverser un Littoral.", { stats: [["Capacité", "2 personnes"], ["Maximum", "4 par Littoral"]], conditions: ["Littoral uniquement."], notes: "La vitesse définitive reste à définir." }),
    card("voilier", "Voilier", "Antique", "⛵", "Grande embarcation servant à traverser un Littoral.", { stats: [["Capacité", "15 personnes"], ["Maximum", "2 par Littoral"]], conditions: ["Littoral uniquement."], notes: "La vitesse définitive reste à définir." }),
    card("charrette", "Charrette", "Antique", "🛞", "Transport terrestre qui libère ses troupes à sa destruction ou à son arrivée.", { stats: [["PV", "150"], ["Capacité", "8 habitants"]], biome: "Montagne : vitesse réduite de 50 %.", notes: "La vitesse de base reste à préciser." }),
    card("filet-peche", "Filet de pêche", "Antique", "#", "Installation autonome qui produit du poisson.", { stats: [["Production", "+1 poisson / 30 s"]], conditions: ["Uniquement dans l’eau."] }),
    card("tour-genoise", "Tour génoise", "Antique", "♜", "Construction d’observation qui révèle une partie de la colonne adverse.", { stats: [["PV", "300"], ["Vision", "25 % de la colonne"]], biome: "Littoral : vision portée à 50 %." }),
    card("outil-bois", "Outil en bois", "Équipement", "🪓", "Outil individuel en bois.", { stats: [["Attaque", "+5"], ["Production", "+20 %"]], conditions: ["Un outil maximum par habitant."] }),
    card("outil-bronze", "Outil en bronze", "Équipement", "🪓", "Outil individuel en bronze.", { stats: [["Attaque", "+10"], ["Production", "+30 %"]], conditions: ["Un outil maximum par habitant."] }),
    card("outil-fer", "Outil en fer", "Équipement", "🪓", "Outil individuel en fer.", { stats: [["Attaque", "+20"], ["Production", "+50 %"]], conditions: ["Un outil maximum par habitant."] }),
    card("armure-cuir", "Armure en cuir", "Équipement", "🛡", "Armure individuelle légère.", { stats: [["PV", "+15"]], conditions: ["Une armure maximum par habitant."] }),
    card("armure-maille", "Armure en maille", "Équipement", "🛡", "Armure individuelle intermédiaire.", { stats: [["PV", "+35"]], conditions: ["Une armure maximum par habitant."] }),
    card("armure-fer", "Armure en fer", "Équipement", "🛡", "Armure individuelle lourde.", { stats: [["PV", "+50"]], conditions: ["Une armure maximum par habitant."] }),
    card("sentier", "Sentier de randonnée", "Antique", "〽", "Aménagement qui accélère les déplacements dans une région montagneuse.", { stats: [["Vitesse", "+20 %"]], conditions: ["Montagne uniquement."], notes: "Le bonus reste une valeur temporaire d’équilibrage." }),
    card("piege", "Piège", "Antique", "⚠", "Piège qui blesse et ralentit une unité ennemie.", { stats: [["Dégâts", "50"], ["Ralentissement", "−50 % pendant 3 s"]] })
  ];

  const mythological = [
    card("u-mazzeru", "U Mazzeru", "Mythologique", "☾", "Révèle les forces humaines adverses pendant une durée limitée.", { effect: "Révèle le nombre et le rôle des habitants dans toutes les colonnes ennemies pendant 120 secondes." }),
    card("a-stregha", "A Stregha", "Mythologique", "✦", "Maudit une zone ennemie et affaiblit son économie.", { stats: [["Durée", "120 s"]], effect: "La production et le rendement de la zone choisie sont divisés par deux." }),
    card("u-diavulu", "U Diavulu", "Mythologique", "♠", "Brûle une colonne et détruit ses forces économiques.", { effect: "Les habitants, cultures et élevages des deux joueurs meurent dans la colonne sélectionnée, qui devient inutilisable pendant 120 secondes.", biome: "Depuis une Montagne : inflige aussi 125 dégâts au village et à ses bâtiments.", conditions: ["Inutilisable depuis un village détruit."] }),
    card("squadra-arozza", "A Squadra d’Arozza", "Mythologique", "♞", "Ramène les habitants morts récemment.", { effect: "Ressuscite tous les habitants morts pendant les 3 dernières minutes.", biome: "Depuis une Plaine : fenêtre portée à 5 minutes.", notes: "Le lieu de réapparition si le village d’origine est détruit reste à définir." }),
    card("oeil-sainte-lucie", "Œil de Sainte-Lucie", "Mythologique", "◉", "Dissipe durablement le brouillard sur les côtes adverses.", { effect: "Révèle les biomes Littoraux adverses jusqu’à la fin de la partie.", conditions: ["Utilisable uniquement depuis un Littoral."] })
  ];

  E.Cards = Object.freeze({
    rules: Object.freeze({ deckCount: 3, normalDeckMax: 30, copiesPerCardMax: 4, mythologicalMax: 3, futureMythologicalDraw: 2 }),
    normal: Object.freeze(normal),
    mythological: Object.freeze(mythological),
    all: Object.freeze([...normal, ...mythological]),
    get(id) { return this.all.find((item) => item.id === id) || null; }
  });
})();
