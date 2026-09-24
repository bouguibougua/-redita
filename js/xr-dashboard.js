(function () {
  "use strict";
  const E = window.Eredita;
  const cfg = E.Config.xr;

  function create({ THREE, scene }) {
    const group = new THREE.Group();
    group.name = "xr-game-dashboard";
    scene.add(group);
    const targets = [];
    const panels = new Map();
    const layouts = {
      redGold: [-0.55, 0.55, 0.64, 0.08], blueGold: [0.55, 0.55, 0.64, 0.08],
      clock: [0, 0.38, 0.22, 0.23], gear: [1.04, 0.54, 0.11, 0.1],
      jobs: [-0.81, -0.035, 0.44, 0.5], info: [0.81, -0.035, 0.44, 0.5],
      tasks: [-0.265, -0.48, 0.5, 0.34], buildings: [0.265, -0.48, 0.5, 0.34],
      residents: [0, -0.725, 0.94, 0.24], modal: [0, -0.08, 0.77, 0.77]
    };
    for (let lane = 0; lane < 4; lane++) {
      layouts[`red${lane}`] = [-0.805 + lane * 0.215, 0.365, 0.2, 0.23];
      layouts[`blue${lane}`] = [0.16 + lane * 0.215, 0.365, 0.2, 0.23];
    }
    function disposeMesh(mesh) { mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose(); }
    function panel(id) {
      if (panels.has(id)) return panels.get(id);
      const [x, y, width, height] = layouts[id];
      const node = new THREE.Group(); node.position.set(x, y, id === "modal" ? 0.08 : 0); group.add(node);
      const canvas = document.createElement("canvas"); canvas.width = /^(red\d|blue\d|gear)$/.test(id) ? 512 : 1024; canvas.height = Math.round(canvas.width * height / width);
      const context = canvas.getContext("2d"); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
      face.userData.xrTarget = { kind: "dashboard-panel" }; node.add(face);
      const item = { node, face, canvas, context, texture, width, height, buttons: [], key: "", rowsKey: "" };
      panels.set(id, item); return item;
    }
    function paint(id, title, lines, rows, visible = true, options = {}) {
      const p = panel(id);
      p.node.visible = visible;
      if (!visible) return;
      p.face.userData.xrTarget = options.action ? { kind: "dashboard-button", action: options.action, enabled: true } : { kind: "dashboard-panel" };
      const key = JSON.stringify([title, lines, rows, options.selected]);
      if (key === p.key) return;
      p.key = key;
      const rowsKey = JSON.stringify(rows);
      const c = p.context, w = p.canvas.width, h = p.canvas.height;
      const red = id.startsWith("red"), blue = id.startsWith("blue");
      c.clearRect(0, 0, w, h); c.fillStyle = id === "modal" ? "#112930f5" : "#172026ed"; c.fillRect(0, 0, w, h);
      c.strokeStyle = options.selected ? "#f7dc8a" : red ? "#aa5651" : blue ? "#4f9ac3" : "#8faba5";
      c.lineWidth = options.selected ? 10 : 5; c.strokeRect(3, 3, w - 6, h - 6);
      if (id === "clock") {
        c.textAlign = "center";
        c.fillStyle = "#f7d88d"; c.font = "bold 68px Georgia, serif"; c.fillText(lines[0] || "FRONTIÈRE", w / 2, 200, w - 80);
        c.fillStyle = "#f4f7f5"; c.font = "bold 200px Georgia, serif"; c.fillText(title, w / 2, 600, w - 80);
        c.textAlign = "left";
      } else if (id === "gear") {
        c.fillStyle = "#f4f7f5"; c.textAlign = "center"; c.font = "bold 240px sans-serif"; c.fillText(title, w / 2, h * 0.72, w - 80); c.textAlign = "left";
      } else {
        c.fillStyle = "#ffe7a1"; c.font = `bold ${cfg.dashboardTitleSize}px ${/^(red\d|blue\d)$/.test(id) ? "sans-serif" : "Georgia, serif"}`; c.fillText(title, 30, 60, w - 60);
        c.font = `${cfg.dashboardFontSize}px sans-serif`; c.fillStyle = "#f3f8f4";
        const maxLines = Math.max(0, Math.floor((h - 90 - rows.length * 92) / 50));
        lines.slice(0, maxLines).forEach((line, index) => c.fillText(String(line), 30, 116 + index * 50, w - 60));
      }
      if (rowsKey !== p.rowsKey) {
        p.rowsKey = rowsKey;
        p.buttons.forEach((button) => { p.node.remove(button); disposeMesh(button); });
        p.buttons = [];
        const rowHeight = p.height / (h / 92);
        rows.forEach((row, index) => {
        const y = -p.height / 2 + rowHeight * (rows.length - index - 0.5);
        const slotWidth = p.width / row.length;
        row.forEach((entry, column) => {
          const [label, action, enabled = true] = entry;
          const bw = slotWidth - 0.012;
          const bc = document.createElement("canvas"); bc.width = 512; bc.height = 128;
          const bctx = bc.getContext("2d");
          const portrait = action?.type === "select-resident";
          const activeFill = id === "jobs" ? "#d2aa5d" : id === "tasks" ? "#8c453e" : id === "buildings" ? "#477b4c" : "#265b57";
          bctx.fillStyle = portrait ? "#232f36" : enabled ? activeFill : "#3c4544"; bctx.fillRect(0, 0, 512, 128);
          if (portrait) {
            bctx.strokeStyle = label.startsWith("▶") ? "#f8d882" : "#78969e"; bctx.lineWidth = 8; bctx.strokeRect(4, 4, 504, 120);
            bctx.fillStyle = "#d4a477"; bctx.beginPath(); bctx.arc(84, 42, 20, 0, Math.PI * 2); bctx.fill();
            bctx.fillStyle = "#74644e"; bctx.beginPath(); bctx.moveTo(47, 112); bctx.lineTo(62, 69); bctx.lineTo(106, 69); bctx.lineTo(121, 112); bctx.fill();
          }
          bctx.fillStyle = enabled ? (id === "jobs" ? "#1f2525" : "#ffffff") : "#b9c0bd"; bctx.font = "bold 38px sans-serif"; bctx.textAlign = portrait ? "left" : "center"; bctx.textBaseline = "middle"; bctx.fillText(label.replace(/^▶ /, ""), portrait ? 135 : 256, 64, portrait ? 355 : 480);
          const map = new THREE.CanvasTexture(bc); map.colorSpace = THREE.SRGBColorSpace;
          const button = new THREE.Mesh(new THREE.PlaneGeometry(bw, rowHeight - 0.008), new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide }));
          button.position.set((column - (row.length - 1) / 2) * slotWidth, y, 0.008);
          button.userData.xrTarget = { kind: "dashboard-button", action, enabled };
          p.node.add(button); p.buttons.push(button);
        });
        });
      }
      p.texture.needsUpdate = true;
    }
    function syncTargets() {
      targets.length = 0;
      panels.forEach((p) => { if (p.node.visible) targets.push(...p.buttons, p.face); });
    }
    function position(viewer, smooth = false, dt = 0) {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(viewer.quaternion); forward.y = 0;
      if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
      forward.normalize();
      const target = viewer.position.clone().addScaledVector(forward, cfg.dashboardDistance);
      const yaw = Math.atan2(-forward.x, -forward.z);
      if (!smooth || !group.visible) { group.position.copy(target); group.rotation.set(0, yaw, 0); }
      else {
        if (group.position.distanceTo(target) > cfg.dashboardMoveThreshold) group.position.lerp(target, Math.min(1, dt * cfg.dashboardSmoothness));
        const difference = Math.atan2(Math.sin(yaw - group.rotation.y), Math.cos(yaw - group.rotation.y));
        if (Math.abs(difference) > cfg.dashboardTurnThreshold) group.rotation.y += difference * Math.min(1, dt * cfg.dashboardSmoothness);
      }
      group.visible = true;
    }
    function dispose() {
      panels.forEach((p) => { p.buttons.forEach(disposeMesh); disposeMesh(p.face); group.remove(p.node); });
      scene.remove(group);
    }
    return { group, targets, paint, syncTargets, position, dispose,
      highlight(objects) { panels.forEach((p) => {
        p.buttons.forEach((button) => button.material.color.setHex(objects.has(button) ? 0x9dffe0 : 0xffffff));
        p.face.material.color.setHex(objects.has(p.face) ? 0x9dffe0 : 0xffffff);
      }); }
    };
  }
  E.XRDashboard = { create };
}());
