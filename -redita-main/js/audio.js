(function () {
  "use strict";
  const E = window.Eredita = window.Eredita || {};
  const tracks = {
    menu: document.querySelector("#menu-music"),
    game: document.querySelector("#game-music")
  };
  let current = null;
  let desiredTrack = "menu";
  let muted = false;
  let interfaceAudio = null;
  function confirmInterface() {
    if (muted) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      interfaceAudio = interfaceAudio || new AudioContext();
      if (interfaceAudio.state !== "running") { interfaceAudio.resume().catch(() => {}); return; }
      const cfg = E.Config.xr;
      const tone = interfaceAudio.createOscillator(), gain = interfaceAudio.createGain();
      const now = interfaceAudio.currentTime;
      tone.frequency.value = cfg.interfaceSoundHz;
      gain.gain.setValueAtTime(cfg.interfaceSoundGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + cfg.interfaceSoundDuration);
      tone.connect(gain); gain.connect(interfaceAudio.destination);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      tone.start(now); tone.stop(now + cfg.interfaceSoundDuration);
    } catch (_) { /* L'interface reste utilisable sans sortie audio. */ }
  }
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
    audio.volume = muted ? 0 : .38;
    current = audio;
    audio.play().catch(() => {});
    audio.addEventListener("error", () => { if (current === audio) current = null; }, { once: true });
  }
  E.Audio = { play, confirmInterface,
    get muted() { return muted; },
    setMuted(value) { muted = Boolean(value); if (current) current.volume = muted ? 0 : .38; if (muted) interfaceAudio?.suspend().catch(() => {}); },
    stop() { current?.pause(); current = null; }, playMenuOnInteraction() {
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
