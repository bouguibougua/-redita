(function () {
  "use strict";
  const E = window.Eredita;
  // Source : immersive-web/webxr-input-profiles, meta/meta-quest-touch-plus.json.
  // Index 0 = index, 1 = préhension, 4/5 = A/B ou X/Y, axes 2/3 = joystick.
  // Seuls ces profils connus donnent un sens à A/B ; jamais aux boutons système.
  const touchProfiles = new Set(["meta-quest-touch-plus", "meta-quest-touch-pro", "oculus-touch-v3", "oculus-touch-v2", "oculus-touch"]);
  function mapping(source) {
    if (source?.targetRayMode !== "tracked-pointer" || source.gamepad?.mapping !== "xr-standard") return null;
    return {
      axes: [2, 3],
      confirm: source.handedness === "right" && source.profiles?.some((id) => touchProfiles.has(id)) ? 4 : null,
      cancel: source.handedness === "right" && source.profiles?.some((id) => touchProfiles.has(id)) ? 5 : null,
      panels: source.handedness === "left" && source.profiles?.some((id) => touchProfiles.has(id)) ? 4 : null,
      cards: source.handedness === "left" && source.profiles?.some((id) => touchProfiles.has(id)) ? 5 : null
    };
  }

  function create({ THREE, renderer, scene, session }) {
    const cfg = E.Config.xr;
    const queue = [];
    const listeners = [];
    const records = [0, 1].map((index) => {
      const node = renderer.xr.getController(index);
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(), new THREE.Vector3(0, 0, -1)
      ]), new THREE.LineBasicMaterial({ color: 0xc8dce3 }));
      ray.scale.z = cfg.rayLength;
      node.add(ray);
      scene.add(node);
      const record = { node, ray, source: null, tracked: false, squeezing: false, buttons: {}, axes: [0, 0], position: new THREE.Vector3(), direction: new THREE.Vector3(), gripPosition: new THREE.Vector3(), gripQuaternion: new THREE.Quaternion(), panelDragging: false, selectBlocked: false, suppressSelectUntil: 0, panelsHeldSince: null, recoverySent: false };
      const blocked = () => record.squeezing || record.panelDragging || performance.now() < record.suppressSelectUntil;
      const bind = (type, callback) => {
        node.addEventListener(type, callback);
        listeners.push(() => node.removeEventListener(type, callback));
      };
      bind("connected", (event) => { record.source = event.data; record.buttons = {}; });
      bind("disconnected", () => { record.source = null; record.squeezing = false; record.tracked = false; record.buttons = {}; record.panelsHeldSince = null; });
      bind("selectstart", () => { record.selectBlocked = blocked(); });
      bind("select", () => {
        if (record.source && !record.selectBlocked && !blocked()) queue.push({ type: "confirm", record, source: record.source });
        record.selectBlocked = false;
      });
      bind("squeezestart", () => { record.squeezing = true; record.selectBlocked = true; });
      bind("squeezeend", () => { record.squeezing = false; record.suppressSelectUntil = performance.now() + cfg.windowSelectGuardMs; });
      return record;
    });

    function update(frame, referenceSpace) {
      records.forEach((record) => {
        const source = record.source;
        const pose = source && frame.getPose(source.targetRaySpace, referenceSpace);
        record.tracked = Boolean(pose);
        record.node.visible = Boolean(pose);
        record.axes = [0, 0];
        if (!pose) { record.squeezing = false; record.buttons = {}; record.panelsHeldSince = null; return; }
        const transform = new THREE.Matrix4().fromArray(pose.transform.matrix);
        record.position.setFromMatrixPosition(transform);
        record.direction.set(0, 0, -1).transformDirection(transform);
        const grip = source.gripSpace && frame.getPose(source.gripSpace, referenceSpace);
        if (grip) transform.fromArray(grip.transform.matrix);
        record.gripPosition.setFromMatrixPosition(transform);
        record.gripQuaternion.setFromRotationMatrix(transform);
        const layout = mapping(source);
        if (!layout) return;
        record.axes = layout.axes.map((i) => {
          const value = source.gamepad.axes[i] || 0;
          return Math.abs(value) < cfg.stickDeadzone ? 0 : value;
        });
        ["confirm", "cancel", "panels", "cards"].forEach((type) => {
          const index = layout[type];
          const pressed = index !== null && Boolean(source.gamepad.buttons[index]?.pressed);
          if (pressed && record.buttons[type] === false && (type !== "confirm" || (!record.squeezing && !record.panelDragging && performance.now() >= record.suppressSelectUntil))) queue.push({ type: type === "confirm" ? "info" : type, record, source, button: index });
          if (type === "panels") {
            if (pressed && record.buttons[type] === false) { record.panelsHeldSince = performance.now(); record.recoverySent = false; }
            if (!pressed) record.panelsHeldSince = null;
            if (pressed && record.panelsHeldSince !== null && !record.recoverySent && performance.now() - record.panelsHeldSince >= cfg.windowRecoveryHoldMs) {
              queue.push({ type: "recover-panels", record, source }); record.recoverySent = true;
            }
          }
          record.buttons[type] = pressed;
        });
      });
    }

    return {
      records, update,
      drain: () => queue.splice(0).filter(({ record, source }) => record.source === source && record.tracked && session.visibilityState === "visible"),
      reset() { queue.length = 0; records.forEach((r) => { r.squeezing = false; r.buttons = {}; r.selectBlocked = true; r.panelsHeldSince = null; r.suppressSelectUntil = performance.now() + cfg.windowSelectGuardMs; }); },
      flash(record, valid) { record.feedbackUntil = performance.now() + cfg.feedbackMs; record.feedbackValid = valid; },
      feedback(record, distance, valid, invalid = false) {
        if (performance.now() < record.feedbackUntil) { valid = record.feedbackValid; invalid = !valid; }
        record.ray.scale.z = distance || cfg.rayLength;
        record.ray.material.color.setHex(invalid ? 0xff776b : valid ? 0x6cffba : 0xc8dce3);
      },
      dispose() {
        listeners.forEach((off) => off());
        records.forEach(({ node, ray }) => { node.remove(ray); scene.remove(node); ray.geometry.dispose(); ray.material.dispose(); });
        queue.length = 0;
      }
    };
  }
  E.XRInput = { create, mapping };
}());
