(function () {
  "use strict";

  const E = window.Eredita = window.Eredita || {};
  let socket = null;
  let mode = "pending";
  let playerId = null;
  let roomCode = null;
  let handlers = {};
  let format = E.Config.defaultFormat;
  let legendCollection = null;

  function selectFormat(value) {
    if (mode !== "pending" || !E.Config.formats[value]) return false;
    format = value;
    document.querySelectorAll("[data-match-format]").forEach(button => {
      const selected = button.dataset.matchFormat === format;
      button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", String(selected));
    });
    return true;
  }
  function formatChoices() {
    return `<div class="match-formats" role="group" aria-label="Nombre de camps par joueur">${Object.entries(E.Config.formats).map(([id, value]) => `<button class="play-format ${format === id ? "selected" : ""}" type="button" data-match-format="${id}" aria-pressed="${format === id}">
      <span class="play-format-map" aria-hidden="true"><i>${'<b></b>'.repeat(value.regions)}</i><i>${'<b></b>'.repeat(value.regions)}</i></span>
      <span class="play-format-copy"><strong>${value.label}</strong><small>${value.regions} régions par joueur</small></span><span class="play-format-check" aria-hidden="true">✓</span>
    </button>`).join("")}</div>`;
  }
  function playMenuHtml() {
    return `<div class="play-lobby">
      <div class="play-layout">
        <section class="play-format-panel play-main-panel" aria-labelledby="play-format-title">
          <span class="play-panel-index" aria-hidden="true">01</span>
          <span class="play-mode-emblem" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="m8 13 16-6 16 6 16-6v44l-16 6-16-6-16 6V13ZM24 7v44M40 13v44"/></svg></span>
          <h3 id="play-format-title">Format</h3><p class="play-mode-meta">Camps par joueur</p>
          ${formatChoices()}
        </section>
            <button id="open-multiplayer" class="play-mode-card play-main-panel multiplayer" type="button">
              <span class="play-panel-index" aria-hidden="true">02</span>
              <span class="play-mode-emblem" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M13 8 45 40 40 45 8 13V8h5ZM51 8 19 40 24 45 56 13V8h-5ZM34 43l13-13M21 34l13-13M44 44l8 8M12 52l8-8M47 55l8-8M9 47l8 8"/></svg></span>
              <strong>Multijoueur</strong><span class="play-mode-meta">Deux joueurs · local ou en ligne</span>
              <span class="play-mode-action">Choisir une partie <span aria-hidden="true">↗</span></span>
            </button>
            <button id="training-button" class="play-mode-card play-main-panel training" type="button">
              <span class="play-panel-index" aria-hidden="true">03</span>
              <span class="play-mode-emblem" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="30" cy="34" r="21"/><circle cx="30" cy="34" r="13"/><circle cx="30" cy="34" r="5"/><path d="m30 34 23-23M46 18V9l9-5v10l5 4-9 5h-9"/></svg></span>
              <strong>Entraînement</strong><span class="play-mode-meta">Un joueur · contre l’IA</span>
              <span class="play-mode-action">Préparer la partie <span aria-hidden="true">↗</span></span>
            </button>
      </div>
    </div>`;
  }
  function bindFormats(root) {
    root.querySelectorAll("[data-match-format]").forEach(button => button.addEventListener("click", () => selectFormat(button.dataset.matchFormat)));
  }

  function websocketUrl() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/ws`;
  }

  function setStatus(text, error = false) {
    const targets = [document.querySelector("#online-status"), document.querySelector("#session-status")].filter(Boolean);
    targets.forEach((target) => {
      target.textContent = text;
      target.classList.toggle("error", error);
      if (target.id === "session-status") target.hidden = mode === "pending" || mode === "local";
    });
  }

  function showGame() {
    legendCollection?.dispose(); legendCollection = null;
    document.querySelector("#connection-screen").hidden = true;
    document.querySelector("#main-menu").hidden = true;
    document.querySelector("#menu-subscreen").hidden = true;
    document.querySelector(".app-shell").classList.remove("connection-pending");
    E.Audio?.play("menu");
  }

  function startMode(nextMode, nextFormat = format) {
    if (mode !== "pending" || !["solo", "local"].includes(nextMode)) return false;
    if (!selectFormat(nextFormat)) return false;
    mode = nextMode; playerId = nextMode === "solo" ? "red" : null; roomCode = null;
    showGame();
    handlers.onReady?.({ mode, playerId, roomCode, format });
    return true;
  }

  function connect(type, code) {
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
    if (location.protocol !== "http:" && location.protocol !== "https:") {
      setStatus("Ouvre http://localhost:8765 dans le navigateur pour jouer en réseau.", true);
      return;
    }
    setStatus("Connexion au serveur…");
    socket = new WebSocket(websocketUrl());
    const attempt = socket;
    const connectionTimeout = setTimeout(() => {
      if (socket !== attempt || mode !== "pending") return;
      setStatus("Connexion trop longue. Vérifie que la page et le serveur utilisent bien http://localhost:8765.", true);
      attempt.close();
    }, E.Config.network.connectionTimeoutMs);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ type, code })));
    socket.addEventListener("error", () => {
      if (socket !== attempt) return;
      clearTimeout(connectionTimeout);
      setStatus("Serveur inaccessible à cette adresse. Ouvre l'adresse affichée par node server.js.", true);
    });
    socket.addEventListener("close", () => {
      clearTimeout(connectionTimeout);
      if (socket !== attempt) return;
      if (mode !== "local" && mode !== "pending") setStatus("Connexion interrompue.", true);
    });
    socket.addEventListener("message", (event) => {
      if (socket !== attempt) return;
      const message = JSON.parse(event.data);
      if (["created", "joined", "error"].includes(message.type)) clearTimeout(connectionTimeout);
      if (message.type === "created" || message.type === "joined") {
        mode = message.type === "created" ? "host" : "guest";
        playerId = message.playerId;
        roomCode = message.code;
        setStatus(mode === "host" ? `Code du salon : ${roomCode} · en attente du joueur bleu` : `Salon ${roomCode} · vous êtes le joueur bleu`);
        if (mode === "host") {
          document.querySelector(".connection-actions").hidden = true;
          document.querySelector(".join-room").hidden = true;
          document.querySelector("#created-room-code").textContent = roomCode;
          document.querySelector("#created-room").hidden = false;
        } else showGame();
        handlers.onReady?.({ mode, playerId, roomCode, format });
      } else if (message.type === "state") handlers.onState?.(message.state);
      else if (message.type === 'mythology') handlers.onMythology?.(message);
      else if (message.type === 'mythology-execute' && mode === 'host') handlers.onMythologyExecute?.(message.execution);
      else if (message.type === "command") handlers.onCommand?.(message);
      else if (message.type === "state-request") handlers.onStateRequest?.();
      else if (message.type === "peer") {
        setStatus(message.connected ? `Salon ${roomCode} · les deux joueurs sont connectés` : message.message, !message.connected);
        handlers.onPeer?.(message.connected);
      } else if (message.type === "error") setStatus(message.message, true);
    });
  }

  function init(nextHandlers) {
    handlers = nextHandlers;
    const menu = document.querySelector("#main-menu");
    const sub = document.querySelector("#menu-subscreen");
    const subTitle = document.querySelector("#menu-subtitle");
    const subContent = document.querySelector("#menu-subcontent");
    const back = document.querySelector("#menu-back");
    function openMenuScreen(screen) {
      legendCollection?.dispose(); legendCollection = null;
      menu.hidden = true;
      sub.hidden = false;
      sub.classList.toggle("legends-screen", screen === "legends");
      sub.classList.toggle("play-screen", screen === "play");
      sub.querySelector(".menu-subpanel")?.classList.toggle("legends-panel", screen === "legends");
      sub.querySelector(".menu-subpanel")?.classList.toggle("play-panel", screen === "play");
      if (screen === "play") {
        subTitle.textContent = "L’armurerie";
        subContent.innerHTML = playMenuHtml();
        bindFormats(subContent);
        document.querySelector("#open-multiplayer").addEventListener("click", () => { sub.hidden = true; document.querySelector("#connection-screen").hidden = false; selectFormat(format); });
        document.querySelector("#training-button").addEventListener("click", () => { startMode("solo"); setStatus("Mode entraînement · vous jouez Rouge contre l’IA"); });
      } else if (screen === "legends") {
        subTitle.textContent = "Les légendes de Corse";
        legendCollection = E.MythologyUI.mountCollection(subContent);
      } else {
        mode = "tutorial";
        playerId = "red";
        roomCode = null;
        showGame();
        setStatus("Tutoriel · parcours guidé");
        handlers.onReady?.({ mode, playerId, roomCode, format });
      }
      E.Audio?.play("menu");
    }
    function bindConnectionControls() {
      document.querySelector("#play-solo")?.addEventListener("click", () => startMode("solo"));
      document.querySelector("#play-local")?.addEventListener("click", () => startMode("local"));
      document.querySelector("#create-online")?.addEventListener("click", () => connect("create"));
      document.querySelector("#join-online")?.addEventListener("click", () => { const code = document.querySelector("#room-code").value.trim().toUpperCase(); if (code.length !== 5) return setStatus("Entre un code de salon à 5 caractères.", true); connect("join", code); });
      document.querySelector("#room-code")?.addEventListener("input", (event) => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 5); });
      document.querySelector("#connection-back")?.addEventListener("click", leaveRoom);
    }
    bindConnectionControls(); bindFormats(document.querySelector("#connection-screen"));
    document.querySelectorAll("[data-menu-screen]").forEach((button) => button.addEventListener("click", () => openMenuScreen(button.dataset.menuScreen)));
    back.addEventListener("click", () => {
      legendCollection?.dispose(); legendCollection = null;
      sub.hidden = true;
      sub.classList.remove("legends-screen", "play-screen");
      sub.querySelector(".menu-subpanel")?.classList.remove("legends-panel", "play-panel");
      menu.hidden = false;
      E.Audio?.play("menu");
    });
    E.Audio?.play("menu");
    E.Audio?.playMenuOnInteraction();
    document.querySelector("#continue-online").addEventListener("click", showGame);
  }

  function sendState(state) {
    if (mode === "host" && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "state", state }));
  }

  function sendCommand(method, args, view) {
    if (mode === "guest" && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "command", method, args, view }));
  }

  function selectReinforcement(epoch, offerId, legendId) {
    if (!['host', 'guest'].includes(mode) || socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: 'mythology-select', epoch, offerId, legendId }));
    return true;
  }

  function leaveRoom() {
    const previous = socket;
    socket = null;
    if (previous && previous.readyState < WebSocket.CLOSING) previous.close();
    mode = "pending"; playerId = null; roomCode = null;
    document.querySelector("#created-room").hidden = true;
    document.querySelector(".connection-actions").hidden = false;
    document.querySelector(".join-room").hidden = false;
    document.querySelector("#connection-screen").hidden = true;
    document.querySelector("#menu-subscreen").hidden = true;
    document.querySelector("#main-menu").hidden = false;
    document.querySelector(".app-shell").classList.add("connection-pending");
    setStatus("Choisissez un mode de jeu.");
  }

  function activateReinforcement(epoch, offerId, target) {
    if (!['host', 'guest'].includes(mode) || socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: 'mythology-activate', epoch, offerId, target })); return true;
  }
  function finishReinforcement(activationId, result) {
    if (mode !== 'host' || socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: 'mythology-result', activationId, accepted: result.accepted, reason: result.reason })); return true;
  }

  E.Network = { init, sendState, sendCommand, selectReinforcement, activateReinforcement, finishReinforcement, startMode, selectFormat, leaveRoom, get format() { return format; }, get mode() { return mode; }, get playerId() { return playerId; }, get roomCode() { return roomCode; } };
}());
