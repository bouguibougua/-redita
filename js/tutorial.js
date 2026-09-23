(function () {
  "use strict";

  const E = window.Eredita = window.Eredita || {};
  const AUDIO_ROOT = "assets/audio/tutorial/";
  const TUTORIAL_BIOMES = ["plaine", "littoral", "montagne", "montagne"];
  const FINAL_BIOMES = ["plaine", "plaine", "littoral", "montagne"];
  const PLAINS_DECK_INDEX = 1;

  const dialogues = {
    choixDeck: ["tutoriel_choix_deck.mp3", "Bien, maintenant, avant de commencer, il faudrait choisir ton deck. Les trois decks disponibles sont : spécial montagne, spécial plaine et spécial littoral.", false],
    deckPlaine: ["tutoriel_deck_plaine.mp3", "Commence par choisir le deck plaine. C'est le plus évident pour commencer.", false],
    choixTerritoire: ["tutoriel_choix_territoire.mp3", "Ensuite, tu dois décider de ton territoire.", true],
    territoireExplication: ["tutoriel_territoire_explication.mp3", "Comme tu peux le voir, tu commences obligatoirement avec au moins deux terrains différents, et l'un d'entre eux en double.", true],
    echangeTerrain: ["tutoriel_echange_terrain.mp3", "Si tu veux, tu peux échanger jusqu'à deux terrains contre de nouveaux terrains aléatoires.", true],
    optimiserPlaine: ["tutoriel_optimiser_plaine.mp3", "Pour optimiser le deck que tu as choisi, je te conseille d'essayer d'avoir un maximum de terrains de plaine.", false],
    territoireValide: ["tutoriel_territoire_valide.mp3", "C'est déjà mieux comme ça. Maintenant, on peut jouer.", false],
    plateau: ["tutoriel_plateau.mp3", "Voilà comment ça se présente.", false],
    quatreVillages: ["tutoriel_quatre_villages.mp3", "Tu as quatre villages.", true],
    objectif: ["tutoriel_objectif.mp3", "Le but est de détruire les quatre villages adverses.", true],
    attaqueHabitants: ["tutoriel_attaque_habitants.mp3", "Pour cela, tu dois attaquer avec les habitants de tes villages.", true],
    ameliorations: ["tutoriel_ameliorations.mp3", "Les villages et les villageois peuvent être améliorés au cours de la partie.", true],
    champsBle: ["tutoriel_champs_ble.mp3", "Place quatre champs de blé dans cette zone.", false],
    recolteBle: ["tutoriel_recolte_ble.mp3", "Bien. Maintenant, demande à un habitant d'aller récolter le blé.", false],
    batiments: ["tutoriel_batiments.mp3", "Tu peux placer des bâtiments pour acheter des équipements et attribuer des métiers à tes villageois.", true],
    bergerie: ["tutoriel_bergerie.mp3", "Place une bergerie dans cette plaine.", false],
    premierMetier: ["tutoriel_premier_metier.mp3", "Maintenant, tu peux attribuer un métier à ton villageois. Ça le fera travailler plus vite, tu verras.", false],
    alerteAttaque: ["tutoriel_alerte_attaque.mp3", "Attention ! Un ennemi attaque !", true],
    defendre: ["tutoriel_defendre.mp3", "Sélectionne un villageois et ordonne-lui d'attaquer.", false],
    contreAttaque: ["tutoriel_contre_attaque.mp3", "On a repoussé cette attaque. Mais maintenant, on va leur montrer de quel bois on se chauffe !", true],
    artisanat: ["tutoriel_artisanat.mp3", "Construis un artisanat à côté de la bergerie.", false],
    tousGuerriers: ["tutoriel_tous_guerriers.mp3", "Bieeen ! Regarde ce bouton-là. Il permet d'attribuer le métier de guerrier à tout le monde.", false],
    attaqueGenerale: ["tutoriel_attaque_generale.mp3", "Hooooo ! Et regarde celui-là. Il permet de donner l'ordre à tout le monde d'attaquer. Essaie un peu pour voir.", false],
    premierVillage: ["tutoriel_premier_village_detruit.mp3", "Bien ! Ça en fait un sur les quatre. Maintenant que tu as compris, je peux te laisser finir le travail tout seul.", true],
    dernierePrecision: ["tutoriel_derniere_precision.mp3", "Ah oui, c'est vrai ! Une dernière précision. Ces terrains-là sont un peu particuliers.", false],
    montagne: ["tutoriel_montagne.mp3", "Celui-là, c'est le terrain montagneux. Il ralentit tous ceux qui essaient d'y pénétrer. Et deux de ses quatre emplacements permettent d'élever uniquement du bétail.", true],
    littoral: ["tutoriel_littoral.mp3", "Et celui-là, c'est le littoral. Il n'y a que deux emplacements, mais pour t'attaquer, l'ennemi devra trouver un moyen de traverser la mer.", false]
  };

  let controller = null;
  let stateRef = null;
  let active = false;
  let stage = "idle";
  let dialogueActive = false;
  let typingTimer = null;
  let autoTimer = null;
  let fullText = "";
  let shownText = "";
  let dialogueManual = false;
  let dialogueDone = null;
  let dialogueAudio = null;
  let enemyDelay = 0;
  let enemyResidentId = null;
  let defenderResidentId = null;
  let specialExplanationShown = false;
  let renderedStage = null;

  function elements() {
    return {
      dialog: document.querySelector("#tutorial-dialog"),
      text: document.querySelector("#tutorial-dialog-text"),
      prompt: document.querySelector("#tutorial-dialog-continue"),
      end: document.querySelector("#tutorial-end")
    };
  }

  function clearDialogueTimers() {
    clearInterval(typingTimer);
    clearTimeout(autoTimer);
    typingTimer = null;
    autoTimer = null;
  }

  function finishTyping() {
    clearInterval(typingTimer);
    typingTimer = null;
    shownText = fullText;
    const ui = elements();
    ui.text.textContent = fullText;
    ui.prompt.hidden = !dialogueManual;
    if (!dialogueManual) autoTimer = setTimeout(completeDialogue, 650);
  }

  function completeDialogue() {
    if (!dialogueActive || shownText !== fullText) return;
    clearDialogueTimers();
    dialogueActive = false;
    const ui = elements();
    ui.dialog.hidden = true;
    ui.prompt.hidden = true;
    dialogueAudio?.pause();
    dialogueAudio = null;
    const callback = dialogueDone;
    dialogueDone = null;
    callback?.();
  }

  function showDialogue(id, done) {
    const [audioFile, text, manual] = dialogues[id];
    clearDialogueTimers();
    dialogueAudio?.pause();
    dialogueActive = true;
    dialogueManual = manual;
    dialogueDone = done;
    fullText = text;
    shownText = "";
    const ui = elements();
    clearHighlights();
    ui.dialog.hidden = false;
    ui.prompt.hidden = true;
    ui.text.textContent = "";
    let index = 0;
    typingTimer = setInterval(() => {
      index += 1;
      shownText = text.slice(0, index);
      ui.text.textContent = shownText;
      if (index >= text.length) finishTyping();
    }, 22);
    try {
      dialogueAudio = new Audio(`${AUDIO_ROOT}${audioFile}`);
      dialogueAudio.play().catch(() => {});
      dialogueAudio.addEventListener("error", () => { dialogueAudio = null; }, { once: true });
    } catch (_) { dialogueAudio = null; }
    if (id === "quatreVillages") document.querySelectorAll(".village-token.red").forEach((element) => element.classList.add("tutorial-highlight"));
    if (id === "montagne") document.querySelector(".region.red.montagne")?.classList.add("tutorial-highlight", "tutorial-biome-focus");
    if (id === "littoral") document.querySelector(".region.red.littoral")?.classList.add("tutorial-highlight", "tutorial-biome-focus");
  }

  function onDialogueClick() {
    if (!dialogueActive) return;
    if (shownText !== fullText) {
      finishTyping();
      return;
    }
    if (dialogueManual) completeDialogue();
  }

  function setBiomes(player, biomes) {
    player.villages.forEach((village, lane) => {
      village.biome = biomes[lane];
      village.slots = E.Biomes.createSlots(biomes[lane]);
    });
  }

  function start(state) {
    active = true;
    stateRef = state;
    stage = "intro";
    specialExplanationShown = false;
    state.tutorial = { populationLocked: true, freePlay: false, noTimer: true, finished: false };
    setBiomes(state.players.red, TUTORIAL_BIOMES);
    setBiomes(state.players.blue, TUTORIAL_BIOMES);
    state.players.red.selectedDeck = 0;
    state.players.red.setupConfirmed = false;
    state.players.red.setupSelection = [];
    state.players.blue.name = "Apprenti adverse";
    state.players.blue.setupConfirmed = true;
    state.players.blue.selectedDeck = PLAINS_DECK_INDEX;
    const firstVillage = state.players.red.villages[0];
    firstVillage.residents = firstVillage.residents.slice(0, 5);
    firstVillage.population = 5;
    document.body.classList.add("tutorial-mode", "tutorial-guided");
    showDialogue("choixDeck", () => showDialogue("deckPlaine", () => {
      stage = "chooseDeck";
      render(state);
    }));
    E.UI.render(state);
  }

  function allow(method, args, state) {
    if (!active || state.tutorial?.freePlay) return true;
    if (dialogueActive) return false;
    const selectedResident = state.selectedResidentId;
    if (stage === "chooseDeck") return method === "selectDeck" && args[0] === "red" && args[1] === PLAINS_DECK_INDEX;
    if (stage === "exchange") {
      if (method === "toggleBiome") return args[0] === "red" && [1, 2].includes(args[1]);
      if (method === "confirmBiomes") return args[0] === "red" && args[1] === "exchange" && [1, 2].every((lane) => state.players.red.setupSelection.includes(lane)) && state.players.red.setupSelection.length === 2;
      return false;
    }
    if (stage === "launch") return method === "start";
    if (stage === "fields") return method === "placeCrop" && args[0] === "ble";
    if (stage === "harvest") return method === "selectResident" || (method === "assignResidentMission" && args[0] === selectedResident && args[1] === "agriculture");
    if (stage === "buildBergerie") return method === "build" && args[0] === "bergerie";
    if (stage === "profession") return method === "selectResident" || (method === "setProfession" && args[0] === selectedResident && args[1] === "agriculteur");
    if (stage === "defend") {
      if (method === "selectResident") return args[0] === defenderResidentId;
      if (method === "assignResidentMission" && args[0] === defenderResidentId && args[1] === "attaque") {
        state.paused = false;
        return true;
      }
      return false;
    }
    if (stage === "buildArtisanat") return method === "build" && args[0] === "artisanat";
    if (stage === "warriors") return method === "assignProfessionToAll" && args[0] === "guerrier";
    if (stage === "generalAttack") return method === "assignAllResidents" && args[0] === "attaque";
    return false;
  }

  function beginTerritoryDialogues() {
    showDialogue("choixTerritoire", () => showDialogue("territoireExplication", () => showDialogue("echangeTerrain", () => showDialogue("optimiserPlaine", () => {
      stage = "exchange";
      render(stateRef);
    }))));
  }

  function beginBoardDialogues() {
    showDialogue("plateau", () => showDialogue("quatreVillages", () => showDialogue("objectif", () => showDialogue("attaqueHabitants", () => showDialogue("ameliorations", () => showDialogue("champsBle", () => {
      stage = "fields";
      render(stateRef);
    }))))));
  }

  function afterAction(method, args, state) {
    if (!active) return;
    stateRef = state;
    if (stage === "chooseDeck" && method === "selectDeck") {
      beginTerritoryDialogues();
    } else if (stage === "exchange" && method === "confirmBiomes") {
      setBiomes(state.players.red, FINAL_BIOMES);
      state.players.red.setupConfirmed = true;
      showDialogue("territoireValide", () => { stage = "launch"; render(state); });
    } else if (stage === "launch" && method === "start") {
      beginBoardDialogues();
    } else if (stage === "fields" && method === "placeCrop") {
      const fields = state.players.red.villages[0].slots.filter((slot) => slot.content?.category === "crop" && slot.content.type === "ble").length;
      if (fields === 4) showDialogue("recolteBle", () => { stage = "harvest"; render(state); });
    } else if (stage === "harvest" && method === "assignResidentMission") {
      const farmer = state.players.red.villages[0].residents.find((resident) => resident.mission === "agriculture");
      if (farmer) showDialogue("batiments", () => showDialogue("bergerie", () => { stage = "buildBergerie"; render(state); }));
    } else if (stage === "buildBergerie" && method === "build" && E.Buildings.has(state.players.red.villages[0], "bergerie")) {
      showDialogue("premierMetier", () => { stage = "profession"; render(state); });
    } else if (stage === "profession" && method === "setProfession") {
      const farmer = state.players.red.villages[0].residents.find((resident) => resident.mission === "agriculture" && resident.profession === "agriculteur");
      if (farmer) { stage = "enemyDelay"; enemyDelay = 5; }
    } else if (stage === "defend" && method === "assignResidentMission") {
      stage = "combatWait";
    } else if (stage === "buildArtisanat" && method === "build" && E.Buildings.has(state.players.red.villages[0], "artisanat")) {
      showDialogue("tousGuerriers", () => { stage = "warriors"; render(state); });
    } else if (stage === "warriors" && method === "assignProfessionToAll") {
      const village = state.players.red.villages[0];
      if (village.residents.filter((resident) => resident.profession === "guerrier").length === 3) {
        showDialogue("attaqueGenerale", () => { stage = "generalAttack"; render(state); });
      }
    } else if (stage === "generalAttack" && method === "assignAllResidents") {
      stage = "destroyVillage";
    } else if (state.tutorial?.freePlay && method === "selectVillage" && !specialExplanationShown) {
      const village = state.players[args[0]]?.villages[args[1]];
      if (args[0] === "red" && ["montagne", "littoral"].includes(village?.biome)) explainSpecialBiomes(state);
    }
  }

  function spawnEnemy(state) {
    const village = state.players.blue.villages[0];
    const resident = village.residents.find((item) => item.mission === "disponible" && !item.unitId);
    if (!resident) return;
    resident.profession = "habitant";
    if (!E.Economy.deployResident(state, "blue", 0, resident.id, "attaque")) return;
    enemyResidentId = resident.id;
    defenderResidentId = state.players.red.villages[0].residents.find((item) => item.mission === "disponible")?.id || null;
    showDialogue("alerteAttaque", () => {
      state.paused = true;
      showDialogue("defendre", () => { stage = "defend"; render(state); });
    });
    stage = "alert";
  }

  function unlockFreePlay(state) {
    state.tutorial.populationLocked = false;
    state.tutorial.freePlay = true;
    stage = "freePlay";
    document.body.classList.remove("tutorial-guided");
    clearHighlights();
  }

  function explainSpecialBiomes(state) {
    specialExplanationShown = true;
    state.paused = true;
    if (document.querySelector("#battlefield")?.classList.contains("three-mode")) E.Board3D?.toggle();
    showDialogue("dernierePrecision", () => {
      showDialogue("montagne", () => {
        showDialogue("littoral", () => {
          stage = "return3d";
          render(state);
        });
      });
    });
  }

  function update(state, delta) {
    if (!active) return;
    stateRef = state;
    if (stage === "enemyDelay") {
      enemyDelay -= delta;
      if (enemyDelay <= 0) spawnEnemy(state);
    } else if (stage === "combatWait") {
      const redAlive = state.players.red.villages[0].residents.some((resident) => resident.id === defenderResidentId);
      const blueAlive = state.players.blue.villages[0].residents.some((resident) => resident.id === enemyResidentId);
      if (!redAlive && !blueAlive) {
        showDialogue("contreAttaque", () => showDialogue("artisanat", () => { stage = "buildArtisanat"; render(state); }));
        stage = "counterDialogue";
      }
    } else if (stage === "destroyVillage" && state.players.blue.villages[0].destroyed) {
      stage = "firstVillageDialogue";
      showDialogue("premierVillage", () => unlockFreePlay(state));
    }
    if (state.phase === "ended" && state.result === "red" && !state.tutorial.finished) {
      state.tutorial.finished = true;
      finish(state);
    }
  }

  function clearHighlights() {
    renderedStage = null;
    document.querySelectorAll(".tutorial-highlight, .tutorial-biome-focus").forEach((element) => element.classList.remove("tutorial-highlight", "tutorial-biome-focus"));
  }

  function highlight(selector, all = false) {
    const targets = all ? document.querySelectorAll(selector) : [document.querySelector(selector)].filter(Boolean);
    targets.forEach((element) => element.classList.add("tutorial-highlight"));
  }

  function render(state) {
    if (!active) return;
    if (dialogueActive) return;
    if (renderedStage === stage && document.querySelector(".tutorial-highlight")) return;
    clearHighlights();
    if (stage === "chooseDeck") highlight('[data-setup-deck="1"][data-player="red"]');
    else if (stage === "exchange") { highlight('[data-biome-choice][data-player="red"][data-lane="1"]'); highlight('[data-biome-choice][data-player="red"][data-lane="2"]'); highlight('[data-setup-action="exchange"][data-player="red"]'); }
    else if (stage === "launch") highlight("#start-game");
    else if (stage === "fields") {
      if (document.querySelector("#battlefield")?.classList.contains("three-mode")) E.Board3D?.toggle();
      document.querySelectorAll('[data-slot-visual][data-player="red"][data-lane="0"]').forEach((element) => element.classList.add("tutorial-highlight"));
    }
    else if (stage === "harvest") { highlight('#residents-panel [data-select-resident][data-resident-state="disponible"]'); highlight('#residents-panel [data-resident-mission="agriculture"]'); }
    else if (stage === "buildBergerie") highlight('#residents-panel [data-build="bergerie"]');
    else if (stage === "profession") { highlight('#residents-panel [data-select-resident][data-resident-state="agriculture"]'); highlight('#residents-panel [data-profession="agriculteur"]'); }
    else if (stage === "defend") { highlight(`#residents-panel [data-select-resident="${defenderResidentId}"]`); highlight('#residents-panel [data-resident-mission="attaque"]'); }
    else if (stage === "buildArtisanat") highlight('#residents-panel [data-build="artisanat"]');
    else if (stage === "warriors") highlight('#residents-panel [data-profession-all="guerrier"]');
    else if (stage === "generalAttack") highlight('#residents-panel [data-assign-all="attaque"]');
    else if (stage === "return3d") highlight("#toggle-board-view");
    renderedStage = stage;
    if (!state.tutorial.freePlay) document.body.classList.add("tutorial-guided");
  }

  function onSlotClick(event) {
    if (!active || stage !== "fields" || dialogueActive) return;
    const slot = event.target.closest('[data-slot-visual][data-player="red"][data-lane="0"]');
    if (!slot) return;
    event.preventDefault();
    event.stopPropagation();
    const index = Number(slot.dataset.slotIndex);
    const target = stateRef.players.red.villages[0].slots[index];
    if (!target?.content) controller.placeCrop("ble", index);
  }

  function finish(state) {
    clearDialogueTimers();
    clearHighlights();
    dialogueAudio?.pause();
    document.body.classList.remove("tutorial-guided");
    document.querySelector("#result-dialog").hidden = true;
    elements().end.hidden = false;
  }

  function init(options) {
    controller = options.controller;
    document.querySelector("#tutorial-dialog").addEventListener("click", onDialogueClick);
    document.addEventListener("click", onSlotClick, true);
    document.querySelector("#toggle-board-view").addEventListener("click", () => {
      if (!active || stage !== "return3d") return;
      if (!document.querySelector("#battlefield")?.classList.contains("three-mode")) return;
      stage = "freePlay";
      stateRef.paused = false;
      clearHighlights();
    });
    document.querySelector("#tutorial-return-menu").addEventListener("click", () => location.reload());
  }

  E.Tutorial = {
    init, start, allow, afterAction, update, render,
    get active() { return active; },
    get stage() { return stage; },
    get dialogueActive() { return dialogueActive; },
    get debug() { return stateRef ? { stage, paused: stateRef.paused, units: stateRef.units.map((unit) => ({ ownerId: unit.ownerId, residentId: unit.residentId, hp: unit.hp, position: unit.position })), redResidents: stateRef.players.red.villages[0].residents.map((resident) => ({ id: resident.id, mission: resident.mission })), blueResidents: stateRef.players.blue.villages[0].residents.map((resident) => ({ id: resident.id, mission: resident.mission })) } : null; },
    get freePlay() { return Boolean(stateRef?.tutorial?.freePlay); },
    get deckLabels() { return ["Spécial Montagne", "Spécial Plaine", "Spécial Littoral"]; },
    dialogues
  };
}());
