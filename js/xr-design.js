(function () {
  "use strict";
  const E = window.Eredita;
  // Pixels de texture pour le dessin, mètres pour les dimensions spatiales.
  const tokens = {
    pixelsPerMeter: 1600, maxTextureSize: 2048,
    type: { title: 40, body: 32, detail: 27, value: 46 },
    spacing: { inset: 26, gap: 12, header: 108, line: 45, row: 105, detailRow: 132, footer: 94 },
    radius: { panel: 32, button: 20, portrait: 16 },
    border: { normal: 1.5, selected: 3, hover: 2.5 },
    feedbackMs: 4000, confirmationMs: 320, transitionMs: 140,
    textScales: { normal: 1, large: 1.16, xlarge: 1.32 },
    portraitCrop: [0.2, 0.01, 0.65, 0.65],
    font: '"Segoe UI", Inter, system-ui, sans-serif',
    // TEMP_BALANCE_VALUE — confort à mesurer physiquement sur Quest.
    layouts: {
      redGold: [-0.24, 0.4, 0.21, 0.2], clock: [0, 0.4, 0.24, 0.2], blueGold: [0.24, 0.4, 0.21, 0.2],
      gear: [1.2, 0.4, 0.11, 0.2],
      jobs: [-1.3, -0.15, 0.56, 0.7], info: [1.3, -0.15, 0.56, 0.7],
      tasks: [-0.32, -0.70, 0.6, 0.42], buildings: [0.32, -0.70, 0.6, 0.42],
      residents: [0, -1.12, 1.25, 0.36], modal: [0, -0.13, 0.88, 0.94],
      feedback: [0, 0.64, 1.25, 0.12]
    }
  };
  tokens.layouts.placement = [0, 0, 0.84, 0.72];
  for (let lane = 0; lane < 4; lane++) {
    tokens.layouts[`red${lane}`] = [-1.04 + lane * 0.195, 0.4, 0.18, 0.2];
    tokens.layouts[`blue${lane}`] = [0.455 + lane * 0.195, 0.4, 0.18, 0.2];
  }
  function theme() {
    const css = typeof getComputedStyle === "function" ? getComputedStyle(document.documentElement) : null;
    const read = (name, fallback) => css?.getPropertyValue(name).trim() || fallback;
    return { ink: read("--ink", "#f4efe2"), muted: read("--muted", "#aaa99f"), surface: read("--surface", "#20231f"), raised: read("--surface-raised", "#2a2e28"), gold: read("--gold", "#dfb85e"), red: read("--red", "#c54f46"), blue: read("--blue", "#4e87b8"), danger: read("--danger", "#e36a5f"), line: read("--line", "rgba(255,255,255,0.12)") };
  }
  function rounded(c, x, y, w, h, radius) { c.beginPath(); c.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2)); }
  function wrap(c, value, width) {
    const lines = []; let line = "";
    for (const word of String(value ?? "").split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && c.measureText(next).width > width) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line); return lines;
  }
  function text(c, value, x, y, width, size, color, weight = 500, maxLines = Infinity) {
    c.font = `${weight} ${size}px ${tokens.font}`; c.fillStyle = color; c.textAlign = "left"; c.textBaseline = "top";
    const lines = wrap(c, value, width);
    lines.slice(0, maxLines).forEach((line, i) => {
      // Jamais de fillText(maxWidth) qui écraserait les caractères.
      if (i === maxLines - 1 && lines.length > maxLines) {
        while (line.length && c.measureText(`${line}…`).width > width) line = line.slice(0, -1);
        line += "…";
      }
      c.fillText(line, x, y + i * size * 1.25);
    });
    return Math.min(lines.length, maxLines) * size * 1.25;
  }
  function icon(c, key, x, y, size, color) {
    c.save(); c.translate(x, y); c.scale(size / 32, size / 32); c.strokeStyle = color; c.lineWidth = 1.8; c.lineJoin = "round"; c.lineCap = "round"; c.beginPath();
    if (["gear", "⚙"].includes(key)) {
      c.arc(16, 16, 8, 0, Math.PI * 2); c.moveTo(19, 16); c.arc(16, 16, 3, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.moveTo(16 + Math.cos(a) * 10, 16 + Math.sin(a) * 10); c.lineTo(16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13); }
    } else if (key === "🐑") {
      c.moveTo(24, 20); c.bezierCurveTo(30, 7, 14, 4, 10, 12); c.bezierCurveTo(0, 10, 2, 25, 12, 23); c.lineTo(24, 23); c.moveTo(10, 23); c.lineTo(10, 29); c.moveTo(22, 23); c.lineTo(22, 29); c.moveTo(25, 16); c.lineTo(29, 16); c.lineTo(29, 22); c.lineTo(24, 22);
    } else if (key === "🏹") {
      c.moveTo(8, 3); c.quadraticCurveTo(31, 16, 8, 29); c.lineTo(14, 16); c.closePath(); c.moveTo(4, 16); c.lineTo(30, 16); c.moveTo(25, 11); c.lineTo(30, 16); c.lineTo(25, 21);
    } else if (key === "🪓" || key === "🔨") {
      c.moveTo(8, 29); c.lineTo(22, 4); c.moveTo(15, 7); c.lineTo(28, 12); c.lineTo(23, 20); c.lineTo(12, 11); c.closePath();
    } else if (["⌂", "🏠", "🥩", "building"].includes(key)) {
      c.moveTo(4, 15); c.lineTo(16, 5); c.lineTo(28, 15); c.moveTo(7, 14); c.lineTo(7, 27); c.lineTo(25, 27); c.lineTo(25, 14); c.moveTo(13, 27); c.lineTo(13, 19); c.lineTo(19, 19); c.lineTo(19, 27);
    } else if (["⚔", "⚔️", "🪓", "🏹"].includes(key)) {
      c.moveTo(7, 27); c.lineTo(24, 6); c.lineTo(25, 13); c.lineTo(11, 26); c.moveTo(5, 20); c.lineTo(14, 28);
    } else if (["🌾", "🌱", "🌿"].includes(key)) {
      c.moveTo(16, 28); c.lineTo(16, 5);
      for (let yy = 9; yy < 24; yy += 6) { c.moveTo(16, yy + 4); c.quadraticCurveTo(6, yy + 2, 7, yy - 3); c.moveTo(16, yy); c.quadraticCurveTo(26, yy - 2, 25, yy - 7); }
    } else if (["🛡", "🛡️"].includes(key)) {
      c.moveTo(16, 4); c.lineTo(27, 9); c.quadraticCurveTo(26, 23, 16, 29); c.quadraticCurveTo(6, 23, 5, 9); c.closePath();
    } else if (["🎣", "🐟"].includes(key)) {
      c.moveTo(7, 28); c.lineTo(16, 5); c.lineTo(26, 6); c.lineTo(26, 21); c.quadraticCurveTo(19, 29, 19, 20);
    } else {
      c.arc(16, 9, 5, 0, Math.PI * 2); c.moveTo(5, 29); c.quadraticCurveTo(5, 17, 16, 17); c.quadraticCurveTo(27, 17, 27, 29);
    }
    c.stroke(); c.restore();
  }
  E.XRDesign = { tokens, theme, rounded, wrap, text, icon };
}());
