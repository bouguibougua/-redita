(function () {
  "use strict";
  const E = window.Eredita;

  // Manipulation de fenêtres uniquement : ce module ne reçoit jamais le plateau.
  function create({ THREE, dashboard, status = () => {} }) {
    const cfg = E.Config.xr;
    const grabs = new Map();
    const pressed = new Map();
    const offset = new THREE.Vector3();
    const desired = new THREE.Vector3();
    const worldPosition = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const delta = new THREE.Quaternion();
    const orientation = new THREE.Quaternion();
    const parentRotation = new THREE.Quaternion();
    let disposed = false;

    function basis(viewer) {
      forward.set(0, 0, -1).applyQuaternion(viewer.quaternion);
      forward.y = 0;
      if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
      forward.normalize(); right.set(-forward.z, 0, forward.x);
    }
    function constrain(point, viewer) {
      basis(viewer);
      offset.copy(point).sub(viewer.position);
      const y = THREE.MathUtils.clamp(offset.y, cfg.windowMinY, cfg.windowMaxY);
      offset.y = 0;
      const depth = THREE.MathUtils.clamp(offset.length(), cfg.windowMinDistance, cfg.windowMaxDistance);
      const angle = THREE.MathUtils.clamp(Math.atan2(offset.dot(right), offset.dot(forward)), -cfg.windowMaxYaw, cfg.windowMaxYaw);
      desired.copy(viewer.position).addScaledVector(forward, Math.cos(angle) * depth).addScaledVector(right, Math.sin(angle) * depth);
      desired.y += y;
      return desired;
    }
    function scale(node, factor) {
      const old = node.userData.windowUserScale || 1;
      const next = THREE.MathUtils.clamp(old * factor, cfg.windowMinScale, cfg.windowMaxScale);
      node.scale.multiplyScalar(next / old);
      node.userData.windowUserScale = next;
    }
    function release(record, cancelled = false) {
      const grab = grabs.get(record);
      if (!grab) return;
      if (cancelled) {
        grab.node.position.copy(grab.localPosition);
        grab.node.quaternion.copy(grab.localQuaternion);
        grab.node.scale.copy(grab.localScale);
        grab.node.userData.windowUserScale = grab.userScale;
        grab.node.userData.customLayout = grab.wasCustom;
      } else grab.node.userData.customLayout = true;
      grab.node.userData.grabbed = false;
      record.panelDragging = false;
      record.suppressSelectUntil = performance.now() + cfg.windowSelectGuardMs;
      grabs.delete(record);
    }
    function begin(record, hit) {
      const target = hit?.object?.userData.xrTarget;
      if (target?.kind !== "panel-handle") return;
      const panel = dashboard.getPanel(target.panelId);
      if (!panel?.node.visible || [...grabs.values()].some((grab) => grab.node === panel.node)) return;
      const node = panel.node;
      node.updateWorldMatrix(true, false);
      const position = node.getWorldPosition(new THREE.Vector3());
      grabs.set(record, {
        node, panelId: target.panelId,
        localPosition: node.position.clone(), localQuaternion: node.quaternion.clone(), localScale: node.scale.clone(),
        userScale: node.userData.windowUserScale || 1, wasCustom: Boolean(node.userData.customLayout),
        gripInverse: (record.gripQuaternion || new THREE.Quaternion()).clone().invert(),
        quaternion: node.getWorldQuaternion(new THREE.Quaternion()),
        offset: position.sub(record.gripPosition), depth: 0
      });
      record.panelDragging = true;
      record.selectBlocked = true;
      node.userData.grabbed = true;
      status("Fenêtre saisie · bougez et orientez la main. Joystick ↕ distance, ↔ taille. B : annuler.");
    }
    function update(records, hits, viewer, dt, enabled = true) {
      if (disposed) return;
      for (const record of [...pressed.keys()]) {
        if (!records.includes(record)) { release(record); pressed.delete(record); }
      }
      for (const record of records) {
        const down = Boolean(record.tracked && record.squeezing);
        if (!enabled || !record.tracked) release(record);
        if (enabled && down && !pressed.get(record)) begin(record, hits.get(record));
        pressed.set(record, down);
        const grab = grabs.get(record);
        if (!grab) continue;
        if (!down || !grab.node.visible) { release(record); continue; }
        delta.copy(record.gripQuaternion || grab.gripInverse.clone().invert()).multiply(grab.gripInverse);
        grab.depth = THREE.MathUtils.clamp(grab.depth - (record.axes[1] || 0) * cfg.windowDepthSpeed * dt, -1, 1);
        worldPosition.copy(grab.offset).applyQuaternion(delta).add(record.gripPosition).addScaledVector(record.direction, grab.depth);
        constrain(worldPosition, viewer);
        const limited = worldPosition.distanceToSquared(desired) > 0.0001;
        if (limited && !grab.limited) status("Limite de confort atteinte. Les paramètres permettent de recentrer les fenêtres.");
        grab.limited = limited;
        grab.node.parent.worldToLocal(desired);
        const alpha = 1 - Math.exp(-cfg.windowSmoothing * dt);
        grab.node.position.lerp(desired, alpha);
        orientation.copy(delta).multiply(grab.quaternion);
        grab.node.parent.getWorldQuaternion(parentRotation).invert();
        orientation.premultiply(parentRotation);
        grab.node.quaternion.slerp(orientation, alpha);
        scale(grab.node, Math.exp((record.axes[0] || 0) * cfg.windowScaleSpeed * dt));
      }
    }
    function adjust(panelId, operation, viewer) {
      const node = dashboard.getPanel(panelId)?.node;
      if (!node || !viewer) return false;
      reset();
      node.updateWorldMatrix(true, false);
      node.getWorldPosition(worldPosition);
      basis(viewer);
      if (operation === "face") node.lookAt(viewer.position);
      else if (operation === "grow" || operation === "shrink") scale(node, operation === "grow" ? cfg.windowScaleStep : 1 / cfg.windowScaleStep);
      else {
        if (operation === "near" || operation === "far") worldPosition.addScaledVector(forward, operation === "near" ? -cfg.windowMoveStep : cfg.windowMoveStep);
        else if (operation === "left" || operation === "right") worldPosition.addScaledVector(right, operation === "left" ? -cfg.windowMoveStep : cfg.windowMoveStep);
        else if (operation === "up" || operation === "down") worldPosition.y += operation === "up" ? cfg.windowMoveStep : -cfg.windowMoveStep;
        else return false;
        constrain(worldPosition, viewer); node.parent.worldToLocal(desired); node.position.copy(desired);
      }
      node.userData.customLayout = true;
      return true;
    }
    function reset() { for (const record of [...grabs.keys()]) release(record); }
    return {
      update, adjust, reset,
      cancel() { const active = grabs.size > 0; for (const record of [...grabs.keys()]) release(record, true); return active; },
      isDragging: (record) => grabs.has(record),
      get active() { return grabs.size > 0; },
      get diagnostics() { return [...grabs.values()].map(({ panelId }) => panelId); },
      dispose() { reset(); pressed.clear(); disposed = true; }
    };
  }
  E.XRWindows = { create };
}());
