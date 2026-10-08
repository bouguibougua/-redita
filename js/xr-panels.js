(function () {
  "use strict";
  const E = window.Eredita;
  // Le placement et les réglages du plateau partagent le thème/composant des
  // fenêtres de gestion, sans afficher de console permanente pendant le jeu.
  function create(context) {
    const panel = E.XRDashboard.create(context);
    panel.group.name = "xr-panel"; panel.group.visible = false;
    return {
      group: panel.group, targets: panel.targets, getPanel: panel.getPanel, resetLayout: panel.resetLayout, recenter: panel.recenter,
      setContent(title, lines, rows) {
        panel.paint("placement", title, lines, rows, true);
        panel.syncTargets();
        panel.targets.forEach((mesh) => {
          const target = mesh.userData.xrTarget;
          if (target.kind !== "panel-handle") target.kind = target.action ? "button" : "panel";
        });
      },
      position(viewer) {
        if (!panel.getPanel("placement")?.node.userData.customLayout) panel.position(viewer, false);
        panel.group.visible = true;
      },
      highlight: panel.highlight, dispose: panel.dispose
    };
  }
  E.XRPanels = { create };
}());
