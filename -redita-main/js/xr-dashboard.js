(function () {
  "use strict";
  const E = window.Eredita;
  function create({ THREE, scene, renderer }) {
    const D = E.XRDesign, T = D.tokens, C = D.theme(), S = T.spacing, F = T.type;
    const group = new THREE.Group(); group.name = "xr-game-dashboard"; scene.add(group);
    const targets = [], panels = new Map(), images = new Map();
    const movable = new Set(["jobs", "info", "tasks", "buildings", "residents", "modal"]);
    let positioned = false, disposed = false, feedbackUntil = 0, lastHighlight = performance.now();
    let { textScale, highContrast } = D.getPreferences();
    const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    function panel(id) {
      if (panels.has(id)) return panels.get(id);
      const [x, y, width, height] = T.layouts[id];
      const node = new THREE.Group(); node.name = `xr-window-${id}`; node.userData = { panelId: id, modal: id === "modal", windowUserScale: 1 };
      node.position.set(x, y, id === "modal" ? 0.18 : 0); group.add(node);
      const canvas = document.createElement("canvas"), density = T.pixelsPerMeter;
      const textureDensity = Math.min(T.texturePixelsPerMeter, T.maxTextureSize / Math.max(width, height), (renderer?.capabilities?.maxTextureSize || T.maxTextureSize) / Math.max(width, height));
      canvas.width = Math.round(width * textureDensity); canvas.height = Math.round(height * textureDensity);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
      texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
      face.userData.xrTarget = { kind: "dashboard-panel", panelId: id }; node.add(face);
      const item = { id, node, face, canvas, context: canvas.getContext("2d"), texture, width, height, density, logicalWidth: width * density, logicalHeight: height * density, buttons: [], visibleRects: [], hitKey: "", key: "", data: null, page: 0, pageCount: 1, hover: new Set(), confirmed: null, confirmUntil: 0, drawCount: 0 };
      if (movable.has(id)) {
        const handle = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.022, S.header / density - 0.006), new THREE.MeshBasicMaterial({ visible: false }));
        handle.position.set(0, height / 2 - S.header / density / 2, 0.005);
        handle.userData.xrTarget = { kind: "panel-handle", panelId: id }; node.add(handle); item.handle = handle;
      }
      panels.set(id, item); placeDefault(item); return item;
    }
    function placeDefault(p) {
      const [x, y] = T.layouts[p.id];
      p.node.position.set(x, y, p.id === "modal" ? 0.18 : 0);
      p.node.scale.setScalar(p.node.userData.windowUserScale || 1);
      p.node.rotation.set(0, p.id === "jobs" ? 0.22 : p.id === "info" ? -0.22 : 0, 0);
    }
    const drawText = (c, value, x, y, width, size = F.body, color = C.ink, weight = 500, max = Infinity) => D.text(c, value, x, y, width, size * textScale, highContrast && color === C.muted ? C.ink : color, weight, max);
    function surface(c, x, y, width, height, fill, stroke = C.gold, radius = T.radius.panel, lineWidth = T.border.normal) {
      D.rounded(c, x, y, width, height, radius); c.fillStyle = fill; c.fill();
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = lineWidth; c.stroke(); }
    }
    function measure(c, value, width, size = F.body, weight = 500) {
      c.font = `${weight} ${size * textScale}px ${T.font}`;
      return D.wrap(c, value, width);
    }
    function imageFor(src) {
      if (images.has(src)) return images.get(src);
      const img = new Image(); images.set(src, img);
      img.onload = () => { if (!disposed) panels.forEach((p) => { if (p.id === "residents" && p.data) draw(p); }); };
      img.src = src; return img;
    }
    function buttonHeight(p, entry, width) {
      const [label, , , meta = {}] = entry, inset = meta.icon ? 64 : 18;
      const labelHeight = measure(p.context, label, width - inset - 18, F.body, 650).length * F.body * textScale * 1.25;
      const detailHeight = meta.detail ? measure(p.context, meta.detail, width - inset - 18, F.detail).length * F.detail * textScale * 1.25 + 10 : 0;
      if (meta.portrait) {
        const profession = measure(p.context, meta.profession, width - 32, F.detail).length;
        const status = measure(p.context, `${meta.detail || ""} · ${meta.status || ""}`, width - 32, F.detail).length;
        return 132 + labelHeight + (profession + status) * F.detail * textScale * 1.25 + 24;
      }
      return Math.max(S.row, labelHeight + detailHeight + 36);
    }
    function drawButton(p, entry, rect, index) {
      const [label, action, enabled = true, meta = {}] = entry, c = p.context, { x, y, w, h } = rect;
      const active = meta.selected, hovered = p.hover.has(index), confirmed = p.confirmed === index && performance.now() < p.confirmUntil;
      surface(c, x, y, w, h, !enabled ? C.surface : C.raised, active || hovered || confirmed ? C.gold : highContrast && enabled ? C.muted : C.line, T.radius.button, active || confirmed ? T.border.selected : T.border.normal);
      if (hovered || confirmed) { c.fillStyle = `${C.gold}12`; D.rounded(c, x, y, w, h, T.radius.button); c.fill(); }
      if (meta.portrait) {
        const photo = imageFor(meta.portrait.src), side = 100, px = x + (w - side) / 2, py = y + 16;
        c.save(); D.rounded(c, px, py, side, side, T.radius.portrait); c.clip();
        if (photo.complete && photo.naturalWidth) {
          const { columns, rows, index: tile } = meta.portrait, sw = photo.naturalWidth / columns, sh = photo.naturalHeight / rows;
          const [cx, cy, cw, ch] = T.portraitCrop;
          c.drawImage(photo, ((tile % columns) + cx) * sw, (Math.floor(tile / columns) + cy) * sh, sw * cw, sh * ch, px, py, side, side);
        } else D.icon(c, "person", px + 15, py + 15, 70, C.ink);
        c.restore();
        let ty = py + side + 16;
        ty += drawText(c, label, x + 16, ty, w - 32, F.body, C.ink, 700);
        ty += drawText(c, meta.profession, x + 16, ty + 8, w - 32, F.detail, C.ink) + 8;
        drawText(c, `${meta.detail || ""} · ${meta.status || ""}`, x + 16, ty + 8, w - 32, F.detail, C.muted);
      } else {
        const inset = meta.icon ? 64 : 18;
        if (meta.icon) D.icon(c, meta.icon, x + 16, y + 20, 34, enabled ? C.gold : C.muted);
        const ty = y + 18;
        const used = drawText(c, label, x + inset, ty, w - inset - 18, F.body, enabled ? C.ink : C.muted, 650);
        if (meta.detail) drawText(c, meta.detail, x + inset, ty + used + 10, w - inset - 18, F.detail, C.muted);
      }
    }
    // Une grille devient plusieurs rangées quand le texte réclame plus de largeur.
    function rowBlocks(p, rows, width, capacity, compact = false) {
      const blocks = [];
      for (const row of rows) {
        const portrait = row.some(entry => entry[3]?.portrait);
        const minWidth = (compact ? 220 : portrait ? 300 : 360) * textScale;
        const columns = Math.max(1, Math.min(row.length, Math.floor((width + S.gap) / (minWidth + S.gap))));
        for (let i = 0; i < row.length; i += columns) {
          const entries = row.slice(i, i + columns), cellWidth = (width - S.gap * (entries.length - 1)) / entries.length;
          const height = Math.max(...entries.map(entry => buttonHeight(p, entry, cellWidth)));
          if (height <= capacity || portrait) blocks.push({ kind: "row", entries, height });
          else {
            // Une longue condition reste lisible sur les pages suivantes.
            // L'action et sa validation métier sont identiques sur chaque fragment.
            for (const entry of entries) {
              const [label, action, enabled, meta = {}] = entry, inset = meta.icon ? 64 : 18;
              const labelLines = measure(p.context, label, width - inset - 18, F.body, 650);
              const headingLines = Math.max(1, Math.floor((capacity - 36) / (F.body * textScale * 1.25)));
              for (let j = 0; j < labelLines.length; j += headingLines) {
                const part = labelLines.slice(j, j + headingLines).join(" ");
                const detailLines = j === 0 ? measure(p.context, meta.detail || "", width - inset - 18, F.detail) : [];
                const remaining = capacity - buttonHeight(p, [part, action, enabled, { ...meta, detail: "" }], width) - 10;
                const count = Math.max(1, Math.floor(remaining / (F.detail * textScale * 1.25)));
                if (!detailLines.length) {
                  const fragment = [part, action, enabled, { ...meta, detail: "" }];
                  blocks.push({ kind: "row", entries: [fragment], height: buttonHeight(p, fragment, width) });
                } else for (let d = 0; d < detailLines.length; d += count) {
                  const fragment = [d ? "Suite" : part, action, enabled, { ...meta, detail: detailLines.slice(d, d + count).join(" ") }];
                  blocks.push({ kind: "row", entries: [fragment], height: buttonHeight(p, fragment, width) });
                }
              }
            }
          }
        }
      }
      return blocks;
    }
    function contentBlocks(p, lines, width) {
      const blocks = [], c = p.context;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line?.kind === "stat") {
          const cells = [line];
          if (lines[i + 1]?.kind === "stat" && width >= 620 * textScale) cells.push(lines[++i]);
          const cw = (width - S.gap * (cells.length - 1)) / cells.length;
          const height = Math.max(...cells.map(cell => 28 + measure(c, cell.label, cw - 28, F.detail).length * F.detail * textScale * 1.25 + measure(c, cell.value, cw - 28, F.value, 700).length * F.value * textScale * 1.25));
          blocks.push({ kind: "stat", cells, height });
        } else {
          const size = typeof line === "object" ? F.detail : F.body, color = typeof line === "object" ? C.gold : C.muted;
          for (const value of measure(c, typeof line === "object" ? line.label : line, width, size)) blocks.push({ kind: "text", value, size, color, height: size * textScale * 1.25 + 8 });
        }
      }
      return blocks;
    }
    function drawBlock(p, block, y, width, entries) {
      const c = p.context;
      if (block.kind === "text") drawText(c, block.value, S.inset, y, width, block.size, block.color);
      else if (block.kind === "stat") {
        const cw = (width - S.gap * (block.cells.length - 1)) / block.cells.length;
        block.cells.forEach((cell, column) => {
          const x = S.inset + column * (cw + S.gap);
          surface(c, x, y, cw, block.height, C.raised, C.line, T.radius.button);
          const used = drawText(c, cell.label, x + 14, y + 12, cw - 28, F.detail, C.muted);
          drawText(c, cell.value, x + 14, y + used + 18, cw - 28, F.value, C.ink, 700);
        });
      } else {
        const bw = (width - S.gap * (block.entries.length - 1)) / block.entries.length;
        block.entries.forEach((entry, col) => {
          const rect = { x: S.inset + col * (bw + S.gap), y, w: bw, h: block.height };
          drawButton(p, entry, rect, entries.length); entries.push({ entry, rect });
        });
      }
      return y + block.height + S.gap;
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
    function draw(p) {
      if (!p.data || !p.node.visible) return;
      const { title, lines, rows, options } = p.data, c = p.context, w = p.logicalWidth, h = p.logicalHeight;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, p.canvas.width, p.canvas.height);
      c.setTransform(p.canvas.width / w, 0, 0, p.canvas.height / h, 0, 0);
      surface(c, 4, 4, w - 8, h - 8, C.surface, C.gold, T.radius.panel, options.selected ? T.border.selected : T.border.normal);
      const team = p.id.startsWith("red") ? C.red : p.id.startsWith("blue") ? C.blue : null;
      if (team) surface(c, 12, 16, 6, h - 32, team, null, 3);
      if (p.id === "gear") {
        D.icon(c, "gear", w / 2 - 40, h / 2 - 40, 80, C.ink); syncButtons(p, []);
      } else if (/^(red|blue)\d$/.test(p.id)) {
        const x = 28, width = w - 44;
        let y = 20;
        y += drawText(c, title, x, y, width, F.body, C.ink, 750) + 8;
        y += drawText(c, lines[0] || "", x, y, width, F.detail, C.muted) + 8;
        y += drawText(c, String(lines[1] || ""), x, y, width, F.body, C.ink, 700) + 8;
        drawText(c, lines[2] || "", x, y, width, F.detail, C.ink); syncButtons(p, []);
      } else if (p.id === "clock" || p.id.endsWith("Gold")) {
        const clock = p.id === "clock", width = w - 40;
        const used = drawText(c, clock ? lines[0] : title, 20, 24, width, F.detail, C.muted, 600);
        drawText(c, clock ? title : lines[0], 20, 40 + used, width, F.value, clock ? C.ink : C.gold, 750); syncButtons(p, []);
      } else if (p.id === "feedback") {
        drawText(c, title, 26, 23, w - 52, F.body, options.kind === "error" ? C.danger : C.ink, 600); syncButtons(p, []);
      } else {
        const width = w - 2 * S.inset;
        const header = Math.max(S.header, 52 + measure(c, title, width, F.title, 700).length * F.title * textScale * 1.25);
        if (p.handle) {
          const handleHover = p.hover.has("handle") || p.node.userData.grabbed;
          p.handle.scale.y = (header / p.density - 0.006) / p.handle.geometry.parameters.height;
          p.handle.position.y = p.height / 2 - header / p.density / 2;
          if (handleHover) surface(c, 12, 10, w - 24, header - 15, C.raised, C.gold, 24);
          surface(c, (w - 55) / 2, 16, 55, 4, handleHover ? C.gold : C.muted, null, 2);
        }
        drawText(c, title, S.inset, 39, width, F.title, C.ink, 700);
        c.beginPath(); c.moveTo(S.inset, header - 8); c.lineTo(w - S.inset, header - 8); c.strokeStyle = C.line; c.lineWidth = 1; c.stroke();
        const entries = [], pinned = rowBlocks(p, options.pinnedRows || [], width, h - header - S.footer - S.inset, true);
        let startY = header + 12;
        pinned.forEach(block => { startY = drawBlock(p, block, startY, width, entries); });
        const available = h - startY - S.inset;
        // Une réserve fixe assure des cibles de navigation généreuses à toutes les tailles.
        const footer = Math.max(108, S.footer, F.body * textScale * 1.25 + 48);
        const capacity = available - footer - S.gap;
        const blocks = [...contentBlocks(p, lines, width), ...rowBlocks(p, rows, width, capacity)];
        const total = blocks.reduce((sum, block) => sum + block.height + S.gap, 0), hasPages = total > available;
        const pages = [[]]; let used = 0;
        const pageHeight = hasPages ? capacity : available;
        for (const block of blocks) {
          if (used + block.height + S.gap > pageHeight && pages.at(-1).length) { pages.push([]); used = 0; }
          pages.at(-1).push(block); used += block.height + S.gap;
        }
        p.pageCount = pages.length; p.page = Math.min(p.page, pages.length - 1);
        let y = startY;
        pages[p.page].forEach(block => { y = drawBlock(p, block, y, width, entries); });
        p.contentBottom = y - S.gap; p.contentLimit = hasPages ? h - footer - S.inset : h - S.inset;
        if (hasPages) {
          const bw = (width - 2 * S.gap) / 3;
          const navigation = [["←", { type: "panel-page", panelId: p.id, delta: -1 }, p.page > 0, { reason: "Première page." }], [`${p.page + 1}/${pages.length}`, null, false], ["→", { type: "panel-page", panelId: p.id, delta: 1 }, p.page + 1 < pages.length, { reason: "Dernière page." }]];
          navigation.forEach((entry, col) => {
            const rect = { x: S.inset + col * (bw + S.gap), y: h - footer, w: bw, h: footer - 12 };
            drawButton(p, entry, rect, entries.length); entries.push({ entry, rect });
          });
        }
        p.visibleRects = entries.map(item => ({ ...item.rect }));
        syncButtons(p, entries);
      }
      p.texture.needsUpdate = true; p.drawCount++;
    }
    function paint(id, title, lines = [], rows = [], visible = true, options = {}) {
      const p = panel(id), wasVisible = p.node.visible; p.node.visible = visible;
      if (!wasVisible && visible && !reducedMotion) p.face.material.opacity = 0.25;
      p.face.userData.xrTarget = options.action ? { kind: "dashboard-button", panelId: id, action: options.action, enabled: true, label: title } : { kind: "dashboard-panel", panelId: id };
      const key = JSON.stringify([title, lines, rows, options]);
      if (p.data?.title !== title) p.page = 0;
      p.data = { title, lines, rows, options };
      if (key !== p.key || (!wasVisible && visible)) { p.key = key; draw(p); }
    }
    function syncTargets() { targets.length = 0; panels.forEach((p) => { if (p.node.visible && p.id !== "feedback") targets.push(...p.buttons, ...(p.handle ? [p.handle] : []), p.face); }); }
    function position(viewer, smooth = false) {
      if (smooth && positioned) return;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(viewer.quaternion); forward.y = 0;
      if (forward.lengthSq() < 0.01) forward.set(0, 0, -1); forward.normalize();
      group.position.copy(viewer.position).addScaledVector(forward, E.Config.xr.dashboardDistance);
      // Le cadre est orienté vers la table : ses commandes basses restent sous
      // le plateau dans le champ visuel au lieu de passer derrière sa géométrie.
      const pitch = E.Config.xr.dashboardPitch;
      group.position.y -= Math.tan(pitch) * E.Config.xr.dashboardDistance;
      group.rotation.set(-pitch, Math.atan2(-forward.x, -forward.z), 0, "YXZ"); positioned = true;
    }
    function resetLayout(viewer) { panels.forEach((p) => { p.node.userData.customLayout = false; p.node.userData.windowUserScale = 1; placeDefault(p); }); if (viewer) position(viewer, false); }
    function recenter(viewer) {
      panels.forEach((p) => { if (Math.abs(p.node.position.x) > 1.6 || Math.abs(p.node.position.y) > 1.5 || Math.abs(p.node.position.z) > 0.7) { p.node.userData.customLayout = false; placeDefault(p); } }); position(viewer, false);
    }
    // Seuls les glyphes et leur mise en page changent. Les poses restent intactes.
    const unsubscribe = D.subscribe(preferences => {
      textScale = preferences.textScale; highContrast = preferences.highContrast;
      panels.forEach(p => { p.page = 0; p.hover.clear(); p.confirmed = null; draw(p); });
      syncTargets();
    });
    function setTextScale(scale) { return D.setPreferences({ textScale: scale }); }
    function setTextSize(size) { return T.textScales[size] ? setTextScale(T.textScales[size]) : false; }
    function setHighContrast(enabled) { return D.setPreferences({ highContrast: enabled }); }
    function setFeedback(message, kind = "info") {
      feedbackUntil = performance.now() + T.feedbackMs; paint("feedback", message, [], [], true, { kind });
      // Zone de notification réservée : aucune cible de gestion n'est recouverte.
      placeDefault(panels.get("feedback"));
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
      const notice = panels.get("feedback"); if (notice && now > feedbackUntil) notice.node.visible = false;
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
      disposed = true; unsubscribe();
      panels.forEach((p) => { [p.face, p.handle, ...p.buttons].filter(Boolean).forEach((mesh) => { mesh.geometry.dispose(); mesh.material.dispose(); }); p.texture.dispose(); });
      images.forEach((img) => { img.onload = null; }); images.clear(); panels.clear(); targets.length = 0; scene.remove(group);
    }
    return { group, targets, paint, syncTargets, position, resetLayout, recenter, setTextSize, setTextScale, setHighContrast, setFeedback, feedback, navigate, highlight, dispose,
      getPanel: (id) => panels.get(id), get textSize() { return Object.keys(T.textScales).find(key => T.textScales[key] === textScale) || "custom"; }, get textScale() { return textScale; }, get highContrast() { return highContrast; }, get modalActive() { return Boolean(panels.get("modal")?.node.visible); },
      get diagnostics() { return [...panels.values()].map((p) => ({ id: p.id, visible: p.node.visible, position: p.node.position.toArray(), width: p.width * p.node.scale.x, height: p.height * p.node.scale.y, page: p.page, pages: p.pageCount, draws: p.drawCount, textScale, contentBottom: p.contentBottom, contentLimit: p.contentLimit, texture: [p.canvas.width, p.canvas.height] })); }
    };
  }
  E.XRDashboard = { create };
}());
