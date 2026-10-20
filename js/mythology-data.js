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
  // Illustrations individuelles générées à partir de la direction fournie.
  // Aucun lien avec le catalogue historique de cartes ; miroir uniquement sur l’art.
  const art = id => ({ src: `assets/mythology/${id}.webp`, kind: 'illustration', width: 1536, height: 1024,
    crop: { x: 0, y: 0, width: 1, height: 1 } });
  const param = key => configRef('reinforcementPowers.' + key);
  function entry(id, name, category, description, parameters, primary, options = {}) {
    return { id, name, aliases: options.aliases || [],
      lore: options.lore || null,
      visuals: { normal: art(id), reversed: null, motion: options.motion || null, primaryColor: primary, secondaryColor: options.secondary || null,
        paletteStatus: 'provisional' },
      gameplay: { status: 'confirmed', category, categoryStatus: 'classified', description,
        displayDescription: options.displayDescription || description,
        // Texte développé du grimoire ; les choix en partie conservent leur résumé.
        menuDescription: options.menuDescription || [options.displayDescription || description],
        shortDescription: options.shortDescription || description, parameters, targetMode: options.targetMode || 'none',
        source: { document: 'GAME_DESIGN.md', section: 62, decision: 'mythology-2026-10-20' } },
      implementation: { status: 'implemented', effectKey: id, engine: 'MythologyEffects.activate' } };
  }
  const entries = [
    entry('u-mazzeru', 'U Mazzeru', 'vision',
      'Révèle tous les habitants offensifs adverses jusqu’à la fin de la partie.',
      { until: 'match-end', target: 'enemy-offensive-humans' }, '#c73d4d', { lore: { subtitle: "Le chasseur de morts", paragraphs: [
          "U Mazzeru est l'une des figures les plus emblématiques de la mythologie corse. Il s'agit d'un individu possédant un don surnaturel qui lui permet de pressentir la mort d'une personne à travers ses rêves.",
          "Pendant son sommeil, son esprit participe à une chasse nocturne au cours de laquelle il poursuit et tue un animal, généralement un sanglier ou un autre gibier. Lorsqu'il s'approche de sa proie, il découvre que celle-ci possède le visage d'une personne qu'il connaît. Selon la croyance, cette personne est destinée à mourir prochainement.",
          "Le Mazzeru n'est pas nécessairement malveillant. Son pouvoir est souvent involontaire et peut être vécu comme une malédiction. Certaines traditions évoquent également des affrontements entre groupes de Mazzeri, notamment lors des Mandrache, associés au destin des communautés."
        ] },
        menuDescription: [
        'U Mazzeru lève le voile sur les habitants offensifs de votre adversaire. Guerriers, Ravageurs et humains en mission d’attaque deviennent visibles jusqu’à la fin de la partie.',
        'Cette vision permet de suivre les forces ennemies sans révéler les autres civils ni les légendes. Le pouvoir s’applique à l’ensemble du terrain : cliquez sur une région pour l’activer.'
      ] }),
    entry('a-stregha', 'A Strega', 'enchantement',
      'Maudit une région ennemie pendant 2 minutes : son rendement est divisé par deux.',
      { durationSeconds: param('stregaDuration'), productionMultiplier: param('stregaMultiplier') }, '#42b58a',
      { aliases: ['A Stregha'], targetMode: 'enemy-region', lore: { subtitle: "La sorcière corse", paragraphs: [
          "A Stregha est une figure féminine associée à la sorcellerie dans les traditions corses. Elle incarne les craintes liées aux maléfices, aux maladies inexpliquées et aux influences surnaturelles.",
          "Dans les croyances populaires, la sorcière peut être soupçonnée d'agir sur le destin d'autrui par des pratiques magiques. Elle est notamment associée à la crainte du mauvais œil, même si cette croyance dépasse largement la seule figure de la Stregha.",
          "Son personnage témoigne de l'importance des croyances magiques dans les sociétés rurales, où certains malheurs pouvaient être interprétés comme le résultat d'une intervention surnaturelle.",
          "La Stregha ne possède cependant pas une apparence ou une histoire unique : les représentations changent selon les récits."
        ] },
        menuDescription: [
        'A Strega jette une malédiction sur la région ennemie que vous désignez. Pendant deux minutes, son rendement est divisé par deux, freinant les récoltes et la production locale.',
        'Choisissez la région adverse dont vous voulez affaiblir l’économie. Seule cette région est touchée ; à la fin de la malédiction, son rendement revient à la normale.'
      ] }),
    entry('u-stregu', 'U Stregu', 'enchantement',
      'Bénit une région alliée pendant 2 minutes : son rendement est doublé.',
      { durationSeconds: param('streguDuration'), productionMultiplier: param('streguMultiplier') }, '#3a9fea',
      { targetMode: 'allied-region', lore: { subtitle: "Le sorcier corse", paragraphs: [
          "U Stregu est le pendant masculin de A Stregha. Le terme désigne un homme associé à la sorcellerie et aux pratiques magiques.",
          "Dans l'imaginaire populaire, il peut être considéré comme une personne possédant des connaissances ou des capacités dépassant celles des autres habitants. Selon les contextes, ces facultés peuvent être perçues comme dangereuses, mystérieuses ou simplement inhabituelles.",
          "Il faut néanmoins éviter de présenter U Stregu comme un magicien utilisant systématiquement des sorts offensifs : cette représentation relève surtout de la fantasy contemporaine.",
          "Les frontières entre les termes stregu, strigonu, magu et certaines désignations du Mazzeru ne sont pas toujours nettes dans les traditions corses."
        ] },
        menuDescription: [
        'U Stregu bénit une région de votre territoire. Son rendement est multiplié par deux pendant deux minutes : les habitants qui y travaillent profitent de cette production renforcée.',
        'Cliquez sur la région alliée à soutenir. La bénédiction est locale et temporaire ; elle ne double pas les caractéristiques de combat de vos habitants.'
      ] }),
    entry('a-fata', 'A Fata', 'terrain',
      'Place une rivière dans la région choisie et augmente sa vitesse de pêche de 25 %.',
      { fishingSpeedMultiplier: param('fataFishingSpeed') }, '#e7b755', { targetMode: 'any-region', lore: { subtitle: "La fée corse", paragraphs: [
          "A Fata est une créature surnaturelle occupant une place importante dans les contes traditionnels corses.",
          "Les fées sont souvent associées aux sources, aux paysages naturels et aux savoirs mystérieux. Elles possèdent des connaissances auxquelles les êtres humains n'ont normalement pas accès.",
          "Certaines fées apparaissent sous les traits de femmes d'une beauté extraordinaire. Elles peuvent guider les hommes, leur transmettre des secrets ou leur accorder des bienfaits. Toutefois, leur générosité dépend parfois du respect de certaines conditions ou promesses.",
          "La légende de la fée de l'Ortolu ou celle de la fée du Rizzanese illustrent cette relation entre les êtres humains et les puissances surnaturelles.",
          "Dans certains récits, les fées peuvent aussi décider du destin des hommes. Elles ne sont donc pas systématiquement bienveillantes."
        ] },
        menuDescription: [
        'A Fata fait apparaître une rivière dans la région que vous choisissez. Dans cette même région, la vitesse de pêche augmente de 25 %.',
        'La rivière transforme les possibilités du terrain. Le bonus concerne la pêche : il ne remplace pas l’affectation des habitants à leur tâche et n’accélère pas les autres productions.'
      ] }),
    entry('anima-in-pena', 'Anima in Pena', 'invocation',
      'Invoque une âme par mort allié de la colonne. Chaque âme a 1 PV et 1 dégât/s ; elle peut recevoir des tâches, mais aucun métier.',
      { hp: param('animaHp'), dps: param('animaDps'), professionsAllowed: false }, '#51cda6', { targetMode: 'allied-region', shortDescription: 'Une âme par mort allié de la colonne · 1 PV, 1 dégât/s · tâches autorisées.', lore: { subtitle: "L'âme en peine", paragraphs: [
          "L'Anima in Pena, également appelée Anima Persa, représente l'âme d'une personne décédée qui ne parvient pas à rejoindre définitivement l'au-delà.",
          "Selon les croyances corses, ces âmes peuvent appartenir à des personnes mortes sans sépulture, sans messe ou sans que les rites nécessaires à leur passage vers le monde des morts aient été accomplis.",
          "Elles errent alors dans des lieux symbolisant les frontières entre les mondes, notamment les ponts, les cols de montagne et les sources.",
          "Les âmes en peine peuvent troubler les vivants, leur jouer de mauvais tours ou leur apporter le mauvais œil.",
          "Pour se protéger, certaines traditions recommandent de jeter trois pierres lors du franchissement d'un pont, de faire un geste symbolique près de l'eau ou de réciter une formule protectrice.",
          "Ces croyances montrent l'importance des rites funéraires et de la relation entre les vivants et leurs ancêtres dans la culture corse."
        ] },
        menuDescription: [
        'Anima in Pena invoque une âme pour chaque mort allié enregistré dans la colonne choisie. Désignez une région alliée : les âmes y apparaissent, chacune avec 1 PV et 1 dégât par seconde.',
        'Vous pouvez leur confier des tâches, mais aucun métier. Ce sont de nouvelles invocations : elles ne font pas revenir les habitants disparus avec leur ancien équipement.'
      ] }),
    entry('l-orcu', "L’Orcu", 'invocation',
      'Invoque L’Orcu dans la région choisie : 200 PV, 30 dégâts et un déplacement extrêmement lent.',
      { hp: param('orcuHp'), damage: param('orcuDamage'), speed: param('orcuSpeed') }, '#c99554', { aliases: ["L'Orcu"], targetMode: 'any-region', shortDescription: '200 PV · 30 dégâts · déplacement extrêmement lent.', lore: { subtitle: "L'ogre corse", paragraphs: [
          "L'Orcu est une créature ancienne du folklore corse, dont les caractéristiques sont plus complexes que celles d'un simple ogre.",
          "Selon les récits, il peut prendre l'apparence d'un géant, d'un être anthropomorphe ou même d'une créature de petite taille. Il est associé aux lieux mystérieux, aux dolmens, aux sources et aux frontières entre le monde des vivants et celui des morts.",
          "Dans les Agriate, les légendes évoquent un couple d'Orchi qui terrorisait les bergers. Ces créatures sont également associées à la transmission du secret de fabrication du brocciu.",
          "Un autre récit célèbre concerne l'Orcu du Canapali, près de Tavera, qui provoque une crue dévastatrice avant de trouver la mort dans les eaux de la cascade d'A Spusata.",
          "L'Orcu représente ainsi une puissance ancienne, capable de transmettre des connaissances, mais aussi de punir les hommes qui le provoquent."
        ] },
        menuDescription: [
        'L’Orcu entre sur le terrain dans la région que vous désignez. Cette créature dispose de 200 PV et inflige 30 dégâts, mais se déplace extrêmement lentement.',
        'Le choix de son point d’apparition est donc essentiel : sa puissance s’accompagne d’un long trajet s’il est invoqué loin des combats. Cliquez sur une région pour y placer l’invocation.'
      ] }),
    entry('u-magu', 'U Magu', 'enchantement',
      'Le prochain habitant de chaque village allié reçoit des statistiques doublées et une taille augmentée de 50 %, avec une aura violette et dorée.',
      { statMultiplier: param('maguStatMultiplier'), scaleMultiplier: param('maguScale'), residentsPerVillage: param('maguResidentsPerVillage') }, '#b45ae0', { secondary: '#dfbc62', shortDescription: 'Prochain habitant de chaque village : statistiques ×2 et taille +50 %.', lore: { subtitle: "Le magicien", paragraphs: [
          "U Magu est une figure liée à la magie, aux connaissances mystérieuses et aux puissances surnaturelles.",
          "Dans les traditions corses, les personnages désignés par des termes proches de magu peuvent détenir des savoirs extraordinaires, notamment en rapport avec les forces naturelles et certains lieux sacrés.",
          "À l'image des fées, le Magu peut être associé à la connaissance de sources miraculeuses et à la transmission de secrets aux êtres humains.",
          "Cependant, il ne faut pas le confondre avec le magicien classique des univers fantastiques, qui combat à l'aide de boules de feu ou de sorts élémentaires. La figure traditionnelle est davantage liée à la connaissance et à l'accès au surnaturel.",
          "Le terme magu recoupe parfois d'autres figures du folklore, notamment celles associées au mazzérisme."
        ] },
        menuDescription: [
        'U Magu enchante la prochaine naissance de chacun de vos villages. Un seul nouvel habitant par village reçoit des statistiques doublées et une taille augmentée de 50 %.',
        'Une aura violette et dorée permet de reconnaître ces habitants. Le sort ne renforce pas la population déjà présente et ne concerne pas toutes les naissances suivantes. Cliquez sur le terrain pour préparer cette bénédiction dans vos villages.'
      ] }),
    entry('u-surpatore', 'U Surpatore', 'invocation',
      'Invoque un sanglier qui, à sa mort, devient U Surpatore : un vampire rapide de 25 PV et 5 dégâts.',
      { vampireHp: param('vampireHp'), vampireDamage: param('vampireDamage'), vampireSpeed: param('vampireSpeed') }, '#d44351', { targetMode: 'allied-region', shortDescription: 'Un sanglier devient à sa mort un vampire rapide · 25 PV, 5 dégâts.', lore: { subtitle: "Le vampire corse", paragraphs: [
          "U Surpatore, également appelé U Surpadori, est l'une des créatures les plus inquiétantes du folklore corse.",
          "Il s'agit d'un être surnaturel, généralement masculin, qui s'introduit dans les habitations après minuit afin de s'attaquer aux jeunes enfants.",
          "Selon la tradition, il entaille le petit doigt de ses victimes pour en aspirer le sang. Cette caractéristique le rapproche des vampires présents dans d'autres mythologies européennes.",
          "Le Surpatore peut également prendre l'apparence de différents animaux, notamment d'un serpent, d'un chat ou d'une belette, ce qui lui permet de se déplacer discrètement.",
          "Pour protéger les enfants, certaines croyances mentionnent l'utilisation d'un objet appelé Ugna di a Gran Bestia, l'ongle d'une créature monstrueuse auquel étaient attribuées des vertus protectrices."
        ] },
        menuDescription: [
        'U Surpatore apparaît d’abord sous la forme d’un sanglier dans la région alliée choisie. Lorsque le sanglier meurt, il laisse place à sa seconde forme : un vampire rapide.',
        'Le vampire possède 25 PV et inflige 5 dégâts. Les deux formes appartiennent à la même invocation ; la mort du vampire met fin à sa présence sur le terrain.'
      ] }),
    entry('u-lupu-mannaru', 'U Lupu Mannaru', 'invocation',
      'Transforme un habitant sans tâche ni métier, ou le prochain à naître, en loup-garou : 60 PV, 20 dégâts et les propriétés du ravageur. Il attaque uniquement les structures.',
      { hp: param('lupuHp'), damage: param('lupuDamage'), structuresOnly: true, baseRole: 'ravageur' }, '#428bd6', { targetMode: 'allied-region', shortDescription: 'Un habitant devient loup-garou · 60 PV, 20 dégâts · structures uniquement.', lore: { subtitle: "Le loup-garou corse", paragraphs: [
          "U Lupu Mannaru correspond à la figure du loup-garou dans les traditions populaires corses.",
          "Il s'agit d'un être humain associé à une transformation animale, généralement en loup ou en créature possédant des caractéristiques lupines.",
          "Cette transformation est souvent présentée dans le folklore européen comme une malédiction, une punition ou la conséquence d'une influence surnaturelle.",
          "En Corse, la figure du Lupu Mannaru s'inscrit dans un imaginaire rural où les animaux sauvages, les montagnes et les déplacements nocturnes pouvaient susciter la peur.",
          "Les récits évoquent notamment des hommes condamnés à errer pendant la nuit sous une apparence bestiale.",
          "Il convient toutefois de ne pas lui attribuer automatiquement toutes les caractéristiques du loup-garou moderne, comme la transformation obligatoire à chaque pleine lune."
        ] },
        menuDescription: [
        'Dans la région alliée choisie, U Lupu Mannaru transforme un habitant qui n’a ni tâche ni métier. Si aucun habitant ne remplit ces conditions, la transformation attend le prochain nouveau-né.',
        'Le loup-garou possède 60 PV et inflige 20 dégâts. Il adopte les propriétés du Ravageur et attaque uniquement les structures : il ne combat pas les unités ennemies.'
      ] }),
    entry('u-diavulu', 'U Diavule', 'terrain',
      'Brûle les deux régions de la colonne et détruit cultures, élevages et habitants présents sur les terrains. Les habitants à l’intérieur des villages et les bâtiments sont épargnés.',
      { burnDurationSeconds: param('burnDuration'), sparesResidentsInVillage: true, damagesBuildings: false }, '#d63843',
      { aliases: ['u-diavule', 'U Diavulu'], targetMode: 'column', shortDescription: 'Anéantit le village de votre adversaire.',
        motion: { src: 'assets/mythology/u-diavulu-motion.mp4', type: 'video/mp4', width: 960, height: 640, frameRate: 30,
          gif: 'assets/mythology/u-diavulu-motion.gif' },
        lore: { subtitle: "Le Diable", paragraphs: [
          "U Diavule, ou U Diavulu, représente le Diable dans les croyances populaires corses.",
          "Sa présence témoigne de l'influence du christianisme sur des traditions parfois plus anciennes. Dans plusieurs légendes, il remplace des figures surnaturelles antérieures, notamment L'Orcu.",
          "Le Diable intervient fréquemment dans les récits expliquant la formation de certains paysages ou monuments naturels.",
          "L'une de ces histoires concerne le Capu Tafunatu, une montagne célèbre pour son immense ouverture rocheuse. Selon la légende, le Diable, furieux d'avoir perdu un pari avec un berger, aurait lancé son marteau contre la montagne, la traversant et créant ainsi le trou visible aujourd'hui.",
          "D'autres traditions associent le Diable aux trésors cachés, aux dolmens et aux lieux considérés comme dangereux ou sacrés."
        ] },
        displayDescription: 'Anéantit le village de votre adversaire.' }),
    entry('a-stregha-bianca', 'A Strega Bianca', 'enchantement',
      'Pendant la prochaine minute, chaque humain allié qui devrait mourir revient au début de son terrain, en pleine vie, avec sa tâche et son équipement. Sans effet sur les légendes.',
      { durationSeconds: param('biancaDuration'), legendsAllowed: false, restoreTask: true, restoreEquipment: true }, '#e2e7f0',
      { aliases: ['A Stregha Bianca'], secondary: '#d8ba69',
        motion: { src: 'assets/mythology/a-stregha-bianca-motion.mp4', type: 'video/mp4', width: 1024, height: 586, frameRate: 30 },
        shortDescription: 'Pendant 1 minute, vos humains échappent à la mort et reviennent en pleine vie.', lore: { subtitle: "La Dame blanche", paragraphs: [
          "A Stregha Bianca est une apparition féminine surnaturelle connue dans certaines traditions de Corse-du-Sud.",
          "La légende est notamment associée à la région du Taravu et aux environs de Cauro, où des récits de veillées évoquaient une mystérieuse femme blanche apparaissant aux voyageurs pendant la nuit.",
          "Cette apparition pouvait être interprétée de différentes manières. Elle pouvait effrayer les personnes qui la rencontraient, mais également intervenir pour leur éviter un danger mortel.",
          "La Stregha Bianca possède donc un caractère ambigu : elle n'est pas nécessairement malveillante et peut parfois jouer le rôle d'une protectrice.",
          "Elle se rapproche des nombreuses traditions européennes concernant les Dames blanches, apparitions associées à la mort, aux avertissements et aux lieux isolés."
        ] },
        menuDescription: [
        'Pendant la minute qui suit l’activation, chaque humain allié qui devrait mourir est ramené au début de son terrain en pleine vie. Il conserve son équipement et sa tâche ; une lueur verte et dorée accompagne la protection.',
        'Le sort protège uniquement des morts à venir : il ne ressuscite pas les habitants déjà disparus et ne s’applique pas aux légendes. Cliquez sur le terrain pour protéger vos humains.'
      ] }),
    entry('squadra-arozza', "A Squadra d’Arozza", 'invocation',
      'Ressuscite tous les habitants alliés morts durant la dernière minute.',
      { resurrectionWindowSeconds: param('resurrectionWindow') }, '#4cb4ca', { aliases: ["a-squadra-d-arozza", "A Squadra d'Arozza"], lore: { subtitle: "La procession des morts", paragraphs: [
          "A Squadra d'Arozza est une procession surnaturelle composée de morts, d'esprits et parfois de personnes dont l'esprit participe au cortège pendant leur sommeil.",
          "Cette confrérie parcourt les chemins et les villages pour chercher l'âme d'une personne destinée à mourir prochainement.",
          "Dans certaines versions, les membres de la procession portent des cierges et accompagnent un cercueil. Rencontrer ce cortège est considéré comme un présage particulièrement inquiétant.",
          "La légende raconte qu'il ne faut surtout pas accepter un cierge tendu par l'un de ses membres. Celui-ci peut se transformer en ossement ou en bras d'enfant, et son acceptation peut entraîner la personne vivante dans le monde surnaturel de la confrérie.",
          "Le cortège est également associé à la nuit des morts, autour du 2 novembre, période durant laquelle les défunts étaient traditionnellement honorés."
        ] },
        menuDescription: [
        'A Squadra d’Arozza rappelle tous vos habitants humains morts au cours de la dernière minute. Ils retrouvent leur métier et leur équipement, puis rejoignent leur village d’origine ou le village survivant le plus proche.',
        'Si le village d’accueil est plein ou brûlé, leur retour attend une place disponible. Un même décès ne peut pas être ressuscité deux fois. Ce rappel ne concerne pas les légendes ; cliquez sur le terrain pour l’activer.'
      ] }),
    entry('a-mumma', 'A Mumma', 'enchantement',
      'Fait faire demi-tour à tous les ennemis présents dans les territoires alliés.',
      { target: 'enemies-in-allied-territories' }, '#a49cab', { lore: { subtitle: "Le cortège funèbre surnaturel", paragraphs: [
          "A Mumma, également appelée A Mubba, désigne une procession funèbre fantomatique dans certaines traditions corses.",
          "Elle réunit des revenants, des Mazzeri ou d'autres esprits liés au monde des morts. Ce cortège vient chercher l'âme d'une personne dont le décès est annoncé.",
          "A Mumma est parfois décrite comme une sorte d'enterrement surnaturel, reproduisant à l'avance les funérailles d'une personne encore vivante.",
          "Certaines croyances indiquent qu'il serait possible d'échapper à ce destin en intervenant avant que la procession ne franchisse un cours d'eau.",
          "A Mumma et A Squadra d'Arozza sont donc très proches : selon les régions, elles peuvent désigner des manifestations similaires plutôt que deux créatures entièrement différentes."
        ] },
        menuDescription: [
        'A Mumma contraint les ennemis présents dans vos territoires à faire demi-tour et à repartir vers leur propre village. Tous les intrus concernés sont touchés au moment de l’activation.',
        'Le pouvoir couvre l’ensemble de vos terres : il suffit de cliquer sur le terrain. Les ennemis qui se trouvent encore dans leurs territoires ne sont pas concernés par ce repli.'
      ] }),
    entry('i-lacrimenti', 'I Lacramanti', 'enchantement',
      'Renforce les humains alliés de la colonne de +2 PV et +1 dégât par mort allié sur cette colonne depuis le début de la partie. Sans effet sur les autres légendes.',
      { hpPerDeath: param('lacramantiHpPerDeath'), damagePerDeath: param('lacramantiDamagePerDeath'), alliesOnly: true, humansOnly: true }, '#47c8b6',
      { aliases: ['I Lacrimenti', 'I Lacramanti'], targetMode: 'column', shortDescription: 'Vos humains de la colonne : +2 PV, +1 dégât par mort allié depuis le début.', lore: { subtitle: "Les esprits du brouillard", paragraphs: [
          "Les Lacramanti, également appelés Lagramanti, sont des esprits surnaturels associés aux brouillards, aux rivières et aux zones humides de Corse.",
          "Selon la tradition, ils habitent près des fleuves, des lacs et des pozzi, ces zones humides caractéristiques des montagnes corses.",
          "Lorsque le brouillard apparaît, ces esprits peuvent remonter vers les villages et s'attaquer aux personnes qu'ils rencontrent, notamment aux femmes et aux enfants.",
          "Les récits racontent qu'ils peuvent saisir leurs victimes par les cheveux pour les entraîner jusqu'à leurs repaires, où ils se nourrissent de leur sang ou de leur énergie vitale.",
          "Pour éviter ces créatures, les familles pouvaient empêcher les enfants de sortir pendant les journées de brouillard. Les femmes attachaient également leurs cheveux ou les dissimulaient sous un foulard.",
          "Le fer était considéré comme une protection efficace contre les Lacramanti.",
          "Cette légende témoigne de la manière dont les phénomènes naturels, comme les brouillards épais des montagnes, pouvaient être interprétés comme des manifestations surnaturelles."
        ] },
        menuDescription: [
        'I Lacramanti puise sa force dans les pertes alliées de la colonne choisie, comptées depuis le début de la partie. Chaque mort allié y apporte un bonus de 2 PV et de 1 dégât à vos humains présents sur cette colonne.',
        'Seuls vos humains reçoivent ce renfort : les ennemis et les autres légendes en sont exclus. Cliquez sur une région de la colonne à renforcer ; le bonus dépend des pertes qui y ont été enregistrées.'
      ] }),
    entry('u-fullettu', 'U Fullettu', 'invocation',
      'Invoque cinq follets à des endroits aléatoires de vos territoires. Très rapides, ils ont 20 PV et 0 dégât ; ils récoltent les ressources ennemies et les déposent directement dans votre banque locale.',
      { count: param('fullettuCount'), hp: param('fullettuHp'), damage: param('fullettuDamage'), speed: param('fullettuSpeed'),
        gatherInterval: param('fullettuGatherInterval'), gatherAmount: param('fullettuGatherAmount') }, '#4f8edc', { shortDescription: '5 follets · 20 PV, 0 dégât · très rapides · récoltes vers votre banque.', lore: { subtitle: "Le lutin farceur", paragraphs: [
          "U Fullettu est un petit être surnaturel du folklore corse, comparable aux lutins et aux farfadets présents dans d'autres traditions européennes.",
          "Il est généralement présenté comme une créature espiègle qui aime déranger les habitants, particulièrement pendant la nuit.",
          "Certaines descriptions lui attribuent une main de fer ou de plomb et une autre faite d'étoupe. Il peut s'introduire dans les habitations pour jouer de mauvais tours aux personnes endormies, notamment en retirant leurs couvertures, en les frappant ou en mouillant leur lit.",
          "Dans d'autres croyances, le terme fuddettu est également associé à un vent tourbillonnant soudain, manifestation naturelle à laquelle une signification surnaturelle pouvait être attribuée.",
          "Le Fullettu se distingue donc des créatures directement associées à la mort : il incarne davantage le désordre, les farces et les phénomènes mystérieux du quotidien."
        ] },
        menuDescription: [
        'U Fullettu fait apparaître cinq follets à des endroits aléatoires de vos territoires. Chacun possède 20 PV, n’inflige aucun dégât et se déplace très rapidement pour s’introduire dans les villages adverses.',
        'Ils y récoltent des ressources à la place de l’ennemi et les transfèrent directement dans votre banque locale. Cliquez sur le terrain pour les invoquer : leurs points d’apparition sont déterminés automatiquement.'
      ] }),
    entry('oeil-sainte-lucie', 'Œil de Sainte-Lucie', 'vision',
      'Révèle intégralement les régions littorales adverses, habitants compris, jusqu’à la fin de la partie.',
      { until: 'match-end', target: 'enemy-coastal-regions' }, '#e0ba69', { aliases: ['ochju-di-santa-lucia', 'Ochju di Santa Lucia', 'Œil de Sainte-Lucie'], lore: { subtitle: "Le talisman protecteur", paragraphs: [
          "L'Œil de Sainte-Lucie est un symbole de protection particulièrement répandu en Corse.",
          "Il s'agit de l'opercule d'un mollusque marin, reconnaissable à sa forme arrondie et à sa spirale blanche. Cet objet naturel est traditionnellement considéré comme un porte-bonheur capable de protéger contre le mauvais œil.",
          "Selon une version de la légende, Sainte Lucie, jeune chrétienne originaire de Syracuse, aurait renoncé à ses yeux pour préserver sa foi. La Vierge Marie lui aurait ensuite rendu la vue et offert des yeux encore plus beaux.",
          "Les opercules retrouvés sur les plages méditerranéennes seraient devenus le symbole de ces yeux miraculeux.",
          "En Corse, l'Œil de Sainte-Lucie est fréquemment porté sous forme de bijou. On lui attribue des vertus de protection, de chance et de prospérité."
        ] },
        menuDescription: [
        'L’Œil de Sainte-Lucie révèle intégralement les régions littorales de votre adversaire, ainsi que les personnages qui s’y trouvent. Cette vision demeure jusqu’à la fin de la partie.',
        'Le pouvoir concerne les Littoraux ennemis ; les autres biomes restent soumis à leur visibilité habituelle. Aucun Littoral allié n’est nécessaire pour l’activer : choisissez la légende puis cliquez sur le terrain.'
      ] })
  ];
  E.Config.mythology = freeze({ schemaVersion: 1, categories, entries,
    // Présentation partagée par l’aperçu et la partie, sans activation des pouvoirs.
    crystal: { duration: 4.4, splitAt: 1.4, splitDuration: 1.2, revealAt: 2.5, revealDuration: 1.1,
      cardsAppearAt: .5, cardsDeployDuration: .95, cardOuterInset: 16,
      crystalHeightPixels: 72,
      beamSegments: 24, beamsFadeAt: 1.2, beamsFadeDuration: .8,
      maxPixelRatio: 1.5, desktopFps: 60, mobileFps: 30, mobileBreakpoint: 600, particleCount: 48 },
    codex: { duration: 1200, swapAt: 480, slideDuration: 720, textDuration: 180, crystalHeightPixels: 112,
      shardCount: 18, arcCount: 7, arcSegments: 18, ambientFps: 30, particleSize: .04, particleOpacity: .65,
      arcSpeed: .18, arcLength: .23, arcSurfaceOffset: 1.035, flashDuration: 300, flashOpacity: .28 }
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
