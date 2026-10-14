(function () {
  "use strict";

  const E = window.Eredita = window.Eredita || {};
  const $ = (selector) => document.querySelector(selector);
  const touchProfiles = new Set(["meta-quest-touch-plus", "meta-quest-touch-pro", "oculus-touch-v3", "oculus-touch-v2", "oculus-touch"]);
  let initialized = false;
  let supported = false;
  let starting = false;
  let runtime = null;
  let availabilityTimer = null;
  let supportMessage = "Vérification du menu immersif…";

  function status(message) {
    const element = $("#menu-status");
    if (element) element.textContent = message;
  }

  function refreshAvailability() {
    const button = $("#menu-enter-vr");
    if (!button) return;
    const renderError = E.MenuScene?.diagnostics?.error;
    button.disabled = starting || Boolean(runtime) || !supported || !E.MenuScene?.getContext();
    status(renderError ? "Décor statique actif. Le menu VR nécessite un rendu WebGL disponible." : supportMessage);
    clearTimeout(availabilityTimer);
    if (supported && !runtime && !renderError && !E.MenuScene?.getContext()) {
      availabilityTimer = setTimeout(refreshAvailability, 250);
    }
  }

  async function checkSupport() {
    supported = false;
    if (!window.isSecureContext) supportMessage = "Le menu VR nécessite HTTPS ou localhost.";
    else if (!navigator.xr) supportMessage = "Sur Quest 3, ouvrez ce site dans Meta Quest Browser pour entrer en VR.";
    else {
      try {
        supported = await navigator.xr.isSessionSupported("immersive-vr");
        supportMessage = supported ? "Menu VR disponible · visez avec vos contrôleurs, puis appuyez sur une gâchette."
          : "Le menu VR n’est pas disponible dans ce navigateur.";
      } catch (_) { supportMessage = "Impossible de vérifier la VR. Vérifiez les autorisations du navigateur."; }
    }
    refreshAvailability();
  }

  function init() {
    if (initialized || !$("#menu-enter-vr")) return;
    initialized = true;
    $("#menu-enter-vr").addEventListener("click", start);
    navigator.xr?.addEventListener("devicechange", checkSupport);
    checkSupport();
  }

  function messageFor(error) {
    if (["NotAllowedError", "SecurityError"].includes(error?.name)) return "Entrée VR refusée. Autorisez la VR dans Meta Quest Browser puis réessayez.";
    if (error?.name === "InvalidStateError") return "Une session immersive est déjà ouverte. Fermez-la avant de revenir au menu VR.";
    if (error?.name === "NotSupportedError") return "Ce navigateur ne propose pas de session VR compatible.";
    return `Le menu VR n’a pas pu démarrer : ${error?.message || error}.`;
  }

  async function start() {
    const context = E.MenuScene?.getContext();
    if (!context || !supported || starting || runtime || E.XR?.active) return;
    starting = true;
    refreshAvailability();
    let session;
    let active;
    try {
      // Cette demande reste dans le clic de l’utilisateur, avant tout await.
      session = await navigator.xr.requestSession("immersive-vr", { requiredFeatures: ["local"] });
      const { THREE, renderer, scene, camera } = context;
      const group = new THREE.Group();
      group.name = "eredita-menu-vr";
      group.visible = false;
      scene.add(group);
      active = {
        ...context, session, group, targets: [], rows: [], controllers: [], page: 0,
        signature: "", scope: "main", needsRefresh: true, positioned: false,
        space: null, viewer: null, lastRefresh: -Infinity, lastSelectTime: -Infinity, afterEnd: null,
        saved: { position: camera.position.clone(), quaternion: camera.quaternion.clone(), near: camera.near, far: camera.far }
      };
      runtime = active;
      session.addEventListener("end", () => cleanup(active), { once: true });
      active.visibilityChanged = () => {
        clearTracking(active);
      };
      session.addEventListener("visibilitychange", active.visibilityChanged);
      active.observer = new MutationObserver(() => { active.needsRefresh = true; });
      [$("#main-menu"), $("#menu-subscreen"), $("#connection-screen")].filter(Boolean).forEach((element) => {
        active.observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "disabled", "aria-selected", "aria-pressed", "class"] });
      });
      createControllers(active);
      E.MenuScene.setVisible(true);
      E.MenuScene.setImmersive(true);
      camera.position.set(0, 0, 0);
      camera.quaternion.identity();
      renderer.xr.setReferenceSpaceType("local");
      await renderer.xr.setSession(session);
      if (runtime !== active) return;
      active.space = renderer.xr.getReferenceSpace();
      active.spaceReset = () => { active.positioned = false; active.group.visible = false; };
      active.space?.addEventListener("reset", active.spaceReset);
      rebuild(active, true);
      supportMessage = "Menu VR actif · gâchettes ou A : choisir · B : revenir.";
    } catch (error) {
      if (active) active.afterEnd = null;
      if (session) { try { await session.end(); } catch (_) { /* La session peut être déjà fermée. */ } }
      if (active) cleanup(active);
      supportMessage = messageFor(error);
    } finally {
      starting = false;
      refreshAvailability();
    }
  }

  function disposeObject(object) {
    object.traverse((item) => {
      item.geometry?.dispose();
      const materials = Array.isArray(item.material) ? item.material : item.material ? [item.material] : [];
      materials.forEach((material) => { material.map?.dispose(); material.dispose(); });
    });
  }

  function clearPanel(active) {
    active.group.children.slice().forEach((child) => { active.group.remove(child); disposeObject(child); });
    active.targets = [];
    active.rows = [];
  }

  function visible(element) {
    if (!element || element.closest("[hidden]") || element.hidden) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function labelFor(button) {
    return (button.getAttribute("aria-label") || button.textContent || "Choisir").replace(/\s+/g, " ").trim();
  }

  function readNavigation() {
    const sub = $("#menu-subscreen");
    const connection = $("#connection-screen");
    const menu = $("#main-menu");
    if (sub && !sub.hidden) {
      const modal = sub.querySelector(".deck-modal-backdrop:not(.closing)");
      const source = modal || $("#menu-subcontent") || sub;
      const title = modal ? sub.querySelector("#deck-modal-title")?.textContent : $("#menu-subtitle")?.textContent;
      return { scope: modal ? "deck-card" : sub.classList.contains("decks-screen") ? "decks" : "play", title: title || "Choisissez votre voie", buttons: [...source.querySelectorAll("button")].filter((button) => visible(button) && !button.closest(".deck-modal-backdrop.closing")), back: modal?.querySelector(".deck-modal-close, button[data-close-modal]") || $("#menu-back") };
    }
    if (connection && !connection.hidden) {
      return { scope: "connection", title: "Choisir une partie", buttons: [...connection.querySelectorAll("button")].filter((button) => visible(button) && button.id !== "connection-back"), back: $("#connection-back"), input: $("#room-code") };
    }
    if (menu && !menu.hidden) return { scope: "main", title: "La terre se transmet. La victoire se mérite.", buttons: [...menu.querySelectorAll(".main-menu-actions button")].filter(visible), back: null };
    return { scope: "game", title: "Continuez sur le site", buttons: [], back: null };
  }

  function describeNavigation(nav) {
    return JSON.stringify([nav.scope, nav.title, nav.buttons.map((button) => [labelFor(button), button.disabled, button.getAttribute("aria-selected"), button.getAttribute("aria-pressed"), button.classList.contains("selected")])]);
  }

  function canvasPlane(active, text, width, height, fontSize, button = null) {
    const { THREE } = active;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = Math.max(96, Math.round(1024 * height / width));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
    mesh.userData.menuVR = { text, canvas, texture, fontSize, button, hovered: false };
    paintRow(mesh);
    return mesh;
  }

  function paintRow(mesh) {
    const { text, canvas, texture, fontSize, button, hovered } = mesh.userData.menuVR;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const disabled = button?.disabled;
    const selected = button?.getAttribute("aria-selected") === "true" || button?.getAttribute("aria-pressed") === "true" || button?.classList.contains("selected");
    const gold = hovered || selected;
    if (button) {
      ctx.fillStyle = hovered ? "rgba(42, 28, 17, .91)" : "rgba(12, 11, 10, .78)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = gold ? "#edc57b" : "rgba(159, 136, 93, .42)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    }
    ctx.fillStyle = disabled ? "#8b8475" : gold ? "#ffe4ac" : "#e4d5b6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${fontSize}px Georgia, 'Times New Roman', serif`;
    // maxWidth garde les libellés longs dans la surface cliquable.
    ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 64);
    texture.needsUpdate = true;
  }

  function addButton(active, label, x, y, width, height, action, source = null) {
    const font = E.Config.menu.vrFontSize;
    const mesh = canvasPlane(active, label, width, height, font, source || { disabled: false, getAttribute: () => null, classList: { contains: () => false } });
    mesh.position.set(x, y, 0.015);
    mesh.userData.menuVR.action = action;
    active.group.add(mesh);
    active.targets.push(mesh);
    active.rows.push(mesh);
    return mesh;
  }

  function rebuild(active, force = false) {
    if (runtime !== active) return;
    const nav = readNavigation();
    if (nav.scope === "game") { end(); return; }
    const signature = describeNavigation(nav);
    const sameSources = active.nav && nav.buttons.length === active.nav.buttons.length
      && nav.buttons.every((button, index) => button === active.nav.buttons[index]);
    if (!force && signature === active.signature && sameSources) { active.needsRefresh = false; return; }
    if (active.scope !== nav.scope) active.page = 0;
    active.scope = nav.scope;
    active.nav = nav;
    active.signature = signature;
    active.needsRefresh = false;
    clearPanel(active);
    const cfg = E.Config.menu;
    const pageSize = cfg.vrPageSize;
    const pageCount = Math.max(1, Math.ceil(nav.buttons.length / pageSize));
    active.page = Math.min(active.page, pageCount - 1);
    active.pageCount = pageCount;
    const width = cfg.vrPanelWidth;
    const height = cfg.vrRowHeight;
    const background = new active.THREE.Mesh(new active.THREE.PlaneGeometry(width + 0.16, 2.15), new active.THREE.MeshBasicMaterial({ color: 0x090908, transparent: true, opacity: 0.74, depthWrite: false }));
    background.position.z = -0.02;
    active.group.add(background);
    const logoWidth = width * 0.84;
    const logo = new active.THREE.Mesh(new active.THREE.PlaneGeometry(logoWidth, logoWidth * 135 / 564), new active.THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    logo.position.set(0, 0.8, 0);
    logo.visible = false;
    active.group.add(logo);
    const logoUrl = new URL("assets/eredita-logo.png", document.baseURI).href;
    new active.THREE.TextureLoader().load(logoUrl, (texture) => {
      if (runtime !== active || !logo.parent) { texture.dispose(); return; }
      texture.colorSpace = active.THREE.SRGBColorSpace;
      logo.material.map = texture;
      logo.material.needsUpdate = true;
      logo.visible = true;
    }, undefined, () => { if (logo.parent) logo.visible = false; });
    const title = canvasPlane(active, nav.title, width, 0.11, cfg.vrFontSize * 0.8);
    title.position.set(0, 0.55, 0);
    active.group.add(title);
    nav.buttons.slice(active.page * pageSize, (active.page + 1) * pageSize).forEach((source, index) => {
      addButton(active, labelFor(source), 0, 0.35 - index * (height + 0.018), width, height, () => activateSource(source), source);
    });
    const footerY = -0.99;
    const footerWidth = (width - 0.04) / 3;
    addButton(active, "Retour", -footerWidth - 0.02, footerY, footerWidth, 0.14, back);
    addButton(active, "Recentrer", 0, footerY, footerWidth, 0.14, () => positionPanel(active));
    addButton(active, "Quitter VR", footerWidth + 0.02, footerY, footerWidth, 0.14, () => end());
    if (pageCount > 1) {
      addButton(active, "←", -width * 0.4, -0.81, width * 0.18, 0.12, () => changePage(-1));
      addButton(active, "→", width * 0.4, -0.81, width * 0.18, 0.12, () => changePage(1));
      const pageText = canvasPlane(active, `${active.page + 1} / ${pageCount}`, width * 0.5, 0.1, cfg.vrFontSize);
      pageText.position.set(0, -0.81, 0);
      active.group.add(pageText);
    }
    if (nav.scope === "decks" || nav.scope === "deck-card" || nav.input) {
      const label = nav.input ? "Saisir le code du salon sur le site" : "Voir les cartes et éditer sur le site";
      addButton(active, label, 0, -1.17, width, 0.13, () => end(() => nav.input?.focus()));
    }
    active.controllers.forEach((record) => { record.hit = null; });
  }

  function changePage(delta) {
    const active = runtime;
    if (!active || active.pageCount < 2) return;
    active.page = (active.page + delta + active.pageCount) % active.pageCount;
    rebuild(active, true);
  }

  function activateSource(source) {
    const active = runtime;
    if (!active || active.ending || !source.isConnected || source.disabled || !visible(source)) return;
    const leavesMenu = source.matches('[data-menu-screen="tutorial"], [data-open-xr], #training-button, #play-solo, #play-local, #continue-online, #join-online');
    if (leavesMenu) { end(() => source.click()); return; }
    source.click();
    E.Audio?.confirmInterface?.();
    rebuild(active, true);
  }

  function back() {
    const active = runtime;
    if (!active || active.ending) return;
    const nav = readNavigation();
    if (nav.back && visible(nav.back)) {
      nav.back.click();
      active.needsRefresh = true;
      // La fermeture des fiches de cartes possède une transition HTML.
      rebuild(active, true);
    } else end();
  }

  function positionPanel(active) {
    if (!active.viewer) { active.positioned = false; return; }
    const { THREE, viewer, group } = active;
    const position = new THREE.Vector3(viewer.position.x, viewer.position.y, viewer.position.z);
    const quaternion = new THREE.Quaternion(viewer.orientation.x, viewer.orientation.y, viewer.orientation.z, viewer.orientation.w);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
    forward.normalize();
    group.position.copy(position).addScaledVector(forward, E.Config.menu.vrPanelDistance);
    group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-forward.x, -forward.z));
    group.visible = true;
    active.positioned = true;
    group.updateMatrixWorld(true);
  }

  function createControllers(active) {
    const { THREE, renderer, scene } = active;
    active.raycaster = new THREE.Raycaster();
    active.controllers = [0, 1].map((index) => {
      const node = renderer.xr.getController(index);
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xb1a78e, transparent: true, opacity: 0.85 }));
      ray.scale.z = E.Config.menu.vrPanelDistance + 1;
      node.add(ray);
      scene.add(node);
      const record = { node, ray, source: null, hit: null, tracked: false, buttons: {}, lastNavigation: -Infinity, origin: new THREE.Vector3(), direction: new THREE.Vector3(), listeners: [] };
      const bind = (type, fn) => { node.addEventListener(type, fn); record.listeners.push(() => node.removeEventListener(type, fn)); };
      bind("connected", (event) => { record.source = event.data; record.buttons = {}; });
      bind("disconnected", () => { record.source = null; record.tracked = false; record.hit = null; record.buttons = {}; });
      bind("select", () => select(record));
      return record;
    });
  }

  function hitFor(active, record) {
    if (!record.tracked || !active.positioned) return null;
    active.raycaster.set(record.origin, record.direction);
    return active.raycaster.intersectObjects(active.targets, false)[0] || null;
  }

  function select(record) {
    const active = runtime;
    if (!active || active.ending || active.session.visibilityState !== "visible" || !record.tracked) return;
    const now = performance.now();
    if (now - active.lastSelectTime < E.Config.menu.vrInputCooldownMs) return;
    const hit = hitFor(active, record);
    const row = hit?.object.userData.menuVR;
    if (row && !row.button?.disabled) {
      active.lastSelectTime = now;
      row.action?.();
    }
  }

  function setHovered(active, hovered) {
    active.rows.forEach((mesh) => {
      const row = mesh.userData.menuVR;
      const next = hovered.has(mesh) && !row.button?.disabled;
      if (row.hovered !== next) { row.hovered = next; paintRow(mesh); }
    });
  }

  function clearTracking(active) {
    active.group.visible = false;
    active.controllers.forEach((record) => { record.tracked = false; record.hit = null; record.buttons = {}; record.ray.visible = false; });
    setHovered(active, new Set());
  }

  function update(timestamp, frame) {
    const active = runtime;
    if (!active || !frame || !active.space) return;
    if (active.session.visibilityState !== "visible") { clearTracking(active); return; }
    const viewerPose = frame.getViewerPose(active.space);
    if (!viewerPose) { clearTracking(active); return; }
    active.viewer = viewerPose.transform;
    if (!active.positioned) positionPanel(active);
    else active.group.visible = true;
    if (active.needsRefresh && timestamp - active.lastRefresh > E.Config.menu.vrRefreshMs) {
      active.lastRefresh = timestamp;
      rebuild(active);
      if (runtime !== active) return;
    }
    active.group.updateMatrixWorld(true);
    const hovered = new Set();
    for (const record of active.controllers) {
      const pose = record.source && frame.getPose(record.source.targetRaySpace, active.space);
      record.tracked = Boolean(pose);
      record.ray.visible = Boolean(pose);
      if (!pose) { record.hit = null; record.buttons = {}; continue; }
      const matrix = new active.THREE.Matrix4().fromArray(pose.transform.matrix);
      record.origin.setFromMatrixPosition(matrix);
      record.direction.set(0, 0, -1).transformDirection(matrix);
      const hit = hitFor(active, record);
      record.hit = hit?.object || null;
      const enabled = record.hit && !record.hit.userData.menuVR.button?.disabled;
      if (enabled) hovered.add(record.hit);
      record.ray.scale.z = hit?.distance || E.Config.menu.vrPanelDistance + 1;
      record.ray.material.color.setHex(enabled ? 0xffd38b : 0xb1a78e);
      const source = record.source;
      const gamepad = source.gamepad;
      if (gamepad?.mapping === "xr-standard") {
        if (source.handedness === "right" && source.profiles?.some((profile) => touchProfiles.has(profile))) {
          const confirm = Boolean(gamepad.buttons[4]?.pressed);
          const cancel = Boolean(gamepad.buttons[5]?.pressed);
          if (confirm && record.buttons.confirm === false) select(record);
          if (runtime !== active) return;
          if (cancel && record.buttons.cancel === false) back();
          if (runtime !== active) return;
          record.buttons.confirm = confirm;
          record.buttons.cancel = cancel;
        }
        const vertical = gamepad.axes[3] || 0;
        if (Math.abs(vertical) < 0.65) record.lastNavigation = -Infinity;
        else if (timestamp - record.lastNavigation > 350) {
          changePage(Math.sign(vertical));
          record.lastNavigation = timestamp;
        }
      }
    }
    setHovered(active, hovered);
  }

  async function end(afterEnd = null) {
    const active = runtime;
    if (!active) { afterEnd?.(); return; }
    if (active.ending) return;
    active.ending = true;
    active.afterEnd = afterEnd;
    try {
      await active.session.end();
      cleanup(active);
    } catch (_) {
      active.ending = false;
      active.afterEnd = null;
      supportMessage = "La sortie VR a été refusée. Utilisez la commande de sortie du casque.";
      status(supportMessage);
    }
  }

  function cleanup(active) {
    if (runtime !== active) return;
    runtime = null;
    active.observer?.disconnect();
    active.session.removeEventListener("visibilitychange", active.visibilityChanged);
    active.space?.removeEventListener("reset", active.spaceReset);
    active.controllers.forEach((record) => {
      record.listeners.forEach((off) => off());
      record.node.remove(record.ray);
      active.scene.remove(record.node);
      record.ray.geometry.dispose();
      record.ray.material.dispose();
    });
    clearPanel(active);
    active.scene.remove(active.group);
    active.camera.position.copy(active.saved.position);
    active.camera.quaternion.copy(active.saved.quaternion);
    active.camera.near = active.saved.near;
    active.camera.far = active.saved.far;
    active.camera.updateProjectionMatrix();
    E.MenuScene.setImmersive(false);
    supportMessage = "Menu VR fermé. Vous pouvez poursuivre sur le site ou entrer à nouveau.";
    refreshAvailability();
    const action = active.afterEnd;
    active.afterEnd = null;
    if (action) action();
    else $("#menu-enter-vr")?.focus();
  }

  E.MenuVR = {
    init, checkSupport, refreshAvailability, start, end, update,
    get active() { return Boolean(runtime); },
    get diagnostics() {
      return runtime ? {
        active: true, mode: "immersive-vr", positioned: runtime.positioned,
        scope: runtime.scope, page: runtime.page + 1, pages: runtime.pageCount,
        targets: runtime.targets.length, controllers: runtime.controllers.map((record) => ({ hand: record.source?.handedness, tracked: record.tracked }))
      } : { active: false, supported, starting };
    }
  };
  init();
}());
