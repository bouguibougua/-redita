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
      red: [-0.62, 0.36, 0.43, 0.18], clock: [0, 0.38, 0.35, 0.15], blue: [0.62, 0.36, 0.43, 0.18],
      jobs: [-0.61, 0.04, 0.44, 0.43], info: [0.61, 0.04, 0.44, 0.43],
      tasks: [-0.61, -0.39, 0.44, 0.36], buildings: [0.61, -0.39, 0.44, 0.36],
      residents: [0, -0.61, 0.68, 0.34], modal: [0, -0.08, 0.77, 0.77]
    };
    function disposeMesh(mesh) { mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose(); }
    function panel(id) {
      if (panels.has(id)) return panels.get(id);
      const [x, y, width, height] = layouts[id];
      const node = new THREE.Group(); node.position.set(x, y, id === "modal" ? 0.08 : 0); group.add(node);
      const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = Math.round(1024 * height / width);
      const context = canvas.getContext("2d"); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
      face.userData.xrTarget = { kind: "dashboard-panel" }; node.add(face);
      const item = { node, face, canvas, context, texture, width, height, buttons: [], key: "", rowsKey: "" };
      panels.set(id, item); return item;
    }
    function paint(id, title, lines, rows, visible = true) {
      const p = panel(id);
      p.node.visible = visible;
      if (!visible) return;
      const key = JSON.stringify([title, lines, rows]);
      if (key === p.key) return;
      p.key = key;
      const rowsKey = JSON.stringify(rows);
      const c = p.context, w = p.canvas.width, h = p.canvas.height;
      c.clearRect(0, 0, w, h); c.fillStyle = id === "modal" ? "#112930f5" : "#102529ed"; c.fillRect(0, 0, w, h);
      c.strokeStyle = "#9ac7ab"; c.lineWidth = 5; c.strokeRect(3, 3, w - 6, h - 6);
      c.fillStyle = "#ffe7a1"; c.font = `bold ${cfg.dashboardTitleSize}px sans-serif`; c.fillText(title, 30, 60, w - 60);
      c.font = `${cfg.dashboardFontSize}px sans-serif`; c.fillStyle = "#f3f8f4";
      const maxLines = Math.max(0, Math.floor((h - 90 - rows.length * 92) / 50));
      lines.slice(0, maxLines).forEach((line, index) => c.fillText(String(line), 30, 116 + index * 50, w - 60));
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
          const bctx = bc.getContext("2d"); bctx.fillStyle = enabled ? "#265b57" : "#3c4544"; bctx.fillRect(0, 0, 512, 128);
          bctx.fillStyle = enabled ? "#ffffff" : "#b9c0bd"; bctx.font = "bold 38px sans-serif"; bctx.textAlign = "center"; bctx.textBaseline = "middle"; bctx.fillText(label, 256, 64, 480);
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
      highlight(objects) { panels.forEach((p) => p.buttons.forEach((button) => button.material.color.setHex(objects.has(button) ? 0x9dffe0 : 0xffffff))); }
    };
  }
  E.XRDashboard = { create };
}());
