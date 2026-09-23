(function () {
  "use strict";
  const E = window.Eredita = window.Eredita || {};
  const tracks = {
    menu: document.querySelector("#menu-music"),
    game: document.querySelector("#game-music")
  };
  let current = null;
  let desiredTrack = "menu";
  function play(kind) {
    desiredTrack = kind;
    const audio = tracks[kind];
    if (!audio) return;
    if (current === audio) {
      if (audio.paused) audio.play().catch(() => {});
      return;
    }
    if (current) { current.pause(); current.currentTime = 0; }
    audio.loop = true;
    audio.volume = .38;
    current = audio;
    audio.play().catch(() => {});
    audio.addEventListener("error", () => { if (current === audio) current = null; }, { once: true });
  }
  E.Audio = { play, stop() { current?.pause(); current = null; }, playMenuOnInteraction() {
    const events = ["pointerdown", "touchstart", "keydown", "click"];
    const start = () => {
      const audio = tracks[desiredTrack];
      if (!audio) return;
      audio.play().then(() => events.forEach((eventName) => document.removeEventListener(eventName, start, true))).catch(() => {});
    };
    events.forEach((eventName) => document.addEventListener(eventName, start, { capture: true }));
  } };
  play("menu");
}());
