(function () {
  "use strict";
  const E = window.Eredita;
  function create({ THREE, scene }) {
    const cfg = E.Config.xr;
    const group = new THREE.Group();
    group.name = "xr-panel";
    scene.add(group);
    group.visible = false;
    const targets = [];
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 896;
    const context = canvas.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(cfg.panelWidth, cfg.panelHeight, 0.012), new THREE.MeshBasicMaterial({ color: 0x122527 }));
    panel.userData.xrTarget = { kind: "panel" };
    const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(cfg.panelWidth, cfg.panelHeight), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
    textPlane.position.z = 0.007;
    group.add(panel, textPlane);
    let buttons = [];
    let contentKey = "";
    let layoutKey = "";

    function disposeMesh(mesh) {
      mesh.geometry.dispose();
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }

    function setContent(title, lines, rows) {
      const nextLayout = JSON.stringify(rows);
      if (nextLayout !== layoutKey) {
        layoutKey = nextLayout;
        buttons.forEach((button) => { group.remove(button); disposeMesh(button); });
        buttons = [];
        rows.forEach((row, rowIndex) => row.forEach(([label, action], column) => {
          const width = (cfg.panelWidth - 0.05) / row.length - 0.012;
          const buttonCanvas = document.createElement("canvas");
          buttonCanvas.width = 512; buttonCanvas.height = 128;
          const ctx = buttonCanvas.getContext("2d");
          ctx.fillStyle = "#24474d"; ctx.fillRect(0, 0, 512, 128);
          ctx.fillStyle = "#fff9e6"; ctx.font = "bold 40px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(label, 256, 64, 480);
          const map = new THREE.CanvasTexture(buttonCanvas);
          map.colorSpace = THREE.SRGBColorSpace;
          const button = new THREE.Mesh(new THREE.BoxGeometry(width, 0.055, 0.02), new THREE.MeshBasicMaterial({ map }));
          button.position.set((column - (row.length - 1) / 2) * (width + 0.012), -cfg.panelHeight / 2 + 0.045 + (rows.length - 1 - rowIndex) * 0.068, 0.019);
          button.userData.xrTarget = { kind: "button", action };
          buttons.push(button); group.add(button);
        }));
        targets.splice(0, targets.length, ...buttons, panel);
      }
      const nextContent = JSON.stringify([title, lines]);
      if (nextContent === contentKey) return;
      contentKey = nextContent;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#f5d98b"; context.font = "bold 39px sans-serif";
      context.fillText(title, 40, 62, 944);
      context.font = "32px sans-serif"; context.fillStyle = "#f4f7f5";
      lines.forEach((line, index) => context.fillText(line, 40, 120 + index * 55, 944));
      texture.needsUpdate = true;
    }

    return {
      group, targets, setContent,
      position(viewer) {
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(viewer.quaternion);
        direction.y = 0; direction.normalize();
        if (direction.lengthSq() < 0.01) direction.set(0, 0, -1);
        const right = new THREE.Vector3(-direction.z, 0, direction.x);
        group.position.copy(viewer.position).addScaledVector(direction, cfg.panelDistance).addScaledVector(right, -cfg.panelSideOffset);
        group.position.y -= cfg.panelBelowEyes;
        group.lookAt(viewer.position);
        group.visible = true;
      },
      highlight(objects) { buttons.forEach((button) => button.material.color.setHex(objects.has(button) ? 0x8cffe0 : 0xffffff)); },
      dispose() { buttons.forEach(disposeMesh); disposeMesh(panel); disposeMesh(textPlane); scene.remove(group); }
    };
  }
  E.XRPanels = { create };
}());
