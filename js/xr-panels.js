(function () {
  "use strict";
  const E = window.Eredita;
  // Le placement et les réglages du plateau partagent le thème/composant des
  // fenêtres de gestion, sans afficher de console permanente pendant le jeu.
  function create(context) {
    const { THREE } = context, cfg = E.Config.xr;
    const panel = E.XRDashboard.create(context);
    panel.group.name = "xr-panel"; panel.group.visible = false;
    return {
      group: panel.group, targets: panel.targets,
      setContent(title, lines, rows) {
        panel.paint("placement", title, lines, rows, true);
        panel.syncTargets();
        panel.targets.forEach((mesh) => {
          const target = mesh.userData.xrTarget;
          target.kind = target.action ? "button" : "panel";
        });
      },
      position(viewer) {
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(viewer.quaternion);
        direction.y = 0; if (direction.lengthSq() < 0.01) direction.set(0, 0, -1); direction.normalize();
        const right = new THREE.Vector3(-direction.z, 0, direction.x);
        panel.group.position.copy(viewer.position).addScaledVector(direction, cfg.panelDistance).addScaledVector(right, -cfg.panelSideOffset);
        panel.group.position.y -= cfg.panelBelowEyes; panel.group.lookAt(viewer.position); panel.group.visible = true;
      },
      highlight: panel.highlight, dispose: panel.dispose
    };
  }
  E.XRPanels = { create };
}());
