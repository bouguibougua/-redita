(function () {
  "use strict";
  const E = window.Eredita;
  let supported = false;
  let supportMessage = "Vérification du navigateur…";
  let starting = false;
  let current = null;
  let entryButton = null;
  const $ = (selector) => document.querySelector(selector);

  function refreshAvailability() {
    const ready = E.Board3D?.ready;
    const tutorial = E.Network?.mode === "tutorial";
    $("#xr-start").disabled = starting || Boolean(current) || !supported || !ready || tutorial;
    $("#xr-status").textContent = tutorial ? "Le tutoriel guidé utilise l’interface classique. Terminez-le avant de passer en réalité mixte."
      : E.Board3D?.error ? "Le rendu 3D est indisponible. La vue 2D reste accessible."
      : supported && !ready ? "Chargement du plateau 3D…" : supportMessage;
  }
  async function checkSupport() {
    supported = false;
    if (!window.isSecureContext) supportMessage = "WebXR exige une adresse HTTPS sécurisée (ou localhost via USB). Une adresse IP en HTTP ne suffit pas.";
    else if (!navigator.xr) supportMessage = "WebXR est indisponible ici. Ouvrez ce site dans Meta Quest Browser sur le casque.";
    else {
      try {
        supported = await navigator.xr.isSessionSupported("immersive-ar");
        supportMessage = supported ? "Réalité mixte disponible. Allumez vos deux contrôleurs puis entrez dans le plateau."
          : "Ce navigateur ne propose pas immersive-ar. Le jeu classique reste disponible.";
      } catch (_) { supportMessage = "Impossible de vérifier WebXR. Vérifiez les autorisations du navigateur."; }
    }
    refreshAvailability();
  }
  function init() {
    document.querySelectorAll("[data-open-xr]").forEach((button) => button.addEventListener("click", () => {
      entryButton = button;
      $("#xr-dialog").showModal();
      checkSupport();
    }));
    $("#xr-close").addEventListener("click", () => $("#xr-dialog").close());
    $("#xr-start").addEventListener("click", start);
    navigator.xr?.addEventListener("devicechange", checkSupport);
    checkSupport();
  }

  function errorMessage(error) {
    if (["NotAllowedError", "SecurityError"].includes(error?.name)) return "Autorisation refusée ou contexte non sécurisé. Autorisez la réalité mixte dans Quest Browser puis réessayez.";
    if (error?.name === "NotSupportedError") return "Cette session AR n’est pas prise en charge. Essayez le placement manuel simplifié.";
    if (error?.name === "InvalidStateError") return "Une session immersive est déjà ouverte. Fermez-la avant de réessayer.";
    return `Le mode AR n’a pas pu démarrer : ${error?.message || error}. Le jeu classique reste disponible.`;
  }
  async function start() {
    const context = E.Board3D.getXRContext();
    if (!context || starting || current || !supported || E.Network.mode === "tutorial") return;
    starting = true;
    $("#xr-start").disabled = true;
    const manualOnly = $("#xr-manual-only").checked;
    let session;
    try {
      // requestSession est appelé directement dans le gestionnaire du clic :
      // aucun chargement/await préalable ne consomme l'activation utilisateur.
      session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["local"],
        optionalFeatures: manualOnly ? [] : ["hit-test", "anchors"]
      });
      const { THREE, renderer, scene, camera, world } = context;
      const saved = {
        background: scene.background, fog: scene.fog, shadow: renderer.shadowMap.enabled,
        clearColor: renderer.getClearColor(new THREE.Color()), clearAlpha: renderer.getClearAlpha(),
        position: camera.position.clone(), quaternion: camera.quaternion.clone(), near: camera.near, far: camera.far,
        worldPosition: world.position.clone(), worldQuaternion: world.quaternion.clone(), worldScale: world.scale.clone(), worldVisible: world.visible
      };
      const root = new THREE.Group(); root.name = "xr-board-placement";
      scene.add(root); root.add(world);
      world.position.set(0, -E.Config.xr.boardBottom, 0); world.quaternion.identity(); world.scale.setScalar(1); world.visible = true;
      scene.background = null; scene.fog = null; renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = false;
      camera.position.set(0, 0, 0); camera.quaternion.identity();
      camera.near = E.Config.xr.cameraNear; camera.far = E.Config.xr.cameraFar; camera.updateProjectionMatrix();
      current = { ...context, session, root, saved, selected: null, manipulation: null, message: "Visez votre table, puis confirmez le repère à la gâchette.", lastPanel: -Infinity, lastTime: null, viewer: null, positioned: false };
      const runtime = current;
      const status = (message) => { runtime.message = message; };
      session.addEventListener("end", cleanup, { once: true });
      current.panels = E.XRPanels.create(context);
      current.input = E.XRInput.create({ ...context, session });
      current.placement = E.XRPlacement.create({ ...context, session, root, manualOnly, playerId: E.GameView.getPlayerId(), status });
      current.interactions = E.XRInteractions.create({ ...context, panels: current.panels });
      current.visibilityChanged = () => {
        runtime.input.reset(); runtime.lastTime = null;
        if (session.visibilityState !== "visible") runtime.message = "Session en attente du retour du suivi.";
      };
      session.addEventListener("visibilitychange", current.visibilityChanged);
      E.Board3D.setXRPreview(true);
      renderer.xr.setReferenceSpaceType("local");
      await renderer.xr.setSession(session);
      if (current !== runtime) return;
      current.space = renderer.xr.getReferenceSpace();
      current.onReset = () => { runtime.placement.resetReference(); runtime.manipulation = null; runtime.selected = null; runtime.positioned = false; runtime.input.reset(); };
      current.space.addEventListener("reset", current.onReset);
      $("#xr-dialog").close();
    } catch (error) {
      if (session) {
        try { await session.end(); } catch (_) { /* La session peut déjà être fermée. */ }
        cleanup();
      }
      supportMessage = errorMessage(error);
    } finally { starting = false; refreshAvailability(); }
  }

  function cleanup() {
    const runtime = current;
    if (!runtime) return;
    current = null;
    const { scene, renderer, camera, world, saved, root, session } = runtime;
    session.removeEventListener("visibilitychange", runtime.visibilityChanged);
    runtime.space?.removeEventListener("reset", runtime.onReset);
    runtime.input?.dispose(); runtime.placement?.dispose(); runtime.interactions?.dispose(); runtime.panels?.dispose();
    E.Board3D.setXRPreview(false);
    scene.add(world); scene.remove(root);
    world.position.copy(saved.worldPosition); world.quaternion.copy(saved.worldQuaternion); world.scale.copy(saved.worldScale); world.visible = saved.worldVisible;
    scene.background = saved.background; scene.fog = saved.fog;
    renderer.setClearColor(saved.clearColor, saved.clearAlpha); renderer.shadowMap.enabled = saved.shadow;
    camera.position.copy(saved.position); camera.quaternion.copy(saved.quaternion); camera.near = saved.near; camera.far = saved.far; camera.updateProjectionMatrix();
    E.UI.render(E.GameView.getState());
    requestAnimationFrame(() => E.Board3D.resize());
    supportMessage = "Session terminée. Le plateau devra être replacé à la prochaine ouverture.";
    refreshAvailability(); entryButton?.focus();
  }
  function end() {
    const runtime = current;
    runtime?.session.end().catch(() => { runtime.message = "Sortie refusée par le navigateur. Utilisez la commande de sortie du casque."; });
  }
  function cancel() {
    const r = current;
    if (r.selected) { r.selected = null; return; }
    if (r.manipulation) { r.manipulation = null; r.placement.endManipulation(); r.message = "Manipulation terminée."; return; }
    if (!r.placement.placed && r.placement.cancelPlacement()) { r.message = "Repositionnement annulé."; return; }
    r.message = "Utilisez Quitter AR pour revenir à l’interface classique.";
  }
  function action(name) {
    const r = current;
    const cfg = E.Config.xr;
    if (name === "exit") return end();
    if (name === "close") { r.selected = null; return; }
    if (name === "manual") return r.placement.setManual(true);
    if (name === "automatic") return r.placement.setManual(false);
    if (name === "height-up" || name === "height-down") return r.placement.height(name === "height-up" ? 1 : -1);
    if (name === "cancel") return cancel();
    if (name === "recenter") {
      r.selected = null; r.manipulation = null;
      r.placement.beginPlacement(); r.panels.position(r.viewer);
      r.message = "Replacez le plateau sur la table avec votre gâchette.";
      return;
    }
    if (["move", "rotate", "size"].includes(name)) {
      r.selected = null; r.manipulation = name; r.placement.beginManipulation();
      r.message = "Préhension : déplacer ; deux mains : taille et rotation.";
      return;
    }
    if (name === "done") { r.manipulation = null; r.placement.endManipulation(); r.message = "Manipulation terminée. Sélectionnez un village."; return; }
    r.placement.adjust(name, r.viewer);
    r.message = `Largeur ${(r.placement.width * 100).toFixed(0)} cm · limites ${cfg.minWidth * 100}–${cfg.maxWidth * 100} cm`;
  }
  function confirm(record, hit) {
    const r = current;
    const target = hit?.object.userData.xrTarget;
    if (target?.kind === "button") { r.input.flash(record, true); return action(target.action); }
    if (target?.kind === "panel") { r.input.flash(record, false); return; }
    if (!r.placement.placed) { r.input.flash(record, r.placement.confirm(record)); return; }
    if (r.manipulation) { r.input.flash(record, false); return; }
    if (target?.kind === "village" && E.GameView.selectVillage(target.playerId, target.lane)) {
      r.selected = { playerId: target.playerId, lane: target.lane };
      r.input.flash(record, true);
      r.message = "Village sélectionné. B ou Fermer pour revenir aux commandes.";
    } else { r.message = "Pointez un village ou un bouton du panneau."; r.input.flash(record, false); }
  }
  function panelContent() {
    const r = current;
    const state = E.GameView.getState();
    const phase = state.phase === "setup" ? "Aperçu du tirage actuel · préparation dans le menu" : state.phase === "ended" ? "Partie terminée" : state.paused ? "Partie en pause" : `Partie en cours · ${Math.floor(state.elapsed)} s`;
    const controllers = r.input.records.filter((record) => record.tracked).map((record) => record.source.handedness === "left" ? "gauche" : record.source.handedness === "right" ? "droite" : "sans main définie");
    const message = controllers.length ? r.message : "Aucun contrôleur suivi. Rallumez vos Touch Plus.";
    // Retours courts, sur deux lignes au maximum, sans réduire la taille du texte.
    const words = message.split(" "); const statusLines = [""];
    words.forEach((word) => { if ((statusLines.at(-1) + word).length > 54) statusLines.push(""); statusLines[statusLines.length - 1] += `${word} `; });
    if (r.selected) {
      const info = E.GameView.villageInfo(r.selected.playerId, r.selected.lane);
      if (!info) { r.selected = null; return panelContent(); }
      const resources = [];
      for (let i = 0; i < info.resources.length; i += 2) resources.push(info.resources.slice(i, i + 2).map((item) => `${item.label} : ${Number(item.amount.toFixed(1))}`).join("   ·   "));
      r.panels.setContent(info.title, [
        `${info.biome} · T${info.level}${info.destroyed ? " · Détruit" : ""}`,
        `PV : ${Math.ceil(info.hp)} / ${info.maxHp} · Habitants : ${info.population}/${info.populationMax}`,
        ...resources,
        "Bâtiments :", ...(info.buildings.length ? info.buildings : ["Aucun bâtiment"])
      ], [[["Fermer (B)", "close"], ["Quitter AR", "exit"]]]);
    } else if (!r.placement.placed) {
      r.panels.setContent("Placement du plateau", [phase,
        r.placement.manual ? "Plan manuel : alignez-le sur votre vraie table." : "Surface horizontale proposée, à vérifier par vous.",
        "La détection ne garantit pas qu’il s’agit d’une table.",
        ...statusLines.slice(0, 2), `Contrôleurs : ${controllers.join(" / ") || "aucun"}`
      ], [
        r.placement.manual ? [["Plus haut", "height-up"], ["Plus bas", "height-down"]] : [["Placement manuel", "manual"]],
        [[r.placement.manual && !r.placement.manualOnly ? "Détection" : "Manuel", r.placement.manual && !r.placement.manualOnly ? "automatic" : "manual"], ["Annuler (B)", "cancel"], ["Quitter AR", "exit"]]
      ]);
    } else if (r.manipulation) {
      const extra = r.manipulation === "move" ? [
        [["Gauche", "left"], ["Avancer", "forward"], ["Droite", "right"]],
        [["Monter", "up"], ["Reculer", "back"], ["Descendre", "down"]]
      ] : r.manipulation === "rotate" ? [[["↶ Rotation", "rotate-left"], ["Rotation ↷", "rotate-right"]]] : [[["Réduire", "shrink"], ["Agrandir", "grow"]]];
      r.panels.setContent(`Manipulation · ${(r.placement.width * 100).toFixed(0)} cm`, [
        "Joystick gauche : déplacer ; droit : pivoter.",
        "Une préhension : déplacer ; deux : taille / rotation.",
        "Les villages sont verrouillés pendant les réglages."
      ], [
        [["Déplacer", "move"], ["Rotation", "rotate"], ["Taille", "size"]], ...extra,
        [["Recentrer", "recenter"], ["Terminer", "done"], ["Quitter AR", "exit"]]
      ]);
    } else {
      r.panels.setContent("Eredità · Réalité mixte", [phase, "Gâchette / A : sélectionner · B : fermer", ...statusLines.slice(0, 2),
        `Contrôleurs : ${controllers.join(" / ") || "aucun"}`,
        r.placement.anchorTracked ? "Ancre active pour cette session." : "Position conservée pour cette session."
      ], [ [["Manipuler", "move"], ["Recentrer", "recenter"], ["Quitter AR", "exit"]] ]);
    }
  }
  function update(timestamp, frame) {
    const r = current;
    if (!r || !frame || !r.space) return;
    const dt = r.lastTime === null ? 0 : Math.min((timestamp - r.lastTime) / 1000, 0.05);
    r.lastTime = timestamp;
    if (r.session.visibilityState !== "visible") { r.input.reset(); return; }
    const pose = frame.getViewerPose(r.space);
    if (!pose) { r.root.visible = false; r.input.reset(); return; }
    r.viewer = { position: new r.THREE.Vector3().copy(pose.transform.position), quaternion: new r.THREE.Quaternion().copy(pose.transform.orientation) };
    if (!r.positioned) { r.panels.position(r.viewer); r.positioned = true; }
    r.input.update(frame, r.space);
    r.placement.update(frame, r.space, r.input.records, r.viewer, timestamp);
    if (r.manipulation && r.placement.placed) r.placement.manipulate(r.input.records, r.viewer, dt);
    E.Board3D.setXRPreview(!r.placement.placed);
    r.interactions.sync();
    r.scene.updateMatrixWorld(true);
    const hovered = new Set();
    const hits = new Map();
    for (const record of r.input.records.filter((item) => item.tracked)) {
      const hit = r.interactions.hit(record, r.placement.placed && !r.manipulation);
      hits.set(record, hit);
      if (hit?.object.userData.xrTarget.kind !== "panel" && hit) hovered.add(hit.object);
      const candidate = r.placement.candidate;
      const canPlace = !r.placement.placed && candidate?.record === record;
      r.input.feedback(record, hit?.distance || (canPlace ? record.position.distanceTo(candidate.position) : null), hovered.has(hit?.object) || canPlace);
    }
    for (const event of r.input.drain()) {
      if (event.type === "cancel") cancel(); else confirm(event.record, hits.get(event.record));
      if (current !== r) return;
      r.lastPanel = -Infinity;
    }
    r.interactions.highlight(hovered, r.selected);
    if (timestamp - r.lastPanel >= E.Config.xr.panelUpdateMs) { panelContent(); r.lastPanel = timestamp; }
  }
  E.XR = { init, update, refreshAvailability, get active() { return Boolean(current); },
    get diagnostics() {
      return current ? {
        mode: current.session.mode || "immersive-ar", visibility: current.session.visibilityState,
        features: Array.from(current.session.enabledFeatures || []),
        placed: current.placement.placed, manual: current.placement.manual,
        width: current.placement.width, anchored: current.placement.anchorTracked,
        manipulation: current.manipulation, selected: current.selected,
        controllers: current.input.records.filter((r) => r.source).map((r) => ({ hand: r.source.handedness, profiles: r.source.profiles, mapping: r.source.gamepad?.mapping, tracked: r.tracked }))
      } : { active: false, supported };
    }
  };
}());
