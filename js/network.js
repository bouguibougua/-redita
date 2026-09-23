(function () {
  "use strict";

  const E = window.Eredita = window.Eredita || {};
  let socket = null;
  let mode = "pending";
  let playerId = null;
  let roomCode = null;
  let handlers = {};

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
    document.querySelector("#connection-screen").hidden = true;
    document.querySelector("#main-menu").hidden = true;
    document.querySelector("#menu-subscreen").hidden = true;
    document.querySelector(".app-shell").classList.remove("connection-pending");
    E.Audio?.play("menu");
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
        handlers.onReady?.({ mode, playerId, roomCode });
      } else if (message.type === "state") handlers.onState?.(message.state);
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
      E.Decks?.unmount();
      menu.hidden = true;
      sub.hidden = false;
      sub.classList.toggle("decks-screen", screen === "decks");
      sub.querySelector(".menu-subpanel")?.classList.toggle("decks-panel", screen === "decks");
      if (screen === "play") {
        subTitle.textContent = "Choisissez votre voie";
        subContent.innerHTML = '<div class="menu-choice-grid"><button id="open-multiplayer" class="button button-red" type="button">MULTIJOUEUR</button><button id="training-button" class="button" type="button">ENTRAÎNEMENT</button></div><p class="menu-muted">Le mode entraînement réutilise la partie contre l’IA déjà présente dans le prototype.</p>';
        document.querySelector("#open-multiplayer").addEventListener("click", () => { sub.hidden = true; document.querySelector("#connection-screen").hidden = false; bindConnectionControls(); });
        document.querySelector("#training-button").addEventListener("click", () => { mode = "solo"; playerId = "red"; showGame(); setStatus("Mode entraînement · vous jouez Rouge contre l’IA"); handlers.onReady?.({ mode, playerId, roomCode: null }); });
      } else if (screen === "decks") {
        subTitle.textContent = "Construire vos decks";
        E.Decks.mount(subContent);
      } else {
        mode = "tutorial";
        playerId = "red";
        roomCode = null;
        showGame();
        setStatus("Tutoriel · parcours guidé");
        handlers.onReady?.({ mode, playerId, roomCode });
      }
      E.Audio?.play("menu");
    }
    function bindConnectionControls() {
      document.querySelector("#play-local")?.addEventListener("click", () => { mode = "local"; playerId = null; showGame(); handlers.onReady?.({ mode, playerId, roomCode: null }); });
      document.querySelector("#create-online")?.addEventListener("click", () => connect("create"));
      document.querySelector("#join-online")?.addEventListener("click", () => { const code = document.querySelector("#room-code").value.trim().toUpperCase(); if (code.length !== 5) return setStatus("Entre un code de salon à 5 caractères.", true); connect("join", code); });
      document.querySelector("#room-code")?.addEventListener("input", (event) => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 5); });
      document.querySelector("#connection-back")?.addEventListener("click", () => { document.querySelector("#connection-screen").hidden = true; menu.hidden = false; });
    }
    document.querySelectorAll("[data-menu-screen]").forEach((button) => button.addEventListener("click", () => openMenuScreen(button.dataset.menuScreen)));
    back.addEventListener("click", () => {
      E.Decks?.unmount();
      sub.hidden = true;
      sub.classList.remove("decks-screen");
      sub.querySelector(".menu-subpanel")?.classList.remove("decks-panel");
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

  E.Network = { init, sendState, sendCommand, get mode() { return mode; }, get playerId() { return playerId; }, get roomCode() { return roomCode; } };
}());
