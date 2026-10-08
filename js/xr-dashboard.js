(function () {
  "use strict";
  const E = window.Eredita;
  function create({ THREE, scene, renderer, world }) {
    const D = E.XRDesign, T = D.tokens, C = D.theme(), S = T.spacing, F = T.type;
    const group = new THREE.Group(); group.name = "xr-game-dashboard"; scene.add(group);
    const targets = [], panels = new Map(), images = new Map();
    const movable = new Set(Object.keys(T.layouts));
    const scorePanel = (id) => /^(red|blue)(\d|Gold)$/.test(id) || id === "clock";
    let viewer = null, modalNeedsPlacement = false;
    let positioned = false, textSize = "normal", disposed = false, feedbackUntil = 0, lastHighlight = performance.now();
    const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    function canvasTexture(canvas) {
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
      texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter; return texture;
    }
    function panel(id) {
      if (panels.has(id)) return panels.get(id);
      const [x, y, width, height] = T.layouts[id];
      const node = new THREE.Group(); node.name = `xr-window-${id}`; node.userData = { panelId: id, modal: id === "modal", windowUserScale: 1 };
      node.position.set(x, y, id === "modal" ? 0.18 : 0); group.add(node);
      const canvas = document.createElement("canvas"), density = Math.min(T.pixelsPerMeter, T.maxTextureSize / Math.max(width, height));
      canvas.width = Math.round(width * density); canvas.height = Math.round(height * density);
      const texture = canvasTexture(canvas);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
      face.userData.xrTarget = { kind: "dashboard-panel", panelId: id }; node.add(face);
      const item = { id, node, face, canvas, context: canvas.getContext("2d"), texture, width, height, density, buttons: [], hitKey: "", key: "", data: null, page: 0, pageCount: 1, hover: new Set(), confirmed: null, confirmUntil: 0, drawCount: 0 };
      if (movable.has(id)) {
        const header = scorePanel(id) ? 34 : S.header;
        const handle = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.022, header / density - 0.006), new THREE.MeshBasicMaterial({ visible: false }));
        handle.position.set(0, height / 2 - header / density / 2, 0.015);
        handle.userData.xrTarget = { kind: "panel-handle", panelId: id }; node.add(handle); item.handle = handle;
      }
      panels.set(id, item); placeDefault(item); return item;
    }
    function placeDefault(p) {
      const [x, y] = T.layouts[p.id], factor = T.textScales[textSize];
      p.node.position.set(x * factor, y * factor, p.id === "modal" ? 0.18 : 0);
      p.node.scale.setScalar(factor * (p.node.userData.windowUserScale || 1));
      p.node.rotation.set(0, 0, 0);
    }
    const drawText = (c, value, x, y, width, size = F.body, color = C.ink, weight = 500, max = Infinity) => D.text(c, value, x, y, width, size, color, weight, max);
    function surface(c, x, y, width, height, fill, stroke = C.gold, radius = T.radius.panel, lineWidth = T.border.normal) {
      D.rounded(c, x, y, width, height, radius); c.fillStyle = fill; c.fill();
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = lineWidth; c.stroke(); }
    }
    function drawLines(p, lines, y) {
      const c = p.context, w = p.canvas.width - 2 * S.inset;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (typeof line === "object" && line.kind === "stat") {
          const cells = [line]; if (lines[i + 1]?.kind === "stat") cells.push(lines[++i]);
          cells.forEach((cell, column) => {
            const cw = (w - S.gap) / 2, x = S.inset + column * (cw + S.gap);
            surface(c, x, y, cw, 100, C.raised, C.line, T.radius.button);
            drawText(c, cell.label, x + 12, y + 9, cw - 24, F.detail, C.muted, 500, 1);
            drawText(c, cell.value, x + 12, y + 43, cw - 24, F.value, C.ink, 700, 1);
          }); y += 112;
        } else if (typeof line === "object") {
          drawText(c, line.label, S.inset, y + 10, w, F.detail, C.gold, 600); y += 56;
        } else y += drawText(c, line, S.inset, y, w, F.body, C.muted) + 10;
      }
      return y;
    }
    function imageFor(src) {
      if (images.has(src)) return images.get(src);
      const img = new Image(); images.set(src, img);
      img.onload = () => { if (!disposed) panels.forEach((p) => { if (p.id === "residents" && p.data) draw(p); }); };
      img.src = src; return img;
    }
    function drawButton(p, entry, rect, index) {
      const [label, action, enabled = true, meta = {}] = entry, c = p.context, { x, y, w, h } = rect;
      const active = meta.selected, hovered = p.hover.has(index), confirmed = p.confirmed === index && performance.now() < p.confirmUntil;
      const biomeColors = { littoral: ["#568c85", "#285d73"], plaine: ["#98aa56", "#445727"], montagne: ["#85817a", "#454641"] };
      let fill = meta.primary ? "#65522b" : active ? "#514526" : C.raised;
      if (meta.biome) {
        const colors = biomeColors[meta.biome], gradient = c.createLinearGradient(x, y, x + w, y + h);
        gradient.addColorStop(0, colors[0]); gradient.addColorStop(0.48, colors[0]); gradient.addColorStop(0.51, colors[1]); gradient.addColorStop(1, colors[1]); fill = gradient;
      }
      surface(c, x, y, w, h, !enabled && !meta.biome ? C.surface : fill, active || hovered || confirmed ? C.gold : C.line, T.radius.button, active || confirmed ? T.border.selected : T.border.normal);
      if (hovered || confirmed) { c.fillStyle = `${C.gold}12`; D.rounded(c, x, y, w, h, T.radius.button); c.fill(); }
      if (meta.centered || meta.biome) {
        const titleSize = meta.large ? F.title + 8 : F.body + 4;
        const headingY = meta.detail ? y + h / 2 - titleSize * 1.25 : y + (h - titleSize * 1.25) / 2;
        D.centered(c, label, x + 18, headingY, w - 36, titleSize, enabled || meta.biome ? C.ink : C.muted, 750, 1);
        if (meta.detail) D.centered(c, meta.detail, x + 16, y + h / 2 + 13, w - 32, F.detail, C.ink, 500, 2);
        if (meta.biome) {
          surface(c, x + w - 64, y + 14, 46, 46, "rgba(0,0,0,0.26)", null, 23);
          D.centered(c, String(meta.lane + 1), x + w - 64, y + 20, 46, F.detail, C.ink, 600, 1);
          if (active) D.centered(c, "✓", x + 14, y + 19, 38, F.body, C.gold, 700, 1);
        }
      } else if (meta.portrait) {
        const photo = imageFor(meta.portrait.src), side = Math.min(100, h * 0.36), px = x + (w - side) / 2, py = y + 12;
        c.save(); D.rounded(c, px, py, side, side, T.radius.portrait); c.clip();
        if (photo.complete && photo.naturalWidth) {
          const { columns, rows, index: tile } = meta.portrait, sw = photo.naturalWidth / columns, sh = photo.naturalHeight / rows;
          const [cx, cy, cw, ch] = T.portraitCrop;
          c.drawImage(photo, ((tile % columns) + cx) * sw, (Math.floor(tile / columns) + cy) * sh, sw * cw, sh * ch, px, py, side, side);
        } else D.icon(c, "person", px + side * 0.15, py + side * 0.15, side * 0.7, C.ink);
        c.restore();
        drawText(c, `${active ? "✓ " : ""}${label}`, x + 12, py + side + 10, w - 24, F.body, C.ink, 700, 1);
        drawText(c, meta.profession, x + 12, py + side + 53, w - 24, F.detail, C.ink, 500, 1);
        drawText(c, `${meta.detail || ""} · ${meta.status || ""}`, x + 12, py + side + 90, w - 24, F.detail, C.muted, 500, 2);
      } else {
        const hasIcon = Boolean(meta.icon), inset = hasIcon ? 64 : 17;
        if (hasIcon) D.icon(c, meta.icon, x + 16, y + 19, 34, enabled ? C.gold : C.muted);
        const headingY = y + (meta.detail ? 15 : Math.max(14, (h - F.body * 1.25) / 2));
        drawText(c, `${active ? "✓ " : ""}${label}`, x + inset, headingY, w - inset - 16, F.body, enabled ? C.ink : C.muted, 650, meta.detail ? 1 : 2);
        if (meta.detail) drawText(c, meta.detail, x + inset, y + 59, w - inset - 16, F.detail, enabled ? C.muted : C.ink, 500, 2);
        if (!enabled && action && !meta.detail && h > 100) drawText(c, "Indisponible", x + inset, y + h - 35, w - inset - 16, F.detail, C.muted, 500, 1);
      }
    }
    function syncButtons(p, entries) {
      const key = JSON.stringify(entries.map(({ entry, rect }) => [entry, rect])); if (key === p.hitKey) return;
      p.hitKey = key;
      while (p.buttons.length > entries.length) { const old = p.buttons.pop(); p.node.remove(old); old.geometry.dispose(); old.material.dispose(); }
      entries.forEach(({ entry, rect }, index) => {
        let mesh = p.buttons[index];
        if (!mesh) { mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ visible: false })); p.node.add(mesh); p.buttons.push(mesh); }
        mesh.scale.set(rect.w / p.density, rect.h / p.density, 1);
        mesh.position.set((rect.x + rect.w / 2) / p.density - p.width / 2, p.height / 2 - (rect.y + rect.h / 2) / p.density, 0.009);
        const [label, action, enabled = true, meta = {}] = entry;
        mesh.userData.xrTarget = { kind: "dashboard-button", panelId: p.id, label, action, enabled, ...meta, buttonIndex: index };
      });
    }
    function drawMenu(p, startY) {
      const { rows, options } = p.data, M = T.menu, w = p.canvas.width, h = p.canvas.height, entries = [];
      let y = startY;
      rows.forEach((row, rowIndex) => {
        const height = options.variant === "settings" ? S.row : options.variant === "mode" ? row.some(entry => entry[3]?.large) ? M.modeRow : M.actionRow : rowIndex === 0 ? M.deckRow : row.some(entry => entry[3]?.biome) ? M.biomeRow : M.actionRow;
        const bw = (w - 2 * S.inset - S.gap * (row.length - 1)) / row.length;
        row.forEach((entry, col) => {
          const rect = { x: S.inset + col * (bw + S.gap), y, w: bw, h: height };
          drawButton(p, entry, rect, entries.length); entries.push({ entry, rect });
        }); y += height + S.gap;
      });
      const footer = options.footer || [], bw = (w - 2 * S.inset - S.gap * (footer.length - 1)) / Math.max(1, footer.length);
      footer.forEach((entry, col) => {
        const rect = { x: S.inset + col * (bw + S.gap), y: h - M.footer - S.inset, w: bw, h: M.footer };
        drawButton(p, entry, rect, entries.length); entries.push({ entry, rect });
      });
      p.page = 0; p.pageCount = 1; syncButtons(p, entries);
    }
    function draw(p) {
      if (!p.data || !p.node.visible) return;
      const { title, lines, rows, options } = p.data, c = p.context, w = p.canvas.width, h = p.canvas.height;
      c.clearRect(0, 0, w, h); c.save(); c.shadowBlur = 14; c.shadowColor = "rgba(0,0,0,0.3)"; c.shadowOffsetY = 5;
      surface(c, 4, 4, w - 8, h - 8, C.surface, C.gold, T.radius.panel, options.selected ? T.border.selected : T.border.normal); c.restore();
      if (p.handle && (scorePanel(p.id) || ["gear", "feedback"].includes(p.id))) surface(c, (w - 52) / 2, 12, 52, 4, p.hover.has("handle") || p.node.userData.grabbed ? C.gold : C.muted, null, 2);
      const team = p.id.startsWith("red") ? C.red : p.id.startsWith("blue") ? C.blue : null;
      if (team) surface(c, 20, 19, 7, h - 38, team, null, 3);
      if (p.id === "gear") {
        D.icon(c, "gear", w / 2 - 34, 66, 68, C.ink); drawText(c, "Réglages", 14, 177, w - 28, F.detail, C.ink, 600, 1); syncButtons(p, []);
      } else if (/^(red|blue)\d$/.test(p.id)) {
        drawText(c, title, 38, 27, w - 52, F.body, C.ink, 750, 1);
        drawText(c, lines[0] || "", 38, 79, w - 52, F.detail, C.muted, 500, 2);
        drawText(c, String(lines[1] || "").replace("PV ", ""), 38, 147, w - 52, F.value, C.ink, 700, 1);
        drawText(c, "Points de vie", 38, 205, w - 52, F.detail, C.muted, 500, 1);
        drawText(c, lines[2] || "", 38, 246, w - 52, F.detail, C.ink, 500, 2); syncButtons(p, []);
      } else if (p.id === "clock" || p.id.endsWith("Gold")) {
        const clock = p.id === "clock";
        drawText(c, clock ? lines[0] : title, 30, 38, w - 60, F.detail, C.muted, 600, 2);
        drawText(c, clock ? title : lines[0], 30, 135, w - 60, clock && title.length > 7 ? F.body : 61, clock ? C.ink : C.gold, 750, 2); syncButtons(p, []);
      } else if (p.id === "feedback") {
        drawText(c, title, 26, 23, w - 52, F.body, options.kind === "error" ? C.danger : C.ink, 600, 4); syncButtons(p, []);
      } else {
        if (p.handle) {
          const handleHover = p.hover.has("handle") || p.node.userData.grabbed;
          if (handleHover) surface(c, 12, 10, w - 24, S.header - 15, C.raised, C.gold, 24);
          surface(c, (w - 55) / 2, 16, 55, 4, handleHover ? C.gold : C.muted, null, 2);
        }
        drawText(c, title, S.inset, 39, w - 2 * S.inset, F.title, C.ink, 700, 1);
        c.beginPath(); c.moveTo(S.inset, S.header - 8); c.lineTo(w - S.inset, S.header - 8); c.strokeStyle = C.line; c.lineWidth = 1; c.stroke();
        const startY = drawLines(p, lines, S.header + 10) + (lines.length ? 12 : 0);
        if (options.variant) {
          drawMenu(p, startY); p.texture.needsUpdate = true; p.drawCount++; return;
        }
        const heights = rows.map((row) => row.some((entry) => entry[3]?.portrait) ? 265 : row.some((entry) => entry[3]?.detail) ? S.detailRow : S.row);
        const available = h - startY - S.inset, total = heights.reduce((sum, height) => sum + height + S.gap, 0), hasPages = total > available;
        const pageHeight = available - (hasPages ? S.footer : 0), pages = [[]]; let used = 0;
        rows.forEach((row, i) => {
          if (used + heights[i] + S.gap > pageHeight && pages.at(-1).length) { pages.push([]); used = 0; }
          pages.at(-1).push(i); used += heights[i] + S.gap;
        });
        p.pageCount = pages.length; p.page = Math.min(p.page, pages.length - 1);
        let y = startY; const entries = [];
        pages[p.page].forEach((rowIndex) => {
          const row = rows[rowIndex], height = heights[rowIndex], bw = (w - 2 * S.inset - S.gap * (row.length - 1)) / row.length;
          row.forEach((entry, col) => { const rect = { x: S.inset + col * (bw + S.gap), y, w: bw, h: height }; drawButton(p, entry, rect, entries.length); entries.push({ entry, rect }); }); y += height + S.gap;
        });
        if (hasPages) {
          const navigation = [["← Préc.", { type: "panel-page", panelId: p.id, delta: -1 }, p.page > 0, { reason: "Première page." }], [`${p.page + 1} / ${pages.length}`, null, false], ["Suiv. →", { type: "panel-page", panelId: p.id, delta: 1 }, p.page + 1 < pages.length, { reason: "Dernière page." }]];
          const bw = (w - 2 * S.inset - 2 * S.gap) / 3;
          navigation.forEach((entry, col) => { const rect = { x: S.inset + col * (bw + S.gap), y: h - S.footer, w: bw, h: S.footer - S.inset }; drawButton(p, entry, rect, entries.length); entries.push({ entry, rect }); });
        }
        syncButtons(p, entries);
      }
      p.texture.needsUpdate = true; p.drawCount++;
    }
    function paint(id, title, lines = [], rows = [], visible = true, options = {}) {
      const p = panel(id), wasVisible = p.node.visible; p.node.visible = visible;
      const height = id === "modal" ? options.variant === "mode" ? T.menu.modeHeight : options.variant === "setup" ? T.menu.setupHeight : T.layouts.modal[3] : p.height;
      if (height !== p.height) {
        p.height = height; p.canvas.height = Math.round(height * p.density);
        // Une nouvelle taille exige de réallouer aussi le stockage GPU de la texture.
        p.texture.dispose(); p.texture = canvasTexture(p.canvas);
        p.face.material.map = p.texture; p.face.material.needsUpdate = true;
        p.face.geometry.dispose(); p.face.geometry = new THREE.PlaneGeometry(p.width, height);
        if (p.handle) p.handle.position.y = height / 2 - S.header / p.density / 2;
        p.key = ""; p.hitKey = "";
      }
      if (id === "modal" && visible && (modalNeedsPlacement || !wasVisible) && viewer && !p.node.userData.customLayout) {
        placeDefault(p);
      }
      if (id === "modal" && visible) modalNeedsPlacement = false;
      if (!wasVisible && visible && !reducedMotion) p.face.material.opacity = 0.25;
      p.face.userData.xrTarget = options.action ? { kind: "dashboard-button", panelId: id, action: options.action, enabled: true, label: title } : { kind: "dashboard-panel", panelId: id };
      const key = JSON.stringify([title, lines, rows, options]);
      if (p.data?.title !== title) p.page = 0;
      p.data = { title, lines, rows, options };
      if (key !== p.key || (!wasVisible && visible)) { p.key = key; draw(p); }
    }
    function syncTargets() { targets.length = 0; panels.forEach((p) => { if (p.node.visible) targets.push(...p.buttons, ...(p.handle ? [p.handle] : []), p.face); }); }
    function position(viewer, smooth = false) {
      if (smooth && positioned) return;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(viewer.quaternion); forward.y = 0;
      if (forward.lengthSq() < 0.01) forward.set(0, 0, -1); forward.normalize();
      group.position.copy(viewer.position).addScaledVector(forward, E.Config.xr.dashboardDistance);
      // Toutes les fenêtres sont parallèles au joueur et centrées au-dessus du plateau.
      if (world?.parent?.name === "xr-board-placement" && world.parent.visible) {
        const boardPosition = world.parent.getWorldPosition(new THREE.Vector3());
        group.position.copy(boardPosition).addScaledVector(forward, E.Config.xr.dashboardBoardOffset);
        group.position.y = viewer.position.y;
      }
      group.rotation.set(0, Math.atan2(-forward.x, -forward.z), 0, "YXZ"); positioned = true;
    }
    function resetLayout(viewer) { group.scale.setScalar(1); panels.forEach((p) => { p.node.userData.customLayout = false; p.node.userData.windowUserScale = 1; placeDefault(p); }); if (viewer) position(viewer, false); }
    function recenter(viewer) {
      panels.forEach((p) => { if (Math.abs(p.node.position.x) > 1.6 || Math.abs(p.node.position.y) > 1.5 || Math.abs(p.node.position.z) > 0.7) { p.node.userData.customLayout = false; placeDefault(p); } }); position(viewer, false);
    }
    function adjustScale(direction) {
      const cfg = E.Config.xr;
      const factor = direction === "grow" ? cfg.windowScaleStep : direction === "shrink" ? 1 / cfg.windowScaleStep : 1;
      // Agrandir aussi les espacements conserve la disposition sans superposer les fenêtres.
      group.scale.setScalar(THREE.MathUtils.clamp(group.scale.x * factor, cfg.windowMinScale, cfg.windowMaxScale));
    }
    function setTextSize(size) {
      if (!T.textScales[size] || textSize === size) return;
      const ratio = T.textScales[size] / T.textScales[textSize]; textSize = size;
      panels.forEach((p) => { if (p.node.userData.customLayout) p.node.scale.multiplyScalar(ratio); else placeDefault(p); });
    }
    function setFeedback(message, kind = "info") {
      feedbackUntil = performance.now() + T.feedbackMs; paint("feedback", message, [], [], true, { kind });
      // Zone de notification réservée : aucune cible de gestion n'est recouverte.
      if (!panels.get("feedback").node.userData.customLayout) placeDefault(panels.get("feedback"));
    }
    function highlight(objects) {
      const now = performance.now(), fade = Math.min(1, (now - lastHighlight) / T.transitionMs); lastHighlight = now;
      panels.forEach((p) => {
        p.face.material.opacity = Math.min(1, p.face.material.opacity + fade);
        const hover = new Set(); p.buttons.forEach((button, index) => { if (objects.has(button)) hover.add(index); });
        if (p.handle && (objects.has(p.handle) || p.node.userData.grabbed)) hover.add("handle");
        const changed = [...hover].join(",") !== [...p.hover].join(","), expired = p.confirmed !== null && now >= p.confirmUntil; p.hover = hover;
        if (expired) p.confirmed = null; if (changed || expired) draw(p);
        p.face.material.color.set(objects.has(p.face) ? C.gold : "#ffffff");
      });
      const notice = panels.get("feedback"); if (notice && now > feedbackUntil && !notice.node.userData.grabbed) notice.node.visible = false;
    }
    function navigate(id, amount) {
      const p = panels.get(id); if (!p) return false; const next = THREE.MathUtils.clamp(p.page + amount, 0, p.pageCount - 1);
      if (next === p.page) return false; p.page = next; draw(p); syncTargets(); return true;
    }
    function feedback(target, valid) {
      const data = target?.userData?.xrTarget || target, p = panels.get(data?.panelId); if (!p) return;
      if (valid) { p.confirmed = data.buttonIndex; p.confirmUntil = performance.now() + T.confirmationMs; draw(p); }
    }
    function dispose() {
      disposed = true;
      panels.forEach((p) => { [p.face, p.handle, ...p.buttons].filter(Boolean).forEach((mesh) => { mesh.geometry.dispose(); mesh.material.dispose(); }); p.texture.dispose(); });
      images.forEach((img) => { img.onload = null; }); images.clear(); panels.clear(); targets.length = 0; scene.remove(group);
    }
    return { group, targets, paint, syncTargets, position, resetLayout, recenter, adjustScale, setTextSize, setFeedback, feedback, navigate, highlight, dispose,
      setViewer(value) { viewer = value; }, presentModal() { modalNeedsPlacement = true; },
      getPanel: (id) => panels.get(id), get windowScale() { return group.scale.x; }, get textSize() { return textSize; }, get modalActive() { return Boolean(panels.get("modal")?.node.visible); },
      get diagnostics() { return [...panels.values()].map((p) => ({ id: p.id, visible: p.node.visible, position: p.node.position.toArray(), width: p.width * p.node.scale.x * group.scale.x, height: p.height * p.node.scale.y * group.scale.y, page: p.page, pages: p.pageCount, draws: p.drawCount, texture: [p.canvas.width, p.canvas.height] })); }
    };
  }
  E.XRDashboard = { create };
}());
