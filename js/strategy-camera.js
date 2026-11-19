(function () {
  "use strict";
  // Caméra de stratégie de la version PC : inclinaison et cap fixes, déplacement ZQSD/WASD/flèches
  // ou clic molette, zoom molette centré sur le curseur, interpolation douce et limites.
  // Elle ne touche ni aux règles ni à la sélection ; la VR/MR ne l'utilise jamais.
  const E = window.Eredita = window.Eredita || {};
  const KEY_DIRECTIONS = {
    KeyW: [1, 0], ArrowUp: [1, 0], KeyS: [-1, 0], ArrowDown: [-1, 0],
    KeyD: [0, 1], ArrowRight: [0, 1], KeyA: [0, -1], ArrowLeft: [0, -1]
  };

  function create(THREE, { camera, domElement, isActive, getBounds, getHeight }) {
    const cfg = E.Config.strategyCamera;
    const pitch = THREE.MathUtils.degToRad(cfg.pitchDeg), heading = THREE.MathUtils.degToRad(cfg.headingDeg);
    // Direction cible → caméra : verrouillée, aucune API ne la modifie.
    const toCamera = new THREE.Vector3(Math.sin(heading) * Math.cos(pitch), Math.sin(pitch), Math.cos(heading) * Math.cos(pitch));
    const forward = new THREE.Vector3(-toCamera.x, 0, -toCamera.z).normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const current = { x: 0, z: 0, zoom: 1 }, desired = { x: 0, z: 0, zoom: 1 };
    const keys = new Set();
    const scratch = new THREE.PerspectiveCamera(cfg.fov, 1, 0.1, 400);
    const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    let fit = 20, fitKey = "", lastTime = 0, panning = null, ready = false;

    // Distance qui cadre tout le plateau pour la forme d'écran actuelle.
    function fitDistance(aspect, bounds = getBounds()) {
      const tangent = Math.tan(THREE.MathUtils.degToRad(cfg.fov / 2));
      const up = new THREE.Vector3().crossVectors(right, toCamera).normalize();
      const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
      let distance = 0;
      for (const x of [bounds.minX, bounds.maxX]) for (const y of [-0.1, 1.1]) for (const z of [bounds.minZ, bounds.maxZ]) {
        a.set(x - cx, y, z - cz);
        const depth = a.dot(toCamera);
        distance = Math.max(distance, Math.abs(a.dot(right)) / (tangent * aspect) + depth, Math.abs(a.dot(up)) / tangent + depth);
      }
      return distance * 1.07;
    }

    function refreshFit() {
      const bounds = getBounds();
      const key = `${camera.aspect.toFixed(3)}:${bounds.minX}:${bounds.maxX}:${bounds.minZ}:${bounds.maxZ}`;
      if (key !== fitKey) { fitKey = key; fit = fitDistance(camera.aspect, bounds); }
    }

    function clampState(state) {
      const bounds = getBounds(), m = cfg.panMargin;
      state.x = Math.min(bounds.maxX + m, Math.max(bounds.minX - m, state.x));
      state.z = Math.min(bounds.maxZ + m, Math.max(bounds.minZ - m, state.z));
      state.zoom = Math.min(cfg.zoomMax, Math.max(cfg.zoomMin, state.zoom));
    }

    function poseInto(cam, state) {
      const distance = fit * state.zoom;
      cam.position.set(state.x + toCamera.x * distance, toCamera.y * distance, state.z + toCamera.z * distance);
      const ground = getHeight?.(cam.position.x, cam.position.z);
      if (Number.isFinite(ground) && cam.position.y < ground + cfg.lowestClearance) cam.position.y = ground + cfg.lowestClearance;
      cam.lookAt(state.x, 0, state.z);
      cam.updateMatrixWorld(true);
    }

    function groundPoint(clientX, clientY, cam, out) {
      const rect = domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), cam);
      return raycaster.ray.intersectPlane(plane, out) ? out : null;
    }

    function syncScratch() { scratch.aspect = camera.aspect; scratch.fov = camera.fov; scratch.updateProjectionMatrix(); }

    function reset(animate = false) {
      const bounds = getBounds();
      desired.x = (bounds.minX + bounds.maxX) / 2; desired.z = (bounds.minZ + bounds.maxZ) / 2; desired.zoom = cfg.zoomFit;
      clampState(desired);
      if (!animate) Object.assign(current, desired);
    }

    function centerOn(x, z, zoom) {
      desired.x = x; desired.z = z;
      if (zoom !== undefined) desired.zoom = zoom;
      clampState(desired);
    }

    function update(now) {
      if (!ready) { refreshFit(); reset(false); ready = true; }
      refreshFit();
      const dt = Math.min(0.1, lastTime ? (now - lastTime) / 1000 : 0.016); lastTime = now;
      if (keys.size) {
        let f = 0, r = 0;
        keys.forEach((code) => { const d = KEY_DIRECTIONS[code]; if (d) { f += d[0]; r += d[1]; } });
        const length = Math.hypot(f, r);
        if (length > 0) {
          const speed = cfg.keyboardSpeed * fit * Math.max(0.35, desired.zoom) * (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2 : 1) * dt;
          desired.x += (forward.x * f + right.x * r) / length * speed; desired.z += (forward.z * f + right.z * r) / length * speed;
        }
      }
      clampState(desired);
      const k = 1 - Math.exp(-cfg.smoothing * dt);
      current.x += (desired.x - current.x) * k; current.z += (desired.z - current.z) * k; current.zoom += (desired.zoom - current.zoom) * k;
      if (Math.abs(desired.zoom - current.zoom) < 1e-4) current.zoom = desired.zoom;
      clampState(current);
      poseInto(camera, current);
    }

    // --- Entrées ---
    function typing(event) {
      const t = event.target;
      return Boolean(t?.closest?.("input, select, textarea, [contenteditable=''], [contenteditable='true'], [data-layout-resize]"));
    }
    function blocked() {
      return !isActive() || document.querySelector("dialog[open]") || document.querySelector("#shop-modal")?.hidden === false;
    }
    function onKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented || typing(event) || blocked()) return;
      if (event.code === "Space") {
        if (event.target?.closest?.("button, a, summary, [role='button']")) return;
        event.preventDefault(); reset(true); return;
      }
      if (KEY_DIRECTIONS[event.code] || event.code === "ShiftLeft" || event.code === "ShiftRight") {
        if (KEY_DIRECTIONS[event.code]) {
          if (event.target?.closest?.("button, [role='button'], [role='tab'], [role='listbox']") && event.code.startsWith("Arrow")) return;
          event.preventDefault();
        }
        keys.add(event.code);
      }
    }
    function onKeyUp(event) { keys.delete(event.code); }
    function clearKeys() { keys.clear(); }

    function onWheel(event) {
      if (!isActive()) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      const factor = Math.exp(Math.max(-400, Math.min(400, event.deltaY * unit)) * cfg.wheelSensitivity);
      syncScratch(); refreshFit();
      poseInto(scratch, desired);
      const before = groundPoint(event.clientX, event.clientY, scratch, a);
      const beforeX = before?.x, beforeZ = before?.z;
      desired.zoom = Math.min(cfg.zoomMax, Math.max(cfg.zoomMin, desired.zoom * factor));
      if (before) {
        poseInto(scratch, desired);
        const after = groundPoint(event.clientX, event.clientY, scratch, b);
        if (after) { desired.x += beforeX - after.x; desired.z += beforeZ - after.z; }
      }
      clampState(desired);
    }

    function onPointerDown(event) {
      if (event.button !== 1 || !isActive()) return;
      event.preventDefault();
      syncScratch(); poseInto(scratch, current);
      const start = groundPoint(event.clientX, event.clientY, scratch, a);
      if (!start) return;
      panning = { id: event.pointerId, x: start.x, z: start.z };
      try { domElement.setPointerCapture(event.pointerId); } catch (_) {}
      domElement.style.cursor = "grabbing";
    }
    function onPointerMove(event) {
      if (!panning || panning.id !== event.pointerId) return;
      syncScratch(); poseInto(scratch, current);
      const now = groundPoint(event.clientX, event.clientY, scratch, b);
      if (!now) return;
      // Le point saisi reste sous le curseur : déplacement direct, sans retard.
      desired.x = current.x + panning.x - now.x; desired.z = current.z + panning.z - now.z;
      clampState(desired); current.x = desired.x; current.z = desired.z;
    }
    function endPan(event) {
      if (!panning || (event && panning.id !== event.pointerId)) return;
      try { domElement.releasePointerCapture(panning.id); } catch (_) {}
      panning = null; domElement.style.cursor = "";
    }
    const suppress = (event) => { if (event.button === 1) event.preventDefault(); };

    domElement.addEventListener("wheel", onWheel, { passive: false });
    domElement.addEventListener("pointerdown", onPointerDown);
    domElement.addEventListener("pointermove", onPointerMove);
    domElement.addEventListener("pointerup", endPan);
    domElement.addEventListener("pointercancel", endPan);
    domElement.addEventListener("mousedown", suppress);
    domElement.addEventListener("auxclick", suppress);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", clearKeys);

    function dispose() {
      domElement.removeEventListener("wheel", onWheel); domElement.removeEventListener("pointerdown", onPointerDown);
      domElement.removeEventListener("pointermove", onPointerMove); domElement.removeEventListener("pointerup", endPan);
      domElement.removeEventListener("pointercancel", endPan); domElement.removeEventListener("mousedown", suppress); domElement.removeEventListener("auxclick", suppress);
      window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys); document.removeEventListener("visibilitychange", clearKeys);
    }

    return { update, reset, centerOn, fitDistance, dispose, clearKeys,
      get target() { return { x: current.x, z: current.z }; }, get zoom() { return current.zoom; }, get desiredZoom() { return desired.zoom; },
      get distance() { return fit * current.zoom; }, get fit() { refreshFit(); return fit; },
      get pitchDegrees() { return cfg.pitchDeg; }, get headingDegrees() { return cfg.headingDeg; },
      get settled() { return Math.hypot(desired.x - current.x, desired.z - current.z) < 0.02 && Math.abs(desired.zoom - current.zoom) < 0.002; },
      get panning() { return Boolean(panning); }, setDesired(x, z, zoom) { desired.x = x; desired.z = z; if (zoom !== undefined) desired.zoom = zoom; clampState(desired); },
      get keysDown() { return [...keys]; } };
  }

  E.StrategyCamera = { create };
}());
