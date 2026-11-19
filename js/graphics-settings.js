(function () {
  "use strict";
  // Niveaux de qualité graphique (PC). Les valeurs sont dans Config.graphics.
  // Priorité : ?quality=… dans l'adresse, puis le choix mémorisé, puis la valeur par défaut.
  const E = window.Eredita = window.Eredita || {};
  const KEY = "eredita.graphicsLevel";
  const listeners = new Set();
  let level = null;

  const levels = () => E.Config.graphics.levels;
  const valid = (name) => Boolean(name) && Object.prototype.hasOwnProperty.call(levels(), name);

  function read() {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("quality");
      if (valid(fromUrl)) return fromUrl;
    } catch (_) {}
    try {
      const saved = window.localStorage.getItem(KEY);
      if (valid(saved)) return saved;
    } catch (_) {}
    return E.Config.graphics.defaultLevel;
  }

  function current() {
    if (!level) level = read();
    return level;
  }

  function profile() { return levels()[current()]; }

  function set(name, remember = true) {
    if (!valid(name) || name === level) return;
    level = name;
    if (remember) { try { window.localStorage.setItem(KEY, name); } catch (_) {} }
    listeners.forEach((listener) => listener(name, profile()));
  }

  function onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }

  // Petit sélecteur dans l'en-tête de la carte ; inactif sans DOM (tests Node).
  function bindSelector() {
    const select = document.querySelector("#graphics-quality");
    if (!select) return;
    select.innerHTML = Object.entries(levels()).map(([key, item]) => `<option value="${key}">${item.label}</option>`).join("");
    select.value = current();
    select.addEventListener("change", () => set(select.value));
    onChange((name) => { select.value = name; });
  }

  E.GraphicsSettings = { get level() { return current(); }, get profile() { return profile(); }, set, onChange, names: () => Object.keys(levels()) };
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindSelector, { once: true });
    else bindSelector();
  }
}());
