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
  const cfg = E.Config.audio;
  const effects = Object.fromEntries(Object.entries(cfg.effects).map(([name, source]) => {
    const audio = new Audio(source); audio.preload = "auto";
    return [name, audio];
  }));
  const voices = [];
  function releaseVoice(audio) {
    const index = voices.indexOf(audio);
    if (index >= 0) voices.splice(index, 1);
  }
  function stopEffects() {
    voices.splice(0).forEach(audio => { audio.pause(); audio.currentTime = 0; });
  }
  function playEffect(name) {
    if (muted || !effects[name]) return;
    while (voices.length >= cfg.maxEffectVoices) {
      const oldest = voices.shift(); oldest.pause(); oldest.currentTime = 0;
    }
    const audio = effects[name].cloneNode(true);
    audio.volume = cfg.effectVolume;
    audio.addEventListener("ended", () => releaseVoice(audio), { once:true });
    audio.addEventListener("error", () => releaseVoice(audio), { once:true });
    voices.push(audio);
    audio.play().catch(() => releaseVoice(audio));
  }
  // Capture avant la navigation : les boutons peuvent masquer leur écran au clic.
  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || button.disabled || button.closest("[hidden], [inert]")) return;
    if (button.hasAttribute("data-ui-back")) { playEffect("swordReverse"); return; }
    if (button.id !== "menu-sound" && button.closest("#main-menu, .play-panel, #connection-screen")) playEffect("sword");
  }, true);
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
    audio.volume = muted ? 0 : cfg.musicVolume;
    current = audio;
    audio.play().catch(() => {});
    audio.addEventListener("error", () => { if (current === audio) current = null; }, { once: true });
  }
  E.Audio = { play, playEffect, confirmInterface,
    get currentTrack() { return desiredTrack; },
    get muted() { return muted; },
    setMuted(value) { muted = Boolean(value); if (current) current.volume = muted ? 0 : cfg.musicVolume; if (muted) { stopEffects(); interfaceAudio?.suspend().catch(() => {}); } },
    stop() { current?.pause(); current = null; stopEffects(); }, playMenuOnInteraction() {
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
